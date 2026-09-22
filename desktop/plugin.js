/**
 * Needs You — Hermes is waiting. One full page for everything that needs you.
 *
 * Unified package: copy to $HERMES_HOME/desktop-plugins/needs-you/.
 * Visual language: Hermes UI kit + --ui-* / --chrome-* tokens only.
 */

import {
  host,
  useQuery,
  useMutation,
  queryClient,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  STATUSBAR_AREAS,
  Button,
  Badge,
  Separator,
  EmptyState,
  StatusDot,
} from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useEffect, useRef } from 'react'

const PAGE_PATH = '/needs-you'

let stylesInjected = false
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const el = document.createElement('style')
  el.setAttribute('data-needs-you', '1')
  el.textContent = `
    .ny-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: auto;
      box-sizing: border-box;
      padding: 28px 32px 48px;
      max-width: 720px;
      margin: 0 auto;
      color: var(--ui-text-secondary);
    }
    .ny-kicker {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 11px;
      line-height: 16px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--ui-text-tertiary);
    }
    .ny-title {
      margin: 0;
      font-size: 22px;
      line-height: 28px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--ui-text-primary);
    }
    .ny-lede {
      margin: 8px 0 0;
      font-size: 12px;
      line-height: 18px;
      max-width: 34rem;
      color: var(--ui-text-tertiary);
    }
    .ny-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-top: 18px;
      margin-bottom: 4px;
    }
    .ny-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
    }
    .ny-card {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 12px 11px;
      border-radius: 4px;
      background: var(--ui-bg-quaternary);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-stroke-secondary) 55%, transparent);
    }
    .ny-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .ny-card-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .ny-card-name {
      font-size: 13px;
      line-height: 18px;
      font-weight: 600;
      color: var(--ui-text-primary);
      text-transform: capitalize;
    }
    .ny-card-when {
      font-size: 11px;
      line-height: 16px;
      color: var(--ui-text-quaternary);
      margin-top: 4px;
      font-variant-numeric: tabular-nums;
    }
    .ny-card-desc {
      font-size: 12px;
      line-height: 18px;
      color: var(--ui-text-secondary);
    }
    .ny-pre {
      margin: 0;
      padding: 8px 10px;
      font-size: 11px;
      line-height: 16px;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--ui-text-secondary);
      background: var(--ui-bg-secondary, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-stroke-secondary) 45%, transparent);
      border-radius: 2.5px;
      font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
    }
    .ny-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding-top: 2px;
    }
    .ny-history {
      margin-top: 28px;
    }
    .ny-history-label {
      font-size: 11px;
      line-height: 16px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--ui-text-tertiary);
      margin-bottom: 8px;
    }
    .ny-history-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: baseline;
      padding: 8px 0;
    }
    .ny-history-choice {
      font-size: 12px;
      line-height: 16px;
      font-weight: 500;
      color: var(--ui-text-secondary);
    }
    .ny-history-pattern {
      font-size: 11px;
      line-height: 16px;
      color: var(--ui-text-tertiary);
      margin-top: 2px;
      text-transform: capitalize;
    }
    .ny-history-time {
      font-size: 11px;
      line-height: 16px;
      color: var(--ui-text-quaternary);
      font-variant-numeric: tabular-nums;
    }
    .ny-empty-wrap {
      margin-top: 12px;
      border-radius: 4px;
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-stroke-secondary) 45%, transparent);
      background: color-mix(in srgb, var(--ui-bg-quaternary) 70%, transparent);
    }
  `
  document.head.appendChild(el)
}

function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const audio = new Ctx()
    const now = audio.currentTime
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(740, now)
    osc.frequency.setValueAtTime(988, now + 0.12)
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start(now)
    osc.stop(now + 0.38)
  } catch {
    /* no audio */
  }
}

function settingsOf(data) {
  return (data && data.settings) || {}
}

function ring(ctx, settings, title, body) {
  if (settings.muted) return
  if (settings.sound !== false) playChime()
  host.notify({
    kind: 'warning',
    title,
    message: `${body} Open Needs You from the sidebar.`,
  })
  if (settings.os_notify !== false && ctx.os && typeof ctx.os.notify === 'function') {
    try {
      ctx.os.notify({ title, body, activate: PAGE_PATH })
    } catch {
      try {
        ctx.os.notify({ title, body })
      } catch {
        /* older hosts */
      }
    }
  }
}

function useQueue(ctx) {
  return useQuery({
    queryKey: ['needs-you', 'queue'],
    queryFn: () => ctx.rest('/queue'),
    refetchInterval: 2500,
  })
}

function NeedsWatcher({ ctx }) {
  const query = useQueue(ctx)
  const prevCount = useRef(null)
  const settings = settingsOf(query.data)
  const count = (query.data && query.data.count) || 0

  useEffect(() => {
    const was = prevCount.current
    prevCount.current = count
    if (was === null) return
    if (count > was) {
      ring(ctx, settings, 'Hermes needs you', `${count} approval${count === 1 ? '' : 's'} waiting.`)
    }
  }, [count, ctx, settings])

  return null
}

