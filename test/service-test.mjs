// dsh-deepseek-monitor 宿主自测：mock 平台 API + 临时 token/记账文件，
// 验证按 Key 聚合、累计降级、时区、采集缓存与记账增量解析。
// 运行：node test/service-test.mjs

import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsm-host-test-"));
const tokenFile = path.join(tmp, "platform-token");
const logFile = path.join(tmp, "usage.jsonl");
const cfgFile = path.join(tmp, "config.json");
const cacheFile = path.join(tmp, "cache.json");
fs.writeFileSync(tokenFile, "  test-platform-token  \n", "utf8");
fs.writeFileSync(
  logFile,
  [
    JSON.stringify({ kind: "messages", streaming: true, model: "deepseek-chat", status: 200, inputTokens: 1000, outputTokens: 500, totalCostCny: 0.000895 }),
    JSON.stringify({ kind: "models", model: "deepseek-chat", status: 200 }),
    "not json",
  ].join("\n") + "\n",
  "utf8"
);
process.env.DS_PLATFORM_TOKEN_FILE = tokenFile;
process.env.DS_MONITOR_LOG = logFile;
process.env.DS_MONITOR_CONFIG = cfgFile;
process.env.DS_MONITOR_CACHE = cacheFile;
// 把记账文件上限压到 1 字节，好在用例里触发一次轮转（logger.mjs 在加载时读取该值）
process.env.DS_MONITOR_LOG_MAX_BYTES = "1";
// 固定一个不可能有代理的端口，保证 localEnabled 断言确定
process.env.DS_MONITOR_PORT = "1";
process.env.DS_MONITOR_HOST = "127.0.0.1";

const {
  collect,
  readLocalStats,
  readConfig,
  writeConfig,
  writeToken,
  readToken,
  resetResidentState,
  zonedParts,
  TZ_OFFSET_HOURS,
} = await import("../lib/service.mjs");

// ── 记账时区口径（测试按规格自己算，不依赖被测实现的私有函数）────────────
const TZ = TZ_OFFSET_HOURS * 3600;
const bj = new Date(Date.now() + TZ * 1000);
const { year: currentYear, month: currentMonth } = zonedParts();
const dayStart = Math.floor(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate()) / 1000) - TZ;
const monthStart = Math.floor(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), 1) / 1000) - TZ;
const historyStart = Math.floor(Date.UTC(2024, 0, 1) / 1000) - TZ;
// 每月 1 号时"今日窗口"与"本月窗口"起点相同，两者数据必然一致
const sameWindow = dayStart === monthStart;

// ── 两个 Key 与各自的用量 ────────────────────────────────────────────────
const KEY_A = { id: "track-a", name: "KeyA" };
const KEY_B = { id: "track-b", name: "KeyB" };
const TODAY = { A: { hit: 600, miss: 300, resp: 100, cost: 0.01 }, B: { hit: 200, miss: 200, resp: 100, cost: 0.005 } };
const MONTH = { A: { hit: 1200, miss: 600, resp: 200, cost: 0.02 }, B: { hit: 400, miss: 200, resp: 100, cost: 0.007 } };
const HISTORY_2024_01 = { A: { hit: 10, miss: 0, resp: 0, cost: 1 }, B: { hit: 1, miss: 0, resp: 0, cost: 0.1 } };
const ACCOUNT_TOTAL_COST = 0.5;

const pick = (p, k) => (sameWindow ? (k === "day" ? MONTH : MONTH) : TODAY);
const tokOf = (p) => p.hit + p.miss + p.resp;

// 由用例控制：让某一个历史月份报错，验证它不会连坐其余数据
let failHistoryMonth = null;

