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
| 4 | 发布到 npm | ⛔ **没做**：本机没有 npm 凭据（`npm whoami` → ENEEDAUTH） |
| 5 | 公开 GitHub 仓库 | ⛔ **没做**：仓库还没建（缺你的账号授权），但**网络已确认可用**，见下面的诊断 |
| 6 | `package.json` 的 `repository` / `homepage` | ⛔ 等第 5 步：仓库 URL 未知，暂不写死 |

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

第 6 条很关键：两家的 `id` 都从 `owner/repo` 生成，**没有 repository 字段的包基本不会被归到某个仓库下**（dshfind 取样 50 条，50 条都有 repository）。

## 3. 有凭据后的一串命令

```powershell
# 1) npm 发布（先在 C:\Users\<you>\.npmrc 写好 token，或用 NPM_TOKEN）
dsh plugin --profile desktop add dsh-retirement-countdown   # 装自己发的版本，验证一次
npm publish --access public

# 2) GitHub：本地仓库已经建好并提交过了（.git 存在，分支 main，1 个提交）
#    你只需在 GitHub 网页上 New repository → 名字 dsh-retirement-countdown（不要勾 README）
git remote add origin https://github.com/<owner>/dsh-retirement-countdown.git
git push -u origin main        # 弹窗时用 Personal Access Token 当密码；SSH key 目前没被 GitHub 接受

# 3) 回填仓库地址后重新发布（让 npm 与目录都能识别仓库归属）
#    package.json 里加：
#      "repository": { "type": "git", "url": "git+https://github.com/<owner>/dsh-retirement-countdown.git" },
#      "homepage": "https://github.com/<owner>/dsh-retirement-countdown#readme"
npm version patch && npm publish
```

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
