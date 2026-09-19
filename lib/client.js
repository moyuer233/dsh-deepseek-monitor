// dsh-deepseek-monitor / lib/client.js
//
// 浏览器半（手工打包的 CJS factory，格式与官方 dsh-client-ui-* bundle 一致）。
// 展示位，全部由配置开关（齿轮面板里的滑块）控制：
//   1. conversation.session.header.actions — 会话头部横向信息段（点击弹完整详情）
//   2. sidebar.footer.action               — 侧边栏底部竖排
// 每 60s 轮询宿主路由 GET /dsm/usage；配置持久化在 localStorage。
window.__ModuleLoader__.load({
	id: "dsh-deepseek-monitor-moyuer233",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");

		//#region 字典
		const zh = {
			"balance": "余额",
			"bonus": "赠送",
			"month": "本月",
			"month.tokens": "本月 Token",
			"month.cost": "本月费用",
			"today": "今日",
			"today.tokens": "总量",
			"today.prompt": "输入(含缓存)",
			"today.completion": "输出",
			"today.cacheHit": "缓存命中",
			"today.cacheMiss": "缓存未命中",
			"today.cost": "费用",
			"today.total": "今日 Token 总量",
			"local": "本地代理",
			"local.records": "记录",
			"local.tokens": "Token",
			"local.cost": "费用",
			"refresh": "刷新",
			"updated": "更新于",
			"loading": "加载中…",
			"noToken.title": "未配置平台 Token",
			"noToken.hint": "把 platform.deepseek.com 浏览器里的 userToken 写入 ~/.dsh/deepseek-monitor/platform-token 后重启",
			"fetchFailed": "获取失败",
			"config": "配置",
			"config.title": "显示项",
			"config.desc": "滑块控制显示/隐藏",
			"cfg.drag.hint": "（可以通过拖动显示块来调整顺序）",
			"cfg.lowBalance": "余额不足提醒",
			"cfg.lowBalance.desc": "余额低于阈值时弹窗提醒（关掉即完全不弹）",
			"cfg.lowBalance.threshold": "低于此余额就提醒（¥）",
			"cfg.lowBalance.interval": "重复提醒间隔（小时）",
			"cfg.lowBalance.hint": "余额第一次跌破阈值会立刻弹；一直没处理时，每隔「重复提醒间隔」再弹一次。「今天不再提醒」静默到次日零点，余额回到阈值以上会自动解除静默。",
			"alert.title": "余额不足",
			"alert.balance": "当前余额",
			"alert.threshold": "提醒阈值",
			"alert.topup": "去充值",
			"alert.muteToday": "今天不再提醒",
			"alert.close": "知道了",
			"cfg.balance": "余额",
			"cfg.balance.desc": "账户余额（¥）",
			"cfg.dayTokens": "日 Token",
			"cfg.dayTokens.desc": "今日 Token 总量（含缓存）",
			"cfg.dayCost": "日费用",
			"cfg.dayCost.desc": "今日花费（¥）",
			"cfg.monthTokens": "月 Token",
			"cfg.monthTokens.desc": "本月 Token 总量",
			"cfg.monthCost": "月费用",
			"cfg.monthCost.desc": "本月花费（¥）",
			"cfg.totalTokens": "Token 总量",
			"cfg.totalTokens.desc": "累计 Token 总量",
			"cfg.totalCost": "总费用",
			"cfg.totalCost.desc": "累计花费（¥）",
			"cfg.sidebar": "侧边栏底部",
			"cfg.sidebar.desc": "在左侧边栏底部竖排显示",
			"cfg.sidebar.items": "侧边栏显示项",
			"cfg.sidebar.items.hint": "侧边栏用自己的一套，与上面头部的顺序无关：这里的开关只控制显示；顺序直接在侧边栏里长按某一项拖动调整（侧边栏收起成窄条时先展开）。",
			"token.section": "平台 Token",
			"token.howto": "① 打开平台页登录 ② 把「获取 Token」链接拖到浏览器书签栏，之后在平台页点一下书签即自动复制 ③ 回来粘贴保存（自动去引号）",
			"token.open": "打开平台页面",
			"token.bookmark": "🔑 获取 Token（拖我到书签栏）",
			"token.bookmark.hint": "拖动上方链接到书签栏；登录平台页后点击书签即自动复制 Token",
			"token.copyBookmark": "复制书签链接",
			"token.copySnippet": "复制控制台代码（备用）",
			"token.readClipboard": "从剪贴板读取",
			"token.input": "在此粘贴 userToken…（自动去除引号）",
			"token.save": "保存",
			"token.saved": "已保存，正在刷新…",
			"token.copied": "已复制，去平台页面执行（书签/控制台皆可）",
			"token.clipboardFail": "读取剪贴板失败：请直接 Ctrl+V 粘贴",
			"token.status.ok": "Token 有效 ✓",
			"token.status.missing": "未配置 Token",
			"token.status.invalid": "Token 无效或平台异常",
			"seg.day": "日",
			"seg.dayCost": "日费",
			"seg.month": "月",
			"seg.monthCost": "月费",
			"seg.total": "总量",
			"seg.totalCost": "总费",
			"cfg.lang": "语言",
			"cfg.key": "API Key",
			"cfg.key.all": "全部 Key",
			"cfg.key.hint": "与平台页面的「API Key」筛选同口径",
			"total.tokens": "累计 Token",
			"total.cost": "累计费用",
			"detail": "详情",
			"open.platform": "打开平台充值页",
			"open.platform.short": "充值",
			"balance.tooltip": "DeepSeek 平台用量（长按可拖动排序）"
		};
		const en = {
			"balance": "Balance",
			"bonus": "Bonus",
			"month": "This month",
			"month.tokens": "Tokens",
			"month.cost": "Cost",
			"today": "Today",
			"today.tokens": "Total",
			"today.prompt": "Input (incl. cache)",
			"today.completion": "Output",
			"today.cacheHit": "Cache hit",
			"today.cacheMiss": "Cache miss",
			"today.cost": "Cost",
			"today.total": "Today total tokens",
			"local": "Local proxy",
			"local.records": "Records",
			"local.tokens": "Tokens",
			"local.cost": "Cost",
			"refresh": "Refresh",
			"updated": "Updated",
			"loading": "Loading…",
			"noToken.title": "Platform token missing",
			"noToken.hint": "Write the userToken from platform.deepseek.com browser into ~/.dsh/deepseek-monitor/platform-token and restart",
			"fetchFailed": "Fetch failed",
			"config": "Settings",
			"config.title": "Display items",
			"config.desc": "Switches control visibility",
			"cfg.drag.hint": "(You can drag the blocks to change their order.)",
			"cfg.lowBalance": "Low-balance alert",
			"cfg.lowBalance.desc": "Popup when the balance drops below the threshold (turn off to disable)",
			"cfg.lowBalance.threshold": "Alert below this balance (¥)",
			"cfg.lowBalance.interval": "Repeat reminder interval (hours)",
			"cfg.lowBalance.hint": "The first drop below the threshold pops up right away; while the balance stays below it, the popup repeats once per \"repeat reminder interval\". \"Don't remind me today\" stays quiet until midnight, and the mute clears automatically once the balance is back above the threshold.",
			"alert.title": "Low balance",
			"alert.balance": "Current balance",
			"alert.threshold": "Threshold",
			"alert.topup": "Top up",
			"alert.muteToday": "Don't remind me today",
			"alert.close": "Got it",
			"cfg.balance": "Balance",
			"cfg.balance.desc": "Account balance (¥)",
			"cfg.dayTokens": "Day tokens",
			"cfg.dayTokens.desc": "Today total tokens (incl. cache)",
			"cfg.dayCost": "Day cost",
			"cfg.dayCost.desc": "Today spend (¥)",
			"cfg.monthTokens": "Month tokens",
			"cfg.monthTokens.desc": "Month-to-date tokens",
			"cfg.monthCost": "Month cost",
			"cfg.monthCost.desc": "Month-to-date spend (¥)",
			"cfg.totalTokens": "Total tokens",
			"cfg.totalTokens.desc": "Cumulative tokens",
			"cfg.totalCost": "All-time cost",
			"cfg.totalCost.desc": "Cumulative spend (¥)",
			"cfg.sidebar": "Sidebar footer",
			"cfg.sidebar.desc": "Vertical stack at the bottom of the left sidebar",
			"cfg.sidebar.items": "Sidebar items",
			"cfg.sidebar.items.hint": "The sidebar keeps its own set, independent of the header above: the switches here only control visibility; to change the order, long-press a row in the sidebar and drag it (expand the sidebar first if it is collapsed).",
			"token.section": "Platform token",
			"token.howto": "① Open the platform page and sign in ② Drag the 'Get Token' link to the bookmarks bar; click it on the platform page to auto-copy ③ Paste here and save (quotes stripped)",
			"token.open": "Open platform page",
			"token.bookmark": "🔑 Get Token (drag me to the bookmarks bar)",
			"token.bookmark.hint": "Drag the link above to the bookmarks bar; click it on the platform page to auto-copy the token",
			"token.copyBookmark": "Copy bookmark link",
			"token.copySnippet": "Copy console code (fallback)",
			"token.readClipboard": "Read from clipboard",
			"token.input": "Paste userToken here… (quotes auto-stripped)",
			"token.save": "Save",
			"token.saved": "Saved, refreshing…",
			"token.copied": "Copied — run it on the platform page (bookmark or console)",
			"token.clipboardFail": "Clipboard read failed: paste with Ctrl+V instead",
			"token.status.ok": "Token valid ✓",
			"token.status.missing": "Token missing",
			"token.status.invalid": "Invalid token or platform error",
			"seg.day": "Day",
			"seg.dayCost": "Day cost",
			"seg.month": "Month",
			"seg.monthCost": "Month cost",
			"seg.total": "Total",
			"seg.totalCost": "Total cost",
			"total.tokens": "Total tokens",
			"total.cost": "Total cost",
			"detail": "Details",
			"open.platform": "Open platform top-up page",
			"open.platform.short": "Top up",
			"balance.tooltip": "DeepSeek platform usage (long-press to reorder)",
			"cfg.lang": "Language",
			"cfg.key": "API Key",
			"cfg.key.all": "All keys",
			"cfg.key.hint": "Same scope as the API Key filter on the platform page"
		};
		//#endregion

		//#region 语言（插件独立语言选择，默认中文，不受应用界面语言影响）
		const DICTS = { zh, en };
		function trKey(lang, key) {
			const dict = DICTS[lang] || DICTS.zh;
			return (dict && dict[key]) || zh[key] || key;
		}
		//#endregion

		//#region 工具函数
		function fmtCny(n) {
			const v = Number(n ?? 0);
			return Number.isFinite(v) ? `¥${v.toFixed(2)}` : "—";
		}
		function fmtTokens(n) {
			const v = Number(n ?? 0);
			if (!Number.isFinite(v)) return "—";
			if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
			if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
			if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
			return String(v);
		}
		function fmtTime(iso) {
			if (!iso) return "";
			const d = new Date(iso);
			const p = (x) => String(x).padStart(2, "0");
			return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
		}
		const CFG_KEY = "dsh.dsm-usage.config";
		/**
		 * 余额不足提醒的运行期状态（上次提醒时间 / 静默到何时）。
		 *
		 * 刻意只写 localStorage，不走 updateCfg：updateCfg 会把**整份** currentCfg POST 给宿主，
		 * 而提醒是在"数据刚到"时就可能触发的——那一刻宿主配置（语言/顺序/Key/开关）也许还没
		 * 加载回来，一写就会把用户设置覆盖成默认值。
		 */
		const ALERT_STATE_KEY = "dsh.dsm-usage.alert-state";
		function loadAlertState() {
			try {
				const raw = JSON.parse(localStorage.getItem(ALERT_STATE_KEY) || "{}");
				return { lastShownAt: Number(raw.lastShownAt) || 0, mutedUntil: Number(raw.mutedUntil) || 0 };
			} catch {
				return { lastShownAt: 0, mutedUntil: 0 };
			}
		}
		function saveAlertState(next) {
			try {
				localStorage.setItem(ALERT_STATE_KEY, JSON.stringify(next));
			} catch {
				/* 存不下就只在本次会话内生效 */
			}
			return next;
		}
		// 默认顺序与开关：余额开、日Token开、月Token关、日费用开、月费用关、总费用开、Token总量开；
		// 侧边栏底部默认关。
		const ITEM_KEYS = ["balance", "dayTokens", "monthTokens", "dayCost", "monthCost", "totalCost", "totalTokens"];
		/** 长按多久进入拖动排序（毫秒）。到点之前松开就当普通点击（打开详情）。 */
		const LONG_PRESS_MS = 250;
		/** 长按成立前允许的抖动（像素）：超过就说明是在划选/点击，不进入拖动。 */
		const MOVE_TOLERANCE_PX = 6;
		const CFG_DEFAULTS = {
			balance: true,
			dayTokens: true,
			monthTokens: false,
			dayCost: true,
			monthCost: false,
			totalCost: true,
			totalTokens: true,
			sidebar: false,
			lang: "zh",
			keyTrackingId: "all",
			lowBalanceAlert: true,
			lowBalanceThreshold: 5,
			lowBalanceIntervalMin: 360,
			order: [...ITEM_KEYS],
		};
		/** 数字配置项的兜底与钳制：手改/旧版写歪了也不至于弹出 NaN 或每次轮询都提醒。 */
		function clampNum(value, min, max, fallback) {
			const n = Number(value);
			if (!Number.isFinite(n)) return fallback;
			return Math.min(max, Math.max(min, n));
		}
		/** 必须是"真数字"才认（`Number(null)` 是 0，会把"拿不到余额"当成余额 0 去弹窗）。 */
		function strictNum(value) {
			if (typeof value === "number") return Number.isFinite(value) ? value : null;
			if (typeof value === "string" && value.trim() !== "") {
				const n = Number(value);
				return Number.isFinite(n) ? n : null;
			}
			return null;
		}
		/** 余额是否已回到阈值以上（回到以上就清静默记录，下次再跌破立刻提醒）。 */
		function lowBalanceRecovered(balance, threshold) {
			const bal = strictNum(balance);
			const thr = clampNum(threshold, 0, 100000, CFG_DEFAULTS.lowBalanceThreshold);
			return bal === null || bal >= thr; // 拿不到余额时按"已回升"处理（只影响静默记录）
		}
		/**
		 * 余额不足提醒此刻该不该弹（纯函数，便于自检）。三道门槛：
		 * 开关打开 / 余额低于阈值 / 不在静默期（「今天不再提醒」与「提醒间隔」）。
		 */
		function shouldAlertLowBalance(input) {
			if (!input || input.enabled !== true) return false;
			const bal = strictNum(input.balance);
			const thr = clampNum(input.threshold, 0, 100000, CFG_DEFAULTS.lowBalanceThreshold);
			if (bal === null || bal >= thr) return false;
			const now = Number(input.now);
			if (!Number.isFinite(now)) return false;
			if (now < Number(input.mutedUntil || 0)) return false;
			const intervalMs = clampNum(input.intervalMin, 1, 10080, CFG_DEFAULTS.lowBalanceIntervalMin) * 60000;
			const last = Number(input.lastShownAt || 0);
			if (last > 0 && now - last < intervalMs) return false;
			return true;
		}
		/** 旧版配置（balance/today/cost/month/tab）迁移到新字段。 */
		function migrateCfg(stored) {
			const out = { ...stored };
			if (out.today !== undefined || out.cost !== undefined || out.month !== undefined) {
				if (out.dayTokens === undefined) {
					out.dayTokens = out.today !== undefined ? out.today : true;
					out.dayCost = out.cost !== undefined ? out.cost : true;
					out.monthCost = out.month !== undefined ? out.month : false;
					out.monthTokens = out.month !== undefined ? out.month : false;
				}
			}
			delete out.today;
			delete out.cost;
			delete out.month;
			delete out.tab;
			if (!Array.isArray(out.order) || out.order.length === 0) out.order = [...ITEM_KEYS];
			out.lowBalanceThreshold = clampNum(out.lowBalanceThreshold, 0, 100000, CFG_DEFAULTS.lowBalanceThreshold);
			out.lowBalanceIntervalMin = clampNum(out.lowBalanceIntervalMin, 1, 10080, CFG_DEFAULTS.lowBalanceIntervalMin);
			// 侧边栏独立显示项：老配置没有这两个字段时按"与头部一致"推导 —— 升级后外观不变
			if (!Array.isArray(out.sidebarOrder)) out.sidebarOrder = [...out.order];
			else {
				out.sidebarOrder = out.sidebarOrder.filter((k) => ITEM_KEYS.includes(k));
				if (out.sidebarOrder.length === 0) out.sidebarOrder = [...out.order];
			}
			if (!Array.isArray(out.sidebarItems)) out.sidebarItems = out.order.filter((k) => out[k]);
			else out.sidebarItems = out.sidebarItems.filter((k) => ITEM_KEYS.includes(k));
			return out;
		}
		function loadCfg() {
			try {
				return { ...CFG_DEFAULTS, ...migrateCfg(JSON.parse(localStorage.getItem(CFG_KEY) || "{}")) };
			} catch {
				return { ...CFG_DEFAULTS };
			}
		}
		/** 段标签（头部/侧边栏短标签）。 */
		function segmentLabel(key, tr) {
			switch (key) {
				case "balance": return tr("balance");
				case "dayTokens": return tr("seg.day");
				case "dayCost": return tr("seg.dayCost");
				case "monthTokens": return tr("seg.month");
				case "monthCost": return tr("seg.monthCost");
				case "totalTokens": return tr("seg.total");
				case "totalCost": return tr("seg.totalCost");
				default: return key;
			}
		}
		/** 段取值。 */
		function segmentValue(key, data) {
			if (!data || data.ok !== true) return "…";
			switch (key) {
				case "balance": return fmtCny(data.summary?.balance);
				case "dayTokens": return fmtTokens(data.today?.total);
				case "dayCost": return fmtCny(data.today?.cost);
				case "monthTokens": return fmtTokens(data.monthUsage?.tokens);
				case "monthCost": return fmtCny(data.monthUsage?.cost);
				case "totalTokens": return data.alltime ? fmtTokens(data.alltime.tokens) : "—";
				case "totalCost": return data.alltime ? fmtCny(data.alltime.cost) : "—";
				default: return "…";
			}
		}
		function saveCfg(cfg) {
			try {
				localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
			} catch {
				/* 忽略存储失败 */
			}
		}
		// 共享响应式配置：三个展示位读同一份状态，改一处全局即时生效。
		// 持久化双通道：localStorage（会话内）+ 宿主 /dsm/config（跨启动，端口无关）。
		let currentCfg = loadCfg();
		const cfgListeners = new Set();
		let hostCfgApplied = false;
		function subscribeCfg(listener) {
			cfgListeners.add(listener);
			return () => cfgListeners.delete(listener);
		}
		function getCfg() {
			return currentCfg;
		}
		function emitCfg() {
			for (const listener of cfgListeners) listener();
		}
		function updateCfg(key, value) {
			currentCfg = { ...currentCfg, [key]: value };
			saveCfg(currentCfg);
			emitCfg();
			fetch("/dsm/config", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(currentCfg)
			}).catch(() => {});
		}
		function applyHostCfg(cfg) {
			if (hostCfgApplied || !cfg || typeof cfg !== "object") return;
			hostCfgApplied = true;
			currentCfg = { ...CFG_DEFAULTS, ...migrateCfg(cfg) };
			saveCfg(currentCfg);
			emitCfg();
		}
		function useCfg() {
			return react.useSyncExternalStore(subscribeCfg, getCfg);
		}
		/**
		 * 信息段的类名 + 一次性注入的小样式表。
		 *
		 * 内联样式写不了伪类：长按会让按钮成为焦点元素，鼠标操作结束后 Chromium 仍会画焦点环
		 * （看起来就是"拖完残留一圈白框，再点一下才消失"）。这里默认不画环，只在键盘聚焦
		 * （`:focus-visible`）时画一个明确的环，别把键盘可访问性一起丢掉。
		 */
		const SEG_CLASS = "dsm-usage-seg";
		let segStyleInjected = false;
		function ensureSegStyle() {
			if (segStyleInjected) return;
			segStyleInjected = true;
			try {
				const el = document.createElement("style");
				el.setAttribute("data-dsm-usage", "seg");
				el.textContent =
					"." + SEG_CLASS + "{outline:none}" +
					"." + SEG_CLASS + ":focus-visible{outline:2px solid var(--dsw-alias-accent,#4c8dff);outline-offset:1px}";
				document.head.appendChild(el);
			} catch {
				/* 注入失败就退回浏览器默认行为 */
			}
		}
		//#endregion

		//#region 样式（主题字体令牌，避免粗糙渲染）
		const F = {
			value: "var(--dsw-font-xs-strong-13)",
			text: "var(--dsw-font-xs-13)",
			small: "var(--dsw-font-xxs-12)",
			tiny: "var(--dsw-font-xxxs-11)"
		};
		const S = {
			row: {
				display: "inline-flex",
				alignItems: "center",
				gap: "4px"
			},
			seg: {
				boxSizing: "border-box",
				display: "inline-flex",
				alignItems: "center",
				gap: "5px",
				minHeight: "26px",
				padding: "2px 8px",
				border: "1px solid var(--dsw-alias-border-l2, #333)",
				borderRadius: "7px",
				background: "var(--dsw-alias-fill-l2, #2a2a2a)",
				color: "var(--dsw-alias-label-primary, #ddd)",
				cursor: "pointer",
				userSelect: "none",
				font: F.value,
				fontVariantNumeric: "tabular-nums",
				whiteSpace: "nowrap",
				transition: "background .12s"
			},
			segHover: {
				background: "var(--dsw-alias-interactive-bg-hover, #333)"
			},
			segLabel: {
				font: F.tiny,
				color: "var(--dsw-alias-label-tertiary, #888)"
			},
			dot: {
				width: "6px",
				height: "6px",
				borderRadius: "50%",
				flex: "none"
			},
			iconBtn: {
				boxSizing: "border-box",
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				width: "26px",
				height: "26px",
				border: "1px solid var(--dsw-alias-border-l2, #333)",
				borderRadius: "7px",
				background: "transparent",
				color: "var(--dsw-alias-label-tertiary, #888)",
				cursor: "pointer",
				fontSize: "13px",
				lineHeight: "1"
			},
			topUpBtn: {
				boxSizing: "border-box",
				display: "inline-flex",
				alignItems: "center",
				minHeight: "26px",
				padding: "2px 10px",
				border: "1px solid var(--dsw-alias-border-l2, #333)",
				borderRadius: "7px",
				background: "transparent",
				color: "var(--dsw-alias-label-secondary, #aaa)",
				cursor: "pointer",
				font: F.small,
				whiteSpace: "nowrap",
				transition: "background .12s"
			},
			popover: {
				zIndex: 100,
				position: "absolute",
				top: "calc(100% + 6px)",
				right: "0",
				width: "340px",
				maxWidth: "min(400px, calc(100vw - 32px))",
				// 面板内容会随功能增加而变长；不封顶的话底部「平台 Token」区会掉出窗口、点不到。
				maxHeight: "min(78vh, 760px)",
				overflowY: "auto",
				overscrollBehavior: "contain",
				boxSizing: "border-box",
				border: "1px solid var(--dsw-alias-border-l2, #333)",
				background: "var(--dsw-specific-menu, #1e1e1e)",
				borderRadius: "12px",
				boxShadow: "0 8px 24px rgba(0,0,0,.35)",
				padding: "12px",
				font: F.text,
				color: "var(--dsw-alias-label-primary, #ddd)"
			},
			rowLine: {
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				gap: "12px",
				padding: "3px 0"
			},
			label: {
				font: F.small,
				color: "var(--dsw-alias-label-secondary, #999)"
			},
			value: {
				font: F.value,
				fontVariantNumeric: "tabular-nums",
				whiteSpace: "nowrap"
			},
			section: {
				font: F.tiny,
				letterSpacing: ".06em",
				textTransform: "uppercase",
				color: "var(--dsw-alias-label-tertiary, #777)",
				margin: "10px 0 4px"
			},
			error: {
				boxSizing: "border-box",
				background: "color-mix(in srgb, var(--dsw-alias-danger, #f66) 12%, transparent)",
				border: "1px solid color-mix(in srgb, var(--dsw-alias-danger, #f66) 40%, transparent)",
				borderRadius: "8px",
				padding: "8px 10px",
				marginBottom: "8px",
				font: F.small,
				color: "var(--dsw-alias-danger, #f66)"
			},
			footer: {
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				marginTop: "10px",
				paddingTop: "8px",
				borderTop: "1px solid var(--dsw-alias-border-l2, #333)",
				font: F.tiny,
				color: "var(--dsw-alias-label-tertiary, #777)"
			},
			refreshBtn: {
				border: "1px solid var(--dsw-alias-border-l2, #333)",
				borderRadius: "6px",
				background: "transparent",
				color: "var(--dsw-alias-label-secondary, #aaa)",
				cursor: "pointer",
				font: F.tiny,
				padding: "3px 8px"
			},
			cell: {
				display: "flex",
				flexDirection: "column",
				gap: "1px"
			},
			cellValue: {
				font: F.value,
				fontVariantNumeric: "tabular-nums"
			},
			cellLabel: {
				font: F.tiny,
				color: "var(--dsw-alias-label-tertiary, #888)"
			},
			toggleRow: {
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				gap: "12px",
				padding: "7px 0"
			},
			segDrag: {
				opacity: 0.5,
				cursor: "grabbing",
				borderStyle: "dashed",
				borderColor: "var(--dsw-alias-accent, #4c8dff)",
				boxShadow: "inset 2px 0 0 0 var(--dsw-alias-accent, #4c8dff)"
			},
			toggleText: {
				minWidth: "0",
				flex: "1"
			},
			toggleLabel: {
				font: F.text
			},
			toggleDesc: {
				font: F.tiny,
				color: "var(--dsw-alias-label-tertiary, #888)",
				marginTop: "1px"
			},
			switch: {
				flex: "none",
				position: "relative",
				width: "34px",
				height: "20px",
				border: "0",
				borderRadius: "10px",
				background: "var(--dsw-alias-fill-l3, #444)",
				cursor: "pointer",
				padding: "0",
				transition: "background .15s"
			},
			switchOn: {
				background: "var(--dsw-alias-accent, #4c8dff)"
			},
			knob: {
				position: "absolute",
				top: "2px",
				left: "2px",
				width: "16px",
				height: "16px",
				borderRadius: "50%",
				background: "var(--dsw-static-neutral-0, #fff)",
				boxShadow: "0 1px 3px rgba(0,0,0,.35)",
				transition: "left .15s"
			},
			knobOn: {
				left: "16px"
			},
			configTitle: {
				font: F.value,
				margin: "0 0 2px"
			},
			configDesc: {
				font: F.tiny,
				color: "var(--dsw-alias-label-tertiary, #888)",
				margin: "0 0 6px"
			},
			// ── 竖排容器 ──
			stack: {
				display: "flex",
				flexDirection: "column",
				gap: "2px"
			},
			stackRow: {
				display: "flex",
				justifyContent: "space-between",
				alignItems: "baseline",
				gap: "8px",
				userSelect: "none",
				borderRadius: "6px"
			},
			stackDrag: {
				opacity: 0.5,
				borderStyle: "dashed",
				borderWidth: "1px",
				borderColor: "var(--dsw-alias-accent, #4c8dff)",
				cursor: "grabbing"
			},
			stackLabel: {
				font: F.tiny,
				color: "var(--dsw-alias-label-tertiary, #888)",
				whiteSpace: "nowrap"
			},
			stackValue: {
				font: F.small,
				fontVariantNumeric: "tabular-nums",
				whiteSpace: "nowrap"
			},
			panelCard: {
				boxSizing: "border-box",
				width: "100%",
				border: "1px solid var(--dsw-alias-border-l2, #333)",
				borderRadius: "12px",
				background: "var(--dsw-alias-fill-l2, #2a2a2a)",
				padding: "12px 14px"
			},
			sideRow: {
				display: "flex",
				alignItems: "center",
				gap: "6px",
				padding: "4px 0"
			},
			sideRowLabel: {
				flex: "1",
				minWidth: "0",
				font: F.small,
				color: "var(--dsw-alias-label-primary, #ddd)",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			},
			numField: {
				display: "flex",
				alignItems: "center",
				gap: "6px",
				font: F.small,
				color: "var(--dsw-alias-label-secondary, #999)"
			},
			numInput: {
				boxSizing: "border-box",
				width: "74px",
				padding: "3px 6px",
				border: "1px solid var(--dsw-alias-border-l2, #333)",
				borderRadius: "6px",
				background: "var(--dsw-alias-fill-l2, #2a2a2a)",
				color: "var(--dsw-alias-label-primary, #ddd)",
				font: F.text
			},
			alertBackdrop: {
				position: "fixed",
				inset: "0",
				zIndex: 2147483100,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "rgba(0,0,0,.45)"
			},
			alertCard: {
				boxSizing: "border-box",
				width: "320px",
				maxWidth: "calc(100vw - 32px)",
				border: "1px solid var(--dsw-alias-border-l2, #333)",
				borderRadius: "12px",
				background: "var(--dsw-specific-menu, #1e1e1e)",
				boxShadow: "0 8px 24px rgba(0,0,0,.45)",
				padding: "14px",
				color: "var(--dsw-alias-label-primary, #ddd)"
			},
			alertTitle: {
				font: F.value,
				marginBottom: "6px"
			},
			alertBody: {
				font: F.text,
				color: "var(--dsw-alias-label-secondary, #b0b0b0)",
				lineHeight: "1.6"
			},
			alertActions: {
				display: "flex",
				flexWrap: "wrap",
				gap: "6px",
				marginTop: "12px"
			}
		};
		//#endregion

		//#region 共享数据 store（单例轮询）
		// 会话头部与侧边栏是两个组件，若各自 fetch + 各自 60s 定时器，同一份数据
		// 会被拉两次（多开标签页再翻倍）。这里收敛成一个 store：模块级状态 +
		// 订阅通知 + 单飞请求 + 引用计数定时器 + 隐藏页暂停。
		const USAGE_POLL_MS = 60000;
		// 单次请求上限：fetch 本身没有超时，宿主若"接了连接却不回"，这个 promise 会一直
		// 挂着 ⇒ usageInflight 永不清空 ⇒ 之后每次轮询都拿到同一个 pending promise，
		// 刷新就永久停住了。必须自己掐断。
		const USAGE_FETCH_TIMEOUT_MS = 20000;
		let usageData = null;
		let usageInflight = null;
		let usageTimer = null;
		let usageRefs = 0;
		const usageListeners = new Set();

		function emitUsage() {
			for (const listener of usageListeners) {
				try {
					listener();
				} catch {
					/* 单个订阅者出错不该影响其它订阅者，也不该把 loadUsage 变成未处理拒绝 */
				}
			}
		}
		function subscribeUsage(listener) {
			usageListeners.add(listener);
			return () => usageListeners.delete(listener);
		}
		function getUsage() {
			return usageData;
		}

		/** 拉一次数据；并发调用共享同一个请求（force=true 跳过宿主缓存）。 */
		function loadUsage(force) {
			if (usageInflight) return usageInflight;
			usageInflight = (async () => {
				let next;
				const ctl = typeof AbortController === "function" ? new AbortController() : null;
				const timer = ctl ? setTimeout(() => ctl.abort(), USAGE_FETCH_TIMEOUT_MS) : null;
				try {
					const res = await fetch(force ? "/dsm/usage?force=1" : "/dsm/usage", {
						cache: "no-store",
						...(ctl ? { signal: ctl.signal } : {})
					});
					next = await res.json();
				} catch (e) {
					next = {
						ok: false,
						error: "FETCH_FAILED",
						message: String((e && e.message) || e)
					};
				} finally {
					if (timer !== null) clearTimeout(timer);
				}
				usageData = next;
				usageInflight = null;
				emitUsage();
				return next;
			})();
			return usageInflight;
		}

		function onUsageVisibility() {
			// 回到前台立刻补一次，后台标签页不产生请求。
			if (document.visibilityState === "visible") loadUsage(false);
		}
		function startUsagePolling() {
			if (usageTimer !== null) return;
			usageTimer = setInterval(() => {
				if (document.visibilityState !== "hidden") loadUsage(false);
			}, USAGE_POLL_MS);
			document.addEventListener("visibilitychange", onUsageVisibility);
		}
		function stopUsagePolling() {
			if (usageTimer === null) return;
			clearInterval(usageTimer);
			usageTimer = null;
			document.removeEventListener("visibilitychange", onUsageVisibility);
		}

		function useDsmUsage() {
			const data = react.useSyncExternalStore(subscribeUsage, getUsage, () => null);
			react.useEffect(() => {
				usageRefs += 1;
				startUsagePolling();
				loadUsage(false);
				return () => {
					usageRefs -= 1;
					if (usageRefs <= 0) stopUsagePolling();
				};
			}, []);
			return { data, reload: () => loadUsage(true) };
		}
		//#endregion

		//#region 基础组件
		function Row(props) {
			return react.createElement(
				"div",
				{ style: S.rowLine },
				react.createElement("span", { style: S.label }, props.label),
				react.createElement("span", { style: S.value }, props.value)
			);
		}
		function Cell(props) {
			return react.createElement(
				"div",
				{ style: S.cell },
				react.createElement("span", { style: S.cellLabel, children: props.label }),
				react.createElement("span", { style: S.cellValue, children: props.value })
			);
		}
		/** 侧边栏显示项的一行：名称 + 显示开关（顺序在侧边栏里长按拖动调整）。 */
		function SideRow(props) {
			return react.createElement(
				"div",
				{ style: S.sideRow },
				react.createElement("span", { style: S.sideRowLabel, children: props.label }),
				react.createElement(
					"button",
					{
						type: "button",
						role: "switch",
						"aria-checked": props.checked,
						style: { ...S.switch, ...(props.checked ? S.switchOn : {}) },
						onClick: () => props.onToggle(!props.checked)
					},
					react.createElement("span", { style: { ...S.knob, ...(props.checked ? S.knobOn : {}) } })
				)
			);
		}
		/** 数字输入行（面板里的「阈值 / 间隔」）。输入框允许中途为空，失焦回填当前值。 */
		function NumField(props) {
			const [text, setText] = react.useState(String(props.value));
			react.useEffect(() => {
				setText(String(props.value));
			}, [props.value]);
			return react.createElement(
				"label",
				{ style: S.numField },
				react.createElement("span", { children: props.label }),
				react.createElement("input", {
					type: "number",
					value: text,
					min: props.min,
					max: props.max,
					step: props.step,
					style: S.numInput,
					onChange: (e) => {
						setText(e.target.value);
						const n = Number(e.target.value);
						if (e.target.value !== "" && Number.isFinite(n)) {
							props.onChange(Math.min(props.max, Math.max(props.min, n)));
						}
					},
					onBlur: () => setText(String(props.value))
				})
			);
		}
		function Toggle(props) {
			return react.createElement(
				"div",
				{ style: S.toggleRow },
				react.createElement(
					"div",
					{ style: S.toggleText },
					react.createElement("div", { style: S.toggleLabel, children: props.label }),
					props.desc && react.createElement("div", { style: S.toggleDesc, children: props.desc })
				),
				react.createElement(
					"button",
					{
						type: "button",
						role: "switch",
						"aria-checked": props.checked,
						style: { ...S.switch, ...(props.checked ? S.switchOn : {}) },
						onClick: (e) => {
							e.stopPropagation();
							props.onChange(!props.checked);
						}
					},
					react.createElement("span", { style: { ...S.knob, ...(props.checked ? S.knobOn : {}) } })
				)
			);
		}
		function Segment(props) {
			const [hover, setHover] = react.useState(false);
			return react.createElement(
				"button",
				{
					type: "button",
					className: SEG_CLASS,
					ref: props.segRef,
					style: { ...S.seg, ...(hover ? S.segHover : {}), ...(props.dragging ? S.segDrag : {}) },
					onMouseEnter: () => setHover(true),
					onMouseLeave: () => setHover(false),
					onPointerDown: props.onPointerDown,
					onClick: props.onClick,
					title: props.tooltip
				},
				props.dot &&
					react.createElement("span", {
						style: { ...S.dot, background: props.dot }
					}),
				props.label !== null &&
					react.createElement("span", { style: S.segLabel, children: props.label }),
				react.createElement("span", { children: props.value })
			);
		}
		/**
		 * 拖动排序：把"可见块"的目标位次翻译成完整 order（含被隐藏项）的新顺序。
		 *
		 * 面板开关会隐藏一些块，而 order 数组把显示与隐藏的一起装着，所以不能直接在可见
		 * 序列里 splice —— 那会把隐藏项挤去别的相对位置。做法：先摘掉被拖项，再在完整
		 * 数组里"插到锚点（目标位次上那个可见项）之前"；位次超出可见范围就落到末尾。
		 *
		 * @param {string[]} order 完整顺序
		 * @param {(key: string) => boolean} isVisible 该键当前是否显示
		 * @param {string} key 被拖动的键
		 * @param {number} target 目标位次（"不含被拖项"的可见序列下标，0..n）
		 */
		function moveInOrder(order, isVisible, key, target) {
			const base = (Array.isArray(order) ? order : []).filter((k) => typeof k === "string");
			if (!base.includes(key)) return base;
			const rest = base.filter((k) => isVisible(k) && k !== key);
			const at = Math.max(0, Math.min(Math.floor(Number(target) || 0), rest.length));
			const next = base.filter((k) => k !== key);
			const anchor = rest[at];
			if (anchor === undefined) next.push(key);
			else next.splice(next.indexOf(anchor), 0, key);
			return next;
		}

		/**
		 * 长按拖动排序（会话头部横排与侧边栏竖排共用同一套手势）。
		 *
		 * 为什么不用 HTML5 原生拖拽：原生一按就进入拖动，会和"点击打开详情"冲突；这里要求按住
		 * 250 ms 才进入拖动态。拖动中顺序即时重排（所见即所得），松手落盘，Esc 取消。
		 *
		 * @param {object} opt
		 *  - order: () => string[]        完整顺序（含未显示项）
		 *  - isVisible: (key) => boolean  该项当前是否显示
		 *  - onCommit: (next: string[]) => void 落盘
		 *  - axis: "x" | "y"              主轴（头部横排 x，侧边栏竖排 y）
		 *  - onDragStart?: () => void
		 */
		function useDragReorder(opt) {
			const [press, setPress] = react.useState(null);
			const [drag, setDrag] = react.useState(null);
			const timer = react.useRef(null);
			const start = react.useRef(null);
			const moved = react.useRef(false);
			const nodes = react.useRef(new Map());
			const optRef = react.useRef(opt);
			optRef.current = opt;

			const visibleNow = () => {
				const o = optRef.current;
				return o.order().filter((k) => o.isVisible(k));
			};
			const cancelPress = () => {
				if (timer.current !== null) {
					clearTimeout(timer.current);
					timer.current = null;
				}
				start.current = null;
				setPress(null);
			};
			const endDrag = () => {
				const d = drag;
				cancelPress();
				setDrag(null);
				// 长按会把元素变成焦点元素，松手后浏览器会继续画焦点环（看起来像残留白框）——主动收掉
				const active = document.activeElement;
				if (active && active.classList && active.classList.contains(SEG_CLASS)) active.blur();
				if (!d) return;
				const o = optRef.current;
				const cur = visibleNow().indexOf(d.key);
				if (cur < 0 || cur === d.target) return;
				o.onCommit(moveInOrder(o.order(), o.isVisible, d.key, d.target));
			};
			const onPointerDown = (key) => (e) => {
				if (drag || e.button !== 0) return;
				moved.current = false;
				start.current = { x: e.clientX, y: e.clientY };
				setPress({ key });
				timer.current = setTimeout(() => {
					timer.current = null;
					moved.current = true;
					const o = optRef.current;
					if (o.onDragStart) o.onDragStart();
					setDrag({ key, target: visibleNow().indexOf(key) });
				}, LONG_PRESS_MS);
			};
			const onMove = (e) => {
				const st = start.current;
				if (timer.current !== null && st) {
					const far =
						Math.abs(e.clientX - st.x) > MOVE_TOLERANCE_PX || Math.abs(e.clientY - st.y) > MOVE_TOLERANCE_PX;
					if (far) cancelPress(); // 没到长按时长就移开：当普通点击处理
					return;
				}
				if (!drag) return;
				if (e.buttons === 0) {
					endDrag(); // 在窗口外松手收不到 pointerup，这里兜底，别让拖动态卡住
					return;
				}
				const horizontal = optRef.current.axis !== "y";
				let target = 0;
				for (const k of visibleNow()) {
					if (k === drag.key) continue;
					const el = nodes.current.get(k);
					if (!el) continue;
					const r = el.getBoundingClientRect();
					const mid = horizontal ? r.left + r.width / 2 : r.top + r.height / 2;
					const pos = horizontal ? e.clientX : e.clientY;
					if (pos > mid) target += 1;
				}
				setDrag((d) => (d && d.target !== target ? { ...d, target } : d));
			};

			// 拖动期间监听挂在 window 上：元素会随顺序重排（DOM 节点移动），挂在元素自己身上会丢事件。
			react.useEffect(() => {
				if (!press && !drag) return;
				const up = () => endDrag();
				const onKey = (e) => {
					if (e.key !== "Escape") return;
					cancelPress();
					setDrag(null);
				};
				window.addEventListener("pointermove", onMove, true);
				window.addEventListener("pointerup", up, true);
				window.addEventListener("pointercancel", up, true);
				window.addEventListener("keydown", onKey);
				return () => {
					window.removeEventListener("pointermove", onMove, true);
					window.removeEventListener("pointerup", up, true);
					window.removeEventListener("pointercancel", up, true);
					window.removeEventListener("keydown", onKey);
				};
			}, [press, drag]);

			return {
				drag,
				onPointerDown,
				refFor: (key) => (el) => {
					if (el) nodes.current.set(key, el);
					else nodes.current.delete(key);
				},
				/** 拖动中的预览顺序（= 松手后的顺序）；未拖动时为 null。 */
				previewOrder: drag ? moveInOrder(opt.order(), opt.isVisible, drag.key, drag.target) : null,
				/** 长按拖动后紧跟的那次 click 要吞掉（不该顺带打开详情）。 */
				swallowClick: () => {
					if (!moved.current) return false;
					moved.current = false;
					return true;
				}
			};
		}

		/**
		 * 侧边栏显示项：老配置没有这个字段时按"与头部一致"推导，
		 * 避免升级后侧边栏突然一片空白。
		 */
		function sidebarItemsOf(cfg) {
			if (Array.isArray(cfg.sidebarItems)) return cfg.sidebarItems;
			return (cfg.order || ITEM_KEYS).filter((k) => !!cfg[k]);
		}
		/** 侧边栏自己的顺序（缺省则跟随头部顺序）。 */
		function sidebarOrderOf(cfg) {
			const o = cfg.sidebarOrder;
			return Array.isArray(o) && o.length > 0 ? o : cfg.order || ITEM_KEYS;
		}

		/** 根据配置（order + 开关）与数据组装信息段列表。 */
		function buildSegments(tr, cfg, data, order) {
			const ok = data && data.ok === true;
			let stateColor = "#888"; // 还没有数据
			if (data) stateColor = ok ? "var(--dsw-alias-success, #4caf50)" : "var(--dsw-alias-danger, #f66)";
			const out = [];
			for (const key of order || cfg.order || []) {
				if (!cfg[key]) continue;
				out.push({
					key,
					label: segmentLabel(key, tr),
					value: segmentValue(key, data),
					dot: key === "balance" ? stateColor : undefined,
					tooltip: key === "balance" ? tr("balance.tooltip") : undefined
				});
			}
			return out;
		}
		//#endregion

		//#region 1) 会话头部（横向信息段 + 齿轮配置）
		function DsmUsageAction(props) {
			const { data, reload } = useDsmUsage();
			const [open, setOpen] = react.useState(null); // null | "detail" | "config"
			const cfg = useCfg();
			const tr = (key) => trKey(cfg.lang, key);
			const rootRef = react.useRef(null);
			const popoverRef = react.useRef(null);
			const gearRef = react.useRef(null);
			// 面板打开时定格一次位置（下次打开再重新计算），避免关闭信息段时 ⚙ 移动导致面板跟着跳
			const [anchorPos, setAnchorPos] = react.useState(null);
			// 拖动排序：长按才进入拖动态，普通点击仍然是打开详情面板。
			const headerDnd = useDragReorder({
				order: () => cfg.order || ITEM_KEYS,
				isVisible: (k) => !!cfg[k],
				onCommit: (next) => updateCfg("order", next),
				axis: "x",
				onDragStart: () => setOpen(null) // 拖动时收起弹出面板，免得挡住
			});
			// 余额不足提醒（弹窗开关状态）
			const [alertOpen, setAlertOpen] = react.useState(false);
			const [alertState, setAlertState] = react.useState(() => loadAlertState());
			// Token 设置
			const [tokenInput, setTokenInput] = react.useState("");
			const [tokenMsg, setTokenMsg] = react.useState(null); // null | "saved" | "copied"
			const [savingToken, setSavingToken] = react.useState(false);

			const saveToken = async () => {
				const token = sanitizeToken(tokenInput);
				if (!token || savingToken) return;
				setSavingToken(true);
				try {
					const res = await fetch("/dsm/token", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ token })
					});
					const body = await res.json().catch(() => null);
					if (body && body.ok === true) {
						setTokenInput("");
						setTokenMsg("saved");
						reload();
					} else {
						setTokenMsg("invalid");
					}
				} catch {
					setTokenMsg("invalid");
				} finally {
					setSavingToken(false);
					setTimeout(() => setTokenMsg((m) => (m === "saved" || m === "copied" ? null : m)), 5000);
				}
			};

			const TOKEN_SNIPPET =
				"(() => {" +
				"var t=null;" +
				"['userToken','user_token','token','access_token'].forEach(function(k){" +
				"  if(t) return; var raw=localStorage.getItem(k); if(!raw) return;" +
				"  try { var o=JSON.parse(raw); t=(typeof o==='string'?o:(o.value||o.token||o.access_token||null)); } catch(e) { t=raw; }" +
				"  if(!t || String(t).trim().length<20) t=null;" +
				"});" +
				"if(t && String(t).trim().length>=20){ copy(String(t).trim()); alert('OK 已复制 Token'); return; }" +
				"if(window.__dsmCap){ alert('已在监听：请按 F5 刷新页面'); return; }" +
				"window.__dsmCap=true;" +
				"var orig=window.fetch.bind(window);" +
				"window.fetch=function(input,init){" +
				"  try { var h=new Headers((init&&init.headers)||(input&&input.headers)||{});" +
				"    var m=/Bearer\\s+(\\S+)/i.exec(h.get('authorization')||'');" +
				"    if(m && m[1] && String(m[1]).trim().length>=20){ copy(String(m[1]).trim()); alert('OK 已从接口请求抓到 Token 并复制'); window.fetch=orig; }" +
				"  } catch(e){}" +
				"  return orig(input,init);" +
				"};" +
				"alert('localStorage 未找到 Token。已监听接口请求：请按 F5 刷新页面');" +
				"})();";

			// 书签版：拖到浏览器书签栏，登录平台页后点一下即自动复制 Token（无需 F12）
			const BOOKMARKLET_JS =
				"(()=>{var ks=['userToken','user_token','token','access_token'],t=null,i;" +
				"for(i=0;i<ks.length;i++){var raw=localStorage.getItem(ks[i]);if(!raw)continue;" +
				"try{var o=JSON.parse(raw);t=(typeof o==='string'?o:(o.value||o.token||o.access_token||null));}catch(e){t=raw;}" +
				"if(t&&String(t).trim().length>=20)break;t=null;}" +
				"if(!t){alert('未找到 Token：请确认已登录 platform.deepseek.com');return;}" +
				"var v=String(t).trim();" +
				"var done=function(){alert('OK 已复制 Token，回面板粘贴保存');};" +
				"var fallback=function(){try{var ta=document.createElement('textarea');ta.value=v;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);done();}catch(e){alert('复制失败，请手动复制：'+v);}};" +
				"if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(v).then(done,fallback);}else{fallback();}" +
				"})()";
			const BOOKMARKLET = "javascript:" + encodeURIComponent(BOOKMARKLET_JS);

			const sanitizeToken = (s) =>
				String(s ?? "")
					.replace(/^['"`\s]+|['"`\s]+$/g, "")
					.trim();

			const copyTokenSnippet = async () => {
				try {
					await navigator.clipboard.writeText(TOKEN_SNIPPET);
					setTokenMsg("copied");
					setTimeout(() => setTokenMsg((m) => (m === "copied" ? null : m)), 5000);
				} catch {
					/* 剪贴板不可用则忽略 */
				}
			};

			const copyBookmarklet = async () => {
				try {
					await navigator.clipboard.writeText(BOOKMARKLET);
					setTokenMsg("copied");
					setTimeout(() => setTokenMsg((m) => (m === "copied" ? null : m)), 5000);
				} catch {
					/* 忽略 */
				}
			};

			const readClipboardToken = async () => {
				try {
					const text = await navigator.clipboard.readText();
					if (text && text.trim()) {
						setTokenInput(sanitizeToken(text));
						setTokenMsg(null);
					}
				} catch {
					setTokenMsg("clipboardFail");
					setTimeout(() => setTokenMsg((m) => (m === "clipboardFail" ? null : m)), 4000);
				}
			};

			const togglePanel = (which) => {
				if (open === which) {
					setOpen(null);
					return;
				}
				const el = gearRef.current || rootRef.current;
				if (el) {
					const r = el.getBoundingClientRect();
					setAnchorPos({
						top: r.bottom + 6,
						left: Math.max(8, Math.min(r.left, window.innerWidth - 348))
					});
				}
				setOpen(which);
			};

			// 启动时从宿主拉取持久化配置（端口无关；一次即可）
			react.useEffect(() => {
				fetch("/dsm/config", { cache: "no-store" })
					.then((r) => (r.ok ? r.json() : null))
					.then((j) => {
						if (j && j.ok) applyHostCfg(j.config);
					})
					.catch(() => {});
			}, []);

			react.useEffect(() => {
				if (!open) return;
				const handler = (ev) => {
					if (ev.target instanceof Node) {
						const inTrigger = rootRef.current && rootRef.current.contains(ev.target);
						const inPopover = popoverRef.current && popoverRef.current.contains(ev.target);
						if (!inTrigger && !inPopover) setOpen(null);
					}
				};
				document.addEventListener("pointerdown", handler);
				return () => document.removeEventListener("pointerdown", handler);
			}, [open]);

			const ok = data && data.ok === true;
			const summary = ok ? data.summary : null;
			const today = ok ? data.today : null;
			const monthUsage = ok && data.monthUsage ? data.monthUsage : null;
			const local = data && data.local;
			let tokenStatus = null;
			if (data) {
				if (ok) tokenStatus = "ok";
				else if (data.error === "NO_TOKEN") tokenStatus = "missing";
				else tokenStatus = "invalid";
			}
			/** token 区那行提示文案（原先是 6 层嵌套三元）。 */
			const tokenStatusText = () => {
				if (tokenMsg === "saved") return tr("token.saved");
				if (tokenMsg === "copied") return tr("token.copied");
				if (tokenMsg === "clipboardFail") return tr("token.clipboardFail");
				if (tokenStatus === "ok") return tr("token.status.ok");
				if (tokenStatus === "missing") return tr("token.status.missing");
				if (tokenStatus === "invalid") return tr("token.status.invalid");
				return "";
			};
			// 余额不足提醒：低于阈值弹一次，之后按「间隔」静默；余额回升到阈值以上自动解除静默。
			react.useEffect(() => {
				if (!cfg.lowBalanceAlert) {
					setAlertOpen(false);
					return;
				}
				if (!ok || !summary) return;
				const bal = Number(summary.balance);
				if (lowBalanceRecovered(bal, cfg.lowBalanceThreshold)) {
					// 已回到阈值以上：清掉静默记录，下次再跌破能立刻提醒
					if (alertState.lastShownAt > 0 || alertState.mutedUntil > 0) {
						setAlertState(saveAlertState({ lastShownAt: 0, mutedUntil: 0 }));
					}
					setAlertOpen(false);
					return;
				}
				const now = Date.now();
				const due = shouldAlertLowBalance({
					enabled: true, // 开关已在上面判过
					balance: bal,
					threshold: cfg.lowBalanceThreshold,
					now,
					mutedUntil: alertState.mutedUntil,
					lastShownAt: alertState.lastShownAt,
					intervalMin: cfg.lowBalanceIntervalMin
				});
				if (!due) return;
				setAlertOpen(true);
				setAlertState(saveAlertState({ ...alertState, lastShownAt: now })); // 落盘：重启/刷新后间隔依然生效
			}, [
				data, // 每次采集到新数据都重新检测（store 每轮都是新对象）
				cfg.lowBalanceAlert,
				cfg.lowBalanceThreshold,
				cfg.lowBalanceIntervalMin,
				alertState.lastShownAt,
				alertState.mutedUntil
			]);

			const closeAlert = () => setAlertOpen(false);
			const muteAlertToday = () => {
				const next = new Date();
				next.setHours(24, 0, 0, 0); // 次日 00:00（本地时区）
				setAlertState(saveAlertState({ ...alertState, mutedUntil: next.getTime() }));
				setAlertOpen(false);
			};
			const openTopUpPage = () => {
				window.open("https://platform.deepseek.com/top_up", "_blank", "noopener,noreferrer");
				setAlertOpen(false);
			};
			const alertThreshold = clampNum(cfg.lowBalanceThreshold, 0, 100000, CFG_DEFAULTS.lowBalanceThreshold);
			const alertNode =
				alertOpen && ok && summary
					? react_dom.createPortal(
							react.createElement(
								"div",
								{
									style: S.alertBackdrop,
									onPointerDown: (e) => {
										if (e.target === e.currentTarget) setAlertOpen(false); // 点背景关掉
									}
								},
								react.createElement(
									"div",
									{ style: S.alertCard },
									react.createElement("div", { style: S.alertTitle, children: tr("alert.title") }),
									react.createElement("div", {
										style: S.alertBody,
										children: `${tr("alert.balance")} ${fmtCny(summary.balance)}　·　${tr("alert.threshold")} ${fmtCny(alertThreshold)}`
									}),
									react.createElement(
										"div",
										{ style: S.alertActions },
										react.createElement(
											"button",
											{ type: "button", style: S.refreshBtn, onClick: openTopUpPage },
											tr("alert.topup")
										),
										react.createElement(
											"button",
											{ type: "button", style: S.refreshBtn, onClick: muteAlertToday },
											tr("alert.muteToday")
										),
										react.createElement(
											"button",
											{ type: "button", style: S.refreshBtn, onClick: closeAlert },
											tr("alert.close")
										)
									)
								)
							),
							document.body
						)
					: null;

			// 拖动中就用"目标顺序"渲染 —— 这就是预览：拖到哪儿看到的就是松手后的样子
			const segments = buildSegments(tr, cfg, data, headerDnd.previewOrder);

			const headerRow = react.createElement(
				"div",
				{ style: headerDnd.drag ? { ...S.row, cursor: "grabbing", userSelect: "none" } : S.row },
				segments.map((s) =>
					react.createElement(Segment, {
						key: s.key,
						label: s.label,
						value: s.value,
						dot: s.dot,
						tooltip: s.tooltip,
						dragging: !!headerDnd.drag && headerDnd.drag.key === s.key,
						segRef: headerDnd.refFor(s.key),
						onPointerDown: headerDnd.onPointerDown(s.key),
						onClick: () => {
							if (headerDnd.swallowClick()) return; // 长按拖过之后的那次 click 不再打开面板
							togglePanel("detail");
						}
					})
				),
				react.createElement(
					"button",
					{
						type: "button",
						style: S.topUpBtn,
						title: tr("open.platform"),
						"aria-label": tr("open.platform"),
						onClick: (e) => {
							e.stopPropagation();
							window.open("https://platform.deepseek.com/top_up", "_blank", "noopener,noreferrer");
						}
					},
					tr("open.platform.short")
				),
				react.createElement(
					"button",
					{
						type: "button",
						ref: gearRef,
						style: S.iconBtn,
						title: tr("config"),
						"aria-label": tr("config"),
						onClick: (e) => {
							e.stopPropagation();
							togglePanel("config");
						}
					},
					"⚙"
				)
			);

			if (!open) {
				if (!alertNode) return headerRow;
				return react.createElement(react.Fragment, null, headerRow, alertNode);
			}

			// 弹出面板：fixed 定位 + portal 挂到 body（避免被对话代码区遮挡），
			// 位置在打开时定格（⚙ 正下方，防屏幕溢出），下次打开再重新计算。
			const popoverStyle = {
				...S.popover,
				position: "fixed",
				top: (anchorPos ? anchorPos.top : 8) + "px",
				left: (anchorPos ? anchorPos.left : 8) + "px",
				zIndex: 2147483000
			};
			const renderRoot = (popover) =>
				react.createElement(
					react.Fragment,
					null,
					react.createElement("div", { style: { position: "relative" }, ref: rootRef }, headerRow),
					react_dom.createPortal(react.createElement("div", { style: popoverStyle, ref: popoverRef }, popover), document.body),
					alertNode
				);

			if (open === "detail") {
				return renderRoot(
					react.createElement(
						react.Fragment,
						null,
						!ok &&
							react.createElement(
								"div",
								{ style: S.error },
								data && data.error === "NO_TOKEN"
									? tr("noToken.title") + " — " + tr("noToken.hint")
									: `${tr("fetchFailed")}: ${(data && (data.message || data.error)) || "?"}`
							),
						summary &&
							react.createElement(
								"div",
								null,
								react.createElement("div", { style: S.section, children: tr("month") }),
								react.createElement(Row, { label: tr("balance"), value: fmtCny(summary.balance) }),
								react.createElement(Row, { label: tr("bonus"), value: fmtCny(summary.bonusBalance) }),
								react.createElement(Row, {
									label: tr("month.tokens"),
									value: monthUsage ? fmtTokens(monthUsage.tokens) : "—"
								}),
								react.createElement(Row, {
									label: tr("month.cost"),
									value: monthUsage ? fmtCny(monthUsage.cost) : "—"
								}),
								react.createElement(Row, {
									label: tr("total.tokens"),
									value: data.alltime ? fmtTokens(data.alltime.tokens) : "—"
								}),
								react.createElement(Row, {
									label: tr("total.cost"),
									value: data.alltime ? fmtCny(data.alltime.cost) : "—"
								})
							),
						today &&
							react.createElement(
								"div",
								null,
								react.createElement("div", { style: S.section, children: tr("today") + " · " + (data.month || "") }),
								react.createElement(
									"div",
									{ style: S.rowLine },
									react.createElement(Cell, { label: tr("today.prompt"), value: fmtTokens(today.prompt) }),
									react.createElement(Cell, { label: tr("today.completion"), value: fmtTokens(today.completion) }),
									react.createElement(Cell, { label: tr("today.cacheHit"), value: fmtTokens(today.cacheHit) }),
									react.createElement(Cell, { label: tr("today.cacheMiss"), value: fmtTokens(today.cacheMiss) })
								),
								react.createElement(Row, { label: tr("today.total"), value: fmtTokens(today.total) }),
								react.createElement(Row, { label: tr("today.cost"), value: fmtCny(today.cost) })
							),
						local && data.localEnabled &&
							react.createElement(
								"div",
								null,
								react.createElement("div", { style: S.section, children: tr("local") }),
								react.createElement(
									"div",
									{ style: S.rowLine },
									react.createElement(Cell, { label: tr("local.records"), value: String(local.records ?? 0) }),
									react.createElement(Cell, {
										label: tr("local.tokens"),
										value: fmtTokens((local.inputTokens ?? 0) + (local.outputTokens ?? 0))
									}),
									react.createElement(Cell, { label: tr("local.cost"), value: fmtCny(local.costCny) })
								)
							),
						react.createElement(
							"div",
							{ style: S.footer },
							react.createElement("span", {
								children: (data && data.fetchedAt && tr("updated") + " " + fmtTime(data.fetchedAt)) || ""
							}),
							react.createElement(
								"button",
								{
									style: S.refreshBtn,
									onClick: (e) => {
										e.stopPropagation();
										reload();
									}
								},
								tr("refresh")
							)
						)
					)
				);
			}

			// 配置面板（只留显示开关；排序改成会话头部直接拖）
			return renderRoot(
				react.createElement(
					react.Fragment,
					null,
					react.createElement("div", { style: S.configTitle, children: tr("config.title") }),
					react.createElement("div", { style: S.configDesc, children: tr("config.desc") }),
					react.createElement("div", {
						style: { ...S.configDesc, margin: "2px 0 6px" },
						children: tr("cfg.drag.hint")
					}),
					react.createElement(
						"div",
						{ style: { display: "flex", alignItems: "center", gap: "6px", margin: "0 0 4px" } },
						react.createElement(
							"span",
							{ style: { font: F.small, color: "var(--dsw-alias-label-secondary, #999)", marginRight: "auto" } },
							tr("cfg.lang")
						),
						[["zh", "中文"], ["en", "English"]].map(([code, label]) =>
							react.createElement(
								"button",
								{
									key: code,
									type: "button",
									style: {
										...S.refreshBtn,
										...(cfg.lang === code
											? {
													borderColor: "var(--dsw-alias-accent, #4c8dff)",
													color: "var(--dsw-alias-accent, #4c8dff)"
												}
											: {})
									},
									onClick: (e) => {
										e.stopPropagation();
										updateCfg("lang", code);
									}
								},
								label
							)
						)
					),
					// API Key 筛选：与平台页面的「API Key」下拉同口径。
					// 默认「全部 Key」（与升级前语义一致），选了具体 Key 就只看那一个。
					(() => {
						const keyId = cfg.keyTrackingId || "all";
						const opts = [["all", tr("cfg.key.all")]].concat(
							(data && Array.isArray(data.keys) ? data.keys : []).map((k) => [k.trackingId, k.name])
						);
						// 选中的 Key 不在列表里（列表没拉到 / 已被删除）也要显示出来，别静默变回「全部」
						if (keyId !== "all" && !opts.some((pair) => pair[0] === keyId)) {
							opts.push([keyId, `${String(keyId).slice(0, 8)}…`]);
						}
						return react.createElement(
							"div",
							{ style: { display: "flex", alignItems: "center", gap: "6px", margin: "0 0 4px" } },
							react.createElement(
								"span",
								{ style: { font: F.small, color: "var(--dsw-alias-label-secondary, #999)", marginRight: "auto" } },
								tr("cfg.key")
							),
							react.createElement(
								"select",
								{
									value: keyId,
									title: tr("cfg.key.hint"),
									onChange: (e) => updateCfg("keyTrackingId", e.target.value),
									style: {
										...S.refreshBtn,
										minWidth: "150px",
										background: "var(--dsw-alias-fill-l2, #2a2a2a)",
										color: "var(--dsw-alias-label-primary, #ddd)"
									}
								},
								opts.map((pair) => react.createElement("option", { key: pair[0], value: pair[0] }, pair[1]))
							)
						);
					})(),
					react.createElement(
						"div",
						{ style: { margin: "4px 0 6px", borderTop: "1px solid var(--dsw-alias-border-l2, #333)" } },
						(cfg.order || ITEM_KEYS).map((key) =>
							react.createElement(Toggle, {
								key: key,
								label: tr(`cfg.${key}`),
								desc: tr(`cfg.${key}.desc`),
								checked: !!cfg[key],
								onChange: (v) => updateCfg(key, v)
							})
						)
					),
					react.createElement(Toggle, {
						label: tr("cfg.sidebar"),
						desc: tr("cfg.sidebar.desc"),
						checked: !!cfg.sidebar,
						onChange: (v) => updateCfg("sidebar", v)
					}),
					// 余额不足提醒：开关 + 阈值/间隔（阈值与间隔都在面板里填）
					react.createElement(Toggle, {
						label: tr("cfg.lowBalance"),
						desc: tr("cfg.lowBalance.desc"),
						checked: !!cfg.lowBalanceAlert,
						onChange: (v) => updateCfg("lowBalanceAlert", v)
					}),
					!!cfg.lowBalanceAlert &&
						react.createElement(
							react.Fragment,
							null,
							react.createElement(
								"div",
								{ style: { display: "flex", flexWrap: "wrap", gap: "10px", padding: "0 0 4px" } },
								react.createElement(NumField, {
									label: tr("cfg.lowBalance.threshold"),
									value: cfg.lowBalanceThreshold,
									min: 0,
									max: 100000,
									step: 1,
									onChange: (v) => updateCfg("lowBalanceThreshold", v)
								}),
								react.createElement(NumField, {
									label: tr("cfg.lowBalance.interval"),
									value: Math.round((Number(cfg.lowBalanceIntervalMin) / 60) * 100) / 100,
									min: 0.02,
									max: 168,
									step: 0.5,
									onChange: (v) => updateCfg("lowBalanceIntervalMin", Math.max(1, Math.round(v * 60)))
								})
							),
							react.createElement("div", {
								style: {
									font: F.tiny,
									color: "var(--dsw-alias-label-tertiary, #888)",
									lineHeight: "1.5",
									padding: "0 0 6px"
								},
								children: tr("cfg.lowBalance.hint")
							})
						),
					// 侧边栏显示项：与头部解耦的独立一套（这里只控显示；顺序在侧边栏里长按拖动调整）
					!!cfg.sidebar &&
						(() => {
							const order = sidebarOrderOf(cfg);
							const shown = sidebarItemsOf(cfg);
							const toggleItem = (key, on) => {
								// 打开时插回它在 sidebarOrder 里的自然位置，而不是一律追加到末尾
								const next = on ? order.filter((k) => shown.includes(k) || k === key) : shown.filter((k) => k !== key);
								updateCfg("sidebarItems", next);
							};
							return react.createElement(
								"div",
								{
									style: {
										margin: "4px 0 6px",
										paddingTop: "8px",
										borderTop: "1px solid var(--dsw-alias-border-l2, #333)"
									}
								},
								react.createElement("div", { style: S.configTitle, children: tr("cfg.sidebar.items") }),
								react.createElement("div", {
									style: {
										font: F.tiny,
										color: "var(--dsw-alias-label-tertiary, #888)",
										lineHeight: "1.5",
										margin: "2px 0 6px"
									},
									children: tr("cfg.sidebar.items.hint")
								}),
								order.map((key) =>
									react.createElement(SideRow, {
										key,
										label: tr(`cfg.${key}`),
										checked: shown.includes(key),
										onToggle: (v) => toggleItem(key, v)
									})
								)
							);
						})(),
					react.createElement(
						"div",
						{
							style: {
								margin: "8px 0 0",
								paddingTop: "8px",
								borderTop: "1px solid var(--dsw-alias-border-l2, #333)"
							}
						},
						react.createElement("div", { style: S.configTitle, children: tr("token.section") }),
						react.createElement(
							"div",
							{
								style: {
									font: F.tiny,
									color: "var(--dsw-alias-label-tertiary, #888)",
									margin: "2px 0 8px",
									lineHeight: "1.5"
								}
							},
							tr("token.howto")
						),
						react.createElement(
							"div",
							{ style: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" } },
							react.createElement(
								"button",
								{
									style: S.refreshBtn,
									onClick: (e) => {
										e.stopPropagation();
										window.open("https://platform.deepseek.com/usage", "_blank", "noopener,noreferrer");
									}
								},
								tr("token.open")
							),
							react.createElement(
								"a",
								{
									href: BOOKMARKLET,
									title: tr("token.bookmark.hint"),
									onClick: (e) => e.preventDefault(),
									style: {
										...S.refreshBtn,
										textDecoration: "none",
										display: "inline-flex",
										alignItems: "center"
									}
								},
								tr("token.bookmark")
							),
							react.createElement(
								"button",
								{
									style: S.refreshBtn,
									onClick: (e) => {
										e.stopPropagation();
										copyBookmarklet();
									}
								},
								tr("token.copyBookmark")
							),
							react.createElement(
								"button",
								{
									style: S.refreshBtn,
									onClick: (e) => {
										e.stopPropagation();
										copyTokenSnippet();
									}
								},
								tr("token.copySnippet")
							)
						),
						react.createElement(
							"div",
							{ style: { font: F.tiny, color: "var(--dsw-alias-label-tertiary, #888)", margin: "0 0 6px", lineHeight: "1.5" }, children: tr("token.bookmark.hint") }
						),
						react.createElement(
							"div",
							{ style: { display: "flex", gap: "6px" } },
							react.createElement("input", {
								type: "text",
								value: tokenInput,
								placeholder: tr("token.input"),
								spellCheck: false,
								onChange: (e) => setTokenInput(sanitizeToken(e.target.value)),
								style: {
									flex: "1",
									minWidth: "0",
									boxSizing: "border-box",
									border: "1px solid var(--dsw-alias-border-l2, #333)",
									borderRadius: "6px",
									background: "var(--dsw-alias-fill-l2, #2a2a2a)",
									color: "var(--dsw-alias-label-primary, #ddd)",
									font: F.small,
									padding: "6px 8px",
									outline: "none"
								}
							}),
							react.createElement(
								"button",
								{
									style: S.refreshBtn,
									onClick: (e) => {
										e.stopPropagation();
										readClipboardToken();
									}
								},
								tr("token.readClipboard")
							),
							react.createElement(
								"button",
								{
									style: S.refreshBtn,
									disabled: savingToken,
									onClick: (e) => {
										e.stopPropagation();
										saveToken();
									}
								},
								tr("token.save")
							)
						),
						react.createElement(
							"div",
							{
								style: {
									font: F.tiny,
									marginTop: "6px",
									color:
										tokenStatus === "ok"
											? "var(--dsw-alias-success, #4caf50)"
											: "var(--dsw-alias-label-tertiary, #888)"
								},
								children: tokenStatusText()
							}
						)
					)
				)
			);
		}
		//#endregion

		//#region 2) 侧边栏底部（竖排，order + 开关驱动）
		function DsmUsageSidebar(props) {
			const { data } = useDsmUsage();
			const cfg = useCfg();
			const tr = (key) => trKey(cfg.lang, key);
			// 侧边栏有自己的一套显示项与顺序（与头部解耦）；老配置缺字段时按头部推导
			const sidebarDnd = useDragReorder({
				order: () => sidebarOrderOf(cfg),
				isVisible: (k) => sidebarItemsOf(cfg).includes(k),
				onCommit: (next) => updateCfg("sidebarOrder", next),
				axis: "y"
			});
			if (!cfg.sidebar) return null;
			const ok = data && data.ok === true;
			const dotColor = !data
				? "#888"
				: ok
					? "var(--dsw-alias-success, #4caf50)"
					: "var(--dsw-alias-danger, #f66)";

			const shownItems = sidebarItemsOf(cfg);
			const rows = [];
			for (const key of sidebarDnd.previewOrder || sidebarOrderOf(cfg)) {
				if (!shownItems.includes(key)) continue;
				const isBalance = key === "balance";
				const dragging = !!sidebarDnd.drag && sidebarDnd.drag.key === key;
				rows.push(
					react.createElement(
						"div",
						{
							style: { ...S.stackRow, ...(dragging ? S.stackDrag : {}) },
							key,
							ref: sidebarDnd.refFor(key),
							onPointerDown: sidebarDnd.onPointerDown(key)
						},
						react.createElement("span", { style: S.stackLabel, children: segmentLabel(key, tr) }),
						react.createElement("span", {
							style: { ...S.stackValue, ...(isBalance ? { display: "inline-flex", alignItems: "center", gap: "5px" } : {}) },
							children: isBalance
								? react.createElement(react.Fragment, null,
									react.createElement("span", { style: { ...S.dot, background: dotColor } }),
									segmentValue(key, data))
								: segmentValue(key, data)
						})
					)
				);
			}
			if (rows.length === 0) return null;

			const box = react.createElement(
				"div",
				{
					style: {
						...S.stack,
						boxSizing: "border-box",
						width: "100%",
						padding: "8px 10px",
						borderTop: "1px solid var(--dsw-alias-border-l2, #333)"
					}
				},
				rows
			);

			// 折叠导轨态：只留一个状态点
			if (props.wide === false) {
				return react.createElement("button", {
					type: "button",
					title: tr("balance.tooltip"),
					style: { ...S.iconBtn, width: "28px", height: "28px", border: "0", background: "transparent" },
					children: react.createElement("span", { style: { ...S.dot, width: "8px", height: "8px", background: dotColor } })
				});
			}
			return box;
		}
		//#endregion

		//#region 插件注册
		const inject = ["slots", "locale"];
		/**
		 * 客户端插件体：注册字典 + 展示位（会话头部 + 侧边栏；
		 * 「用量」标签页已移除，完整详情在点会话头部信息段弹出的窗口里）。
		 * @param ctx - 客户端根上下文。
		 */
		function apply(ctx) {
			ensureSegStyle();
			ctx.effect(
				() => ctx.locale.register("dsm", { zh, en }),
				"ui-dsm-usage: dictionaries"
			);
			// 1) 会话头部：横向信息段 + 齿轮
			ctx.slots.inject(
				"conversation.session.header.actions",
				() =>
					ctx.slots.register(
						{
							name: "conversation.session.header.actions",
							id: "dsm-usage",
							order: 15,
							locale: "dsm"
						},
						DsmUsageAction
					)
			);
			// 2) 侧边栏底部：竖排
			ctx.slots.inject(
				"sidebar.footer.action",
				() =>
					ctx.slots.register(
						{
							name: "sidebar.footer.action",
							id: "dsm-usage-sidebar",
							order: 20,
							locale: "dsm"
						},
						DsmUsageSidebar
					)
			);
		}
		//#endregion

		exports.apply = apply;
		exports.__moveInOrder = moveInOrder; // 供 test/client-test.mjs 做纯函数自检
		exports.__shouldAlertLowBalance = shouldAlertLowBalance;
		exports.__lowBalanceRecovered = lowBalanceRecovered;
		exports.__sidebarItemsOf = sidebarItemsOf;
		exports.__sidebarOrderOf = sidebarOrderOf;
		exports.__migrateCfg = migrateCfg;
		exports.inject = inject;
		return module.exports;
	}
});
