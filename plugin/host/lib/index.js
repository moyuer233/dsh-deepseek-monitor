// @local/dsh-host-deepseek-usage / lib/index.js
//
// DSH 宿主插件：在 webServer 上注册：
//   GET  /dsm/usage  平台用量/余额 JSON（platform.deepseek.com 内部 API + 本地代理记账）
//   GET  /dsm/config UI 配置（跨启动持久化，与应用随机端口无关）
//   POST /dsm/config 保存 UI 配置
// 客户端插件（@local/dsh-client-ui-deepseek-usage）同源 fetch 这些路由。

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
            const body = await collect();
            res.writeHead(200, JSON_HEADERS);
            res.end(JSON.stringify(body));
          },
        }),
        ctx.webServer.register({
          kind: "exact",
          path: "/dsm/token",
          handler: async (req, res) => {
            if (req.method === "POST") {
              try {
                const raw = await readBody(req);
                const body = JSON.parse(raw || "{}");
                const token = String(body?.token ?? "").trim();
                if (!token) throw new Error("token 不能为空");
                writeToken(token);
                res.writeHead(200, JSON_HEADERS);
                res.end(JSON.stringify({ ok: true, hasToken: true }));
              } catch (e) {
                res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ ok: false, error: String(e?.message ?? e) }));
              }
              return;
            }
            if (req.method === "GET") {
              res.writeHead(200, JSON_HEADERS);
              res.end(JSON.stringify({ ok: true, hasToken: readToken() !== null }));
              return;
            }
            res.writeHead(405);
            res.end();
          },
        }),
        ctx.webServer.register({
          kind: "exact",
          path: "/dsm/config",
          handler: async (req, res) => {
            if (req.method === "GET") {
              res.writeHead(200, JSON_HEADERS);
              res.end(JSON.stringify({ ok: true, config: readConfig() }));
              return;
            }
            if (req.method === "POST") {
              try {
                const raw = await readBody(req);
                const cfg = JSON.parse(raw || "{}");
                if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
                  throw new Error("config must be a JSON object");
                }
                writeConfig(cfg);
                res.writeHead(200, JSON_HEADERS);
                res.end(JSON.stringify({ ok: true, config: cfg }));
              } catch (e) {
                res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ ok: false, error: String(e?.message ?? e) }));
              }
              return;
            }
            res.writeHead(405);
            res.end();
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
