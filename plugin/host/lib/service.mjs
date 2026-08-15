// @local/dsh-host-deepseek-usage / lib/service.mjs
//
// 无 cordis 依赖的业务逻辑：token 读取、本地代理统计、平台数据收集。
// 与 index.js（cordis 插件外壳）分离，便于独立测试。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  fetchSummary,
  fetchMonthlyUsage,
  fetchMonthlyCost,
  summarizeSummary,
  summarizeToday,
  summarizeMonth,
  summarizeDayUsage,
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
const ALLTIME_START_YEAR = 2024;
const ALLTIME_MAX_MONTHS = 60;

function readCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  const tmp = `${CACHE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache), "utf8");
  fs.renameSync(tmp, CACHE_FILE);
}

/**
 * 累计 token：当前月（新鲜） + 历史月份累加（缓存到上月，跨月才重算）。
 * 历史月份按 2024-01..上月 逐月调用 /usage/amount 汇总。
 */
async function computeAlltimeTokens(token, monthTokens) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const cache = readCache();
  let history = cache.historyTokens;
  if (
    typeof history !== "number" ||
    cache.historyYear !== prevYear ||
    cache.historyMonth !== prevMonth
  ) {
    history = 0;
    let y = prevYear;
    let mo = prevMonth;
    let guard = 0;
    while (guard < ALLTIME_MAX_MONTHS && y >= ALLTIME_START_YEAR) {
      const usage = await fetchMonthlyUsage(token, mo, y);
      for (const day of usage?.days ?? []) history += summarizeDayUsage(day).total;
      guard += 1;
      mo -= 1;
      if (mo === 0) {
        mo = 12;
        y -= 1;
      }
    }
    writeCache({ historyYear: prevYear, historyMonth: prevMonth, historyTokens: history });
  }
  return history + monthTokens;
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
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  const tmp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), "utf8");
  fs.renameSync(tmp, CONFIG_FILE);
  return cfg;
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
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  const tmp = `${TOKEN_FILE}.tmp`;
  fs.writeFileSync(tmp, value, "utf8");
  fs.renameSync(tmp, TOKEN_FILE);
  return value;
}

/** 本地代理（dsm-proxy）记账统计：{ records, inputTokens, outputTokens, costCny }。 */
export function readLocalStats() {
  try {
    if (!fs.existsSync(USAGE_LOG)) return { records: 0, inputTokens: 0, outputTokens: 0, costCny: 0 };
    let records = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let costCny = 0;
    for (const line of fs.readFileSync(USAGE_LOG, "utf8").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const r = JSON.parse(t);
        if (r.kind !== "messages" && r.kind !== "count_tokens") continue;
        records += 1;
        inputTokens += r.inputTokens ?? 0;
        outputTokens += r.outputTokens ?? 0;
        costCny += r.totalCostCny ?? 0;
      } catch {
        /* 跳过坏行 */
      }
    }
    return { records, inputTokens, outputTokens, costCny };
  } catch {
    return { records: 0, inputTokens: 0, outputTokens: 0, costCny: 0 };
  }
}

/** 收集一次完整数据（平台 + 本地），失败时返回带错误标记的结构。 */
export async function collect() {
  const base = { local: readLocalStats(), fetchedAt: new Date().toISOString() };
  const token = readToken();
  if (!token) {
    return {
      ...base,
      ok: false,
      error: "NO_TOKEN",
      hint: `把 platform.deepseek.com 的 userToken 写入 ${TOKEN_FILE}`,
    };
  }
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const [summary, usage, cost] = await Promise.all([
      fetchSummary(token),
      fetchMonthlyUsage(token, month, year),
      fetchMonthlyCost(token, month, year),
    ]);
    const today = now.toISOString().slice(0, 10);
    const monthUsage = summarizeMonth(usage, cost);
    const alltimeCost = Number(summary?.total_costs?.[0]?.amount ?? 0) || 0;
    const alltimeTokens = await computeAlltimeTokens(token, monthUsage.tokens);
    return {
      ...base,
      ok: true,
      source: "platform",
      summary: summarizeSummary(summary),
      month: `${year}-${String(month).padStart(2, "0")}`,
      monthUsage,
      today: summarizeToday(usage, cost, today),
      alltime: { tokens: alltimeTokens, cost: alltimeCost },
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
