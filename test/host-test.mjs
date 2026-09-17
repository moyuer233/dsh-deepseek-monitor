// dsh-deepseek-monitor 宿主路由自测：用假的 cordis ctx 抓取三个路由的 handler，
// 验证写接口的同源校验、application/json 强制与配置字段白名单。
// 运行：node test/host-test.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsm-host-routes-"));
process.env.DS_PLATFORM_TOKEN_FILE = path.join(tmp, "platform-token");
process.env.DS_MONITOR_CONFIG = path.join(tmp, "config.json");
process.env.DS_MONITOR_CACHE = path.join(tmp, "cache.json");
process.env.DS_MONITOR_LOG = path.join(tmp, "usage.jsonl");
// 固定一个不可能有代理的端口，避免 healthz 探测真的连上什么
process.env.DS_MONITOR_PORT = "1";
process.env.DS_MONITOR_HOST = "127.0.0.1";
delete process.env.DS_PLATFORM_TOKEN;

const { apply } = await import("../lib/index.js");

// ── 假 ctx：捕获注册的路由 ────────────────────────────────────────────────

const routes = new Map();
apply({
  effect: (fn) => fn(),
  webServer: {
    register: ({ path: routePath, handler }) => {
      routes.set(routePath, handler);
      return () => {};
    },
  },
});

/** 构造假的 req/res 调一次 handler。`url` 可与路由路径不同（测 query）。 */
function call(routePath, { method = "GET", url, body = "", headers = {} } = {}) {
  const handler = routes.get(routePath);
  if (!handler) throw new Error(`route not registered: ${routePath}`);
  const req = Readable.from(body === "" ? [] : [Buffer.from(body, "utf8")]);
  req.method = method;
  req.url = url ?? routePath;
  req.headers = { host: "127.0.0.1:1234", ...headers };
  const res = {
    statusCode: 0,
    payload: "",
    writeHead(status) {
      this.statusCode = status;
    },
    end(chunk) {
      this.payload = chunk === undefined ? "" : String(chunk);
    },
  };
  return Promise.resolve(handler(req, res)).then(() => ({
    status: res.statusCode,
    json: (() => {
      try {
        return JSON.parse(res.payload);
      } catch {
        return null;
      }
    })(),
  }));
}

const JSON_CT = { "content-type": "application/json" };
const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures += 1;
    console.log(`  ❌ ${name} ${extra}`);
  }
};

console.log("\n[dsh-deepseek-monitor] host route self-test");

// ── 路由注册 ─────────────────────────────────────────────────────────────
check("注册 3 条路由", routes.size === 3, [...routes.keys()].join(","));

// ── 读接口不受影响 ───────────────────────────────────────────────────────
const cfgGet = await call("/dsm/config", { method: "GET" });
check("GET /dsm/config 可读", cfgGet.status === 200 && cfgGet.json?.ok === true, `${cfgGet.status}`);
const tokenGet = await call("/dsm/token", { method: "GET" });
check("GET /dsm/token 可读", tokenGet.status === 200 && tokenGet.json?.hasToken === false);
const usageGet = await call("/dsm/usage", { method: "GET" });
check(
  "GET /dsm/usage 无 token → 200 + NO_TOKEN",
  usageGet.status === 200 && usageGet.json?.error === "NO_TOKEN",
  `${usageGet.status} ${usageGet.payload}`
);
const usageForce = await call("/dsm/usage", { method: "GET", url: "/dsm/usage?force=1" });
check("GET /dsm/usage?force=1 → 200", usageForce.status === 200, `${usageForce.status}`);

// ── 方法白名单 ───────────────────────────────────────────────────────────
const putCfg = await call("/dsm/config", { method: "PUT", headers: JSON_CT, body: "{}" });
check("PUT /dsm/config → 405", putCfg.status === 405, String(putCfg.status));
const postUsage = await call("/dsm/usage", { method: "POST" });
check("POST /dsm/usage → 405", postUsage.status === 405, String(postUsage.status));
const delToken = await call("/dsm/token", { method: "DELETE" });
check("DELETE /dsm/token → 405", delToken.status === 405, String(delToken.status));

// ── 跨站写请求（CSRF）────────────────────────────────────────────────────
const crossSite = await call("/dsm/config", {
  method: "POST",
  headers: { ...JSON_CT, "sec-fetch-site": "cross-site" },
  body: JSON.stringify({ balance: true }),
});
check("跨站 POST /dsm/config → 403", crossSite.status === 403, String(crossSite.status));
const badOrigin = await call("/dsm/token", {
  method: "POST",
  headers: { ...JSON_CT, origin: "https://evil.example" },
  body: JSON.stringify({ token: "x".repeat(30) }),
});
check("异源 Origin POST /dsm/token → 403", badOrigin.status === 403, String(badOrigin.status));
check("被拒的写请求没有落盘", !fs.existsSync(path.join(tmp, "platform-token")));

// ── 强制 application/json（挡掉表单式「简单请求」）───────────────────────
const formPost = await call("/dsm/config", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "balance=true",
});
check("表单 POST /dsm/config → 403", formPost.status === 403, String(formPost.status));
const textPost = await call("/dsm/token", {
  method: "POST",
  headers: { "content-type": "text/plain", ...SAME_ORIGIN },
  body: JSON.stringify({ token: "should-be-rejected-token" }),
});
check("text/plain POST /dsm/token → 403", textPost.status === 403, String(textPost.status));

// ── 正常同源写：白名单只留标量与字符串数组 ───────────────────────────────
const okCfg = await call("/dsm/config", {
  method: "POST",
  headers: { ...JSON_CT, ...SAME_ORIGIN, origin: "http://127.0.0.1:1234" },
  body: JSON.stringify({
    balance: true,
    lang: "en",
    order: ["balance", 5, "dayTokens"],
    evil: { nested: true },
  }),
});
check("同源 JSON POST /dsm/config → 200", okCfg.status === 200, String(okCfg.status));
check("白名单：保留标量", okCfg.json?.config?.balance === true && okCfg.json?.config?.lang === "en");
check(
  "白名单：order 只留字符串",
  JSON.stringify(okCfg.json?.config?.order) === JSON.stringify(["balance", "dayTokens"]),
  JSON.stringify(okCfg.json?.config?.order)
);
check("白名单：丢掉嵌套对象", okCfg.json?.config?.evil === undefined);
const onDisk = JSON.parse(fs.readFileSync(path.join(tmp, "config.json"), "utf8"));
check("落盘内容同样被清洗", onDisk.evil === undefined && onDisk.balance === true);

// ── 同源保存 token ───────────────────────────────────────────────────────
const okToken = await call("/dsm/token", {
  method: "POST",
  headers: { ...JSON_CT, ...SAME_ORIGIN },
  body: JSON.stringify({ token: "  tok-abc  " }),
});
check("同源 JSON POST /dsm/token → 200", okToken.status === 200 && okToken.json?.hasToken === true, String(okToken.status));
check("token 已落盘且去掉空白", fs.readFileSync(path.join(tmp, "platform-token"), "utf8") === "tok-abc");
const tokenGet2 = await call("/dsm/token", { method: "GET" });
check("GET /dsm/token 反映已保存", tokenGet2.json?.hasToken === true);

fs.rmSync(tmp, { recursive: true, force: true });

console.log(failures === 0 ? "\n全部通过 ✅" : `\n${failures} 项失败 ❌`);
process.exitCode = failures === 0 ? 0 : 1;
