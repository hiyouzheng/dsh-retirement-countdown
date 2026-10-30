/**
 * 开发期冒烟测试：不启浏览器，直接验证客户端模块的加载契约与渲染树。
 *
 * 做法：给全局装上假的 window.__ModuleLoader__ / localStorage，用最小 React 替身
 * （createElement + useState/useEffect）跑一遍模块，然后调用组件看它返回的元素树。
 * 覆盖：模块 id、factory 返回的 {inject, apply}、slot 注册参数、倒计时天数与文本。
 *
 * 用法：node scripts/smoke-client.mjs
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DAY = 86400000
const TARGET = '2035-01-01'
let captured

/** Node 的 globalThis.navigator 只有 getter，必须用 defineProperty 覆盖。 */
function setNavigator(language) {
  Object.defineProperty(globalThis, 'navigator', { value: { language }, configurable: true })
}

globalThis.window = {
  __ModuleLoader__: { load: (definition) => { captured = definition } },
  localStorage: { getItem: () => null, setItem: () => {} },
  setInterval: () => 1,
  clearInterval: () => {},
}
setNavigator('zh-CN')

await import(pathToFileURL(path.resolve(import.meta.dirname, '..', 'client.js')).href)
assert.ok(captured, 'client.js must call window.__ModuleLoader__.load')
assert.equal(captured.id, 'dsh-retirement-countdown', 'module id must equal the package name')

// 最小 React 替身：只需要 createElement 与两个 hook。
const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat().filter((child) => child !== null && child !== undefined && child !== false) }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
}

const plugin = captured.factory((name) => {
  assert.equal(name, 'react')
  return React
})
assert.deepEqual(plugin.inject, ['slots'])

let registration
plugin.apply({
  slots: {
    inject: (slotName, callback) => {
      assert.equal(slotName, 'conversation.composer.dock')
      callback()
    },
    register: (options, component) => {
      registration = { ...options, component }
      return () => {}
    },
  },
})
assert.ok(registration, 'apply() must inject into conversation.composer.dock')
assert.equal(registration.name, 'conversation.composer.dock')
assert.equal(registration.id, 'retirement-countdown')

/** 在元素树里按 type 找节点。 */
function findAll(node, predicate, found = []) {
  if (node === null || typeof node !== 'object') return found
  if (predicate(node)) found.push(node)
  for (const child of node.children ?? []) findAll(child, predicate, found)
  return found
}

const Countdown = registration.component
assert.equal(typeof Countdown, 'function')

// 100 天整点：把 now 钉在目标前 100 天，断言渲染出 100。
const targetMs = new Date(`${TARGET}T00:00:00`).getTime()
const before = targetMs - 100 * DAY
Date.now = () => before
let tree = Countdown()
const strong = findAll(tree, (node) => node.type === 'strong')
assert.equal(strong.length, 1, 'the days must render in exactly one <strong>')
assert.equal(strong[0].children[0], '100')
const editButton = findAll(tree, (node) => node.type === 'button' && node.children[0] === '✎')
assert.equal(editButton.length, 1, 'the pill must offer the edit button')
const texts = findAll(tree, (node) => typeof node.children?.[0] === 'string').map((node) => node.children[0])
assert.ok(texts.includes('距离退休'), `zh label missing in ${JSON.stringify(texts)}`)
assert.ok(texts.some((value) => /^\d{2}:\d{2}:\d{2}$/u.test(value)), 'hh:mm:ss missing')

// 已退休分支
Date.now = () => targetMs + 5 * DAY
tree = Countdown()
const retiredText = findAll(tree, (node) => typeof node.children?.[0] === 'string' && node.children[0].includes('已退休'))
assert.equal(retiredText.length, 1)

// 英语环境
setNavigator('en-US')
Date.now = () => before
tree = Countdown()
assert.ok(findAll(tree, (node) => node.children?.[0] === 'Retirement in').length === 1)

console.log('✓ client module: id, injection, slot registration')
console.log('✓ render tree: 100 days, hh:mm:ss, edit button, retired branch, en fallback')
console.log('smoke-client: OK')
