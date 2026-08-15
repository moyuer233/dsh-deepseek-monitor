// @local/dsh-client-ui-deepseek-usage / lib/client.js
//
// 浏览器半（手工打包的 CJS factory，格式与官方 dsh-client-ui-* bundle 一致）。
// 三个展示位，全部由配置开关（齿轮面板里的滑块）控制：
//   1. conversation.session.header.actions — 会话头部横向信息段
//   2. sidebar.footer.action               — 侧边栏底部竖排
//   3. conversation.view                   — 对话视图标签页「用量」竖排
// 每 60s 轮询宿主路由 GET /dsm/usage；配置持久化在 localStorage。
window.__ModuleLoader__.load({
	id: "@local/dsh-client-ui-deepseek-usage",
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
			"config.desc": "拖住 ≡ 可排序，开关控制显示",
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
			"total.tokens": "累计 Token",
			"total.cost": "累计费用",
			"detail": "详情",
			"view.usage": "用量",
			"panel.title": "DeepSeek 用量",
			"open.platform": "打开平台充值页",
			"open.platform.short": "充值",
			"balance.tooltip": "DeepSeek 平台用量"
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
			"config.desc": "Drag the ≡ handle to reorder; toggles control visibility",
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
			"seg.dayCost": "Day$",
			"seg.month": "Mo",
			"seg.monthCost": "Mo$",
			"seg.total": "Total",
			"seg.totalCost": "All$",
			"total.tokens": "Total tokens",
			"total.cost": "Total cost",
			"detail": "Details",
			"view.usage": "Usage",
			"panel.title": "DeepSeek Usage",
			"open.platform": "Open platform top-up page",
			"open.platform.short": "Top up",
			"balance.tooltip": "DeepSeek platform usage",
			"cfg.lang": "Language"
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
		// 默认顺序与开关：余额开、日Token开、月Token关、日费用开、月费用关、总费用开、Token总量开；
		// 侧边栏底部默认关。
		const ITEM_KEYS = ["balance", "dayTokens", "monthTokens", "dayCost", "monthCost", "totalCost", "totalTokens"];
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
			order: [...ITEM_KEYS],
		};
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
				case "totalTokens": return fmtTokens(data.alltime?.tokens);
				case "totalCost": return fmtCny(data.alltime?.cost);
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
			currentCfg = { ...CFG_DEFAULTS, ...cfg };
			saveCfg(currentCfg);
			emitCfg();
		}
		function useCfg() {
			return react.useSyncExternalStore(subscribeCfg, getCfg);
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
			dragHandle: {
				flex: "none",
				width: "18px",
				textAlign: "center",
				fontSize: "13px",
				lineHeight: "1",
				letterSpacing: "-2px",
				color: "var(--dsw-alias-label-tertiary, #777)",
				cursor: "grab",
				userSelect: "none"
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
				gap: "8px"
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
			// ── 标签页面板（居中）──
			tabPanel: {
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: "10px",
				width: "100%",
				maxWidth: "560px",
				margin: "0 auto",
				padding: "16px 20px"
			},
			tabTitle: {
				font: F.value,
				margin: "0 0 2px"
			},
			panelCard: {
				boxSizing: "border-box",
				width: "100%",
				border: "1px solid var(--dsw-alias-border-l2, #333)",
				borderRadius: "12px",
				background: "var(--dsw-alias-fill-l2, #2a2a2a)",
				padding: "12px 14px"
			}
		};
		//#endregion

		//#region 共享数据 hook
		function useDsmUsage() {
			const [data, setData] = react.useState(null);
			const load = react.useCallback(async () => {
				try {
					const res = await fetch("/dsm/usage", { cache: "no-store" });
					const json = await res.json();
					setData(json);
				} catch (e) {
					setData({
						ok: false,
						error: "FETCH_FAILED",
						message: String((e && e.message) || e)
					});
				}
			}, []);
			react.useEffect(() => {
				load();
				const timer = setInterval(load, 60000);
				return () => clearInterval(timer);
			}, [load]);
			return { data, reload: load };
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
		function Toggle(props) {
			return react.createElement(
				"div",
				{
					style: { ...S.toggleRow, ...(props.dragStyle || {}) },
					draggable: props.draggable,
					onDragStart: props.onDragStart,
					onDragOver: props.onDragOver,
					onDrop: props.onDrop,
					onDragEnd: props.onDragEnd
				},
				props.handle &&
					react.createElement("span", { style: S.dragHandle, children: props.handle }),
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
					style: { ...S.seg, ...(hover ? S.segHover : {}) },
					onMouseEnter: () => setHover(true),
					onMouseLeave: () => setHover(false),
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
		/** 根据配置（order + 开关）与数据组装信息段列表。 */
		function buildSegments(tr, cfg, data) {
			const ok = data && data.ok === true;
			const stateColor = !data
				? "#888"
				: ok
					? "var(--dsw-alias-success, #4caf50)"
					: "var(--dsw-alias-danger, #f66)";
			const out = [];
			for (const key of cfg.order || []) {
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
			const [dragIndex, setDragIndex] = react.useState(null);
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

			const reorderItem = (from, to) => {
				setDragIndex(null);
				if (from === null || from === to) return;
				const order = [...(cfg.order || ITEM_KEYS)];
				const [item] = order.splice(from, 1);
				if (item === undefined) return;
				order.splice(to, 0, item);
				updateCfg("order", order);
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
			const tokenStatus = !data ? null : ok ? "ok" : data.error === "NO_TOKEN" ? "missing" : "invalid";
			const segments = buildSegments(tr, cfg, data);

			const headerRow = react.createElement(
				"div",
				{ style: S.row },
				segments.map((s) =>
					react.createElement(Segment, {
						key: s.key,
						label: s.label,
						value: s.value,
						dot: s.dot,
						tooltip: s.tooltip,
						onClick: () => togglePanel("detail")
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

			if (!open) return headerRow;

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
					react_dom.createPortal(react.createElement("div", { style: popoverStyle, ref: popoverRef }, popover), document.body)
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
						local &&
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

			// 配置面板（开关滑块 + 拖拽排序）
			return renderRoot(
				react.createElement(
					react.Fragment,
					null,
					react.createElement("div", { style: S.configTitle, children: tr("config.title") }),
					react.createElement("div", { style: S.configDesc, children: tr("config.desc") }),
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
					react.createElement(
						"div",
						{ style: { margin: "4px 0 6px", borderTop: "1px solid var(--dsw-alias-border-l2, #333)" } },
						(cfg.order || ITEM_KEYS).map((key, index) =>
							react.createElement(Toggle, {
								key: key,
								handle: "≡",
								label: tr(`cfg.${key}`),
								desc: tr(`cfg.${key}.desc`),
								checked: !!cfg[key],
								onChange: (v) => updateCfg(key, v),
								draggable: true,
								dragStyle: { cursor: "grab", ...(dragIndex === index ? { opacity: 0.45, border: "1px dashed var(--dsw-alias-border-l2, #555)", borderRadius: "8px" } : {}) },
								onDragStart: (e) => {
									setDragIndex(index);
									try {
										e.dataTransfer.effectAllowed = "move";
										e.dataTransfer.setData("text/plain", String(index));
									} catch {
										/* 忽略 */
									}
								},
								onDragOver: (e) => e.preventDefault(),
								onDrop: () => reorderItem(dragIndex, index),
								onDragEnd: () => setDragIndex(null)
							})
						)
					),
					react.createElement(Toggle, {
						label: tr("cfg.sidebar"),
						desc: tr("cfg.sidebar.desc"),
						checked: !!cfg.sidebar,
						onChange: (v) => updateCfg("sidebar", v)
					}),
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
								children:
									tokenMsg === "saved"
										? tr("token.saved")
										: tokenMsg === "copied"
											? tr("token.copied")
											: tokenMsg === "clipboardFail"
												? tr("token.clipboardFail")
												: tokenStatus === "ok"
													? tr("token.status.ok")
													: tokenStatus === "missing"
														? tr("token.status.missing")
														: tokenStatus === "invalid"
															? tr("token.status.invalid")
															: ""
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
			if (!cfg.sidebar) return null;
			const ok = data && data.ok === true;
			const dotColor = !data
				? "#888"
				: ok
					? "var(--dsw-alias-success, #4caf50)"
					: "var(--dsw-alias-danger, #f66)";

			const rows = [];
			for (const key of cfg.order || ITEM_KEYS) {
				if (!cfg[key]) continue;
				const isBalance = key === "balance";
				rows.push(
					react.createElement(
						"div",
						{ style: S.stackRow, key },
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

		//#region 3) 对话视图「用量」标签页（竖排面板，始终展示完整详情）
		function DsmUsageTab(props) {
			const { data, reload } = useDsmUsage();
			const cfg = useCfg();
			const tr = (key) => trKey(cfg.lang, key);
			const ok = data && data.ok === true;
			const summary = ok ? data.summary : null;
			const today = ok ? data.today : null;
			const monthUsage = ok && data.monthUsage ? data.monthUsage : null;

			return react.createElement(
				"div",
				{ style: S.tabPanel },
				react.createElement(
					"div",
					{ style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", width: "100%" } },
					react.createElement("div", { style: S.tabTitle, children: tr("panel.title") }),
					react.createElement(
						"button",
						{
							type: "button",
							style: S.refreshBtn,
							title: tr("open.platform"),
							onClick: (e) => {
								e.stopPropagation();
								window.open("https://platform.deepseek.com/top_up", "_blank", "noopener,noreferrer");
							}
						},
						"↗ " + tr("open.platform")
					)
				),
				!ok &&
					react.createElement(
						"div",
						{ style: S.error },
						data && data.error === "NO_TOKEN"
							? tr("noToken.title") + " — " + tr("noToken.hint")
							: `${tr("fetchFailed")}: ${(data && (data.message || data.error)) || "?"}`
					),
				react.createElement(
					"div",
					{ style: S.panelCard },
					react.createElement("div", { style: S.section, children: tr("month") }),
					react.createElement(Row, { label: tr("balance"), value: summary ? fmtCny(summary.balance) : "—" }),
					react.createElement(Row, { label: tr("bonus"), value: summary ? fmtCny(summary.bonusBalance) : "—" }),
					react.createElement(Row, { label: tr("month.tokens"), value: monthUsage ? fmtTokens(monthUsage.tokens) : "—" }),
					react.createElement(Row, { label: tr("month.cost"), value: monthUsage ? fmtCny(monthUsage.cost) : "—" }),
					react.createElement(Row, { label: tr("total.tokens"), value: data.alltime ? fmtTokens(data.alltime.tokens) : "—" }),
					react.createElement(Row, { label: tr("total.cost"), value: data.alltime ? fmtCny(data.alltime.cost) : "—" })
				),
				today &&
					react.createElement(
						"div",
						{ style: S.panelCard },
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
				react.createElement(
					"div",
					{ style: S.footer },
					react.createElement("span", {
						children: (data && data.fetchedAt && tr("updated") + " " + fmtTime(data.fetchedAt)) || ""
					}),
					react.createElement(
						"button",
						{ style: S.refreshBtn, onClick: (e) => { e.stopPropagation(); reload(); } },
						tr("refresh")
					)
				)
			);
		}
		//#endregion

		//#region 插件注册
		const inject = ["slots", "locale"];
		/**
		 * 客户端插件体：注册字典 + 三个展示位。
		 * @param ctx - 客户端根上下文。
		 */
		function apply(ctx) {
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
			// 3) 对话视图标签页「用量」
			ctx.slots.inject(
				"conversation.view",
				() =>
					ctx.slots.register(
						{
							name: "conversation.view",
							id: "dsm-usage",
							order: 20,
							locale: "dsm",
							label: () => trKey(getCfg().lang, "view.usage")
						},
						DsmUsageTab
					)
			);
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
