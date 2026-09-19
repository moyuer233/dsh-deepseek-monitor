// dsh-deepseek-monitor / lib/platform.mjs
//
// platform.deepseek.com 内部 API 客户端（仅读，Bearer 平台 token）。
// 端点（在平台前端 main.*.js 里确认过，并逐个实打验证）：
//   GET /api/v0/users/get_user_summary                账户汇总（余额/赠送/累计费用）
//   GET /api/v0/users/get_api_keys                    账户下的 API Key 列表
//   GET /api/v0/usage/by_api_key/amount?start&end&tz  按 Key 的 token 用量（秒级窗口）
//   GET /api/v0/usage/by_api_key/cost?start&end&tz    按 Key 的费用
//
// 为什么改用 by_api_key：/usage/amount 是**账户级**、按模型聚合、**没有 Key 维度**，
// 而平台页面顶部那个「API Key」筛选走的就是 by_api_key 这两个接口。
// 账户下有多个 Key 时，用 /usage/amount 得到的数字必然大于页面筛选后的数字。
// 响应包裹：{ code: 0, data: { biz_code: 0, biz_data: ... } }
//
// 测试可用 DS_PLATFORM_BASE 指向 mock 服务。

const DEFAULT_BASE = "https://platform.deepseek.com/api/v0";

export function platformBase() {
  return process.env.DS_PLATFORM_BASE ?? DEFAULT_BASE;
}

async function platformGet(token, path, params = {}) {
  const url = new URL(platformBase() + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-app-version": "1.0.0",
      Origin: "https://platform.deepseek.com",
      Referer: "https://platform.deepseek.com/usage",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`platform HTTP ${res.status}`);
  const body = await res.json();
  if (body?.code !== 0) throw new Error(`platform code ${body?.code}${body?.msg ? `: ${body.msg}` : ""}`);
  const biz = body?.data;
  if (biz?.biz_code !== 0) throw new Error(`platform biz_code ${biz?.biz_code}${biz?.biz_msg ? `: ${biz.biz_msg}` : ""}`);
  return biz?.biz_data;
}

export function fetchSummary(token) {
  return platformGet(token, "/users/get_user_summary");
}

export function fetchApiKeys(token) {
  return platformGet(token, "/users/get_api_keys");
}

/** 按 Key 的 token 用量。窗口是**秒级**：start/end 为 epoch 秒，tz 为时区偏移秒数。 */
export function fetchUsageByKey(token, { start, end, tz }) {
  return platformGet(token, "/usage/by_api_key/amount", { start, end, tz });
}

/** 按 Key 的费用。 */
export function fetchCostByKey(token, { start, end, tz }) {
  return platformGet(token, "/usage/by_api_key/cost", { start, end, tz });
}

// ── 聚合（纯函数，便于测试）───────────────────────────────────────────────

/** trackingId 传这个值表示"不分 Key、全部合计"。 */
export const ALL_KEYS = "all";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 从 by_api_key/amount 的 biz_data 汇总某个 Key 的 token。 */
export function summarizeKeyUsage(amountBiz, trackingId = ALL_KEYS) {
  const acc = { prompt: 0, completion: 0, cacheHit: 0, cacheMiss: 0, total: 0 };
  for (const series of amountBiz?.series ?? []) {
    if (trackingId !== ALL_KEYS && series.api_key?.tracking_id !== trackingId) continue;
    for (const bucket of series.buckets ?? []) {
      const u = bucket.usage ?? {};
      const hit = num(u.PROMPT_CACHE_HIT_TOKEN);
      const miss = num(u.PROMPT_CACHE_MISS_TOKEN);
      const plain = num(u.PROMPT_TOKEN);
      const resp = num(u.RESPONSE_TOKEN);
      acc.cacheHit += hit;
      acc.cacheMiss += miss;
      acc.completion += resp;
      acc.prompt += plain + hit + miss;
      acc.total += plain + hit + miss + resp;
    }
  }
  return acc;
}

/**
 * 从 by_api_key/cost 的 biz_data 汇总某个 Key 的费用。
 * 注意它的 series 嵌在 data[] 里按币种分组，优先取 CNY。
 */
export function summarizeKeyCost(costBiz, trackingId = ALL_KEYS) {
  const containers = costBiz?.data ?? [];
  const cny = containers.find((c) => c.currency === "CNY") ?? containers[0];
  let cost = 0;
  for (const series of cny?.series ?? []) {
    if (trackingId !== ALL_KEYS && series.api_key?.tracking_id !== trackingId) continue;
    for (const bucket of series.buckets ?? []) cost += num(bucket.cost);
  }
  return cost;
}

/** 账户汇总：余额 / 赠送余额（账户级，与 Key 无关）。 */
export function summarizeSummary(summary) {
  const walletBalance = (arr) => {
    const w = Array.isArray(arr) ? arr[0] : undefined;
    const n = Number(w?.balance ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    balance: walletBalance(summary?.normal_wallets),
    bonusBalance: walletBalance(summary?.bonus_wallets),
  };
}

/** API Key 列表（只留 UI 要用到的字段）。 */
export function summarizeApiKeys(keysBiz) {
  return (keysBiz?.api_keys ?? []).map((k) => ({
    trackingId: k.tracking_id,
    name: k.name || k.tracking_id,
    keyType: k.key_type ?? "NORMAL",
    lastUse: k.last_use ?? 0,
  }));
}
