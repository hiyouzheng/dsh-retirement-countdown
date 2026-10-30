# 进社区市场：现状、卡点、材料

## 1. 实测结论（2026-10-30）

我从本机直连两家社区市场的目录接口做了取样，结论只有一句：**它们是「GitHub 仓库解析 → 包清单」的爬虫目录，不是投稿表单**。

| 市场 | 取样接口 | 结果 |
|---|---|---|
| DSH 1024Store | `GET https://deepseek1024.com/api/v2/plugins` | 返回 `plugins[]`，每条都有 `id:"owner/repo/..."`、`url`（GitHub）、`repository`、`category`、`description{en,zh}` 和一条 `install` 命令 |
| dshfind | `GET https://api.dshfind.com/market/v1/plugins` | 返回 `items[]` + `page.total = 18700`，每条都有 `repository.url` 与 `package{registry:"npm",name}` |

所以收录链路是：**公开 GitHub 仓库（含 dsh 插件）→ 抓到仓库里的包 → npm 上有同名包就能一键装**。没有「填表即上架」。

提交入口我也探了，现状如下（**未核实到底该走哪个**，都写了实际返回）：

- `GET https://deepseek1024.com/api/v2/plugins/submit` → `400 {"error":"Invalid package identifier."}`（路由存在，参数名未知；`?package=` 与 `POST {package|name|id}` 都不被接受，POST 直接 `API route not found`）。
- `https://dshfind.com/submit` → `307 → /zh/submit` → 该页是 **404**；站点导航里只有「插件超市 / 帖子 / GitHub / 登录」。

结论：两家目前更可能靠**爬取 + 人工整理**收录，所以最可靠的动作是先具备「公开仓库 + npm 包」这两项，再走它们的 GitHub / 站内反馈渠道提一句。

## 2. 前置条件 checklist

