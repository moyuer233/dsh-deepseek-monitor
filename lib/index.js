// dsh-deepseek-monitor / lib/index.js
//
// DSH 宿主插件：在 webServer 上注册：
//   GET  /dsm/usage  平台用量/余额 JSON（platform.deepseek.com 内部 API + 本地代理记账）
//                    ?force=1 绕过服务端缓存（UI 的「刷新」按钮用）
//   GET  /dsm/token  平台 token 是否存在
//   POST /dsm/token  保存平台 token
//   GET  /dsm/config UI 配置（跨启动持久化，与应用随机端口无关）
//   POST /dsm/config 保存 UI 配置
// 浏览器端 bundle（exports["./client"] → lib/client.js）同源 fetch 这些路由。
//
// 三条路由都校验 Host（只放行回环名与 IP 字面量），用于挡住 DNS rebinding；
// 经域名或反向代理访问时，用 DS_MONITOR_ALLOWED_HOSTS 追加允许的主机名。

import { collect, readConfig, writeConfig, readToken, writeToken } from "./service.mjs";

const name = "dsm-usage-host";
const inject = ["webServer"];

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

/** 读取请求体（上限 64KB）。 */
function readBody(req, limit = 65536) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

/**
 * 写接口只接受同源请求。本机随机端口上的写接口若不做校验，任意网页都能用
 * 「简单请求」把 token / 配置覆盖成垃圾（CSRF）。
 * 浏览器跨站请求会带 `sec-fetch-site: cross-site`，或带一个不同源的 `Origin`；
 * 缺省这些头的本地脚本 / CLI 不受影响（`Origin: null` 交给上面那条判据兜底）。
 */
function isCrossSiteWrite(req) {
  const site = req.headers["sec-fetch-site"];
  if (
    typeof site === "string" &&
    site !== "" &&
    site !== "same-origin" &&
    site !== "same-site" &&
    site !== "none"
  ) {
    return true;
  }
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin !== "" && origin !== "null") {
    try {
      if (new URL(origin).host !== req.headers.host) return true;
    } catch {
      return true;
    }
  }
  return false;
}

/** 写接口要求 application/json：表单 / text-plain 这类「简单请求」直接被挡掉。 */
function isJsonRequest(req) {
  return String(req.headers["content-type"] ?? "")
    .toLowerCase()
    .includes("application/json");
}

/**
 * 允许访问的 Host。可用 `DS_MONITOR_ALLOWED_HOSTS`（逗号分隔）追加主机名，
 * 或设为 `*` 关闭这项校验。
 */
const EXTRA_ALLOWED_HOSTS = new Set(
  String(process.env.DS_MONITOR_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);
const ALLOW_ANY_HOST = EXTRA_ALLOWED_HOSTS.has("*");
const IPV4_LITERAL = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** 从 Host 头取主机名（去掉端口；IPv6 形如 `[::1]:port`）。 */
function hostOf(req) {
  const raw = String(req.headers.host ?? "").trim().toLowerCase();
  if (raw === "") return "";
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    return end === -1 ? raw : raw.slice(0, end + 1);
  }
  const colon = raw.lastIndexOf(":");
  return colon === -1 ? raw : raw.slice(0, colon);
}

/**
 * 本机 HTTP 接口真正的防线是校验 Host，而不是 Origin / Sec-Fetch-Site。
 *
 * DNS rebinding 下，攻击者页面把自己的域名解析到 127.0.0.1：浏览器算出来的
 * Origin 与 Sec-Fetch-Site 全都"同源"，只有 Host 还带着攻击者域名 —— 那是唯一
 * 没被伪造的信号（实测：只校验 Origin 时该形态的 POST 会 200 并真的改写 config）。
 *
 * 所以这里放行回环名与 IP 字面量（后者用于绑 0.0.0.0 时的局域网 IP 直连；
 * DSH 桌面版的 HTTP 口只绑 127.0.0.1），拒绝一切域名。
 */
