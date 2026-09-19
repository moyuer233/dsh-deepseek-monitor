// dsh-deepseek-monitor / lib/service.mjs
//
// 无 cordis 依赖的业务逻辑：token 读取、本地代理统计、平台数据收集。
// 与 index.js（cordis 插件外壳）分离，便于独立测试。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALL_KEYS,
  fetchApiKeys,
  fetchCostByKey,
  fetchSummary,
  fetchUsageByKey,
  summarizeApiKeys,
  summarizeKeyCost,
  summarizeKeyUsage,
  summarizeSummary,
} from "./platform.mjs";

export const TOKEN_FILE =
  process.env.DS_PLATFORM_TOKEN_FILE ??
  path.join(os.homedir(), ".dsh", "deepseek-monitor", "platform-token");

export const USAGE_LOG =
  process.env.DS_MONITOR_LOG ??
  path.join(os.homedir(), ".dsh", "deepseek-monitor", "usage.jsonl");

export const CONFIG_FILE =
  process.env.DS_MONITOR_CONFIG ??
  path.join(os.homedir(), ".dsh", "deepseek-monitor", "config.json");

export const CACHE_FILE =
  process.env.DS_MONITOR_CACHE ??
  path.join(os.homedir(), ".dsh", "deepseek-monitor", "cache.json");

/** 累计（全历史）token 累加的起始月份下限（DeepSeek API 上线时间附近）。 */
const ALLTIME_START = { year: 2024, month: 1 };
const ALLTIME_MAX_MONTHS = 60;

/** 历史月份并发拉取上限：首轮回填几十个月，串行会明显拖慢首次响应。 */
const HISTORY_CONCURRENCY = Math.max(
  1,
  Math.floor(Number(process.env.DS_MONITOR_HISTORY_CONCURRENCY ?? 6) || 6)
);

/**
 * collect() 结果的服务端缓存时长（毫秒）。会话头部与侧边栏是两个组件、多开标签页
 * 又是两份，若每个轮询都直连平台会成倍浪费配额。设 0 关闭缓存。
 */
export const USAGE_TTL_MS = (() => {
  const n = Number(process.env.DS_MONITOR_TTL_MS ?? 30000);
  return Number.isFinite(n) && n >= 0 ? n : 30000; // 非法值回退默认，而不是静默关掉缓存
})();

/**
 * 记账时区偏移（小时）。platform.deepseek.com 的「日」按账户时区（默认东八区）切分，
 * 直接用 UTC 日期会在北京时间 00:00–08:00 之间取到前一天的数据。
 */
export const TZ_OFFSET_HOURS = (() => {
  const n = Number(process.env.DS_MONITOR_TZ_OFFSET ?? 8);
  return Number.isFinite(n) ? n : 8;
})();

/** 按记账时区把时间戳拆成 { year, month, day: "YYYY-MM-DD" }。纯函数，便于测试。 */
export function zonedParts(date = new Date()) {
  const shifted = new Date(date.getTime() + TZ_OFFSET_HOURS * 3600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.toISOString().slice(0, 10),
  };
}

// ── 平台查询窗口（by_api_key 的两个接口收的是秒级窗口）─────────────────────

const tzSec = () => TZ_OFFSET_HOURS * 3600;

/** 记账时区下「今天 00:00」的 epoch 秒。 */
function dayStartSec(date = new Date()) {
  const shifted = new Date(date.getTime() + tzSec() * 1000);
  const midnightUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return Math.floor(midnightUtc / 1000) - tzSec();
}

/** 记账时区下「某月 1 日 00:00」的 epoch 秒。 */
function monthStartSec(year, month) {
  return Math.floor(Date.UTC(year, month - 1, 1) / 1000) - tzSec();
}

/** 记账时区下「某月结束」的 epoch 秒（= 下月 1 日 00:00）。 */
function monthEndSec(year, month) {
  return month === 12 ? monthStartSec(year + 1, 1) : monthStartSec(year, month + 1);
}

function readCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** 临时文件 + rename 的原子写：避免进程被杀时留下半个文件。 */
function writeFileAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, file);
}

function writeCache(cache) {
  writeFileAtomic(CACHE_FILE, JSON.stringify(cache));
}

/** 当前月的上一个月。 */
function prevMonthOf(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** 从 from 往早枚举到 floor（含），最多 max 个月。 */
function enumerateMonths(from, floor, max) {
  const out = [];
  let { year, month } = from;
  while (out.length < max && (year > floor.year || (year === floor.year && month >= floor.month))) {
    out.push({ year, month });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return out;
}

/** 有并发上限的 map，结果顺序与输入一致。 */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * 累计（全历史）用量：2024-01..上月 逐月累加，缓存到上月（跨月或换 Key 才重算）。
 * 费用只在「选了具体 Key」时才需要逐月拉（全部 Key 时用账户汇总的权威值）。
 */
async function computeAlltimeHistory(token, keyId) {
  const { year, month } = zonedParts();
  const prev = prevMonthOf(year, month);
  const cacheKey = `${prev.year}-${prev.month}|${keyId}`;

  const cache = readCache();
  if (typeof cache.historyTokens === "number" && cache.historyKey === cacheKey) {
    return { tokens: cache.historyTokens, cost: Number(cache.historyCost) || 0 };
  }

  const months = enumerateMonths(prev, ALLTIME_START, ALLTIME_MAX_MONTHS);
  const needCost = keyId !== ALL_KEYS;
  const pages = await mapLimit(months, HISTORY_CONCURRENCY, async (m) => {
    const window = { start: monthStartSec(m.year, m.month), end: monthEndSec(m.year, m.month), tz: tzSec() };
    const amount = await fetchUsageByKey(token, window);
    const cost = needCost ? await fetchCostByKey(token, window) : null;
    return { amount, cost };
  });

  let tokens = 0;
  let cost = 0;
  for (const page of pages) {
    tokens += summarizeKeyUsage(page.amount, keyId).total;
    if (needCost) cost += summarizeKeyCost(page.cost, keyId);
  }
  writeCache({ historyKey: cacheKey, historyTokens: tokens, historyCost: cost });
  return { tokens, cost };
}

/** 读取 UI 配置（跨启动持久化，与应用端口无关）。 */
export function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    /* 损坏则视为无配置 */
  }
  return null;
}

/** 写入 UI 配置（原子落盘）。 */
export function writeConfig(cfg) {
  writeFileAtomic(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  return cfg;
}

/** UI 里选中的 API Key；未配置或配置损坏时用「全部」。 */
export function selectedKeyId() {
  const v = readConfig()?.keyTrackingId;
  return typeof v === "string" && v !== "" ? v : ALL_KEYS;
}

/** 读取平台 token：环境变量优先，其次 ~/.dsh/deepseek-monitor/platform-token。 */
export function readToken() {
  if (process.env.DS_PLATFORM_TOKEN) return process.env.DS_PLATFORM_TOKEN.trim();
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const token = fs.readFileSync(TOKEN_FILE, "utf8").trim();
      if (token) return token;
    }
  } catch {
    /* 读取失败视为无 token */
  }
  return null;
}

