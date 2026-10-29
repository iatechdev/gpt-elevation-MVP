import { useCallback, useEffect, useRef, useState } from 'react'
import { copy } from './copy'
import { history, listEntries, makeIntent, readEntry, request, SpaceError } from './api'
import type { ChatMessage, Entry, Intent } from './api'
import { useDraftGuard, useSpaceToken } from './hooks'
export function usePersonalChat(lang: 'es' | 'en', enabled = true, mode?: 'compass') {
  const token = useSpaceToken(); const c = copy[lang]
  const [messages, setMessages] = useState<ChatMessage[]>([]); const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false); const [expired, setExpired] = useState(!token)
  const [loaded, setLoaded] = useState(false); const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<Entry[]>([]); const [entries, setEntries] = useState<Entry[]>([])
  const [picker, setPicker] = useState(new URLSearchParams(window.location.search).get('journal') === 'choose')
  const [pickerLoading, setPickerLoading] = useState(false); const [pickerError, setPickerError] = useState(false)
  const [intent, setIntent] = useState<Intent | null>(null); const [retryable, setRetryable] = useState(false)
  const lock = useRef(false); const alive = useRef(true)
  const current = useCallback(() => alive.current && localStorage.getItem('elevation_token') === token, [token])
  useDraftGuard(!expired && (!!input || !!intent), c.leave)
  const fail = (error: unknown, fallback: string) => {
    if (!current()) return
    if (error instanceof SpaceError && error.status === 401) { setExpired(true); setMessages([]); setInput(''); setSelected([]); setEntries([]); setIntent(null) }
    else setNotice(fallback)
  }
  const reload = useCallback(async () => {
    const rows = await history(token)
    if (current()) { setMessages(rows); setLoaded(true) }
  }, [token, current])
  useEffect(() => {
    alive.current = true
    if (enabled) void reload().catch(error => {
      if (!current()) return
      if (error instanceof SpaceError && error.status === 401) setExpired(true)
      else setNotice(copy[lang].loadError)
    })
    return () => { alive.current = false }
  }, [reload, enabled, current, lang])
  const loadPicker = async () => {
    if (pickerLoading || !current()) return
    setPicker(true); setPickerLoading(true); setPickerError(false)
    try { const rows = await listEntries(token); if (current()) setEntries(rows) }
    catch (error) { if (current()) { setPickerError(true); fail(error, c.loadError) } }
    finally { if (current()) setPickerLoading(false) }
  }
  // A navigation hint opens the selector, never selects or transmits any entry.
  useEffect(() => {
    if (!picker) return
    let active = true
    void listEntries(token).then(rows => { if (active && current()) setEntries(rows) }).catch(error => {
      if (active && current()) { setPickerError(true); if (error instanceof SpaceError && error.status === 401) setExpired(true) }
    })
    return () => { active = false }
  }, [picker, token, current])
  const confirm = async () => {
    await reload()
    if (current()) { setIntent(null); setInput(''); setSelected([]); setPicker(false); setEntries([]); setRetryable(false); setNotice(c.confirmed) }
  }
  const post = async (body: Intent) => {
    try {
      const response = await request(token, '/api/chat', { method: 'POST', body: JSON.stringify(body) }) as { reply?: unknown; requestId?: unknown }
      if (typeof response?.reply !== 'string' || response.requestId !== body.requestId) throw new SpaceError(502)
      await confirm()
    } catch (error) {
      if (!current()) return
      setRetryable(error instanceof SpaceError && error.retryable)
      fail(error, error instanceof SpaceError && ['ai_budget_exhausted', 'ai_budget_not_configured'].includes(error.code) ? c.budget : error instanceof SpaceError && error.code === 'turn_in_progress' ? c.pending : c.sendError)
    }
  }
  const send = async () => {
    if (!enabled || lock.current || intent || !input.trim() || input.trim().length > 4000 || expired || !loaded) return
    lock.current = true; setBusy(true); setNotice('')
    try {
      const latest = await Promise.all(selected.map(e => readEntry(token, e.id)))
      if (!current()) return
      if (latest.some((e, index) => e.updatedAt !== selected[index].updatedAt)) { setSelected([]); setNotice(c.contextChanged); return }
      const body = makeIntent(input, lang, selected.map(e => e.id), undefined, mode)
      setIntent(body); setRetryable(false)
      await post(body)
    } catch (error) { if (current()) { setSelected([]); fail(error, c.contextChanged) } }
    finally { if (current()) setBusy(false); lock.current = false }
  }
  const check = async () => {
    if (!intent || lock.current) return
    lock.current = true; setBusy(true); setRetryable(false)
    try {
      const result = await request(token, `/api/chat/turns/${intent.requestId}`) as { requestId?: string; status?: string; retryable?: boolean }
      if (!current()) return
      if (result?.requestId !== intent.requestId || !['completed', 'pending', 'failed'].includes(result.status || '')) throw new SpaceError(502)
      if (result.status === 'completed') await confirm()
      else { setRetryable(result.retryable === true); setNotice(result.status === 'pending' ? c.pending : c.sendError) }
    } catch (error) {
      if (current() && error instanceof SpaceError && error.status === 404) { setRetryable(true); setNotice(c.sendError) }
      else fail(error, c.sendError)
    } finally { if (current()) setBusy(false); lock.current = false }
  }
  const retry = async () => {
    if (!intent || lock.current || !retryable) return
    lock.current = true; setBusy(true); setRetryable(false)
    try { await post(intent) } finally { if (current()) setBusy(false); lock.current = false }
  }
  const canLeave = () => expired || (!input && !intent) || window.confirm(c.leave)
  return { messages, input, setInput, busy, expired, loaded, notice, selected, setSelected, entries, picker, pickerLoading, pickerError, intent, retryable, send, check, retry, loadPicker, reload, canLeave, c }
}
export type PersonalChat = ReturnType<typeof usePersonalChat>
