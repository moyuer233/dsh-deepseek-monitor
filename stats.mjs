#!/usr/bin/env node
// dsh-deepseek-monitor / stats.mjs
//
// 用量统计 CLI：
//   node stats.mjs              等价于 totals
//   node stats.mjs totals       累计汇总（按模型分组）
//   node stats.mjs today        今日汇总
//   node stats.mjs recent [n]   最近 n 次请求明细（默认 10）
//   node stats.mjs live         实时跟随新记录（tail -f）
//   node stats.mjs balance      查询 DeepSeek 账户余额
//
// 环境变量：
//   DS_MONITOR_LOG      记账文件路径（与 proxy 保持一致）
//   DS_MONITOR_API_KEY  DeepSeek API Key（balance 用；回退 ANTHROPIC_AUTH_TOKEN / DEEPSEEK_API_KEY）

import fs from "node:fs";
import https from "node:https";
import { readRecords, defaultLogPath } from "./lib/logger.mjs";
import { modelPricing, computeCost } from "./lib/pricing.mjs";

const LOG_FILE = defaultLogPath();
const BALANCE_URL = process.env.DS_MONITOR_BALANCE_URL ?? "https://api.deepseek.com/user/balance";

const fmtCny = (n) => `¥${n.toFixed(2)}`;
const fmtTokens = (n) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);

function apiKey() {
  return process.env.DS_MONITOR_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.DEEPSEEK_API_KEY ?? "";
}

// ── 汇总 ───────────────────────────────────────────────────────────────────

function summarize(records) {
  const byModel = new Map();
  let totals = {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreation: 0,
    cacheRead: 0,
    costCny: 0,
    failed: 0,
  };
  for (const r of records) {
    if (r.kind !== "messages" && r.kind !== "count_tokens") continue;
    totals.requests += 1;
    totals.inputTokens += r.inputTokens ?? 0;
    totals.outputTokens += r.outputTokens ?? 0;
    totals.cacheCreation += r.cacheCreation ?? 0;
    totals.cacheRead += r.cacheRead ?? 0;
    totals.costCny += r.totalCostCny ?? 0;
    if (r.status >= 400 || r.error) totals.failed += 1;
    const key = r.model ?? "(unknown)";
    if (!byModel.has(key)) {
      byModel.set(key, {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreation: 0,
        cacheRead: 0,
        costCny: 0,
      });
    }
    const m = byModel.get(key);
    m.requests += 1;
    m.inputTokens += r.inputTokens ?? 0;
    m.outputTokens += r.outputTokens ?? 0;
    m.cacheCreation += r.cacheCreation ?? 0;
    m.cacheRead += r.cacheRead ?? 0;
    m.costCny += r.totalCostCny ?? 0;
  }
  return { totals, byModel };
}

function printSummary(title, records) {
  const { totals, byModel } = summarize(records);
  console.log(`\n== ${title} ==`);
  if (totals.requests === 0) {
    console.log("（暂无记录）");
    return;
  }
  console.log(
    `请求 ${totals.requests} 次 | 输入 ${fmtTokens(totals.inputTokens)} | 输出 ${fmtTokens(totals.outputTokens)} | 缓存创建 ${fmtTokens(totals.cacheCreation)} | 缓存命中 ${fmtTokens(totals.cacheRead)}`
  );
  console.log(`费用 ${fmtCny(totals.costCny)}${totals.failed ? ` | 失败 ${totals.failed} 次` : ""}`);
  if (byModel.size > 1) {
    for (const [model, m] of byModel) {
      console.log(
        `  ${model}: ${m.requests} 次, 输入 ${fmtTokens(m.inputTokens)}, 输出 ${fmtTokens(m.outputTokens)}, ${fmtCny(m.costCny)}`
      );
    }
  }
}

// ── 子命令 ─────────────────────────────────────────────────────────────────

function cmdTotals() {
  printSummary("累计用量", readRecords(LOG_FILE));
}

function cmdToday() {
  const today = new Date().toISOString().slice(0, 10);
  const records = readRecords(LOG_FILE).filter((r) => (r.ts ?? "").slice(0, 10) === today);
  printSummary(`今日用量（${today}）`, records);
}

