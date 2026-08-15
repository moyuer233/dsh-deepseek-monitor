#!/usr/bin/env node
// dsh-deepseek-monitor / proxy.mjs
//
// 本地用量监控代理：把 DSH 的 claude-code 子代理（headless Claude Code）
// 发往 DeepSeek Anthropic 兼容端点的请求截获并记账。
//
// 原理：
//   child claude ──ANTHROPIC_BASE_URL=http://127.0.0.1:8899──▶ 本代理
//        ◀──SSE / JSON（原样转发，同时解析 usage）─────────────┘
//   本代理 ──▶ https://api.deepseek.com/anthropic（原样转发）
//
// 环境变量：
//   DS_MONITOR_PORT      监听端口，默认 8899
//   DS_MONITOR_HOST      监听地址，默认 127.0.0.1
//   DS_MONITOR_UPSTREAM  上游 DeepSeek Anthropic 兼容端点，默认 https://api.deepseek.com/anthropic
//   DS_MONITOR_LOG       记账 JSONL 路径，默认 ~/.dsh/deepseek-monitor/usage.jsonl
//
// 运行：node proxy.mjs

import http from "node:http";
import https from "node:https";
import { randomUUID } from "node:crypto";
import { appendRecord, defaultLogPath } from "./lib/logger.mjs";
import { modelPricing, computeCost } from "./lib/pricing.mjs";

const UPSTREAM = process.env.DS_MONITOR_UPSTREAM ?? "https://api.deepseek.com/anthropic";
const HOST = process.env.DS_MONITOR_HOST ?? "127.0.0.1";
const PORT = Number(process.env.DS_MONITOR_PORT ?? 8899);
const LOG_FILE = defaultLogPath();

const STARTED_AT = new Date().toISOString();

// ── SSE 事件解析器：从流式响应中抽取 usage ────────────────────────────────

function createSseExtractor(onEvent) {
  let buffer = "";
  let eventType = null;
  const handleDataLine = (data) => {
    const text = data.trim();
    if (!text || text === "[DONE]") return;
    try {
      onEvent(eventType, JSON.parse(text));
    } catch {
      /* 非 JSON 数据行忽略 */
    }
  };
  return {
    push(chunk) {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).replace(/\r$/, "");
        buffer = buffer.slice(idx + 1);
        if (line === "") {
          eventType = null;
          continue;
        }
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          handleDataLine(line.slice(5));
        }
      }
    },
    end() {
      if (buffer.trim()) handleDataLine(buffer);
      buffer = "";
    },
  };
}

const USAGE_KEYS = ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"];

function extractUsageFromSse() {
  const start = {};
  const delta = {};
  let error = null;
  const extractor = createSseExtractor((eventType, ev) => {
    if (eventType === "error" && ev?.error?.message) error = ev.error.message;
    if (eventType === "message_start" && ev?.message?.usage) {
      for (const k of USAGE_KEYS) if (typeof ev.message.usage[k] === "number") start[k] = ev.message.usage[k];
    }
    if (eventType === "message_delta" && ev?.usage) {
      for (const k of USAGE_KEYS) if (typeof ev.usage[k] === "number") delta[k] = ev.usage[k];
    }
  });
  return {
    extractor,
    get usage() {
      return {
        input_tokens: start.input_tokens ?? 0,
        output_tokens: Math.max(delta.output_tokens ?? 0, start.output_tokens ?? 0),
        cache_creation_input_tokens: start.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: start.cache_read_input_tokens ?? 0,
      };
    },
    get error() {
      return error;
    },
  };
}

// ── 请求转发与记账 ─────────────────────────────────────────────────────────

function kindFor(url) {
  if (url === "/v1/messages") return "messages";
  if (url === "/v1/messages/count_tokens") return "count_tokens";
  if (url === "/v1/models") return "models";
  return "other";
}

