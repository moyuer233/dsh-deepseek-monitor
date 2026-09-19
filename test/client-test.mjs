// dsh-deepseek-monitor / test/client-test.mjs
//
// 浏览器半（lib/client.js）是手工打包的 CJS factory，没法直接 import。这里塞一个假的
// __ModuleLoader__ 把 factory 取出来，只对纯函数 moveInOrder（拖动排序的位次换算）做自检。
// 退出码 = 失败数（与仓库其它自检脚本一致）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "..", "lib", "client.js"), "utf8");

let failures = 0;
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`[OK]   ${name}`);
  } else {
    failures++;
    console.log(`[FAIL] ${name}\n       实际 ${a}\n       期望 ${e}`);
  }
};

// ── 取 factory ────────────────────────────────────────────────────────────
let factory = null;
const fakeWindow = {
  __ModuleLoader__: {
    load: (def) => {
      factory = def.factory;
    }
  }
};
const noop = () => null;
const reactStub = {
  createElement: noop,
  Fragment: {},
  useState: () => [null, () => {}],
  useRef: () => ({ current: null }),
  useEffect: () => {},
  useSyncExternalStore: () => ({}),
  createContext: () => ({})
};
const reactDomStub = { createPortal: noop };

new Function("window", "document", "navigator", source)(fakeWindow, { body: null }, {});

if (typeof factory !== "function") {
  console.log("[FAIL] 没能从 client.js 取到 factory（bundle 结构变了？）");
  process.exit(1);
}

const mod = factory((id) => (id === "react" ? reactStub : reactDomStub));
const moveInOrder = mod.__moveInOrder;

if (typeof moveInOrder !== "function") {
  console.log("[FAIL] client.js 没有导出 __moveInOrder（拖动排序的自检钩子丢了）");
  process.exit(1);
}

eq(
  "bundle 仍导出 apply / inject",
  [typeof mod.apply, mod.inject],
  ["function", ["slots", "locale"]]
);

// ── moveInOrder：可见块的位次 → 完整 order 新顺序 ────────────────────────────
const all = () => true;
const A = ["a", "b", "c", "d"];

eq("右移：a → 位次 2", moveInOrder(A, all, "a", 2), ["b", "c", "a", "d"]);
eq("左移：d → 位次 0", moveInOrder(A, all, "d", 0), ["d", "a", "b", "c"]);
eq("移到末尾：a → 位次 3（= 其余可见项个数）", moveInOrder(A, all, "a", 3), ["b", "c", "d", "a"]);
eq("原位：c → 位次 2 不变", moveInOrder(A, all, "c", 2), A);
eq("越界钳制：b → 99 落到末尾", moveInOrder(A, all, "b", 99), ["a", "c", "d", "b"]);
eq("负数钳制：b → -3 落到开头", moveInOrder(A, all, "b", -3), ["b", "a", "c", "d"]);
eq("未知键：原样返回", moveInOrder(A, all, "zz", 1), A);
eq("非数组入参：返回空数组", moveInOrder(null, all, "a", 0), []);

// 隐藏项必须留在原有的相对位置：只在可见序列里 splice 的实现会把它挤走
const hiddenB = (k) => k !== "b";
eq("隐藏项保位：d → 位次 0（b 隐藏）", moveInOrder(A, hiddenB, "d", 0), ["d", "a", "b", "c"]);
eq("隐藏项保位：a → 末尾（b 隐藏）", moveInOrder(A, hiddenB, "a", 2), ["b", "c", "d", "a"]);

// 真实键位：面板隐藏「月 Token / 月费用」时，把「总费用」拖到最前
const ITEMS = ["balance", "dayTokens", "monthTokens", "dayCost", "monthCost", "totalCost", "totalTokens"];
const realVisible = (k) => k !== "monthTokens" && k !== "monthCost";
const expectedReal = ["totalCost", "balance", "dayTokens", "monthTokens", "dayCost", "monthCost", "totalTokens"];
eq("真实键位：totalCost → 位次 0（隐藏 month*）", moveInOrder(ITEMS, realVisible, "totalCost", 0), expectedReal);

