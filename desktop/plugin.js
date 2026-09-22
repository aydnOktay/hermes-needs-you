/**
 * Needs You — Hermes is waiting. One full page for everything that needs you.
 *
 * Unified package: copy to $HERMES_HOME/desktop-plugins/needs-you/.
 */

import {
  host,
  useQuery,
  useMutation,
  queryClient,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  STATUSBAR_AREAS,
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
    @keyframes ny-pulse {
      0%, 100% { opacity: 0.35; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.15); }
    }
    @keyframes ny-fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes ny-chip-glow {
      0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ui-accent) 0%, transparent); }
      50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-accent) 22%, transparent); }
    }
    .ny-page { animation: ny-fade-up 0.45s ease-out; }
    .ny-card { animation: ny-fade-up 0.4s ease-out both; }
    .ny-card:nth-child(1) { animation-delay: 0.04s; }
    .ny-card:nth-child(2) { animation-delay: 0.08s; }
    .ny-card:nth-child(3) { animation-delay: 0.12s; }
    .ny-dot { animation: ny-pulse 1.8s ease-in-out infinite; }
    .ny-chip-live { animation: ny-chip-glow 2.2s ease-in-out infinite; }
    .ny-btn:hover { filter: brightness(1.08); }
    .ny-btn:active { transform: translateY(1px); }
    .ny-btn:disabled { opacity: 0.45; cursor: wait; }
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

function btnStyle(kind) {
  const base = {
    fontSize: 12,
    padding: '7px 12px',
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 500,
    letterSpacing: '0.01em',
    transition: 'filter 0.12s ease, transform 0.08s ease',
  }
  if (kind === 'primary') {
    return {
      ...base,
      color: 'var(--ui-text-on-accent, var(--ui-text-primary))',
      background: 'var(--ui-accent)',
      border: '1px solid transparent',
    }
  }
  if (kind === 'danger') {
    return {
      ...base,
      color: 'var(--ui-text-primary)',
      background: 'transparent',
      border: '1px solid color-mix(in srgb, var(--ui-text-primary) 28%, transparent)',
    }
  }
  return {
    ...base,
    color: 'var(--ui-text-secondary)',
    background: 'transparent',
    border: '1px solid var(--ui-stroke-secondary)',
  }
}

function ItemCard({ item, onRespond, onDismiss, busy }) {
  const title = (item.pattern_key || 'approval').replace(/_/g, ' ')
  const when = formatWhen(item.at)
  return jsxs('article', {
    className: 'ny-card',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: '18px 18px 16px',
      marginBottom: 12,
      borderRadius: 10,
      border: '1px solid var(--ui-stroke-secondary)',
      background:
        'linear-gradient(135deg, color-mix(in srgb, var(--ui-accent) 6%, transparent) 0%, transparent 42%)',
      boxShadow: 'inset 3px 0 0 0 var(--ui-accent)',
    },
    children: [
      jsxs('div', {
        style: { display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' },
        children: [
          jsxs('div', {
            style: { minWidth: 0 },
            children: [
              jsxs('div', {
                style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
                children: [
                  jsx('span', {
                    className: 'ny-dot',
                    style: {
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--ui-accent)',
                      display: 'inline-block',
                      flexShrink: 0,
                    },
                  }),
                  jsx('span', {
                    style: {
                      fontWeight: 650,
                      fontSize: 15,
                      color: 'var(--ui-text-primary)',
                      textTransform: 'capitalize',
                    },
                    children: title,
                  }),
                  jsx('span', {
                    style: {
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '2px 7px',
                      borderRadius: 999,
                      border: '1px solid var(--ui-stroke-secondary)',
                      color: 'var(--ui-text-tertiary)',
                    },
                    children: item.surface || 'approval',
                  }),
                ],
              }),
              jsx('div', {
                style: { fontSize: 11, color: 'var(--ui-text-quaternary, var(--ui-text-tertiary))', marginTop: 6 },
                children: when || 'just now',
              }),
            ],
          }),
          jsx('button', {
            type: 'button',
            className: 'ny-btn',
            onClick: () => openSession(item),
            style: btnStyle('quiet'),
            children: 'Open session',
          }),
        ],
      }),
      item.description
        ? jsx('div', {
            style: { fontSize: 13, lineHeight: 1.5, color: 'var(--ui-text-secondary)' },
            children: item.description,
          })
        : null,
      item.command_preview
        ? jsx('pre', {
            style: {
              margin: 0,
              padding: '12px 14px',
              fontSize: 12,
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--ui-text-secondary)',
              background: 'color-mix(in srgb, var(--ui-bg-secondary, transparent) 80%, transparent)',
              border: '1px solid var(--ui-stroke-secondary)',
              borderRadius: 8,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            },
            children: item.command_preview,
          })
        : null,
      jsxs('div', {
        style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 },
        children: [
          jsx('button', {
            type: 'button',
            className: 'ny-btn',
            disabled: busy,
            onClick: () => onRespond(item, 'once'),
            style: btnStyle('primary'),
            children: 'Approve once',
          }),
          jsx('button', {
            type: 'button',
            className: 'ny-btn',
            disabled: busy,
            onClick: () => onRespond(item, 'session'),
            style: btnStyle('quiet'),
            children: 'Allow session',
          }),
          jsx('button', {
            type: 'button',
            className: 'ny-btn',
            disabled: busy,
            onClick: () => onRespond(item, 'deny'),
            style: btnStyle('danger'),
            children: 'Deny',
          }),
          jsx('button', {
            type: 'button',
            className: 'ny-btn',
            disabled: busy,
            onClick: () => onDismiss(item),
            style: { ...btnStyle('quiet'), opacity: 0.75 },
            children: 'Dismiss',
          }),
        ],
      }),
    ],
  })
}

