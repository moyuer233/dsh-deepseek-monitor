// dsh-deepseek-monitor 自测：mock 上游 + 真实代理，验证 SSE/JSON 用量解析与记账。
// 运行：node test/self-test.mjs

import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const logFile = path.join(os.tmpdir(), `dsm-self-test-${process.pid}.jsonl`);
process.env.DS_MONITOR_LOG = logFile;
process.env.DS_MONITOR_PORT = "0";

// ── 1. mock 上游 ──────────────────────────────────────────────────────────

const mock = http.createServer((req, res) => {
  req.resume();
  if (req.method === "GET" && req.url === "/v1/models") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: [{ id: "deepseek-chat" }] }));
    return;
  }
  if (req.method === "POST" && req.url === "/v1/messages/count_tokens") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ input_tokens: 123 }));
    return;
  }
  if (req.method === "POST" && req.url === "/v1/messages") {
    if (String(req.headers.accept ?? "").includes("text/event-stream")) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const events = [
        ['message_start', { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: "deepseek-chat", usage: { input_tokens: 1000, cache_creation_input_tokens: 200, cache_read_input_tokens: 300, output_tokens: 0 } } }],
        ['content_block_start', { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
        ['content_block_delta', { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "hello" } }],
        ['content_block_stop', { type: "content_block_stop", index: 0 }],
        ['message_delta', { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 500 } }],
        ['message_stop', { type: "message_stop" }],
      ];
      for (const [event, data] of events) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
      res.end();
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        id: "msg_2", type: "message", role: "assistant",
        content: [{ type: "text", text: "hi" }], model: "deepseek-chat",
        usage: { input_tokens: 50, output_tokens: 10, cache_creation_input_tokens: 5, cache_read_input_tokens: 7 },
      }));
    }
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

await new Promise((r) => mock.listen(0, "127.0.0.1", r));
const mockPort = mock.address().port;
process.env.DS_MONITOR_UPSTREAM = `http://127.0.0.1:${mockPort}`;

// ── 2. 启动代理（指向 mock）───────────────────────────────────────────────

const { createProxyServer, LOG_FILE } = await import("../proxy.mjs");
const proxy = createProxyServer();
await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
const proxyPort = proxy.address().port;
const base = `http://127.0.0.1:${proxyPort}`;

// ── 3. 发请求 ─────────────────────────────────────────────────────────────

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures += 1;
    console.log(`  ❌ ${name} ${extra}`);
  }
};

console.log(`\n[dsh-deepseek-monitor] self-test (proxy :${proxyPort} → mock :${mockPort})`);

// 3.1 流式 messages
const sseRes = await fetch(`${base}/v1/messages`, {
  method: "POST",
  headers: { "content-type": "application/json", accept: "text/event-stream", "x-api-key": "test-key" },
  body: JSON.stringify({ model: "deepseek-chat", max_tokens: 64, messages: [{ role: "user", content: "hi" }] }),
});
const sseText = await sseRes.text();
check("流式响应被原样转发（含 message_stop）", sseText.includes('"type":"message_stop"') && sseText.includes("hello"), sseText.slice(0, 80));

// 3.2 非流式 messages
const jsonRes = await fetch(`${base}/v1/messages`, {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({ model: "deepseek-chat", max_tokens: 16, messages: [{ role: "user", content: "yo" }] }),
});
const jsonBody = await jsonRes.json();
check("非流式响应被原样转发", jsonBody.id === "msg_2" && jsonBody.content[0].text === "hi");

// 3.3 count_tokens
const ctRes = await fetch(`${base}/v1/messages/count_tokens`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ model: "deepseek-chat", messages: [] }),
});
const ctBody = await ctRes.json();
check("count_tokens 转发", ctBody.input_tokens === 123);

// 3.4 models
const modelsRes = await fetch(`${base}/v1/models`);
const modelsBody = await modelsRes.json();
check("models 转发", modelsBody.data[0].id === "deepseek-chat");

// 3.5 healthz
const health = await (await fetch(`${base}/healthz`)).json();
check("healthz 存活", health.ok === true);

// ── 4. 校验记账 ───────────────────────────────────────────────────────────

const records = JSON.parse(`[${fs.readFileSync(logFile, "utf8").trim().split("\n").join(",")}]`);
check("共 4 条记账记录", records.length === 4, `got ${records.length}`);

const sse = records.find((r) => r.kind === "messages" && r.streaming);
check("流式记录：input=1000", sse?.inputTokens === 1000, JSON.stringify(sse));
check("流式记录：cache_creation=200", sse?.cacheCreation === 200);
check("流式记录：cache_read=300", sse?.cacheRead === 300);
check("流式记录：output=500", sse?.outputTokens === 500);
check("流式记录：model=deepseek-chat", sse?.model === "deepseek-chat");
check("流式记录：status=200", sse?.status === 200);
check("流式记录：有费用", (sse?.totalCostCny ?? 0) > 0, `¥${sse?.totalCostCny}`);
check("流式记录：有 runId", typeof sse?.runId === "string" && sse.runId.length > 0);

const json = records.find((r) => r.kind === "messages" && !r.streaming);
check("JSON 记录：input=50/output=10", json?.inputTokens === 50 && json?.outputTokens === 10);
check("JSON 记录：cache=5/read=7", json?.cacheCreation === 5 && json?.cacheRead === 7);

const ct = records.find((r) => r.kind === "count_tokens");
check("count_tokens 记录：input=123", ct?.inputTokens === 123);

const models = records.find((r) => r.kind === "models");
check("models 记录：无 token", models && (models.inputTokens ?? 0) === 0);

// ── 5. 清理（等 close 回调结束再退出，避免 Windows 上 libuv 断言）───────

await new Promise((resolve) => {
  proxy.closeAllConnections?.();
  mock.closeAllConnections?.();
  proxy.close(() => mock.close(() => setTimeout(resolve, 100)));
});
fs.rmSync(logFile, { force: true });

console.log(failures === 0 ? "\n全部通过 ✅" : `\n${failures} 项失败 ❌`);
process.exitCode = failures === 0 ? 0 : 1;
