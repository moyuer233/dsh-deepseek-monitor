// @local/dsh-host-deepseek-usage 自测：mock 平台 API + 临时 token/记账文件，
// 验证 collect() 的解析与聚合。
// 运行：node plugin/host/test/service-test.mjs

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

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();
const today = now.toISOString().slice(0, 10);
const dayEntry = (date, usage, cost) => ({
  date,
  data: [
    { model: "deepseek-chat", usage },
    ...(cost ? [{ model: "deepseek-chat", usage: [{ amount: String(cost) }] }] : []),
  ],
});

// ── mock 平台 API ──────────────────────────────────────────────────────────

const mock = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
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

const { collect, readLocalStats } = await import("../lib/service.mjs");
const { summarizeDayUsage } = await import("../lib/platform.mjs");

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures += 1;
    console.log(`  ❌ ${name} ${extra}`);
  }
};

console.log(`\n[dsh-host-deepseek-usage] service self-test (mock :${mock.address().port})`);

const data = await collect();
check("collect ok", data.ok === true, JSON.stringify(data));
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

// 无 token 分支
fs.rmSync(tokenFile, { force: true });
delete process.env.DS_PLATFORM_TOKEN;
const noToken = await collect();
check("无 token → NO_TOKEN", noToken.ok === false && noToken.error === "NO_TOKEN");
check("无 token → 有提示", typeof noToken.hint === "string" && noToken.hint.length > 0);

// 配置读写（跨启动持久化）
const { readConfig, writeConfig } = await import("../lib/service.mjs");
check("初始无配置", readConfig() === null);
writeConfig({ balance: false, today: true, cost: false, month: true, sidebar: false });
const savedCfg = readConfig();
check("配置写后读回", savedCfg && savedCfg.balance === false && savedCfg.month === true && savedCfg.sidebar === false, JSON.stringify(savedCfg));
fs.rmSync(path.join(tmp, "config.json"), { force: true });
check("删除后无配置", readConfig() === null);

// token 写入（UI 一键保存路径）
const { writeToken, readToken } = await import("../lib/service.mjs");
writeToken("  new-token-abc  ");
check("writeToken 后 readToken 返回新值", readToken() === "new-token-abc", JSON.stringify(readToken()));

mock.closeAllConnections?.();
mock.close();
fs.rmSync(tmp, { recursive: true, force: true });

console.log(failures === 0 ? "\n全部通过 ✅" : `\n${failures} 项失败 ❌`);
process.exitCode = failures === 0 ? 0 : 1;
