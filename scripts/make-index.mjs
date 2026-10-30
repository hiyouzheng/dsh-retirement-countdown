/**
 * 生成插件市场索引（format 1）并做一次真实校验。
 *
 * 用法：
 *   node scripts/make-index.mjs                     # 用 package.json 的版本与当前时间
 *   node scripts/make-index.mjs --version 0.1.0 --timestamp 1793000000
 *   node scripts/make-index.mjs --base-url https://your.pages.example          # 索引自身 URL（相对 icon 解析用）
 *   node scripts/make-index.mjs --unpkg                          # 用 unpkg 上的 icon 绝对 URL
 *
 * 产出：dist/index.json。校验走 DSH 安装里的真实实现（dsh-plugin-market-index），
 * 可用 DSH_APP_DIR 指到别的安装目录。
 */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const appDir = process.env.DSH_APP_DIR ?? 'D:\\AppData\\DSH Desktop\\resources\\app'
const marketIndexEntry = pathToFileURL(path.join(appDir, 'node_modules', '@deepseek-ai', 'dsh-plugin-market-index', 'lib', 'index.js')).href
const { parseMarketIndex } = await import(marketIndexEntry)

const args = new Map()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  if (!key.startsWith('--')) continue
  const next = process.argv[index + 1]
  args.set(key.slice(2), next !== undefined && !next.startsWith('--') ? next : 'true')
}

const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const locale = async (name) => JSON.parse(await readFile(path.join(root, 'locale', `${name}.json`), 'utf8')).meta
const en = await locale('en')
const zh = await locale('zh')

const version = args.get('version') ?? manifest.version
const timestamp = Number(args.get('timestamp') ?? Math.floor(Date.now() / 1000))
const baseUrl = args.get('base-url') ?? 'https://example.invalid/index.json'
const icon = args.has('unpkg')
  ? `https://unpkg.com/${manifest.name}@${version}/icon.svg`
  : undefined
const author = args.get('author')

const index = {
  format: 1,
  title: { en: 'My DSH plugins', zh: '我的 DSH 插件' },
  description: { en: 'Plugins published by this workspace.', zh: '本工作区发布的插件。' },
  metadata: {
    categories: {
      widget: { title: { en: 'Widgets', zh: '小组件' } },
    },
    labels: {
      ui: { title: { en: 'UI', zh: '界面' } },
      countdown: { title: { en: 'Countdown', zh: '倒计时' } },
    },
  },
  plugins: [
    {
      name: manifest.name,
      title: { en: en.title, zh: zh.title },
      description: { en: en.description, zh: zh.description },
      ...(icon === undefined ? {} : { icon }),
      ...(author === undefined ? {} : { author }),
      metadata: {
        category: 'widget',
        labels: ['ui', 'countdown'],
        keywords: manifest.keywords ?? [],
      },
      versions: [
        {
          version,
          publishTimestamp: timestamp,
          source: { type: 'npm' },
          engines: { dsh: manifest.engines?.dsh ?? '>=0.2.1-rc.2' },
        },
      ],
    },
  ],
}

// 用 DSH 自己的校验器验一遍：宁可现在报错，也别把坏索引推到线上。
const parsed = parseMarketIndex(index, baseUrl)
assert.equal(parsed.plugins.length, 1)
assert.equal(parsed.plugins[0].versions[0].version, version)

await mkdir(path.join(root, 'dist'), { recursive: true })
const target = path.join(root, 'dist', 'index.json')
await writeFile(target, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
console.log(`✓ index validated by dsh-plugin-market-index, written to ${target}`)
console.log(JSON.stringify(parsed.plugins[0], null, 2))
