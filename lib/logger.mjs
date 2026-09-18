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

/** 单个记账文件的上限，超过就轮转出一代 `<file>.1`（避免长期运行把磁盘写满）。 */
const MAX_LOG_BYTES = (() => {
  const n = Number(process.env.DS_MONITOR_LOG_MAX_BYTES ?? 32 * 1024 * 1024);
  return Number.isFinite(n) && n > 0 ? n : 32 * 1024 * 1024;
})();

/**
 * 追加一条 JSONL 记录（同步写，单进程内安全；多进程由 OS 追加保证不交错）。
 * 到上限时先把现有文件轮转成 `<file>.1`（只保留一代），由 OS 的 rename 保证原子。
 */
export function appendRecord(file, record) {
  ensureLogFile(file);
  try {
    if (fs.statSync(file).size >= MAX_LOG_BYTES) fs.renameSync(file, `${file}.1`);
  } catch {
    /* 文件还不存在（首次写）或 stat 失败：照常追加 */
  }
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, "utf8");
}

/** 读取全部记录（跳过坏行）；轮转出去的那一代也算在内，保证统计不丢历史。 */
export function readRecords(file) {
  const out = [];
  for (const f of [`${file}.1`, file]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        out.push(JSON.parse(t));
      } catch {
        // 忽略坏行
      }
    }
  }
  return out;
}