const mock = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const start = Number(url.searchParams.get("start"));
  const json = (o) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ code: 0, data: { biz_code: 0, biz_data: o } }));
  };

  if (url.pathname === "/api/v0/users/get_user_summary") {
    return json({
      normal_wallets: [{ balance: "12.34" }],
      bonus_wallets: [{ balance: "1.00" }],
      total_costs: [{ currency: "CNY", amount: String(ACCOUNT_TOTAL_COST) }],
    });
  }
  if (url.pathname === "/api/v0/users/get_api_keys") {
    return json({ api_keys: [{ tracking_id: KEY_A.id, name: KEY_A.name }, { tracking_id: KEY_B.id, name: KEY_B.name }] });
  }

  const isCost = url.pathname === "/api/v0/usage/by_api_key/cost";
  if (url.pathname === "/api/v0/usage/by_api_key/amount" || isCost) {
    if (failHistoryMonth) {
      const mStart = Math.floor(Date.UTC(failHistoryMonth.year, failHistoryMonth.month - 1, 1) / 1000) - TZ;
      if (start === mStart) {
        res.writeHead(500, { "content-type": "application/json" });
        return res.end(JSON.stringify({ code: 1, msg: "history month unavailable" }));
      }
    }
    // 本月窗口 → MONTH；今日窗口 → TODAY；2024-01 → 固定历史；其余月份 → 空
    let group = null;
    if (start === monthStart) group = MONTH;
    else if (start === dayStart) group = TODAY;
    else if (start === historyStart) group = HISTORY_2024_01;

    const usageOf = (p) => ({
      PROMPT_TOKEN: 0,
      PROMPT_CACHE_HIT_TOKEN: p.hit,
      PROMPT_CACHE_MISS_TOKEN: p.miss,
      RESPONSE_TOKEN: p.resp,
      REQUEST: 1,
    });
    const seriesOf = (key, p) => ({
      api_key: { tracking_id: key.id, name: key.name, valid: true, key_type: "NORMAL" },
      model: "deepseek-chat",
      buckets: isCost ? [{ time: start, cost: String(p.cost) }] : [{ time: start, usage: usageOf(p) }],
    });
    const series = group ? [seriesOf(KEY_A, group.A), seriesOf(KEY_B, group.B)] : [];
    if (isCost) {
      return json({ start, end: start + 3600, bucket: 3600, models: ["deepseek-chat"], data: [{ currency: "CNY", series }] });
    }
    return json({ start, end: start + 3600, bucket: 3600, models: ["deepseek-chat"], series });
  }

  res.writeHead(404);
  res.end("{}");
});

await new Promise((r) => mock.listen(0, "127.0.0.1", r));
process.env.DS_PLATFORM_BASE = `http://127.0.0.1:${mock.address().port}/api/v0`;

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures += 1;
    console.log(`  ❌ ${name} ${extra}`);
  }
};

console.log(`\n[dsh-deepseek-monitor] service self-test (mock :${mock.address().port})`);

const expTodayAll = (sameWindow ? tokOf(MONTH.A) + tokOf(MONTH.B) : tokOf(TODAY.A) + tokOf(TODAY.B));

// ── 1. 默认「全部 Key」 ───────────────────────────────────────────────────
resetResidentState();
fs.rmSync(cfgFile, { force: true });
fs.rmSync(cacheFile, { force: true });
const all = await collect();
check("collect ok", all.ok === true, JSON.stringify(all).slice(0, 200));
check("默认 key = all", all.key === "all", String(all.key));
check("Key 列表有 2 个", Array.isArray(all.keys) && all.keys.length === 2, JSON.stringify(all.keys));
check("余额=12.34", all.summary?.balance === 12.34);
check("赠送=1.00", all.summary?.bonusBalance === 1);
check(`今日 total = ${expTodayAll}`, all.today?.total === expTodayAll, JSON.stringify(all.today));
check("今日 completion 正确", all.today?.completion === (sameWindow ? MONTH.A.resp + MONTH.B.resp : TODAY.A.resp + TODAY.B.resp));
check(`本月 token = ${tokOf(MONTH.A) + tokOf(MONTH.B)}`, all.monthUsage?.tokens === tokOf(MONTH.A) + tokOf(MONTH.B), JSON.stringify(all.monthUsage));
check("本月费用 = 0.027", Math.abs(all.monthUsage?.cost - 0.027) < 1e-9, String(all.monthUsage?.cost));
check("本月标签", all.month === `${currentYear}-${String(currentMonth).padStart(2, "0")}`, String(all.month));
check("累计费用 = 账户汇总 0.5（全部 Key 取权威值）", Math.abs(all.alltime?.cost - ACCOUNT_TOTAL_COST) < 1e-9, String(all.alltime?.cost));
check(
  `累计 token = 历史(11) + 本月(${tokOf(MONTH.A) + tokOf(MONTH.B)})`,
  all.alltime?.tokens === 11 + tokOf(MONTH.A) + tokOf(MONTH.B),
  String(all.alltime?.tokens)
);

