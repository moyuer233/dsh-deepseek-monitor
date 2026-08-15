# dsh-deepseek-monitor

---

DeepSeek 用量监控 —— **DeepSeek Harness (DSH) 插件**：在会话头部/侧边栏/「用量」标签页
实时显示 DeepSeek 平台**余额、日/月/累计 Token 总量与费用**，支持拖拽排序与开关配置；
另附一个**本地用量代理**，为走 Anthropic 兼容协议的子代理（如 Claude Code）精确记账。

> ⚠️ 本插件使用 platform.deepseek.com **Web 端内部接口**（非公开契约）查询你自己的账户
> 数据，仅限个人使用；接口结构若被 DeepSeek 变更，需要同步更新 `plugin/host/lib/platform.mjs`。

---

## 预览

 会话头部（横排信息段）
 
![header](screenshots/header.png)

---

 ⚙ 配置面板（开关 + 拖拽排序）
 
![config](screenshots/config-panel.png) 

---

「用量」标签页（详情）

![tab](screenshots/tab.png)

---

## 功能

- 📊 **会话头部横排信息段**：余额 / 日 Token / 月 Token / 日费用 / 月费用 / 总费用 / Token 总量，
  每段独立开关、**≡ 拖拽排序**
- 📌 **三个展示位**：会话头部（横排）、侧边栏底部（竖排）、对话视图「用量」标签页（详情）
- 🔄 **60 秒自动刷新**；配置**双通道持久化**（localStorage + 宿主 config.json，与应用随机端口无关）
- 🔑 **浏览器通用 Token 获取**：书签一键复制 / 控制台代码 / 面板内粘贴保存（自动去引号，立即生效）
- 🧮 **累计（总）数据**：费用取平台 `total_costs`，Token 逐月累加并跨月缓存
- 🖥 **本地用量代理**（可选）：拦截 Anthropic 兼容请求，精确解析 SSE/JSON 用量并记账

---

## 安装（DSH 插件）

**最简单的**：

`帮我安装这个插件https://github.com/moyuer233/dsh-deepseek-monitor/`

**↑↑↑复制这个直接叫你的蓝色大肥鱼自己安装↑↑↑**

两个插件包手工装入 profile（无需 npm 发布）：

```powershell
#1. 复制到 profile 的 node_modules/@local/
$dest = "$env:USERPROFILE\.dsh\profiles\node_modules\@local"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Recurse -Force .\plugin\host   $dest\dsh-host-deepseek-usage
Copy-Item -Recurse -Force .\plugin\client $dest\dsh-client-ui-deepseek-usage

#2. 在 profile 补丁（$env:USERPROFILE\.dsh\profiles\web\cordis.patch.yml）追加两行：
```

```yaml
- insert:
    - id: dsm-usage-host
      name: '@local/dsh-host-deepseek-usage'
    - id: ui-dsm-usage
      name: '@local/dsh-client-ui-deepseek-usage'
```

3. **重启 DSH**（宿主代码在启动时加载；此后客户端 bundle 改动走 HMR，刷新页面即可）

## 获取平台 Token（浏览器通用，Edge/Chrome/桌面端均可）

1. 打开 ⚙ 面板 → 「平台 Token」区
2. 点 **打开平台页面** 并登录
3. 把 **🔑 获取 Token** 链接**拖到浏览器书签栏**；之后登录平台页时**点一下书签**即自动复制 Token
   （备选：**复制书签链接**手动建书签，或**复制控制台代码**在 F12 里执行）
4. 回到面板 **粘贴（自动去引号）→ 保存** —— 立即生效，无需重启

保存走宿主 `POST /dsm/token` 原子写入 `~/.dsh/deepseek-monitor/platform-token`。

## 配置

- 会话头部按 **日 / 月 / 总量** 显示 Token 与费用（余额另列）；⚙ 面板每行左侧 **≡ 手柄**
  拖动排序、开关控制显隐，**同步作用于头部横排与侧边栏竖排**；「用量」标签页始终展示完整详情
- 配置持久化：`~/.dsh/deepseek-monitor/config.json`（宿主，与应用端口无关）+ localStorage（会话内）

