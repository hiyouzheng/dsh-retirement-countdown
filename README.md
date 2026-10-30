# dsh-retirement-countdown

一个 **UI 插件**：在 DSH 输入框上方常驻一个退休倒计时。点铅笔图标就能改目标日期。

## 显示在哪

`conversation.composer.dock` —— 输入框上方那条已被界面分配好空间的 list slot。这里是官方推荐的装饰位：不会挡住宿主控件，也不需要自己去算定位。

- 会话界面里常驻，切换会话不会消失；
- **欢迎页（还没有任何消息的空会话）不显示**：那一屏走的是另一个 variant，不渲染 composer dock；
- 颜色全部来自 `--dsw-alias-*` 或 `currentColor`，明暗主题自动跟随。

## 安装

已发布到 npm：[dsh-retirement-countdown@0.1.0](https://www.npmjs.com/package/dsh-retirement-countdown)

```powershell
# 任何人（装到自己的 Profile 里）
dsh plugin --profile desktop add dsh-retirement-countdown

# 仓库地址直装
dsh plugin --profile desktop add github:hiyouzheng/dsh-retirement-countdown

# 本地开发（当前开发机就是这么装的，link 到工作区，改代码立即是新的文件）
dsh plugin --profile desktop add link:D:\AITools\sdh\dsh-retirement-countdown
```

装完**刷新一次页面**（Ctrl+R / Cmd+R）让浏览器加载新的客户端模块；客户端插件的热更新只在同时跑 `pnpm run dev:web` 时无需刷新。

卸载：

```powershell
dsh plugin --profile desktop remove dsh-retirement-countdown
```

## 改退休日期

点倒计时右边的 `✎` → 选日期 → 保存。值存在浏览器 `localStorage`：

| key | 值 |
|---|---|
| `dsh.retirement-countdown.target` | `YYYY-MM-DD`，例 `2029-06-30` |

只影响**这台机器的这个浏览器**，不写 Profile、不改配置、不需要重启。清掉 localStorage 就回到默认值（`client.js` 里的 `DEFAULT_TARGET`）。

## 文件结构

| 文件 | 作用 |
|---|---|
| `package.json` | `dsh.bundle.patch` + `dsh.client`（`platform: web`、`immediately`、`inject` 排序） |
| `cordis.patch.yml` | 插入一条插件行 |
| `index.js` | Host 半边，空 `apply()`（渲染全在浏览器侧） |
| `client.js` | `window.__ModuleLoader__.load({ id, factory })`：拿 React、算倒计时、注册 slot |
| `locale/en.json`、`locale/zh.json` | 插件页标题「退休倒计时」与描述 |
| `icon.svg` | 插件页图标（原创） |

## 改造成别的装饰

- 换位置：把 `client.js` 里的 `conversation.composer.dock` 换成别的 slot key（例如 `conversation.session.header.actions`、`sidebar.footer.action`、`shell.overlay`），组件拿到的 props 会随之变化；
- 换内容：`Countdown` 组件就是普通 React 函数组件，随便改；
- 注意两条硬约束：不要 `require('@deepseek-ai/dsh-client-ui-primitives')`（会被悄悄改坏），不要在组件里往 `document.body` 追加节点。

## 发布与收录（社区市场）

- 作者/版权：**Ghost Zhou**（`package.json` 的 `author`、`LICENSE` 的版权行）。
- **已发布**：npm [dsh-retirement-countdown@0.1.0](https://www.npmjs.com/package/dsh-retirement-countdown)（`latest=0.1.0`，9 个文件 / 15.3 KB，公开 tarball 已下载解包核对）；代码在 [hiyouzheng/dsh-retirement-countdown](https://github.com/hiyouzheng/dsh-retirement-countdown)。
- 社区市场（1024Store / dshfind）是**按公开 GitHub 仓库 + npm 包爬取**的目录，不是投稿表单；实测结论、踩过的坑、可直接提交的条目都在 [market/submission.md](market/submission.md)、[market/1024store-entry.json](market/1024store-entry.json)、[market/dshfind-item.json](market/dshfind-item.json)。
- **收录状态**：发布后 10 分钟内两家目录里都还搜不到（1024Store `?q=retirement` 无结果；dshfind 首页 50 条没有）。爬取周期未知，等收录即可；等不及就提 issue/PR。

## 验收状态

- `node --check index.js && node --check client.js` 通过；`icon.svg` 合法，两份 locale JSON 可解析。
- `node scripts/smoke-client.mjs` 通过：给全局装上假的 `window.__ModuleLoader__` 与最小 React 替身，实跑 `client.js`，验证了
  - 模块 id 等于包名、`factory(require)` 只取 `react`、返回 `{ inject: ['slots'], apply }`；
  - `apply` 注入并注册到 `conversation.composer.dock`，注册 id 为 `retirement-countdown`；
  - 钉住 `Date.now()` 后渲染出「100 天 + hh:mm:ss + ✎ 按钮」，已退休分支与 `en-US` 文案也都对。
- 已装进 `desktop` Profile；`dsh --profile desktop --dump-config` 里能看到 `- id: retirement-countdown`（组合成功，patch 没写错）。
- **发布产物已核对**：从 `registry.npmjs.org` 下载 `0.1.0` 的 tarball，9 个文件齐全、两个 JS 都能过 `node --check`、`dsh.bundle.patch` 与 `dsh.client` 字段都在。
- **未验证**：浏览器里的实际观感（位置、间距、明暗主题对比度）。刷新页面后目视一下；要调大小/位置/文案告诉我。
