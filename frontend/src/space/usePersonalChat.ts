import { useCallback, useEffect, useRef, useState } from 'react'
import { copy } from './copy'
import { history, listEntries, makeIntent, readEntry, request, SpaceError } from './api'
import type { ChatMessage, Entry, Intent } from './api'
import { useDraftGuard, useSpaceToken } from './hooks'
import { isAlert, noticeForError, noticeText } from './notices'
import type { Notice } from './notices'
import { clearPending, loadPending, savePending } from './pending'
import { isNetworkFailure, SLOW_AFTER_MS } from './chatKeys'
export function usePersonalChat(lang: 'es' | 'en', enabled = true, mode?: 'compass') {
  const token = useSpaceToken(); const c = copy[lang]
  const [messages, setMessages] = useState<ChatMessage[]>([]); const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false); const [expired, setExpired] = useState(!token)
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(() => (token && loadPending(token) ? { k: 'restored' } : null))
  const [selected, setSelected] = useState<Entry[]>([]); const [entries, setEntries] = useState<Entry[]>([])
  const [picker, setPicker] = useState(new URLSearchParams(window.location.search).get('journal') === 'choose')
  const [pickerLoading, setPickerLoading] = useState(false); const [pickerError, setPickerError] = useState(false)
  const [intent, setIntent] = useState<Intent | null>(() => (token ? loadPending(token) : null)); const [retryable, setRetryable] = useState(false)
  const lock = useRef(false); const alive = useRef(true)
  // ES-162: petición de envío en curso (para «Dejar de esperar»), demora, y el texto de la respuesta nueva que anuncia el lector de pantalla (solo tras un envío).
  const [waiting, setWaiting] = useState(false); const [slow, setSlow] = useState(false)
  const [announcement, setAnnouncement] = useState(''); const [announceKey, setAnnounceKey] = useState(0)
  const abortRef = useRef<AbortController | null>(null); const stoppedRef = useRef(false)
  const current = useCallback(() => alive.current && localStorage.getItem('elevation_token') === token, [token])
  useDraftGuard(!expired && (!!input || !!intent), c.leave)
  useEffect(() => { if (intent && token && !expired) savePending(token, intent); else clearPending() }, [intent, token, expired])
  const fail = (error: unknown, fallback: Notice) => {
    if (!current()) return
    if (error instanceof SpaceError && error.status === 401) { setExpired(true); setMessages([]); setInput(''); setSelected([]); setEntries([]); setIntent(null) }
    else setNotice(fallback)
  }
  const reload = useCallback(async () => {
    const rows = await history(token)
    if (current()) { setMessages(rows); setLoaded(true) }
    return rows
  }, [token, current])
  useEffect(() => {
    alive.current = true
    if (enabled) void reload().catch(error => {
      if (!current()) return
      if (error instanceof SpaceError && error.status === 401) setExpired(true)
      else setNotice({ k: 'loadError' })
    })
    return () => { alive.current = false }
  }, [reload, enabled, current, lang])
  const loadPicker = async () => {
    if (pickerLoading || !current()) return
    setPicker(true); setPickerLoading(true); setPickerError(false)
    try { const rows = await listEntries(token); if (current()) setEntries(rows) }
    catch (error) { if (current()) { setPickerError(true); fail(error, { k: 'loadError' }) } }
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
  useEffect(() => {
    if (!waiting) return
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [waiting])
  const confirm = async (sent?: Intent) => {
    const rows = await reload()
    if (!current()) return
    // ES-162: la respuesta nueva se anuncia solo cuando llega tras un envío (nunca al cargar el historial ni al cambiar de idioma).
    const last = rows[rows.length - 1]
    if (sent && last?.role === 'bot') { setAnnouncement(last.text); setAnnounceKey(k => k + 1) }
    // ES-142: «Continuar» envía un texto fijo; si en la caja hay otro borrador, se conserva con su selección de diario.
    if (sent && input.trim() !== sent.message) { setIntent(null); setRetryable(false); setNotice({ k: 'confirmed' }); return }
    setIntent(null); setInput(''); setSelected([]); setPicker(false); setEntries([]); setRetryable(false); setNotice({ k: 'confirmed' })
  }
  const post = async (body: Intent) => {
    const controller = new AbortController(); abortRef.current = controller; stoppedRef.current = false; setWaiting(true); setSlow(false)
    try {
      const response = await request(token, '/api/chat', { method: 'POST', body: JSON.stringify(body), signal: controller.signal }) as { reply?: unknown; requestId?: unknown }
      if (typeof response?.reply !== 'string' || response.requestId !== body.requestId) throw new SpaceError(502)
      await confirm(body)
    } catch (error) {
      if (!current()) return
      // ES-162: dejar de esperar corta la espera del navegador, NO al servidor; el envío queda sin confirmar y «Consultar estado» dice si ya se guardó.
      if (stoppedRef.current && error instanceof DOMException && error.name === 'AbortError') { setRetryable(false); setNotice({ k: 'stopped' }); return }
      setRetryable((error instanceof SpaceError && error.retryable) || isNetworkFailure(error)) // sin conexión: el mismo requestId se puede reintentar sin duplicar
      fail(error, noticeForError(error))
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setWaiting(false); setSlow(false)
    }
  }
  const stop = () => { if (abortRef.current) { stoppedRef.current = true; abortRef.current.abort() } }
  const send = async () => {
    if (!enabled || lock.current || intent || !input.trim() || input.trim().length > 4000 || expired || !loaded) return
    lock.current = true; setBusy(true); setNotice(null)
    try {
      const latest = await Promise.all(selected.map(e => readEntry(token, e.id)))
      if (!current()) return
      if (latest.some((e, index) => e.updatedAt !== selected[index].updatedAt)) { setSelected([]); setNotice({ k: 'contextChanged' }); return }
      const body = makeIntent(input, lang, selected.map(e => e.id), undefined, mode)
      setIntent(body); setRetryable(false)
      await post(body)
    } catch (error) { if (current()) { setSelected([]); fail(error, { k: 'contextChanged' }) } }
    finally { if (current()) setBusy(false); lock.current = false }
  }
  // ES-142: «Continuar» pide seguir una respuesta cortada con un turno normal (requestId nuevo, sin diario) y no toca el borrador de la caja.
  const continueReply = async () => {
    const last = messages[messages.length - 1]
    if (!enabled || lock.current || intent || expired || !loaded || last?.role !== 'bot' || !last.truncated) return
    lock.current = true; setBusy(true); setNotice(null)
    try {
      const body = makeIntent(c.continueMessage, lang, [], undefined, mode)
      setIntent(body); setRetryable(false)
      await post(body)
    } catch (error) { if (current()) fail(error, { k: 'sendError' }) }
    finally { if (current()) setBusy(false); lock.current = false }
  }
  const check = async () => {
    if (!intent || lock.current) return
    lock.current = true; setBusy(true); setRetryable(false)
    try {
      const result = await request(token, `/api/chat/turns/${intent.requestId}`) as { requestId?: string; status?: string; retryable?: boolean }
      if (!current()) return
      if (result?.requestId !== intent.requestId || !['completed', 'pending', 'failed'].includes(result.status || '')) throw new SpaceError(502)
      if (result.status === 'completed') await confirm(intent)
      else { setRetryable(result.retryable === true); setNotice({ k: result.status === 'pending' ? 'pending' : 'sendError' }) }
    } catch (error) {
      if (current() && error instanceof SpaceError && error.status === 404) { setRetryable(true); setNotice({ k: 'sendError' }) }
      else fail(error, { k: 'sendError' })
    } finally { if (current()) setBusy(false); lock.current = false }
  }
  const retry = async () => {
    if (!intent || lock.current || !retryable) return
    lock.current = true; setBusy(true); setRetryable(false)
    try { await post(intent) } finally { if (current()) setBusy(false); lock.current = false }
  }
  const canLeave = () => expired || (!input && !intent) || window.confirm(c.leave)
  return { waiting, slow, stop, announcement, announceKey, messages, input, setInput, busy, expired, loaded, notice: noticeText(notice, lang), alert: isAlert(notice), selected, setSelected, entries, picker, setPicker, pickerLoading, pickerError, intent, retryable, send, continueReply, check, retry, loadPicker, reload, canLeave, c }
}
export type PersonalChat = ReturnType<typeof usePersonalChat>