function isHostAllowed(req) {
  if (ALLOW_ANY_HOST) return true;
  const host = hostOf(req);
  if (host === "") return true; // 没有 Host 头（非浏览器场景）：浏览器必然发送，交给其它判据
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
  if (IPV4_LITERAL.test(host)) return true;
  if (host.startsWith("[")) return true; // IPv6 字面量
  return EXTRA_ALLOWED_HOSTS.has(host);
}

function forbidden(res) {
  return sendJson(res, 403, {
    ok: false,
    error: "forbidden",
    hint: "Host 不在允许列表（防 DNS rebinding）。经域名或反向代理访问时请设置 DS_MONITOR_ALLOWED_HOSTS（设为 * 可关闭校验）",
  });
}

/**
 * 宿主插件体。
 * @param ctx - 宿主上下文（含注入的 webServer 服务）。
 */
function apply(ctx) {
  ctx.effect(
    () => {
      const disposers = [
        ctx.webServer.register({
          kind: "exact",
          path: "/dsm/usage",
          handler: async (req, res) => {
            if (!isHostAllowed(req)) return forbidden(res);
            if (req.method === "HEAD") {
              // 探测用：不回响应体，也不值得为它打一次平台接口。
              res.writeHead(200, JSON_HEADERS);
              res.end();
              return;
            }
            if (req.method !== "GET") {
              return sendJson(res, 405, { ok: false, error: "method not allowed" });
            }
            try {
              const force = /[?&]force=1(?:&|$)/.test(req.url ?? "");
              sendJson(res, 200, await collect({ force }));
            } catch (e) {
              sendJson(res, 500, { ok: false, error: "INTERNAL", message: String(e?.message ?? e) });
            }
          },
        }),
        ctx.webServer.register({
          kind: "exact",
          path: "/dsm/token",
          handler: async (req, res) => {
            if (!isHostAllowed(req)) return forbidden(res);
            if (req.method === "GET") {
              return sendJson(res, 200, { ok: true, hasToken: readToken() !== null });
            }
            if (req.method !== "POST") {
              return sendJson(res, 405, { ok: false, error: "method not allowed" });
            }
            if (isCrossSiteWrite(req) || !isJsonRequest(req)) {
              return sendJson(res, 403, { ok: false, error: "forbidden" });
            }
            try {
              const raw = await readBody(req);
              const body = JSON.parse(raw || "{}");
              const token = String(body?.token ?? "").trim();
              if (!token) throw new Error("token 不能为空");
              writeToken(token);
              sendJson(res, 200, { ok: true, hasToken: true });
            } catch (e) {
              sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
            }
          },
        }),
        ctx.webServer.register({
          kind: "exact",
          path: "/dsm/config",
          handler: async (req, res) => {
            if (!isHostAllowed(req)) return forbidden(res);
            if (req.method === "GET") {
              return sendJson(res, 200, { ok: true, config: readConfig() });
            }
            if (req.method !== "POST") {
              return sendJson(res, 405, { ok: false, error: "method not allowed" });
            }
            if (isCrossSiteWrite(req) || !isJsonRequest(req)) {
              return sendJson(res, 403, { ok: false, error: "forbidden" });
            }
            try {
              const raw = await readBody(req);
              const cfg = JSON.parse(raw || "{}");
              if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
                throw new Error("config must be a JSON object");
              }
              // 只接受标量与字符串数组，避免把任意内容写进磁盘。
              const clean = {};
              for (const [k, v] of Object.entries(cfg)) {
                if (k === "order" && Array.isArray(v)) {
                  clean.order = v.filter((x) => typeof x === "string").slice(0, 32);
                } else if (typeof v === "boolean" || typeof v === "string" || typeof v === "number") {
                  clean[k] = v;
                }
              }
              writeConfig(clean);
              sendJson(res, 200, { ok: true, config: clean });
            } catch (e) {
              sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
            }
          },
        }),
      ];
      return () => {
        for (const dispose of disposers) dispose();
      };
    },
    "dsm-usage: routes"
  );
}

export { apply, inject, name };