function openSession(item) {
  const sid = (item && (item.session_id || item.session_key)) || ''
  if (!sid) {
    host.notify({ kind: 'info', message: 'No session id on this item.' })
    return
  }
  if (typeof host.openSession === 'function') {
    void host.openSession(sid).catch(() => {
      host.notify({ kind: 'info', message: 'Could not open that session.' })
    })
    return
  }
  host.notify({ kind: 'info', message: `Session: ${sid}` })
}

async function respondApproval(item, choice) {
  const sessionId = (item && (item.session_id || item.session_key)) || ''
  if (!sessionId) {
    host.notify({ kind: 'info', message: 'Missing session id — open the chat to approve.' })
    return { ok: false }
  }
  let requestId = (item && item.request_id) || ''
  try {
    const pending = await host.request('approval.pending', { session_id: sessionId })
    const list = (pending && pending.approvals) || []
    if (list.length) {
      const hit =
        list.find((a) => requestId && a.request_id === requestId) ||
        list[0]
      if (hit && hit.request_id) requestId = hit.request_id
    }
  } catch {
    /* older gateways */
  }
  try {
    const params = { session_id: sessionId, choice }
    if (requestId) params.request_id = requestId
    await host.request('approval.respond', params)
    host.notify({
      kind: 'success',
      message: choice === 'deny' ? 'Denied.' : `Approved (${choice}).`,
    })
    return { ok: true }
  } catch (err) {
    host.notify({
      kind: 'info',
      message: 'Could not reach approval.respond — open the session to decide.',
    })
    openSession(item)
    return { ok: false, error: String(err && err.message ? err.message : err) }
  }
}

function formatWhen(iso) {
  const s = (iso || '').replace('T', ' ')
  return s.length >= 19 ? s.slice(0, 19) : s
}

function choiceLabel(choice) {
  const c = (choice || '').toLowerCase()
  if (c === 'once') return 'Approved once'
  if (c === 'session' || c === 'always') return 'Allowed'
  if (c === 'deny' || c === 'smart_deny') return 'Denied'
  if (c === 'smart_approve') return 'Smart approved'
  if (c === 'timeout') return 'Timed out'
  return choice || 'Resolved'
}

function ItemCard({ item, onRespond, onDismiss, busy }) {
  const title = (item.pattern_key || 'approval').replace(/_/g, ' ')
  return jsxs('article', {
    className: 'ny-card',
    children: [
      jsxs('div', {
        className: 'ny-card-top',
        children: [
          jsxs('div', {
            style: { minWidth: 0 },
            children: [
              jsxs('div', {
                className: 'ny-card-meta',
                children: [
                  jsx(StatusDot, { tone: 'warn' }),
                  jsx('span', { className: 'ny-card-name', children: title }),
                  jsx(Badge, {
                    variant: 'secondary',
                    children: item.surface || 'approval',
                  }),
                ],
              }),
              jsx('div', {
                className: 'ny-card-when',
                children: formatWhen(item.at) || 'just now',
              }),
            ],
          }),
          jsx(Button, {
            type: 'button',
            variant: 'ghost',
            size: 'xs',
            onClick: () => openSession(item),
            children: 'Open session',
          }),
        ],
      }),
      item.description
        ? jsx('div', { className: 'ny-card-desc', children: item.description })
        : null,
      item.command_preview
        ? jsx('pre', { className: 'ny-pre', children: item.command_preview })
        : null,
      jsxs('div', {
        className: 'ny-actions',
        children: [
          jsx(Button, {
            type: 'button',
            variant: 'default',
            size: 'xs',
            disabled: busy,
            onClick: () => onRespond(item, 'once'),
            children: 'Approve once',
          }),
          jsx(Button, {
            type: 'button',
            variant: 'secondary',
            size: 'xs',
            disabled: busy,
            onClick: () => onRespond(item, 'session'),
            children: 'Allow session',
          }),
          jsx(Button, {
            type: 'button',
            variant: 'outline',
            size: 'xs',
            disabled: busy,
            onClick: () => onRespond(item, 'deny'),
            children: 'Deny',
          }),
          jsx(Button, {
            type: 'button',
            variant: 'ghost',
            size: 'xs',
            disabled: busy,
            onClick: () => onDismiss(item),
            children: 'Dismiss',
          }),
        ],
      }),
    ],
  })
}