function EmptyState() {
  return jsxs('div', {
    style: {
      marginTop: 28,
      padding: '36px 28px',
      borderRadius: 12,
      border: '1px dashed var(--ui-stroke-secondary)',
      background:
        'radial-gradient(ellipse at 20% 0%, color-mix(in srgb, var(--ui-accent) 10%, transparent), transparent 55%)',
      textAlign: 'left',
    },
    children: [
      jsx('div', {
        style: {
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ui-text-tertiary)',
          marginBottom: 10,
        },
        children: 'All clear',
      }),
      jsx('div', {
        style: {
          fontSize: 17,
          fontWeight: 600,
          color: 'var(--ui-text-primary)',
          marginBottom: 8,
          lineHeight: 1.35,
        },
        children: 'Nothing needs you right now.',
      }),
      jsx('div', {
        style: {
          fontSize: 13,
          lineHeight: 1.55,
          color: 'var(--ui-text-secondary)',
          maxWidth: 440,
        },
        children:
          'When the agent hits a dangerous command, it lands here with a redacted preview. Approve once, allow for the session, or deny — or open the session to decide in chat.',
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
    className: 'ny-page',
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'auto',
      padding: '36px 40px 64px',
      maxWidth: 760,
      margin: '0 auto',
      color: 'var(--ui-text-secondary)',
      boxSizing: 'border-box',
    },
    children: [
      jsx(NeedsWatcher, { ctx }),
      jsxs('header', {
        style: { marginBottom: 8 },
        children: [
          jsxs('div', {
            style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
            children: [
              jsx('span', {
                className: waiting ? 'ny-dot' : undefined,
                style: {
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: waiting ? 'var(--ui-accent)' : 'var(--ui-stroke-secondary)',
                  display: 'inline-block',
                },
              }),
              jsx('span', {
                style: {
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--ui-text-tertiary)',
                  fontWeight: 600,
                },
                children: 'Needs You',
              }),
            ],
          }),
          jsx('h1', {
            style: {
              margin: 0,
              fontSize: 'clamp(28px, 4vw, 36px)',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: 'var(--ui-text-primary)',
            },
            children: waiting ? 'Hermes is waiting.' : 'You are clear.',
          }),
          jsx('p', {
            style: {
              margin: '12px 0 0',
              fontSize: 14,
              lineHeight: 1.55,
              maxWidth: 480,
              color: 'var(--ui-text-secondary)',
            },
            children: waiting
              ? `${pending.length} approval${pending.length === 1 ? '' : 's'} need your call. Decide here or open the session.`
              : 'Leave the chat. When something needs consent, it shows up on this page and the chip lights up.',
          }),
        ],
      }),
      jsxs('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 20,
          marginBottom: 8,
          alignItems: 'center',
        },
        children: [
          jsx('div', {
            style: {
              fontSize: 12,
              padding: '5px 10px',
              borderRadius: 999,
              border: '1px solid var(--ui-stroke-secondary)',
              color: waiting ? 'var(--ui-text-primary)' : 'var(--ui-text-tertiary)',
              background: waiting
                ? 'color-mix(in srgb, var(--ui-accent) 12%, transparent)'
                : 'transparent',
              fontWeight: waiting ? 600 : 400,
            },
            children: waiting ? `${pending.length} waiting` : 'Queue empty',
          }),
          jsx('button', {
            type: 'button',
            className: 'ny-btn',
            onClick: () => settingsMut.mutate({ muted: !settings.muted }),
            style: btnStyle('quiet'),
            children: settings.muted ? 'Unmute alerts' : 'Mute alerts',
          }),
          waiting
            ? jsx('button', {
                type: 'button',
                className: 'ny-btn',
                disabled: clearMut.isPending,
                onClick: () => clearMut.mutate(),
                style: btnStyle('quiet'),
                children: 'Clear local queue',
              })
            : null,
        ],
      }),
      waiting
        ? jsx('div', {
            style: { marginTop: 16 },
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
        : jsx(EmptyState, {}),
      history.length
        ? jsxs('section', {
            style: { marginTop: 40 },
            children: [
              jsx('div', {
                style: {
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--ui-text-tertiary)',
                  fontWeight: 600,
                  marginBottom: 14,
                },
                children: 'Recent decisions',
              }),
              jsx('div', {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                },
                children: history.slice(0, 8).map((it) =>
                  jsxs(
                    'div',
                    {
                      style: {
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 12,
                        alignItems: 'baseline',
                        padding: '12px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--ui-stroke-secondary)',
                        background: 'var(--ui-bg-secondary, transparent)',
                      },
                      children: [
                        jsxs('div', {
                          children: [
                            jsx('div', {
                              style: {
                                fontSize: 13,
                                color: 'var(--ui-text-secondary)',
                                fontWeight: 500,
                              },
                              children: choiceLabel(it.choice),
                            }),
                            jsx('div', {
                              style: {
                                fontSize: 12,
                                color: 'var(--ui-text-tertiary)',
                                marginTop: 2,
                                textTransform: 'capitalize',
                              },
                              children: (it.pattern_key || 'approval').replace(/_/g, ' '),
                            }),
                          ],
                        }),
                        jsx('div', {
                          style: {
                            fontSize: 11,
                            color: 'var(--ui-text-quaternary, var(--ui-text-tertiary))',
                            fontVariantNumeric: 'tabular-nums',
                          },
                          children: formatWhen(it.resolved_at || it.at),
                        }),
                      ],
                    },
                    `${it.id}-h`,
                  ),
                ),
              }),
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
    style: { display: 'inline-flex', alignItems: 'center', gap: 6 },
    children: [
      jsx(NeedsWatcher, { ctx }),
      jsx('button', {
        type: 'button',
        className: live ? 'ny-chip-live' : undefined,
        title: 'Open Needs You',
        onClick: () => host.navigate(PAGE_PATH),
        style: {
          fontSize: 11,
          padding: '3px 9px',
          borderRadius: 999,
          border: live
            ? '1px solid color-mix(in srgb, var(--ui-accent) 55%, var(--ui-stroke-secondary))'
            : '1px solid var(--ui-stroke-secondary)',
          background: live
            ? 'color-mix(in srgb, var(--ui-accent) 16%, transparent)'
            : 'transparent',
          color: live ? 'var(--ui-text-primary)' : 'var(--ui-text-tertiary)',
          cursor: 'pointer',
          fontWeight: live ? 650 : 400,
          letterSpacing: '0.01em',
        },
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