// ── 2. 只选 KeyA / KeyB ──────────────────────────────────────────────────
writeConfig({ balance: true, lang: "zh", keyTrackingId: KEY_A.id });
resetResidentState();
const onlyA = await collect();
const expTodayA = sameWindow ? tokOf(MONTH.A) : tokOf(TODAY.A);
check("选中 KeyA 后 key = track-a", onlyA.key === KEY_A.id, String(onlyA.key));
check(`KeyA 今日 total = ${expTodayA}`, onlyA.today?.total === expTodayA, JSON.stringify(onlyA.today));
check("KeyA 今日费用 = 0.01", Math.abs(onlyA.today?.cost - 0.01) < 1e-9, String(onlyA.today?.cost));
check(`KeyA 本月 token = ${tokOf(MONTH.A)}`, onlyA.monthUsage?.tokens === tokOf(MONTH.A), String(onlyA.monthUsage?.tokens));
check("KeyA 本月费用 = 0.02", Math.abs(onlyA.monthUsage?.cost - 0.02) < 1e-9, String(onlyA.monthUsage?.cost));
check("KeyA 累计 token = 10 + 本月", onlyA.alltime?.tokens === 10 + tokOf(MONTH.A), String(onlyA.alltime?.tokens));
check("KeyA 累计费用 = 历史 1 + 本月 0.02（不用账户汇总）", Math.abs(onlyA.alltime?.cost - 1.02) < 1e-9, String(onlyA.alltime?.cost));

resetResidentState();
writeConfig({ keyTrackingId: KEY_B.id });
const onlyB = await collect();
check(`KeyB 本月 token = ${tokOf(MONTH.B)}`, onlyB.monthUsage?.tokens === tokOf(MONTH.B), String(onlyB.monthUsage?.tokens));
check("换 Key 后累计 token = 1 + 本月", onlyB.alltime?.tokens === 1 + tokOf(MONTH.B), String(onlyB.alltime?.tokens));

// ── 3. 采集缓存（TTL + 单飞）─────────────────────────────────────────────
resetResidentState();
writeConfig({ keyTrackingId: "all" });
const first = await collect();
const again = await collect();
check("TTL 缓存：重复 collect 复用同一结果", again === first);
const forced = await collect({ force: true });
check("force 绕过缓存", forced !== first && forced.ok === true);
const [sf1, sf2] = await Promise.all([collect({ force: true }), collect({ force: true })]);
check("单飞：并发 force 合并成一次采集", sf1 === sf2);

// ── 4. 单个历史月份失败不应连坐其余数据 ──────────────────────────────────
resetResidentState();
fs.rmSync(cacheFile, { force: true });
const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
failHistoryMonth = { year: prevYear, month: prevMonth };
const partial = await collect({ force: true });
failHistoryMonth = null;
check("单月失败：整体仍 ok", partial.ok === true, `ok=${partial.ok} error=${partial.error}`);
check("单月失败：余额仍在", partial.summary?.balance === 12.34, JSON.stringify(partial.summary));
check("单月失败：今日数据仍在", partial.today?.total === expTodayAll, JSON.stringify(partial.today));
check("单月失败：alltime 置 null（UI 显示「—」而非假 0）", partial.alltime === null, JSON.stringify(partial.alltime));
check("单月失败：带 alltimeError 供排查", typeof partial.alltimeError === "string" && partial.alltimeError.length > 0, JSON.stringify(partial.alltimeError));

// ── 5. 无 token 分支 ─────────────────────────────────────────────────────
fs.rmSync(tokenFile, { force: true });
delete process.env.DS_PLATFORM_TOKEN;
resetResidentState();
const noToken = await collect();
check("无 token → NO_TOKEN", noToken.ok === false && noToken.error === "NO_TOKEN");
check("无 token → 有提示", typeof noToken.hint === "string" && noToken.hint.length > 0);
writeToken("  new-token-abc  ");
check("writeToken 后 readToken 返回新值", readToken() === "new-token-abc", JSON.stringify(readToken()));

// ── 6. 配置读写 ─────────────────────────────────────────────────────────
fs.rmSync(cfgFile, { force: true });
check("初始无配置", readConfig() === null);
writeConfig({ balance: false, lang: "en", keyTrackingId: "track-a" });
const savedCfg = readConfig();
check("配置写后读回", savedCfg?.balance === false && savedCfg?.lang === "en" && savedCfg?.keyTrackingId === "track-a", JSON.stringify(savedCfg));

