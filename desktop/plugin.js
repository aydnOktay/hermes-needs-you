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

function ItemCard({ item, onRespond, onDismiss, busy }) {
  const title = item.pattern_key || 'approval'
  const when = (item.at || '').replace('T', ' ').slice(0, 19)
  return jsxs('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '14px 0',
      borderBottom: '1px solid var(--ui-stroke-secondary)',
    },
    children: [
      jsxs('div', {
        style: { display: 'flex', justifyContent: 'space-between', gap: 12 },
        children: [
          jsxs('div', {
            children: [
              jsx('div', {
                style: { fontWeight: 600, fontSize: 14, color: 'var(--ui-text-primary)' },
                children: title,
              }),
              jsx('div', {
                style: { fontSize: 11, color: 'var(--ui-text-tertiary)', marginTop: 2 },
                children: `${item.surface || 'surface?'} · ${when}`,
              }),
            ],
          }),
          jsx('button', {
            type: 'button',
            onClick: () => openSession(item),
            style: btnStyle(true),
            children: 'Open session',
          }),
        ],
      }),
      item.description
        ? jsx('div', {
            style: { fontSize: 13, lineHeight: 1.45, color: 'var(--ui-text-secondary)' },
            children: item.description,
          })
        : null,
      item.command_preview
        ? jsx('pre', {
            style: {
              margin: 0,
              padding: '10px 12px',
              fontSize: 12,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--ui-text-secondary)',
              background: 'var(--ui-bg-secondary, transparent)',
              border: '1px solid var(--ui-stroke-secondary)',
              borderRadius: 6,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            },
            children: item.command_preview,
          })
        : null,
      jsxs('div', {
        style: { display: 'flex', flexWrap: 'wrap', gap: 8 },
        children: [
          jsx('button', {
            type: 'button',
            disabled: busy,
            onClick: () => onRespond(item, 'once'),
            style: btnStyle(false),
            children: 'Approve once',
          }),
          jsx('button', {
            type: 'button',
            disabled: busy,
            onClick: () => onRespond(item, 'session'),
            style: btnStyle(false),
            children: 'Allow session',
          }),
          jsx('button', {
            type: 'button',
            disabled: busy,
            onClick: () => onRespond(item, 'deny'),
            style: btnStyle(false),
            children: 'Deny',
          }),
          jsx('button', {
            type: 'button',
            disabled: busy,
            onClick: () => onDismiss(item),
            style: btnStyle(true),
            children: 'Dismiss',
          }),
        ],
      }),
    ],
  })
}

function btnStyle(quiet) {
  return {
    fontSize: 12,
    padding: '6px 10px',
    color: 'var(--ui-text-secondary)',
    background: 'transparent',
    border: `1px solid var(--ui-stroke-secondary)`,
    borderRadius: 6,
    cursor: 'pointer',
    opacity: quiet ? 0.85 : 1,
  }
}

function NeedsPage({ ctx }) {
  const query = useQueue(ctx)
  const pending = (query.data && query.data.pending) || []
  const history = (query.data && query.data.history) || []
  const settings = settingsOf(query.data)
  const respondBusy = useRef(false)

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
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'auto',
      padding: '28px 32px 48px',
      maxWidth: 820,
      margin: '0 auto',
      color: 'var(--ui-text-secondary)',
    },
    children: [
      jsx(NeedsWatcher, { ctx }),
      jsx('div', {
        style: {
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ui-text-tertiary)',
          marginBottom: 8,
        },
        children: 'Needs You',
      }),
      jsx('h1', {
        style: {
          margin: 0,
          fontSize: 28,
          fontWeight: 650,
          lineHeight: 1.2,
          color: 'var(--ui-text-primary)',
        },
        children: 'Hermes is waiting.',
      }),
      jsx('p', {
        style: {
          margin: '10px 0 0',
          fontSize: 14,
          lineHeight: 1.5,
          maxWidth: 520,
          color: 'var(--ui-text-secondary)',
        },
        children:
          'One page for every approval that needs you. Leave the chat — come back here when the chip lights up.',
      }),
      jsxs('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginTop: 18,
          alignItems: 'center',
        },
        children: [
          jsx('div', {
            style: { fontSize: 13, color: 'var(--ui-text-tertiary)' },
            children: pending.length
              ? `${pending.length} waiting`
              : 'Nothing waiting right now.',
          }),
          jsx('button', {
            type: 'button',
            onClick: () =>
              settingsMut.mutate({ muted: !settings.muted }),
            style: btnStyle(true),
            children: settings.muted ? 'Unmute' : 'Mute',
          }),
          pending.length
            ? jsx('button', {
                type: 'button',
                disabled: clearMut.isPending,
                onClick: () => clearMut.mutate(),
                style: btnStyle(true),
                children: 'Clear local queue',
              })
            : null,
        ],
      }),
      pending.length
        ? jsx('div', {
            style: { marginTop: 8 },
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
            style: {
              marginTop: 36,
              padding: '28px 0',
              borderTop: '1px solid var(--ui-stroke-secondary)',
              fontSize: 13,
              color: 'var(--ui-text-tertiary)',
              lineHeight: 1.5,
            },
            children:
              'When the agent hits a dangerous command, it lands here with a redacted preview. Approve once, allow for the session, or deny — or open the session to decide in chat.',
          }),
      history.length
        ? jsxs('div', {
            style: { marginTop: 36 },
            children: [
              jsx('div', {
                style: {
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--ui-text-tertiary)',
                  marginBottom: 10,
                },
                children: 'Recent decisions',
              }),
              ...history.slice(0, 8).map((it) =>
                jsx(
                  'div',
                  {
                    style: {
                      fontSize: 12,
                      padding: '6px 0',
                      borderBottom: '1px solid var(--ui-stroke-secondary)',
                      color: 'var(--ui-text-tertiary)',
                    },
                    children: `${it.choice || '?'} · ${it.pattern_key || 'approval'} · ${(it.resolved_at || it.at || '').slice(0, 19)}`,
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
  const query = useQueue(ctx)
  const count = (query.data && query.data.count) || 0
  const muted = Boolean(settingsOf(query.data).muted)
  const label = muted ? 'muted' : count ? `needs you ${count}` : 'needs you'
  return jsxs('span', {
    style: { display: 'inline-flex', alignItems: 'center' },
    children: [
      jsx(NeedsWatcher, { ctx }),
      jsx('button', {
        type: 'button',
        title: 'Open Needs You',
        onClick: () => host.navigate(PAGE_PATH),
        style: {
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 4,
          border: '1px solid var(--ui-stroke-secondary)',
          background: count && !muted ? 'var(--ui-bg-secondary, transparent)' : 'transparent',
          color: count && !muted ? 'var(--ui-text-primary)' : 'var(--ui-text-tertiary)',
          cursor: 'pointer',
          fontWeight: count ? 600 : 400,
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
