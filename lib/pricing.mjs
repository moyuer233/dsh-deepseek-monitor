// 定价表：人民币元 / 每 100 万 token（CNY per MTok）。
// 默认值基于 DeepSeek 官方公开价格，可用环境变量覆盖（模型名转大写、非字母数字转下划线）：
//   DS_PRICE_DEEPSEEK_CHAT_IN=0.27
//   DS_PRICE_DEEPSEEK_CHAT_CACHE_HIT=0.07
//   DS_PRICE_DEEPSEEK_CHAT_OUT=1.10
// 未知模型使用 FALLBACK，请按你的实际合同价配置。

const DEFAULT_PRICING = Object.freeze({
  "deepseek-chat": Object.freeze({ in: 0.27, cacheHit: 0.07, out: 1.1 }),
  "deepseek-reasoner": Object.freeze({ in: 0.55, cacheHit: 0.14, out: 2.19 }),
  "deepseek-v4-pro": Object.freeze({ in: 1.0, cacheHit: 0.25, out: 3.0 }),
});

const FALLBACK = Object.freeze({ in: 1.0, cacheHit: 0.1, out: 2.0 });

function envKey(model, suffix) {
  return `DS_PRICE_${model.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${suffix}`;
}

/** 取某个模型的单价（环境变量优先，其次默认表，未知模型走 FALLBACK）。 */
export function modelPricing(model) {
  const base = DEFAULT_PRICING[model] ?? FALLBACK;
  const num = (v, d) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  return {
    in: num(process.env[envKey(model, "IN")], base.in),
    cacheHit: num(process.env[envKey(model, "CACHE_HIT")], base.cacheHit),
    out: num(process.env[envKey(model, "OUT")], base.out),
  };
}

/**
 * 按 DeepSeek / Anthropic 用量字段计算费用。
 * Anthropic 协议里 input_tokens 不含缓存 token：
 *  - cache_creation_input_tokens 按全价输入计
 *  - cache_read_input_tokens 按缓存命中价计
 */
export function computeCost(usage, pricing) {
  const inputTokens = usage?.input_tokens ?? 0;
  const cacheCreation = usage?.cache_creation_input_tokens ?? 0;
  const cacheRead = usage?.cache_read_input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const inputCost = (inputTokens / 1e6) * pricing.in;
  const cacheCreationCost = (cacheCreation / 1e6) * pricing.in;
  const cacheReadCost = (cacheRead / 1e6) * pricing.cacheHit;
  const outputCost = (outputTokens / 1e6) * pricing.out;
  return {
    inputTokens,
    cacheCreation,
    cacheRead,
    outputTokens,
    inputCost,
    cacheCreationCost,
    cacheReadCost,
    outputCost,
    totalCostCny: inputCost + cacheCreationCost + cacheReadCost + outputCost,
  };
}