| # | 条件 | 状态 |
|---|---|---|
| 1 | npm 包名可用 | ✅ `dsh-retirement-countdown` 在 npm 上 404，未被占用 |
| 2 | 包声明 `dsh.bundle.patch` | ✅ 有，且 `dsh.client` 声明了 Web UI 半边 |
| 3 | `keywords` 含 `dsh-plugin` | ✅ 有（爬虫按关键字/仓库识别常用这个） |
| 4 | 发布到 npm | ✅ **已发**：[dsh-retirement-countdown@0.1.0](https://www.npmjs.com/package/dsh-retirement-countdown)，`latest=0.1.0`，9 个文件 / 15.3 KB，已从公开 tarball 下载解包核对 |
| 5 | 公开 GitHub 仓库 | ✅ **已建并推送**：[hiyouzheng/dsh-retirement-countdown](https://github.com/hiyouzheng/dsh-retirement-countdown)（public，main） |
| 6 | `package.json` 的 `repository` / `homepage` | ✅ 已回填并随 0.1.0 发布（`npm view` 里可见） |

**发布踩的两个坑**（免得重踩）：

- 第一次那枚 token 的权限是 **Read and write (stage only)**，注册表只多出 `0.0.0-stage` 占位版本（描述 `Temporary package placeholder for staged publishing`，tarball 里只有 `package.json` + `README.md` 两个文件）。npm 是异步处理的，几分钟后 0.1.0 才真正出现；期间重发会报 `You cannot publish over the previously published versions: 0.1.0`。占位版本已 `npm deprecate` 标记废弃。
- 本机 npm 10.9.4 **没有** `npm stage` 命令，无法手动把暂存版本转正——只能等它异步完成，或换带 `publish` 权限的 token。

**实际做了什么（2026-10-30）**

| 渠道 | 动作 | 结果 |
|---|---|---|
| 1024Store | 按它们的 `CONTRIBUTING.md` 提了一个只加 `catalog/plugins/hiyouzheng--dsh-retirement-countdown.json` 的 PR：[#760](https://github.com/imsai-sh/awesome-deepseek-harness-plugins/pull/760) | `static-review` 通过 → **自动合并**；站点由 `catalog-sync` 工作流推到 `POST /api/v1/catalog/sync`，稍后出现在 deepseek1024.com |
| dshfind | 它的规则是「公开仓库打 `dsh-plugin` topic，每天全量同步」 | 本仓库 topic 已设为 `dsh-plugin, dsh, dsh-bundle, countdown, widget`，等日更 |
| 自建索引 | `docs/index.json`（format 1）随仓库推到 GitHub Pages | <https://hiyouzheng.github.io/dsh-retirement-countdown/index.json> 已 200，且通过 DSH `parseMarketIndex` 校验 |

两个关键规则（从它们的 CONTRIBUTING / README 里读到的，不是猜的）：

- **1024Store**：只认 `catalog/plugins/<owner>--<repo>.json` 一个文件；`id` 形如 `owner/repo`（monorepo 用 `owner/repo/sub/dir`），`repository` 固定仓库根，`category` 必须取自 `catalog/categories.json`，`added` 是提交日期；**PR 不许碰 `catalog/plugins/` 之外的任何文件**，否则静态门禁直接拒绝。只有「新增一条」的非 draft PR 才会自动合并，改动既有条目要人工 review。
- **dshfind**：没有投稿入口，`README.zh-CN.md` 写明「给公开仓库加上 `dsh-plugin` topic，下次数据刷新时出现」。所以别去提 issue。

### 网络诊断（2026-10-30 更正）

先前判断「GitHub 不可达」是错的。实测：

| 方式 | 结果 |
|---|---|
| `Test-NetConnection github.com -Port 443` | ✅ 通 |
| `curl https://github.com` | ❌ `CRYPT_E_REVOCATION_OFFLINE`（Windows Schannel 吊销列表检查离线，不是网络问题） |
| `curl --ssl-no-revoke https://github.com` | ✅ 200 |
| `node -e "fetch('https://api.github.com')"` | ✅ 200 |
| `git ls-remote https://github.com/git/git.git HEAD` | ✅ 通 |
| `ssh -T git@github.com` | ❌ `Permission denied (publickey)`：本机 `~/.ssh/id_rsa` 没被 GitHub 账号接受 |

所以：**网络上 GitHub 是通的，卡的是凭据**。本机既没有 `gh` CLI，也没有 `GH_TOKEN`/`GITHUB_TOKEN`，git 也没配 credential helper。HTTP(S) 访问统一加 `--ssl-no-revoke`（或改用 git / node fetch）即可绕过那个证书吊销报错。

第 6 条很关键：两家的 `id` 都从 `owner/repo` 生成，**没有 repository 字段的包基本不会被归到某个仓库下**（dshfind 取样 50 条，50 条都有 repository）。现在这条已经满足。

## 3. 实际执行的发布流程（已跑通，可复用）

已在 `hiyouzheng/dsh-retirement-countdown` 上实际执行过的顺序：

```powershell
# 0) 准备：npm 账号开 2FA 时，token 必须是 Automation 类型，或 Granular 勾了 Bypass 2FA
#    写进 C:\Users\<you>\.npmrc（一行、无 BOM、无尾换行）：
#    //registry.npmjs.org/:_authToken=npm_xxx

# 1) 本地仓库 → 首个提交（作者 Ghost Zhou，邮箱用 GitHub noreply 占位）
git init -b main
git add -A
git -c core.autocrlf=false commit -m "feat: retirement countdown widget for the DSH composer"

# 2) 建远端并推送（GitHub 是通的；curl 访问要 --ssl-no-revoke）
git remote add origin https://github.com/hiyouzheng/dsh-retirement-countdown.git
git -c http.version=HTTP/1.1 push -u origin main

# 3) 发布 npm（0.1.0）
npm publish --access public

# 4) 校验公开产物（别只看本地 tarball）
npm view dsh-retirement-countdown@0.1.0 --json
curl.exe -sS -L https://registry.npmjs.org/dsh-retirement-countdown/-/dsh-retirement-countdown-0.1.0.tgz -o pkg.tgz

# 5) 重新生成市场索引
node scripts/make-index.mjs --version 0.1.0 --timestamp <epoch> --unpkg --author "Ghost Zhou"
```

坑与对策：`git push` 偶发 `Couldn't connect to server` → 加 `-c http.version=HTTP/1.1` 重试即可；`curl` 访问 GitHub 要 `--ssl-no-revoke`。

想用 GitHub Pages 托管自己的插件市场索引（`dist/index.json`）的话，注意它现在被 `.gitignore` 忽略了，需要 `git add -f dist/index.json` 或去掉 `.gitignore` 里的 `dist/`。

## 4. 提交材料（已按实测结构准备）

- [1024store-entry.json](./1024store-entry.json)：`id / name / owner / url / repository / category / description{en,zh} / install`
- [dshfind-item.json](./dshfind-item.json)：`id / name / displayName / summary / repository / package / publisher / categories / latestVersion`

两份里只留了需要人工/你自己的字段，`installCount`、`stars`、`growth24h` 这类统计列是服务端爬出来的，别提交。

给 awesome 列表 / issue 用的一段 Markdown：

```markdown
- [dsh-retirement-countdown](https://github.com/<owner>/dsh-retirement-countdown) — 退休倒计时小组件：DSH 输入框上方常驻显示天/时/分/秒，点铅笔改目标日期，本地保存。`dsh plugin --profile web add dsh-retirement-countdown`
```

## 5. 发布后怎么自查有没有被收录

```powershell
# 1024Store：目录里搜包名
curl.exe -sS "https://deepseek1024.com/api/v2/plugins" | Select-String -Pattern "dsh-retirement-countdown"
# dshfind：翻页找 items[].name
curl.exe -sS "https://api.dshfind.com/market/v1/plugins" | Select-String -Pattern "dsh-retirement-countdown"
```

注意 1024Store 的目录响应很大（95 KB+，本机 25s 会超时截断），只取前若干字节 grep 更稳。