// ── 判据自证：错误做法（只 splice 可见序列）必须与期望不同 ────────────────────
const naive = (order, key, target) => {
  const vis = order.filter((k) => realVisible(k));
  const rest = vis.filter((k) => k !== key);
  rest.splice(target, 0, key);
  return rest;
};
if (JSON.stringify(naive(ITEMS, "totalCost", 0)) === JSON.stringify(expectedReal)) {
  failures++;
  console.log("[FAIL] 判据无效：错误做法也算出了同一个结果，这条用例区分不出对错");
} else {
  console.log("[OK]   判据自证：错误做法（可见序列 splice）与期望不同");
}

// ── 余额不足提醒：阈值 / 静默 / 间隔 ────────────────────────────────────────
const shouldAlert = mod.__shouldAlertLowBalance;
const recovered = mod.__lowBalanceRecovered;
const H = 3600000;
const base = {
  enabled: true,
  balance: 4,
  threshold: 5,
  now: 1000 * H,
  mutedUntil: 0,
  lastShownAt: 0,
  intervalMin: 360
};

eq("低于阈值：该弹", shouldAlert({ ...base }), true);
eq("开关关闭：不弹", shouldAlert({ ...base, enabled: false }), false);
eq("余额等于阈值：不弹（>= 视为够用）", shouldAlert({ ...base, balance: 5 }), false);
eq("余额高于阈值：不弹", shouldAlert({ ...base, balance: 12.34 }), false);
eq("余额非数字：不弹", shouldAlert({ ...base, balance: "abc" }), false);
eq("余额为 null：不弹（别把 null 当 0）", shouldAlert({ ...base, balance: null }), false);
eq("余额为 undefined：不弹", shouldAlert({ ...base, balance: undefined }), false);
eq("余额是字符串数字：照常判（\"4\" 该弹）", shouldAlert({ ...base, balance: "4" }), true);
eq("阈值缺失：按默认 ¥5 判（4 元该弹）", shouldAlert({ ...base, threshold: undefined }), true);
eq("阈值缺失：按默认 ¥5 判（6 元不弹）", shouldAlert({ ...base, balance: 6, threshold: undefined }), false);
eq("「今天不再提醒」未到点：不弹", shouldAlert({ ...base, mutedUntil: base.now + 1 }), false);
eq("静默刚好到点：该弹", shouldAlert({ ...base, mutedUntil: base.now }), true);
eq("间隔内（1 小时前弹过 / 间隔 6 小时）：不弹", shouldAlert({ ...base, lastShownAt: base.now - H }), false);
eq("超过间隔（7 小时前弹过 / 间隔 6 小时）：该弹", shouldAlert({ ...base, lastShownAt: base.now - 7 * H }), true);
eq("间隔 0.5 小时：1 小时前弹过也该弹", shouldAlert({ ...base, intervalMin: 30, lastShownAt: base.now - H }), true);
eq(
  "间隔非法（0）：钳到最小 1 分钟 ⇒ 1 小时前弹过也弹",
  shouldAlert({ ...base, intervalMin: 0, lastShownAt: base.now - H }),
  true
);
eq(
  "间隔非数字：回退默认 6 小时 ⇒ 1 小时前弹过不弹",
  shouldAlert({ ...base, intervalMin: "abc", lastShownAt: base.now - H }),
  false
);
eq("now 非数字：不弹", shouldAlert({ ...base, now: undefined }), false);

eq("回升判据：余额 >= 阈值 为真", recovered(5, 5), true);
eq("回升判据：余额 < 阈值 为假", recovered(4.99, 5), false);
eq("回升判据：拿不到余额时视为已回升（只用于清静默记录）", recovered(null, 5), true);

console.log(failures === 0 ? "[OK] client 自检通过" : `[FAIL] ${failures} 项`);
process.exit(failures);