/** 写入平台 token（原子落盘；UI 一键保存用，立即生效无需重启）。 */
export function writeToken(token) {
  const value = String(token ?? "")
    .replace(/^['"`\s]+|['"`\s]+$/g, "")
    .trim();
  if (!value) throw new Error("token 为空");
  writeFileAtomic(TOKEN_FILE, value);
  return value;
}

const emptyLocalStats = () => ({ records: 0, inputTokens: 0, outputTokens: 0, costCny: 0 });

/** 磁盘上的字段可能是字符串（手改或旧版本写的），一律强制成数字，避免 += 退化成字符串拼接。 */
const numOf = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// 增量游标：只解析新追加的完整行，避免每次轮询都重读整个 JSONL。
// 日志只增不减，长期运行后文件会很大，全量重解析是 O(文件大小) 的无谓开销。
let localCursor = { offset: 0, ino: 0, stats: emptyLocalStats() };

function accumulateLocalStats(stats, text) {
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let r;
    try {
      r = JSON.parse(t);
    } catch {
      continue; // 跳过坏行
    }
    if (r?.kind !== "messages" && r?.kind !== "count_tokens") continue;
    stats.records += 1;
    stats.inputTokens += numOf(r.inputTokens);
    stats.outputTokens += numOf(r.outputTokens);
    stats.costCny += numOf(r.totalCostCny);
  }
}

/** 全量统计一个记账文件（用来把轮转出去的那一代计入基线）。 */
function statsOfFile(file) {
  const stats = emptyLocalStats();
  try {
    accumulateLocalStats(stats, fs.readFileSync(file, "utf8"));
  } catch {
    /* 不存在或不可读：当作空 */
  }
  return stats;
}

/** 本地代理（dsm-proxy）记账统计：{ records, inputTokens, outputTokens, costCny }（增量解析）。 */
export function readLocalStats() {
  let st;
  try {
    st = fs.statSync(USAGE_LOG);
  } catch {
    localCursor = { offset: 0, ino: 0, stats: emptyLocalStats() };
    return emptyLocalStats();
  }

  // 文件被轮转（换了 inode）或截断（变小）：游标作废，从基线重新统计。
  // 基线取轮转出去的那一代（<log>.1），否则日志一轮转面板上的本地统计就归零。
  const rotated = localCursor.ino !== 0 && st.ino !== 0 && localCursor.ino !== st.ino;
  if (rotated || st.size < localCursor.offset) {
    localCursor = { offset: 0, ino: st.ino || 0, stats: statsOfFile(`${USAGE_LOG}.1`) };
  } else if (localCursor.ino === 0) {
    localCursor.ino = st.ino || 0;
  }

  if (st.size > localCursor.offset) {
    let fd;
    try {
      fd = fs.openSync(USAGE_LOG, "r");
      const len = st.size - localCursor.offset;
      const buf = Buffer.allocUnsafe(len);
      const read = fs.readSync(fd, buf, 0, len, localCursor.offset);
      const text = buf.toString("utf8", 0, read);
      const lastNewline = text.lastIndexOf("\n");
      if (lastNewline >= 0) {
        // 只吃整行，尾部半行留给下一次（写入中的行不算数）。
        const complete = text.slice(0, lastNewline);
        accumulateLocalStats(localCursor.stats, complete);
        localCursor.offset += Buffer.byteLength(complete, "utf8") + 1; // +1 = "\n"
      }
    } catch {
      /* 读取失败则保持上次统计 */
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  }
  return { ...localCursor.stats };
}

/** 检测本地用量代理是否在运行（healthz，短超时）。 */
export async function checkProxyHealth() {
  const host = process.env.DS_MONITOR_HOST ?? "127.0.0.1";
  const port = Number(process.env.DS_MONITOR_PORT ?? 8899);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 800);
  try {
    const res = await fetch(`http://${host}:${port}/healthz`, { signal: controller.signal });
    return res.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** 真正采集一次（未命中缓存时调用）；token 由调用方读出。 */
async function doCollect(token) {
  const base = {
    local: readLocalStats(),
    localEnabled: await checkProxyHealth(),
    fetchedAt: new Date().toISOString(),
  };
  if (!token) {
    return {
      ...base,
      ok: false,
      error: "NO_TOKEN",
      hint: `把 platform.deepseek.com 的 userToken 写入 ${TOKEN_FILE}`,
    };
  }

  const keyId = selectedKeyId();
  const { year, month } = zonedParts();
  const tz = tzSec();
  // 平台接口要求窗口按「日边界」对齐：end 必须是"结束日的次日零点"（平台前端 mh() 就是
  // `mu(endDate,t) + 86400`）。传"此刻"会被回 INVALID_PARAM。
  const dayStart = dayStartSec();
  const windowEnd = dayStart + 86400;

  try {
    const [summary, keysBiz, todayAmount, todayCost, monthAmount, monthCost] = await Promise.all([
      fetchSummary(token),
      // Key 列表只喂给 UI 选择器：它拿不到不该拖垮主数据
      fetchApiKeys(token).catch(() => null),
      fetchUsageByKey(token, { start: dayStart, end: windowEnd, tz }),
      fetchCostByKey(token, { start: dayStart, end: windowEnd, tz }),
      fetchUsageByKey(token, { start: monthStartSec(year, month), end: windowEnd, tz }),
      fetchCostByKey(token, { start: monthStartSec(year, month), end: windowEnd, tz }),
    ]);

    const monthTokens = summarizeKeyUsage(monthAmount, keyId).total;
    const monthUsage = { tokens: monthTokens, cost: summarizeKeyCost(monthCost, keyId) };
    const today = { ...summarizeKeyUsage(todayAmount, keyId), cost: summarizeKeyCost(todayCost, keyId) };

    // 累计：token 逐月回填历史；费用在「全部 Key」时直接取账户汇总（权威值），
    // 选了具体 Key 时账户汇总不适用，只能逐月累加。
    // 逐月那一步单独 try/catch：任何一个月出错都不该连坐余额/今日/本月，
    // 失败时 alltime 置 null（UI 显示「—」而不是假 0）并带 alltimeError。
    const accountTotalCost = Number(summary?.total_costs?.[0]?.amount ?? 0) || 0;
    let alltime = null;
    let alltimeError = null;
    try {
      const history = await computeAlltimeHistory(token, keyId);
      alltime = {
        tokens: history.tokens + monthTokens,
        cost: keyId === ALL_KEYS ? accountTotalCost : history.cost + monthUsage.cost,
      };
    } catch (e) {
      alltimeError = String(e?.message ?? e);
    }

    return {
      ...base,
      ok: true,
      source: "platform",
      key: keyId,
      keys: summarizeApiKeys(keysBiz),
      summary: summarizeSummary(summary),
      month: `${year}-${String(month).padStart(2, "0")}`,
      monthUsage,
      today,
      alltime,
      alltimeError,
    };
  } catch (e) {
    return {
      ...base,
      ok: false,
      error: "FETCH_FAILED",
      message: String(e?.message ?? e),
    };
  }
}

// ── 采集缓存（TTL + 单飞）─────────────────────────────────────────────────

let usageCache = { key: null, at: 0, data: null };
let usageInflight = null;

/** 缓存/单飞的键：换 token 或换 Key 都必须视为不同结果。 */
function residentKey() {
  return `${readToken() ?? ""}|${selectedKeyId()}`;
}

/**
 * 收集一次完整数据（平台 + 本地），失败时返回带错误标记的结构。
 *
 * - 同一 token + Key 的结果在 `USAGE_TTL_MS` 内复用；
 * - 同时到达的并发请求合并成一次上游采集（single-flight）；
 * - `{ force: true }` 绕过缓存（UI 的「刷新」按钮走这条）。
 *
 * @param {{ force?: boolean }} [opts]
 */
export async function collect(opts = {}) {
  const key = residentKey();
  const force = opts.force === true || USAGE_TTL_MS <= 0;

  if (!force && usageCache.data && usageCache.key === key && Date.now() - usageCache.at < USAGE_TTL_MS) {
    return usageCache.data;
  }
  if (usageInflight && usageInflight.key === key) return usageInflight.promise;

  const promise = doCollect(readToken()).then(
    (data) => {
      usageCache = { key, at: Date.now(), data };
      usageInflight = null;
      return data;
    },
    (err) => {
      usageInflight = null;
      throw err;
    }
  );
  usageInflight = { key, promise };
  return promise;
}

/** 仅供测试：清空 collect() 的进程内缓存与记账增量游标。 */
export function resetResidentState() {
  usageCache = { key: null, at: 0, data: null };
  usageInflight = null;
  localCursor = { offset: 0, ino: 0, stats: emptyLocalStats() };
}
