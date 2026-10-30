/**
 * dsh-retirement-countdown —— 浏览器侧。
 *
 * 在 `conversation.composer.dock`（输入框上方、由界面分配好空间的 list slot）常驻一个倒计时：
 * - 每秒重算剩余时间，卸载时清掉 interval；
 * - 点铅笔图标即改目标日期，保存到 localStorage（只影响这台机器的这个浏览器）；
 * - 颜色全部走 `--dsw-alias-*` 或 currentColor，跟随宿主明暗主题，不硬编码配色。
 */
window.__ModuleLoader__.load({
  id: 'dsh-retirement-countdown',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const DEFAULT_TARGET = '2035-01-01'
    const STORAGE_KEY = 'dsh.retirement-countdown.target'
    const DAY_MS = 86400000
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u

    const PILL = {
      display: 'inline-flex',
      alignItems: 'center',
      alignSelf: 'center',
      gap: '8px',
      maxWidth: '100%',
      padding: '4px 6px 4px 12px',
      borderRadius: '999px',
      border: '1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))',
      background: 'var(--dsw-alias-bg-layer-1, color-mix(in srgb, currentColor 6%, transparent))',
      color: 'inherit',
      font: 'inherit',
      fontSize: '12px',
      lineHeight: '18px',
      whiteSpace: 'nowrap',
    }
    const CARET = {
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: '3px',
      fontVariantNumeric: 'tabular-nums',
    }
    const DAYS = { fontSize: '15px', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }
    const MUTED = { opacity: 0.72 }
    const ICON_BUTTON = {
      border: 'none',
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      fontSize: '12px',
      lineHeight: '16px',
      padding: '2px 6px',
      borderRadius: '999px',
      opacity: 0.6,
    }
    const TEXT_BUTTON = {
      ...ICON_BUTTON,
      opacity: 0.9,
      border: '1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))',
    }
    const DATE_INPUT = {
      font: 'inherit',
      fontSize: '12px',
      color: 'inherit',
      background: 'transparent',
      border: '1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))',
      borderRadius: '6px',
      padding: '1px 4px',
      colorScheme: 'inherit',
    }

    /** 界面上只有两套文案，避免引入 locale 服务的耦合。 */
    const TEXT = {
      zh: {
        label: '距离退休',
        day: '天',
        retired: (days) => `已退休 ${String(days)} 天`,
        edit: '设置退休日期',
        target: '退休日期',
        save: '保存',
        cancel: '取消',
      },
      en: {
        label: 'Retirement in',
        day: 'd',
        retired: (days) => `Retired ${String(days)} d ago`,
        edit: 'Set target date',
        target: 'Target',
        save: 'Save',
        cancel: 'Cancel',
      },
    }

    function text() {
      const language = (typeof navigator !== 'undefined' && navigator.language) || 'en'
      return /^zh/iu.test(language) ? TEXT.zh : TEXT.en
    }

    function readTarget() {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (typeof stored === 'string' && ISO_DATE.test(stored)) return stored
      } catch {
        // localStorage 被禁用时退回默认值。
      }
      return DEFAULT_TARGET
    }

    function parseTarget(iso) {
      const date = new Date(`${iso}T00:00:00`)
      return Number.isNaN(date.getTime()) ? null : date
    }

    function pad(value) {
      return value < 10 ? `0${String(value)}` : String(value)
    }

    /** 剩余毫秒拆成天/时/分/秒；负数按 0 处理（退休后的天数另算）。 */
    function splitDuration(ms) {
      const value = Math.max(0, ms)
      return {
        days: Math.floor(value / DAY_MS),
        hours: Math.floor(value / 3600000) % 24,
        minutes: Math.floor(value / 60000) % 60,
        seconds: Math.floor(value / 1000) % 60,
      }
    }

    function Countdown() {
      const [target, setTarget] = React.useState(readTarget)
      const [now, setNow] = React.useState(() => Date.now())
      const [editing, setEditing] = React.useState(false)
      const [draft, setDraft] = React.useState(target)
      const copy = text()

      React.useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(timer)
      }, [])

      const targetDate = parseTarget(target)
      const remaining = targetDate === null ? 0 : targetDate.getTime() - now
      const retired = remaining <= 0
      const parts = splitDuration(remaining)

      const openEditor = () => {
        setDraft(target)
        setEditing(true)
      }

      const commit = () => {
        if (!ISO_DATE.test(draft)) return
        setTarget(draft)
        try {
          window.localStorage.setItem(STORAGE_KEY, draft)
        } catch {
          // 存不下也只影响下次打开时的默认值，当前会话已经生效。
        }
        setEditing(false)
      }

      if (editing) {
        return h(
          'div',
          { style: PILL },
          h('span', { style: MUTED }, copy.target),
          h('input', {
            type: 'date',
            value: draft,
            style: DATE_INPUT,
            'aria-label': copy.target,
            onChange: (event) => setDraft(event.target.value),
          }),
          h('button', { type: 'button', style: TEXT_BUTTON, onClick: commit }, copy.save),
          h('button', { type: 'button', style: ICON_BUTTON, onClick: () => setEditing(false) }, copy.cancel),
        )
      }

      const value = retired
        ? h('span', { style: { fontWeight: 600 } }, copy.retired(Math.floor(-remaining / DAY_MS)))
        : h(
            'span',
            { style: CARET },
            h('strong', { style: DAYS }, String(parts.days)),
            h('span', { style: MUTED }, copy.day),
            h('span', { style: MUTED }, `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`),
          )

      return h(
        'div',
        { style: PILL, role: 'status', 'aria-live': 'off', title: `${copy.label} → ${target}` },
        h('span', { style: MUTED }, copy.label),
        value,
        h('button', {
          type: 'button',
          style: ICON_BUTTON,
          title: copy.edit,
          'aria-label': copy.edit,
          onClick: openEditor,
        }, '✎'),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'retirement-countdown',
          order: 5,
        }, Countdown))
      },
    }
  },
})
