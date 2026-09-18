// dsh-deepseek-monitor 宿主自测：mock 平台 API + 临时 token/记账文件，
// 验证 collect() 的解析与聚合。
// 运行：node test/service-test.mjs

import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsm-host-test-"));
const tokenFile = path.join(tmp, "platform-token");
const logFile = path.join(tmp, "usage.jsonl");
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
process.env.DS_MONITOR_CONFIG = path.join(tmp, "config.json");
process.env.DS_MONITOR_CACHE = path.join(tmp, "cache.json");
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

// 平台按账户时区（默认 UTC+8）分桶，测试也用同一口径算「今天 / 本月」，
// 否则断言会随运行时刻（UTC 与北京日期不同的那 8 小时）漂移。
const { year: currentYear, month: currentMonth, day: today } = zonedParts();
const dayEntry = (date, usage, cost) => ({
  date,
  data: [
    { model: "deepseek-chat", usage },
    ...(cost ? [{ model: "deepseek-chat", usage: [{ amount: String(cost) }] }] : []),
  ],
});

// ── mock 平台 API ──────────────────────────────────────────────────────────

// 由用例控制：让某一个历史月份报错，用于验证它不会连坐其余数据
let failHistoryMonth = null;

const mock = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  // 故障注入放最前：writeHead 只能调一次，放到下面分支里会 ERR_HTTP_HEADERS_SENT
  if (failHistoryMonth && url.pathname === "/api/v0/usage/amount") {
    const mo = Number(url.searchParams.get("month"));
    const yr = Number(url.searchParams.get("year"));
    if (mo === failHistoryMonth.month && yr === failHistoryMonth.year) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ code: 1, msg: "history month unavailable" }));
      return;
    }
  }
  res.writeHead(200, { "content-type": "application/json" });
  const wrap = (bizData) => JSON.stringify({ code: 0, data: { biz_code: 0, biz_data: bizData } });
  if (url.pathname === "/api/v0/users/get_user_summary") {
    res.end(
      wrap({
        normal_wallets: [{ balance: "12.34" }],
        bonus_wallets: [{ balance: "1.00" }],
        total_costs: [{ currency: "CNY", amount: "0.50" }],
      })
    );
  } else if (url.pathname === "/api/v0/usage/amount") {
    const mo = Number(url.searchParams.get("month"));
    const yr = Number(url.searchParams.get("year"));
    // 非当前月份返回 31 天零数据（模拟真实平台对账户开立前月份的行为，让累计循环真正执行）
    if (mo !== currentMonth || yr !== currentYear) {
      const zeroDays = [];
      for (let d = 1; d <= 31; d += 1) {
        zeroDays.push({
          date: `${yr}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
          data: [{ model: "deepseek-chat", usage: [{ type: "PROMPT_TOKEN", amount: "0" }] }],
        });
      }
      res.end(wrap({ days: zeroDays }));
      return;
    }
    res.end(
      wrap({
        days: [
          dayEntry(today, [
            { type: "PROMPT_TOKEN", amount: "1000" },
            { type: "PROMPT_CACHE_HIT_TOKEN", amount: "200" },
            { type: "PROMPT_CACHE_MISS_TOKEN", amount: "300" },
            { type: "RESPONSE_TOKEN", amount: "500" },
          ]),
          dayEntry(`${currentYear}-${String(currentMonth).padStart(2, "0")}-01`, [{ type: "PROMPT_TOKEN", amount: "10" }]),
        ],
      })
    );
  } else if (url.pathname === "/api/v0/usage/cost") {
    res.end(wrap({ days: [dayEntry(today, [], 0.012345)] }));
  } else {
    res.writeHead(404);
    res.end("{}");
  }
});

await new Promise((r) => mock.listen(0, "127.0.0.1", r));
process.env.DS_PLATFORM_BASE = `http://127.0.0.1:${mock.address().port}/api/v0`;

const { summarizeDayUsage } = await import("../lib/platform.mjs");

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures += 1;
    console.log(`  ❌ ${name} ${extra}`);
  }
};

console.log(`\n[dsh-deepseek-monitor] service self-test (mock :${mock.address().port})`);

const data = await collect();
check("collect ok", data.ok === true, JSON.stringify(data));
check("本地代理未启用(localEnabled=false)", data.localEnabled === false, `got ${data.localEnabled}`);
check("余额=12.34", data.summary?.balance === 12.34);
check("赠送=1.00", data.summary?.bonusBalance === 1);
check("本月token=2000+10=2010", data.monthUsage?.tokens === 2010, `got ${data.monthUsage?.tokens}`);
check("本月费用=0.012345", Math.abs(data.monthUsage?.cost - 0.012345) < 1e-9, `got ${data.monthUsage?.cost}`);
check("今日prompt=1500 (含缓存)", data.today?.prompt === 1500, `got ${data.today?.prompt}`);
check("今日completion=500", data.today?.completion === 500);
check("今日cacheHit=200", data.today?.cacheHit === 200);
check("今日cacheMiss=300", data.today?.cacheMiss === 300);
check("今日total=2000", data.today?.total === 2000);
check("今日费用≈0.012345", Math.abs(data.today?.cost - 0.012345) < 1e-9);
check("本月标签", data.month === `${currentYear}-${String(currentMonth).padStart(2, "0")}`);
check("累计费用=0.50", Math.abs(data.alltime?.cost - 0.5) < 1e-9, `got ${data.alltime?.cost}`);
check("累计token=本月2010（历史为空）", data.alltime?.tokens === 2010, `got ${data.alltime?.tokens}`);
check("本地：1 条有效记录", data.local?.records === 1, JSON.stringify(data.local));
check("本地：input=1000", data.local?.inputTokens === 1000);
check("本地：output=500", data.local?.outputTokens === 500);
check("本地：费用>0", data.local?.costCny === 0.000895);

// ── 采集缓存（TTL + 单飞）────────────────────────────────────────────────
const again = await collect();
check("TTL 缓存：重复 collect 复用同一结果", again === data);
const forced = await collect({ force: true });
check("force 绕过缓存", forced !== data && forced.ok === true);
check("force 后内容仍正确", forced.summary?.balance === 12.34 && forced.alltime?.tokens === 2010);
const [sf1, sf2] = await Promise.all([collect({ force: true }), collect({ force: true })]);
check("单飞：并发 force 合并成一次采集", sf1 === sf2);

// 无 token 分支
fs.rmSync(tokenFile, { force: true });
delete process.env.DS_PLATFORM_TOKEN;
const noToken = await collect();
check("无 token → NO_TOKEN", noToken.ok === false && noToken.error === "NO_TOKEN");
check("无 token → 有提示", typeof noToken.hint === "string" && noToken.hint.length > 0);

// 配置读写（跨启动持久化）
check("初始无配置", readConfig() === null);
writeConfig({ balance: false, today: true, cost: false, month: true, sidebar: false });
const savedCfg = readConfig();
check("配置写后读回", savedCfg && savedCfg.balance === false && savedCfg.month === true && savedCfg.sidebar === false, JSON.stringify(savedCfg));
fs.rmSync(path.join(tmp, "config.json"), { force: true });
check("删除后无配置", readConfig() === null);

// token 写入（UI 一键保存路径）
writeToken("  new-token-abc  ");
check("writeToken 后 readToken 返回新值", readToken() === "new-token-abc", JSON.stringify(readToken()));

// ── 记账时区（回归：UTC 日期在北京时间 00:00–08:00 会取到前一天）──────────
check("默认时区偏移 = +8", TZ_OFFSET_HOURS === 8, `got ${TZ_OFFSET_HOURS}`);
const p1 = zonedParts(new Date("2026-09-16T19:00:00.000Z")); // 北京 09-17 03:00
check("UTC 19:00 → 北京次日", p1.day === "2026-09-17" && p1.month === 9, JSON.stringify(p1));
const p2 = zonedParts(new Date("2026-09-16T15:59:00.000Z")); // 北京 09-16 23:59
check("UTC 15:59 → 北京当日", p2.day === "2026-09-16", JSON.stringify(p2));
const p3 = zonedParts(new Date("2025-12-31T16:00:00.000Z")); // 北京 2026-01-01 00:00
check("跨年 → 2026-01-01", p3.day === "2026-01-01" && p3.year === 2026 && p3.month === 1, JSON.stringify(p3));

// ── 记账增量解析（只吃整行、截断后重算）──────────────────────────────────
resetResidentState();
const s1 = readLocalStats();
check("增量：首轮 1 条", s1.records === 1 && s1.inputTokens === 1000, JSON.stringify(s1));

fs.appendFileSync(
  logFile,
  JSON.stringify({ kind: "messages", inputTokens: 10, outputTokens: 5, totalCostCny: 0.001 }) + "\n"
);
const s2 = readLocalStats();
check("增量：追加整行后 2 条", s2.records === 2 && s2.inputTokens === 1010, JSON.stringify(s2));

fs.appendFileSync(
  logFile,
  JSON.stringify({ kind: "messages", inputTokens: 999, outputTokens: 0, totalCostCny: 0 })
);
const s3 = readLocalStats();
check("增量：未写完的半行不计入", s3.records === 2 && s3.inputTokens === 1010, JSON.stringify(s3));

fs.appendFileSync(logFile, "\n");
const s4 = readLocalStats();
check("增量：补上换行后计入", s4.records === 3 && s4.inputTokens === 2009, JSON.stringify(s4));

fs.writeFileSync(
  logFile,
  JSON.stringify({ kind: "count_tokens", inputTokens: 7, outputTokens: 0, totalCostCny: 0 }) + "\n"
);
const s5 = readLocalStats();
check("增量：文件截断后从头重算", s5.records === 1 && s5.inputTokens === 7, JSON.stringify(s5));

// ── 单个历史月份失败不应连坐其余数据 ─────────────────────────────────────
// 累计 token 要逐月回填历史（几十个月），其中任何一个月出错都不该让整份响应
// 变成 FETCH_FAILED、把余额与今日数据一起丢掉。
resetResidentState();
fs.rmSync(path.join(tmp, "cache.json"), { force: true }); // 清历史缓存，强制真的回拉历史
const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
failHistoryMonth = { year: prevYear, month: prevMonth };
const partial = await collect({ force: true });
failHistoryMonth = null;
check("单月失败：整体仍 ok", partial.ok === true, `ok=${partial.ok} error=${partial.error}`);
check("单月失败：余额仍在", partial.summary?.balance === 12.34, JSON.stringify(partial.summary));
check("单月失败：今日数据仍在", partial.today?.total === 2000, JSON.stringify(partial.today));
check("单月失败：alltime 置 null（UI 显示「—」而非假 0）", partial.alltime === null, JSON.stringify(partial.alltime));
check(
  "单月失败：带 alltimeError 供排查",
  typeof partial.alltimeError === "string" && partial.alltimeError.length > 0,
  JSON.stringify(partial.alltimeError)
);

// ── 日志轮转：轮转出去的那一代仍要计入统计 ───────────────────────────────
const { appendRecord, readRecords } = await import("../lib/logger.mjs");
const rotLog = path.join(tmp, "rotate.jsonl");
fs.writeFileSync(rotLog, JSON.stringify({ kind: "messages", inputTokens: 5, outputTokens: 0, totalCostCny: 0 }) + "\n", "utf8");
appendRecord(rotLog, { kind: "messages", inputTokens: 7, outputTokens: 0, totalCostCny: 0 });
check("轮转：生成了 .1 那一代", fs.existsSync(`${rotLog}.1`));
const rotRecords = readRecords(rotLog);
check("轮转：readRecords 两代都读到", rotRecords.length === 2, `got ${rotRecords.length}`);

// ── DS_MONITOR_TTL_MS 传非法值要回退默认，而不是静默关掉缓存 ─────────────
// 常量在模块加载时求值，所以只能在独立进程里验证。
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