## 数据来源（platform.deepseek.com 内部 API）

| 接口 | 内容 |
|---|---|
| `GET /api/v0/users/get_user_summary` | 余额 / 赠送 / 累计费用 |
| `GET /api/v0/usage/amount?month&year` | 按天 token 用量 |
| `GET /api/v0/usage/cost?month&year` | 按天费用 |

鉴权为平台登录 token（浏览器 `userToken`，非 API Key）。

## 本地用量代理（可选）

把子 Claude Code（或任何 Anthropic 兼容客户端）的 `ANTHROPIC_BASE_URL` 指向本地代理，
代理转发到 DeepSeek 并精确解析 token 用量记账：

```
客户端 ──▶ 本代理 (127.0.0.1:8899) ──▶ https://api.deepseek.com/anthropic
                │
                ▼
      usage.jsonl（每请求一条：token/费用/耗时）
```

```bash
node proxy.mjs       # 启动代理（默认 127.0.0.1:8899）
node stats.mjs       # totals | today | recent [n] | live | balance
node test/self-test.mjs   # 自测（内置 mock 上游，无需真实 Key）
```

接入 `@deepseek-ai/dsh-subagent-claude-code` 时，在 profile 补丁的 provider 行加：

```yaml
- id: subagent-claude-code
  name: '@deepseek-ai/dsh-subagent-claude-code'
  config:
    env: !!js Object.fromEntries(Object.entries({
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:8899',
      ANTHROPIC_AUTH_TOKEN: process.env.DEEPSEEK_API_KEY
    }).filter(([, v]) => v !== undefined && v !== ''))
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DS_MONITOR_PORT` | `8899` | 代理监听端口 |
| `DS_MONITOR_HOST` | `127.0.0.1` | 监听地址 |
| `DS_MONITOR_UPSTREAM` | `https://api.deepseek.com/anthropic` | 上游端点 |
| `DS_MONITOR_LOG` | `~/.dsh/deepseek-monitor/usage.jsonl` | 代理记账文件 |
| `DS_MONITOR_API_KEY` | 回退 `ANTHROPIC_AUTH_TOKEN`/`DEEPSEEK_API_KEY` | `stats balance` 用 |
| `DS_PLATFORM_TOKEN` | 无 | 平台 token（也可写入 `~/.dsh/deepseek-monitor/platform-token`） |
| `DS_PRICE_<MODEL>_IN/_CACHE_HIT/_OUT` | 内置默认表 | 单价覆盖（元/百万 token） |

## 定价（默认，可用 `DS_PRICE_*` 覆盖）

| 模型 | 输入 | 缓存命中 | 输出 |
|---|---|---|---|
| deepseek-chat | 0.27 | 0.07 | 1.10 |
| deepseek-reasoner | 0.55 | 0.14 | 2.19 |
| deepseek-v4-pro | 1.00 | 0.25 | 3.00 |
| 未知模型 | 1.00 | 0.10 | 2.00 |

费用按 Anthropic 协议语义：`cache_creation_input_tokens` 按全价输入计，
`cache_read_input_tokens` 按缓存命中价计。

## 记账记录示例

```json
{"ts":"2026-08-15T08:00:00.000Z","runId":"...","kind":"messages","streaming":true,"model":"deepseek-chat","status":200,"inputTokens":1000,"cacheCreation":200,"cacheRead":300,"outputTokens":500,"inputCost":0.00027,"cacheCreationCost":0.000054,"cacheReadCost":0.000021,"outputCost":0.00055,"totalCostCny":0.000895,"error":null,"durationMs":1234}
```

## 已知限制

- 代理只统计**经过它的**请求；直接访问 DeepSeek 的流量不计入
- `stats balance` 走 DeepSeek 原生余额端点（`https://api.deepseek.com/user/balance`），需有效 API Key
- 子代理本身是"一次性"运行（`dsh-subagent-claude-code` 的限制），监控粒度到请求级
- 平台内部接口非公开契约，可能随平台更新而变化

---

如果觉得好用，请给个 ⭐ Star 支持一下！欢迎提交 Issue 和 Pull Request。

---

## License

MIT