function createProxyServer() {
  const transport = new URL(UPSTREAM).protocol === "https:" ? https : http;

  return http.createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url === "/healthz")) {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, upstream: UPSTREAM, log: LOG_FILE, startedAt: STARTED_AT }));
      return;
    }

    const runId = randomUUID();
    const startedMs = Date.now();
    const kind = kindFor(req.url);
    const streaming = String(req.headers.accept ?? "").includes("text/event-stream");
    const target = new URL(UPSTREAM + req.url);

    // 收集请求体以读取 model（同时用于转发）
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      let model = null;
      if (kind === "messages" || kind === "count_tokens") {
        try {
          model = JSON.parse(body.toString("utf8") || "{}")?.model ?? null;
        } catch {
          /* 非 JSON 请求体，仍照常转发 */
        }
      }

      const upstreamHeaders = {
        ...req.headers,
        host: target.host,
        "accept-encoding": "identity", // 强制原文，便于解析 SSE
      };
      delete upstreamHeaders["transfer-encoding"];
      delete upstreamHeaders["content-length"];
      if (streaming) upstreamHeaders.accept = "text/event-stream";

      const upstreamReq = transport.request(
        target,
        { method: req.method, headers: upstreamHeaders },
        (upRes) => {
          const status = upRes.statusCode ?? 502;

          if (streaming && kind === "messages") {
            // 流式：边转发边解析 usage
            const track = extractUsageFromSse();
            res.writeHead(status, {
              "content-type": upRes.headers["content-type"] ?? "text/event-stream",
              "cache-control": upRes.headers["cache-control"] ?? "no-cache",
            });
            upRes.on("data", (c) => {
              res.write(c);
              track.extractor.push(c);
            });
            upRes.on("end", () => {
              track.extractor.end();
              record({ model, status, usage: track.usage, error: track.error, kind, startedMs, runId, streaming: true });
              res.end();
            });
            upRes.on("error", (e) => {
              record({ model, status: 502, usage: {}, error: e.message, kind, startedMs, runId, streaming: true });
              res.destroy();
            });
            return;
          }

          // 非流式：缓存响应体，解析 usage 后一次回写
          const outChunks = [];
          upRes.on("data", (c) => outChunks.push(c));
          upRes.on("end", () => {
            const outBody = Buffer.concat(outChunks);
            let usage = {};
            let error = null;
            try {
              const json = JSON.parse(outBody.toString("utf8") || "{}");
              if (json?.usage) usage = json.usage;
              else if (kind === "count_tokens" && typeof json?.input_tokens === "number") usage = { input_tokens: json.input_tokens };
              if (json?.error?.message) error = json.error.message;
            } catch {
              /* 非 JSON（例如纯文本错误页），原样转发 */
            }
            record({ model, status, usage, error, kind, startedMs, runId, streaming: false });
            const headers = { ...upRes.headers };
            delete headers["transfer-encoding"];
            headers["content-length"] = String(outBody.length);
            res.writeHead(status, headers);
            res.end(outBody);
          });
          upRes.on("error", (e) => {
            record({ model, status: 502, usage: {}, error: e.message, kind, startedMs, runId, streaming: false });
            if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
            res.end(`proxy upstream error: ${e.message}`);
          });
        }
      );

      upstreamReq.on("error", (e) => {
        record({ model, status: 502, usage: {}, error: e.message, kind, startedMs, runId, streaming });
        if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
        res.end(`proxy upstream error: ${e.message}`);
      });

      if (body.length) upstreamReq.write(body);
      upstreamReq.end();

      // 客户端真正断开（而非请求体读完）时才终止上游；正常完成后 writableEnded 为 true。
      res.on("close", () => {
        if (!res.writableEnded) upstreamReq.destroy();
      });
    });
  });
}

function record({ model, status, usage, error, kind, startedMs, runId, streaming }) {
  const pricing = modelPricing(model ?? "");
  const cost = computeCost(usage, pricing);
  appendRecord(LOG_FILE, {
    ts: new Date().toISOString(),
    runId,
    kind,
    streaming,
    model: model ?? null,
    status,
    ...cost,
    error: error ?? null,
    durationMs: Date.now() - startedMs,
  });
}

// ── 入口 ───────────────────────────────────────────────────────────────────

function main() {
  const server = createProxyServer();
  server.listen(PORT, HOST, () => {
    const actual = server.address();
    const port = typeof actual === "object" && actual ? actual.port : PORT;
    console.log(`[dsh-deepseek-monitor] listening on http://${HOST}:${port}`);
    console.log(`[dsh-deepseek-monitor] upstream: ${UPSTREAM}`);
    console.log(`[dsh-deepseek-monitor] log: ${LOG_FILE}`);
    console.log(`[dsh-deepseek-monitor] 把它作为子 Claude Code 的 ANTHROPIC_BASE_URL，例如 http://127.0.0.1:${port}`);
  });
  return server;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (isDirectRun) main();

export { createProxyServer, record, UPSTREAM, HOST, PORT, LOG_FILE };