// ── 7. 记账时区（回归：UTC 日期在北京时间 00:00–08:00 会取到前一天）──────
check("默认时区偏移 = +8", TZ_OFFSET_HOURS === 8, `got ${TZ_OFFSET_HOURS}`);
const p1 = zonedParts(new Date("2026-09-16T19:00:00.000Z"));
check("UTC 19:00 → 北京次日", p1.day === "2026-09-17" && p1.month === 9, JSON.stringify(p1));
const p2 = zonedParts(new Date("2026-09-16T15:59:00.000Z"));
check("UTC 15:59 → 北京当日", p2.day === "2026-09-16", JSON.stringify(p2));
const p3 = zonedParts(new Date("2025-12-31T16:00:00.000Z"));
check("跨年 → 2026-01-01", p3.day === "2026-01-01" && p3.year === 2026 && p3.month === 1, JSON.stringify(p3));

// ── 8. 记账增量解析（只吃整行、截断后重算）──────────────────────────────
resetResidentState();
const s1 = readLocalStats();
check("增量：首轮 1 条", s1.records === 1 && s1.inputTokens === 1000, JSON.stringify(s1));
fs.appendFileSync(logFile, JSON.stringify({ kind: "messages", inputTokens: 10, outputTokens: 5, totalCostCny: 0.001 }) + "\n");
const s2 = readLocalStats();
check("增量：追加整行后 2 条", s2.records === 2 && s2.inputTokens === 1010, JSON.stringify(s2));
fs.appendFileSync(logFile, JSON.stringify({ kind: "messages", inputTokens: 999, outputTokens: 0, totalCostCny: 0 }));
const s3 = readLocalStats();
check("增量：未写完的半行不计入", s3.records === 2 && s3.inputTokens === 1010, JSON.stringify(s3));
fs.appendFileSync(logFile, "\n");
const s4 = readLocalStats();
check("增量：补上换行后计入", s4.records === 3 && s4.inputTokens === 2009, JSON.stringify(s4));
fs.writeFileSync(logFile, JSON.stringify({ kind: "count_tokens", inputTokens: 7, outputTokens: 0, totalCostCny: 0 }) + "\n");
const s5 = readLocalStats();
check("增量：文件截断后从头重算", s5.records === 1 && s5.inputTokens === 7, JSON.stringify(s5));

// ── 9. 日志轮转 ─────────────────────────────────────────────────────────
const { appendRecord, readRecords } = await import("../lib/logger.mjs");
const rotLog = path.join(tmp, "rotate.jsonl");
fs.writeFileSync(rotLog, JSON.stringify({ kind: "messages", inputTokens: 5, outputTokens: 0, totalCostCny: 0 }) + "\n", "utf8");
appendRecord(rotLog, { kind: "messages", inputTokens: 7, outputTokens: 0, totalCostCny: 0 });
check("轮转：生成了 .1 那一代", fs.existsSync(`${rotLog}.1`));
check("轮转：readRecords 两代都读到", readRecords(rotLog).length === 2, String(readRecords(rotLog).length));

// ── 10. DS_MONITOR_TTL_MS 非法值回退 ─────────────────────────────────────
const { spawn } = await import("node:child_process");
const ttlFor = (val) =>
  new Promise((resolve) => {
    const env = { ...process.env };
    delete env.DS_MONITOR_TTL_MS;
    if (val !== undefined) env.DS_MONITOR_TTL_MS = val;
    const child = spawn(
      process.execPath,
      ["--input-type=module", "-e", "const m = await import('./lib/service.mjs'); console.log(m.USAGE_TTL_MS);"],
      { cwd: path.resolve(import.meta.dirname, ".."), env, stdio: ["ignore", "pipe", "pipe"] }
    );
    let out = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.on("close", () => resolve(out.trim()));
  });
const ttlUnset = await ttlFor(undefined);
const ttlZero = await ttlFor("0");
const ttlBad = await ttlFor("abc");
check("TTL 未设置 → 30000", ttlUnset === "30000", ttlUnset);
check("TTL=0 → 0（显式关缓存，属正常）", ttlZero === "0", ttlZero);
check("TTL=abc（非法）→ 回退 30000", ttlBad === "30000", ttlBad);

mock.closeAllConnections?.();
mock.close();
fs.rmSync(tmp, { recursive: true, force: true });

console.log(failures === 0 ? "\n全部通过 ✅" : `\n${failures} 项失败 ❌`);
process.exitCode = failures === 0 ? 0 : 1;
