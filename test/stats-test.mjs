// dsh-deepseek-monitor stats CLI 自测：
//   1) `stats.mjs live` 不能丢掉跨轮询被截断的半行（回归：曾永久丢失该条记录）
//   2) `stats.mjs totals` 遇到字符串型金额/Token 字段不能崩（回归：曾 TypeError 退出）
// 运行：node test/stats-test.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const PROJ = path.resolve(import.meta.dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsm-stats-test-"));
const logFile = path.join(tmp, "usage.jsonl");

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures += 1;
    console.log(`  ❌ ${name} ${extra}`);
  }
};

const runCli = (args) =>
  new Promise((resolve) => {
    const c = spawn(process.execPath, [path.join(PROJ, "stats.mjs"), ...args], {
      cwd: PROJ,
      env: { ...process.env, DS_MONITOR_LOG: logFile },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    c.stdout.on("data", (d) => { out += d.toString(); });
    c.stderr.on("data", (d) => { out += d.toString(); });
    c.on("close", (code) => resolve({ code, out }));
  });

console.log("\n[dsh-deepseek-monitor] stats self-test");

// ── 1) live 不丢半行 ────────────────────────────────────────────────────
{
  const seed = JSON.stringify({ ts: "2026-09-18T00:00:00.000Z", kind: "messages", model: "deepseek-chat", status: 200, inputTokens: 1, outputTokens: 1, totalCostCny: 0.1 });
  fs.writeFileSync(logFile, seed + "\n", "utf8");

  const child = spawn(process.execPath, [path.join(PROJ, "stats.mjs"), "live"], {
    cwd: PROJ,
    env: { ...process.env, DS_MONITOR_LOG: logFile },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d) => { out += d.toString(); });
  child.stderr.on("data", (d) => { out += d.toString(); });

  const rec = JSON.stringify({ ts: "2026-09-18T00:00:05.000Z", kind: "messages", model: "deepseek-chat", status: 200, inputTokens: 777, outputTokens: 888, totalCostCny: 0.5 });
  await new Promise((r) => setTimeout(r, 1200));
  fs.appendFileSync(logFile, rec.slice(0, 60)); // 先写半行（写入方还没写完换行）
  await new Promise((r) => setTimeout(r, 2500)); // 让 live 至少轮询到一次"半行"
  fs.appendFileSync(logFile, rec.slice(60) + "\n"); // 补完这一行
  await new Promise((r) => setTimeout(r, 2500));
  child.kill();

  check("live 不丢被截断的半行", out.includes("in=777"), out.trim() || "(无输出)");
}

// ── 2) 字符串型字段不崩 ─────────────────────────────────────────────────
{
  fs.writeFileSync(
    logFile,
    JSON.stringify({
      ts: "2026-09-18T01:00:00.000Z",
      kind: "messages",
      model: "deepseek-chat",
      status: 200,
      inputTokens: "1000",
      outputTokens: "500",
      totalCostCny: "0.25",
    }) + "\n",
    "utf8"
  );
  const totals = await runCli(["totals"]);
  check("totals 遇字符串字段不崩（退出码 0）", totals.code === 0, `exit=${totals.code} ${totals.out.trim()}`);
  check("totals 把字符串金额按数字累加", totals.out.includes("¥0.25"), totals.out.trim());
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? "\n全部通过 ✅" : `\n${failures} 项失败 ❌`);
process.exitCode = failures === 0 ? 0 : 1;