function cmdRecent(n) {
  const records = readRecords(LOG_FILE).slice(-n).reverse();
  console.log(`\n== 最近 ${records.length} 次请求 ==`);
  if (records.length === 0) return;
  for (const r of records) {
    const ok = r.status >= 200 && r.status < 400 && !r.error;
    const cost = (r.totalCostCny ?? 0).toFixed(4);
    console.log(
      `${r.ts} ${ok ? "ok" : "FAIL"} ${r.status} ${r.kind}${r.streaming ? " (sse)" : ""} model=${r.model ?? "-"} ` +
        `in=${fmtTokens(r.inputTokens ?? 0)} out=${fmtTokens(r.outputTokens ?? 0)} cache+${fmtTokens(r.cacheCreation ?? 0)}/read${fmtTokens(r.cacheRead ?? 0)} ¥${cost} ${r.durationMs ?? 0}ms${r.error ? ` err=${r.error}` : ""}`
    );
  }
}

function cmdLive() {
  console.log(`\n跟随 ${LOG_FILE} 的新记录（Ctrl+C 退出）...`);
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, "", "utf8");
  let position = fs.statSync(LOG_FILE).size;
  const poll = () => {
    try {
      const size = fs.statSync(LOG_FILE).size;
      if (size < position) position = 0; // 文件被轮转/截断
      if (size > position) {
        const fd = fs.openSync(LOG_FILE, "r");
        const buf = Buffer.alloc(size - position);
        fs.readSync(fd, buf, 0, buf.length, position);
        fs.closeSync(fd);
        position = size;
        for (const line of buf.toString("utf8").split("\n")) {
          if (!line.trim()) continue;
          try {
            const r = JSON.parse(line);
            console.log(
              `${r.ts} ${r.status} ${r.kind} model=${r.model ?? "-"} in=${fmtTokens(r.inputTokens ?? 0)} out=${fmtTokens(r.outputTokens ?? 0)} ¥${(r.totalCostCny ?? 0).toFixed(4)} ${r.durationMs ?? 0}ms`
            );
          } catch {
            /* 忽略 */
          }
        }
      }
    } catch {
      /* 文件暂不可读则跳过 */
    }
    setTimeout(poll, 1000);
  };
  poll();
}

function cmdBalance() {
  const key = apiKey();
  if (!key) {
    console.error("未找到 API Key：请设置 DS_MONITOR_API_KEY（或 ANTHROPIC_AUTH_TOKEN / DEEPSEEK_API_KEY）");
    process.exit(1);
  }
  https
    .get(BALANCE_URL, { headers: { Authorization: `Bearer ${key}` } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = chunks.join("");
        console.log(`\n== DeepSeek 余额（HTTP ${res.statusCode}）==`);
        try {
          const json = JSON.parse(body);
          if (json?.error) {
            console.error(`查询失败: ${json.error.message ?? json.error}`);
            process.exit(1);
          }
          for (const info of json?.balance_infos ?? []) {
            console.log(
              `${info.currency}: 总余额 ${info.total_balance} | 充值 ${info.topped_up_balance} | 赠送 ${info.granted_balance}`
            );
          }
          if (!json?.balance_infos?.length) console.log(JSON.stringify(json, null, 2));
        } catch {
          console.error(body.slice(0, 500));
          process.exit(1);
        }
      });
    })
    .on("error", (e) => {
      console.error(`查询失败: ${e.message}`);
      process.exit(1);
    });
}

// ── 入口 ───────────────────────────────────────────────────────────────────

const cmd = process.argv[2] ?? "totals";
switch (cmd) {
  case "totals":
    cmdTotals();
    break;
  case "today":
    cmdToday();
    break;
  case "recent": {
    const n = Math.max(1, Number(process.argv[3] ?? 10) || 10);
    cmdRecent(n);
    break;
  }
  case "live":
    cmdLive();
    break;
  case "balance":
    cmdBalance();
    break;
  default:
    console.error(`未知命令: ${cmd}`);
    console.error("用法: node stats.mjs [totals|today|recent [n]|live|balance]");
    process.exit(1);
}
