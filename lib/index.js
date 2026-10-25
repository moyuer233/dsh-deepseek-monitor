// dsh-deepseek-monitor / lib/index.js
//
// DSH 宿主插件：在 webServer 上注册：
//   GET  /dsm/usage  平台用量/余额 JSON（platform.deepseek.com 内部 API + 本地代理记账）
//                    ?force=1 绕过服务端缓存（UI 的「刷新」按钮用）
//   GET  /dsm/token  凭据来源（account=DSH 账号登录 / manual=手填 token / none）
//   POST /dsm/token  保存平台 token
//   GET  /dsm/config UI 配置（跨启动持久化，与应用随机端口无关）
//   POST /dsm/config 保存 UI 配置
//   GET  /dsm/events   SSE：每轮对话结束时推一条 refresh，UI 立刻刷新
//   GET  /dsm/version 当前版本 / registry 最新版 / 是否有更新
//   POST /dsm/update  执行自更新（npm install <pkg>@latest，需重启生效）
// 浏览器端 bundle（exports["./client"] → lib/client.js）同源 fetch 这些路由。
//
// 三条路由都校验 Host（只放行回环名与 IP 字面量），用于挡住 DNS rebinding；
// 经域名或反向代理访问时，用 DS_MONITOR_ALLOWED_HOSTS 追加允许的主机名。

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collect, invalidateUsageCache, readConfig, writeConfig, readToken, writeToken } from "./service.mjs";

const name = "dsm-usage-host";
const inject = ["webServer"];

/** 本包元信息：版本检查与自更新都基于安装目录。 */
const PKG_NAME = "dsh-deepseek-monitor-moyuer233";
const PKG_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readOwnVersion = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(PKG_DIR, "package.json"), "utf8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
};
const VERSION = readOwnVersion();

/** 订阅「一轮对话结束」的 SSE 连接；每轮结束时推一条 refresh。 */
const eventClients = new Set();

function broadcastRefresh() {
  for (const res of eventClients) {
    try {
      res.write("data: refresh\n\n");
    } catch {
      eventClients.delete(res);
    }
  }
}

/** 最新版查询缓存：6 小时内复用，避免每次轮询都打 registry。 */
const LATEST_TTL_MS = 6 * 3600 * 1000;
let latestCache = { at: 0, value: null };

/** 比较 x.y.z：a 比 b 新返回正数。 */
function compareVersion(a, b) {
  const pa = String(a).split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** 依次问镜像与官方 registry；都失败返回 null，不影响面板其它数据。 */
/**
 * 版本查询源：默认镜像 + 官方；测试或自建镜像可用 DS_MONITOR_LATEST_BASE 覆盖
 * （逗号分隔，按顺序尝试）。
 */
const LATEST_BASES = String(
  process.env.DS_MONITOR_LATEST_BASE ?? "https://registry.npmmirror.com,https://registry.npmjs.org"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function fetchLatestVersion() {
  for (const base of LATEST_BASES) {
    try {
      const res = await fetch(`${base}/${PKG_NAME}/latest`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const body = await res.json();
      if (body && typeof body.version === "string") return body.version;
    } catch {
      /* 换下一个源 */
    }
  }
  return null;
}

async function latestVersion() {
  if (latestCache.value && Date.now() - latestCache.at < LATEST_TTL_MS) return latestCache.value;
  const latest = await fetchLatestVersion();
  if (latest) latestCache = { at: Date.now(), value: latest };
  return latest;
}

/**
 * 在 Windows 上找一个能直接跑的 pnpm（宿主进程的 PATH 未必包含它的全局目录）。
 * 返回绝对路径或 null；null 时改用 `cmd /d /s /c pnpm ...` 让 shell 自己找。
 */
function findPnpm() {
  if (process.platform !== "win32") return "pnpm";
  const ext = ".cmd";
  const candidates = [];
  // 先看 PATH：pnpm 全局目录可能就在 PATH 里
  for (const dir of String(process.env.PATH ?? "").split(";")) {
    if (dir) candidates.push(path.join(dir, "pnpm" + ext));
  }
  if (process.env.PNPM_HOME) candidates.push(path.join(process.env.PNPM_HOME, "pnpm" + ext));
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, "npm", "pnpm" + ext));
  if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, "pnpm", "pnpm.exe"));
  try {
    candidates.push(path.join(path.dirname(process.execPath), "pnpm" + ext));
  } catch {
    /* 忽略 */
  }
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* 下一个 */
    }
  }
  return null;
}

/**
 * 自更新：在 profile 目录把本包装到最新；同一时间只允许一个。
 * 优先用 pnpm：profile 由 pnpm 管理（有 pnpm-lock.yaml），用 npm 装会绕过 store 与锁，
 * 下次 pnpm install 会按锁把版本打回旧 commit（2026-10-25 实测 0.4.0 → 0.2.4）。
 * github: 依赖用 `pnpm update <pkg>`（重新解析到 HEAD 并更新锁）；registry 依赖加 --latest。
 */
