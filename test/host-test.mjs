// dsh-deepseek-monitor 宿主路由自测：用假的 cordis ctx 抓取三个路由的 handler，
// 验证写接口的同源校验、application/json 强制与配置字段白名单。
// 运行：node test/host-test.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
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

// 版本查询指向本地假 registry，避免测试打外网
const registry = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ version: "9.9.9" }));
});
await new Promise((r) => registry.listen(0, "127.0.0.1", r));
process.env.DS_MONITOR_LATEST_BASE = `http://127.0.0.1:${registry.address().port}`;

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
function call(routePath, { method = "GET", url, body = "", headers = {} } = {}, routeMap = routes) {
  const handler = routeMap.get(routePath);
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
check("注册 5 条路由", routes.size === 5, [...routes.keys()].join(","));

// ── 读接口不受影响 ───────────────────────────────────────────────────────
const cfgGet = await call("/dsm/config", { method: "GET" });
check("GET /dsm/config 可读", cfgGet.status === 200 && cfgGet.json?.ok === true, `${cfgGet.status}`);
const tokenGet = await call("/dsm/token", { method: "GET" });
check("GET /dsm/token 可读", tokenGet.status === 200 && tokenGet.json?.hasToken === false);
check("GET /dsm/token 报告来源 = none", tokenGet.json?.source === "none", JSON.stringify(tokenGet.json));
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
const ver = await call("/dsm/version", { method: "GET" });
check(
  "GET /dsm/version 报告有新版本",
  ver.status === 200 && ver.json?.latest === "9.9.9" && ver.json?.hasUpdate === true,
  JSON.stringify(ver.json)
);
const updGet = await call("/dsm/update", { method: "GET" });
check("GET /dsm/update → 405", updGet.status === 405, String(updGet.status));
const updCross = await call("/dsm/update", {
  method: "POST",
  headers: { ...JSON_CT, "sec-fetch-site": "cross-site" },
  body: "{}",
});
check("跨站 POST /dsm/update → 403", updCross.status === 403, String(updCross.status));

const headUsage = await call("/dsm/usage", { method: "HEAD" });
check(
  "HEAD /dsm/usage → 200 且不回响应体（不为探测打平台接口）",
  headUsage.status === 200 && headUsage.json === null,
  `${headUsage.status} body=${JSON.stringify(headUsage.json)}`
);

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

// ── DNS rebinding：Origin 与 Host 同为攻击者域名 ─────────────────────────
// 浏览器在 rebinding 后会把这种请求算成"同源"，所以 sec-fetch-site / Origin
// 都会自洽 —— 只有 Host 还带着攻击者域名。这条断言就是真正的防线回归：
// 只校验 Origin 时它会返回 200 并把配置真的改写掉。
const rebound = await call("/dsm/config", {
  method: "POST",
  headers: {
    ...JSON_CT,
    "sec-fetch-site": "same-origin",
    origin: "http://evil.example:1234",
    host: "evil.example:1234",
  },
  body: JSON.stringify({ balance: false, lang: "pwned" }),
});
check("rebinding 形态 POST /dsm/config → 403", rebound.status === 403, String(rebound.status));
check("rebinding 时配置未被改写", !fs.existsSync(path.join(tmp, "config.json")));
const reboundRead = await call("/dsm/usage", {
  method: "GET",
  headers: { host: "evil.example:1234" },
});
check("rebinding 形态 GET /dsm/usage → 403", reboundRead.status === 403, String(reboundRead.status));

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
check("GET /dsm/token 手填后来源 = manual", tokenGet2.json?.source === "manual", JSON.stringify(tokenGet2.json));

// ── 账号服务：来源判定（不联网，只看 GET /dsm/token）──────────────────
function applyWithAccount(session) {
  const table = new Map();
  apply({
    effect: (fn) => fn(),
    on: () => {},
    get: (name) =>
      name === "deepseekAccount"
        ? { getPlatformSession: async () => session }
        : undefined,
    webServer: {
      register: ({ path: p, handler }) => {
        table.set(p, handler);
        return () => {};
      },
    },
  });
  return table;
}

const accountRoutes = applyWithAccount({
  origin: "https://platform.deepseek.com",
  token: "acc-token",
  requestHeaders: { "x-client-platform": "desktop-win" },
});
const accountToken = await call("/dsm/token", {}, accountRoutes);
check(
  "账号登录态 → 来源 = account",
  accountToken.json?.source === "account" && accountToken.json?.hasToken === true,
  JSON.stringify(accountToken.json)
);

const evilRoutes = applyWithAccount({
  origin: "https://evil.example",
  token: "acc-token",
  requestHeaders: {},
});
const evilToken = await call("/dsm/token", {}, evilRoutes);
check(
  "非官方 origin 的 token 不被采用（回落手填）",
  evilToken.json?.source === "manual",
  JSON.stringify(evilToken.json)
);

const signedOutRoutes = applyWithAccount(null);
const signedOutToken = await call("/dsm/token", {}, signedOutRoutes);
check(
  "账号服务返回 null（已退出）→ 回落手填",
  signedOutToken.json?.source === "manual",
  JSON.stringify(signedOutToken.json)
);

registry.close();
fs.rmSync(tmp, { recursive: true, force: true });

console.log(failures === 0 ? "\n全部通过 ✅" : `\n${failures} 项失败 ❌`);
process.exitCode = failures === 0 ? 0 : 1;
