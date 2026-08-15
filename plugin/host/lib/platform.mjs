// @local/dsh-host-deepseek-usage / lib/platform.mjs
//
// platform.deepseek.com 内部 API 客户端（仅读，Bearer 平台 token）。
// 端点来自 deepseek-usage-monitor 项目对平台 Web 接口的逆向：
//   GET /api/v0/users/get_user_summary   账户汇总（余额/本月 token/费用）
//   GET /api/v0/usage/amount?month&year  按天 token 用量
//   GET /api/v0/usage/cost?month&year    按天费用
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
  if (biz?.biz_code !== 0) throw new Error(`platform biz_code ${biz?.biz_code}`);
  return biz?.biz_data;
}

export function fetchSummary(token) {
  return platformGet(token, "/users/get_user_summary");
}

export function fetchMonthlyUsage(token, month, year) {
  return platformGet(token, "/usage/amount", { month, year });
}

export function fetchMonthlyCost(token, month, year) {
  return platformGet(token, "/usage/cost", { month, year });
}

// ── 聚合（纯函数，便于测试）───────────────────────────────────────────────

/** 某一天条目的 token 汇总：{ prompt, completion, cacheHit, cacheMiss, total } */
export function summarizeDayUsage(dayEntry) {
  let prompt = 0;
  let completion = 0;
  let cacheHit = 0;
  let cacheMiss = 0;
  for (const modelEntry of dayEntry?.data ?? []) {
    for (const u of modelEntry?.usage ?? []) {
      const amt = Number(u.amount ?? 0) || 0;
      switch (u.type) {
        case "PROMPT_TOKEN":
          prompt += amt;
          break;
        case "PROMPT_CACHE_HIT_TOKEN":
          prompt += amt;
          cacheHit += amt;
          break;
        case "PROMPT_CACHE_MISS_TOKEN":
          prompt += amt;
          cacheMiss += amt;
          break;
        case "RESPONSE_TOKEN":
          completion += amt;
          break;
        default:
          break;
      }
    }
  }
  return { prompt, completion, cacheHit, cacheMiss, total: prompt + completion };
}

/** 某一天条目的费用（元）。 */
export function dayCost(dayEntry) {
  let cost = 0;
  for (const modelEntry of dayEntry?.data ?? []) {
    for (const u of modelEntry?.usage ?? []) cost += Number(u.amount ?? 0) || 0;
  }
  return cost;
}

/** 账户汇总：余额 / 赠送余额（平台 summary 端点不提供月度 token，月度数据按天累计）。 */
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

/** 今日聚合：传入本月 usage/cost 的 biz_data 与今日日期串（YYYY-MM-DD）。 */
export function summarizeToday(usageData, costData, today) {
  const usageDays = Array.isArray(usageData?.days) ? usageData.days : [];
  const costContainer = Array.isArray(costData) ? costData[0] : costData;
  const costDays = Array.isArray(costContainer?.days) ? costContainer.days : [];
  const usage = summarizeDayUsage(usageDays.find((d) => d.date === today));
  return { ...usage, cost: dayCost(costDays.find((d) => d.date === today)) };
}

/** 本月聚合：把 usage/cost 的按天数据全部累加（与平台页面口径一致）。 */
export function summarizeMonth(usageData, costData) {
  const usageDays = Array.isArray(usageData?.days) ? usageData.days : [];
  const costContainer = Array.isArray(costData) ? costData[0] : costData;
  const costDays = Array.isArray(costContainer?.days) ? costContainer.days : [];
  let tokens = 0;
  let cost = 0;
  for (const day of usageDays) tokens += summarizeDayUsage(day).total;
  for (const day of costDays) cost += dayCost(day);
  return { tokens, cost };
}