let updating = null;
function runUpdate() {
  if (updating) return updating;
  const profileDir = path.dirname(path.dirname(PKG_DIR));
  let spec = "";
  try {
    spec = String(JSON.parse(fs.readFileSync(path.join(profileDir, "package.json"), "utf8"))?.dependencies?.[PKG_NAME] ?? "");
  } catch {
    /* 读不到就按 git 依赖处理 */
  }
  const usePnpm = fs.existsSync(path.join(profileDir, "pnpm-lock.yaml"));
  const isGit = /^(github:|git\+|ssh:|git@)/.test(spec);
  const pnpmArgs = isGit ? ["update", PKG_NAME] : ["update", PKG_NAME, "--latest"];
  let bin;
  let args;
  let shellOpt;
  if (usePnpm) {
    const pnpmBin = findPnpm();
    if (pnpmBin) {
      bin = pnpmBin;
      args = pnpmArgs;
      shellOpt = process.platform === "win32";
    } else {
      // 宿主 PATH 里可能没有 pnpm：交给 cmd 自己找（/d 跳过 AutoRun，/s 剥首尾引号）
      bin = "cmd.exe";
      args = ["/d", "/s", "/c", ["pnpm", ...pnpmArgs].join(" ")];
      shellOpt = false;
    }
  } else {
    bin = process.platform === "win32" ? "npm.cmd" : "npm";
    args = ["install", `${PKG_NAME}@latest`, "--no-audit", "--no-fund"];
    shellOpt = true;
  }
  updating = new Promise((resolve) => {
    execFile(
      bin,
      args,
      { cwd: profileDir, shell: shellOpt, timeout: 240000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        updating = null;
        const from = VERSION;
        const to = readOwnVersion();
        latestCache = { at: 0, value: null };
        if (error) {
          const raw = String(stderr || stdout || error).trim();
          resolve({
            ok: false,
            from,
            to,
            error: /ENOENT/.test(raw)
              ? `没找到 ${usePnpm ? "pnpm" : "npm"}，请用 DSH 的插件管理更新`
              : raw.slice(-400),
          });
          return;
        }
        resolve({ ok: true, from, to, needsRestart: true, manager: usePnpm ? "pnpm" : "npm", bin });
      }
    );
  });
  return updating;
}

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

/** DSH 账号登录态所在的平台源；只接受官方域名，避免把 token 发给别处。 */
const ACCOUNT_ORIGIN = "https://platform.deepseek.com";

/**
 * 读取 DSH 账号登录态（没有账号服务 / 未登录时返回 null）。
 * 走公开方法 getPlatformSession()，不直接读 ~/.dsh/.credentials.yaml。
 */
async function accountAuth(ctx) {
  let account;
  try {
    account = ctx.get("deepseekAccount");
  } catch {
    return null;
  }
  if (!account || typeof account.getPlatformSession !== "function") return null;
  let session;
  try {
    session = await account.getPlatformSession();
  } catch {
    return null;
  }
  if (!session || session.origin !== ACCOUNT_ORIGIN) return null;
  const token = String(session.token ?? "").trim();
  if (!token) return null;
  const headers =
    session.requestHeaders && typeof session.requestHeaders === "object" ? session.requestHeaders : {};
  return { mode: "account", token, headers };
}

/**
 * 解析本次请求的鉴权来源，顺序固定：
 *   1. DS_PLATFORM_TOKEN 环境变量（脚本 / 临时换号）
 *   2. DSH 账号登录态
 *   3. 手填 token 文件（兜底）
 * 任何一步失败都静默跳过，最终返回 none。
 */
async function resolveAuth(ctx) {
  const env = String(process.env.DS_PLATFORM_TOKEN ?? "").trim();
  if (env) return { mode: "manual", token: env };
  const account = await accountAuth(ctx);
  if (account) return account;
  const file = readToken();
  return file ? { mode: "manual", token: file } : { mode: "none", token: null };
}

/**
 * 采集一次；账号登录态被平台拒绝（401 / 业务码 40003）时回落到手填 token。
 * 账号 token 过期而 DSH 还没感知到的情况下，这条兜底能让面板继续出数。
 */
