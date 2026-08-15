import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** 默认记账文件：~/.dsh/deepseek-monitor/usage.jsonl（可用 DS_MONITOR_LOG 覆盖） */
export function defaultLogPath() {
  return (
    process.env.DS_MONITOR_LOG ??
    path.join(os.homedir(), ".dsh", "deepseek-monitor", "usage.jsonl")
  );
}

export function ensureLogFile(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

/** 追加一条 JSONL 记录（同步写，单进程内安全；多进程由 OS 追加保证不交错）。 */
export function appendRecord(file, record) {
  ensureLogFile(file);
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, "utf8");
}

/** 读取全部记录（跳过坏行）。 */
export function readRecords(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      // 忽略坏行
    }
  }
  return out;
}