function NeedsPage({ ctx }) {
  ensureStyles()
  const query = useQueue(ctx)
  const pending = (query.data && query.data.pending) || []
  const history = (query.data && query.data.history) || []
  const settings = settingsOf(query.data)
  const respondBusy = useRef(false)
  const waiting = pending.length > 0

  const clearMut = useMutation({
    mutationFn: () => ctx.rest('/clear', { method: 'POST', body: {} }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['needs-you'] }),
  })
  const dismissMut = useMutation({
    mutationFn: (id) => ctx.rest('/dismiss', { method: 'POST', body: { id } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['needs-you'] }),
  })
  const settingsMut = useMutation({
    mutationFn: (body) => ctx.rest('/settings', { method: 'POST', body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['needs-you'] }),
  })

  const onRespond = async (item, choice) => {
    if (respondBusy.current) return
    respondBusy.current = true
    try {
      await respondApproval(item, choice)
      queryClient.invalidateQueries({ queryKey: ['needs-you'] })
    } finally {
      respondBusy.current = false
    }
  }

  return jsxs('div', {
    className: 'ny-root',
    children: [
      jsx(NeedsWatcher, { ctx }),
      jsxs('header', {
        children: [
          jsxs('div', {
            className: 'ny-kicker',
            children: [
              jsx(StatusDot, { tone: waiting ? 'warn' : 'muted' }),
              'Needs You',
            ],
          }),
          jsx('h1', {
            className: 'ny-title',
            children: waiting ? 'Hermes is waiting.' : 'Nothing waiting.',
          }),
          jsx('p', {
            className: 'ny-lede',
            children: waiting
              ? `${pending.length} approval${pending.length === 1 ? '' : 's'} need a decision. Approve here or open the session.`
              : 'Dangerous commands land here with a redacted preview. Leave the chat — return when the chip lights up.',
          }),
        ],
      }),
      jsxs('div', {
        className: 'ny-toolbar',
        children: [
          jsx(Badge, {
            variant: waiting ? 'default' : 'secondary',
            children: waiting ? `${pending.length} waiting` : 'Clear',
          }),
          jsx(Button, {
            type: 'button',
            variant: 'ghost',
            size: 'xs',
            onClick: () => settingsMut.mutate({ muted: !settings.muted }),
            children: settings.muted ? 'Unmute' : 'Mute',
          }),
          waiting
            ? jsx(Button, {
                type: 'button',
                variant: 'ghost',
                size: 'xs',
                disabled: clearMut.isPending,
                onClick: () => clearMut.mutate(),
                children: 'Clear queue',
              })
            : null,
        ],
      }),
      waiting
        ? jsx('div', {
            className: 'ny-list',
            children: pending
              .slice()
              .reverse()
              .map((item) =>
                jsx(
                  ItemCard,
                  {
                    item,
                    busy: respondBusy.current || dismissMut.isPending,
                    onRespond,
                    onDismiss: (it) => dismissMut.mutate(it.id),
                  },
                  item.id,
                ),
              ),
          })
        : jsx('div', {
            className: 'ny-empty-wrap',
            children: jsx(EmptyState, {
              title: 'All clear',
              description:
                'When an approval is required, it appears in this queue with Approve / Deny actions.',
            }),
          }),
      history.length
        ? jsxs('section', {
            className: 'ny-history',
            children: [
              jsx('div', { className: 'ny-history-label', children: 'Recent decisions' }),
              jsx(Separator, {}),
              ...history.slice(0, 8).map((it, index) =>
                jsxs(
                  'div',
                  {
                    children: [
                      jsxs('div', {
                        className: 'ny-history-row',
                        children: [
                          jsxs('div', {
                            children: [
                              jsx('div', {
                                className: 'ny-history-choice',
                                children: choiceLabel(it.choice),
                              }),
                              jsx('div', {
                                className: 'ny-history-pattern',
                                children: (it.pattern_key || 'approval').replace(/_/g, ' '),
                              }),
                            ],
                          }),
                          jsx('div', {
                            className: 'ny-history-time',
                            children: formatWhen(it.resolved_at || it.at),
                          }),
                        ],
                      }),
                      index < Math.min(history.length, 8) - 1 ? jsx(Separator, {}) : null,
                    ],
                  },
                  `${it.id}-h`,
                ),
              ),
            ],
          })
        : null,
    ],
  })
}

function StatusChip({ ctx }) {
  ensureStyles()
  const query = useQueue(ctx)
  const count = (query.data && query.data.count) || 0
  const muted = Boolean(settingsOf(query.data).muted)
  const live = count > 0 && !muted
  const label = muted ? 'muted' : count ? `needs you ${count}` : 'needs you'
  return jsxs('span', {
    style: { display: 'inline-flex', alignItems: 'center', gap: 4 },
    children: [
      jsx(NeedsWatcher, { ctx }),
      jsx(Button, {
        type: 'button',
        variant: live ? 'secondary' : 'ghost',
        size: 'xs',
        title: 'Open Needs You',
        onClick: () => host.navigate(PAGE_PATH),
        children: label,
      }),
    ],
  })
}

export default {
  id: 'needs-you',
  name: 'Needs You',
  defaultEnabled: true,
  register(ctx) {
    ctx.registerMany([
      {
        id: 'page',
        area: ROUTES_AREA,
        data: { path: PAGE_PATH },
        render: () => jsx(NeedsPage, { ctx }),
      },
      {
        id: 'nav',
        area: SIDEBAR_NAV_AREA,
        order: 45,
        data: { path: PAGE_PATH, label: 'Needs You', codicon: 'warning' },
      },
      {
        id: 'chip',
        area: STATUSBAR_AREAS.right,
        order: 88,
        render: () => jsx(StatusChip, { ctx }),
      },
    ])
  },
}