async function collectWithFallback(ctx, force) {
  const auth = await resolveAuth(ctx);
  const data = await collect({ force, auth });
  if (auth.mode === "account" && data.ok === false && /401|40003/.test(String(data.message ?? ""))) {
    const manual = readToken();
    if (manual) return await collect({ force: true, auth: { mode: "manual", token: manual } });
  }
  return data;
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
/**
 * 注册一条宿主路由。
 * 0.2 起的签名是 `register({ kind, path, handler })`；更早的版本可能只接受
 * `(path, handler)` 或 `{ path, handler }`。逐个尝试，任一成功即用，全部失败时
 * 抛第一个错误，方便定位真正的问题。
 */
function registerRoute(webServer, route) {
  try {
    return webServer.register(route);
  } catch (first) {
    try {
      return webServer.register({ path: route.path, handler: route.handler });
    } catch {
      try {
        return webServer.register(route.path, route.handler);
      } catch {
        throw first;
      }
    }
  }
}

function apply(ctx) {
  // 账号登录 / 退出 / 换 token 后必须作废用量缓存，否则会拿上一个账号的数字继续显示。
  const invalidate = () => {
    try {
      invalidateUsageCache();
    } catch {
      /* 服务尚未就绪：忽略 */
    }
  };
  for (const event of ["deepseek-account/signed-out", "deepseek-account/session-expired"]) {
    try {
      ctx.on(event, invalidate);
    } catch {
      /* 旧宿主没有事件总线：忽略 */
    }
  }
  try {
    ctx.on("credentials/record-updated", (key) => {
      if (key === "deepseek-account-platform/default") invalidate();
    });
  } catch {
    /* 同上 */
  }
  ctx.effect(
    () => {
      const disposers = [
        registerRoute(ctx.webServer, {
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
              sendJson(res, 200, await collectWithFallback(ctx, force));
            } catch (e) {
              sendJson(res, 500, { ok: false, error: "INTERNAL", message: String(e?.message ?? e) });
            }
          },
        }),
        registerRoute(ctx.webServer, {
          kind: "exact",
          path: "/dsm/token",
          handler: async (req, res) => {
            if (!isHostAllowed(req)) return forbidden(res);
            if (req.method === "GET") {
              const auth = await resolveAuth(ctx);
              return sendJson(res, 200, {
                ok: true,
                hasToken: auth.mode !== "none",
                source: auth.mode,
              });
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
        registerRoute(ctx.webServer, {
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
        registerRoute(ctx.webServer, {
          kind: "exact",
          path: "/dsm/events",
          handler: (req, res) => {
            if (!isHostAllowed(req)) return forbidden(res);
            if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "method not allowed" });
            res.writeHead(200, {
              "content-type": "text/event-stream; charset=utf-8",
              "cache-control": "no-store",
              connection: "keep-alive",
            });
            res.write("data: ready\n\n");
            eventClients.add(res);
            const cleanup = () => eventClients.delete(res);
            req.on("close", cleanup);
            res.on("close", cleanup);
          },
        }),
        registerRoute(ctx.webServer, {
          kind: "exact",
          path: "/dsm/version",
          handler: async (req, res) => {
            if (!isHostAllowed(req)) return forbidden(res);
            if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "method not allowed" });
            const latest = await latestVersion();
            sendJson(res, 200, {
              ok: true,
              current: VERSION,
              latest,
              hasUpdate: latest ? compareVersion(latest, VERSION) > 0 : false,
            });
          },
        }),
        registerRoute(ctx.webServer, {
          kind: "exact",
          path: "/dsm/update",
          handler: async (req, res) => {
            if (!isHostAllowed(req)) return forbidden(res);
            if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
            if (isCrossSiteWrite(req) || !isJsonRequest(req)) {
              return sendJson(res, 403, { ok: false, error: "forbidden" });
            }
            try {
              await readBody(req);
              sendJson(res, 200, await runUpdate());
            } catch (e) {
              sendJson(res, 500, { ok: false, error: String(e?.message ?? e) });
            }
          },
        }),
      ];
      // 一轮对话结束 = 某个 agent 从 running 变成 idle。每 2 秒看一眼，
      // 变了就通过 SSE 让前端立刻刷新一次（不依赖宿主事件名；缺 agents 服务时自然跳过）。
      const lastStatus = new Map();
      const turnTimer = setInterval(() => {
        let agents;
        try {
          agents = ctx.get("agents");
        } catch {
          return;
        }
        const list = typeof agents?.list === "function" ? agents.list() : [];
        for (const agent of list) {
          const previous = lastStatus.has(agent) ? lastStatus.get(agent) : "idle";
          const current = agent?.status ?? "idle";
          if (previous === "running" && current === "idle") broadcastRefresh();
          lastStatus.set(agent, current);
        }
      }, 2000);
      return () => {
        clearInterval(turnTimer);
        for (const res of eventClients) {
          try {
            res.end();
          } catch {
            /* 已断开 */
          }
        }
        eventClients.clear();
        for (const dispose of disposers) dispose();
      };
    },
    "dsm-usage: routes"
  );
}

export { apply, inject, name };
