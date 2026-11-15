// ES-179: notas en vivo de la sala. UNA nota viva por sesión: autoguardado a los 2 s de dejar de escribir con `version` esperada y `requestId` (reintento idempotente),
// estados guardando / guardado / error que CONSERVA el texto y ofrece «Guardar ahora», conflicto de otra pestaña (409 `note_changed`) con «Ver la versión actual» / «Conservar la mía»,
// y aviso al salir con texto sin guardar. Al montar recupera la nota viva (recargar no pierde nada).
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { MAX_LIVE, newRequestId } from './roomFormat'
import { invalidateStoredSession } from '../../access/session'
import { enterAgain } from './sessionEnter'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''
type T = (key: string, params?: Record<string, string | number>) => string
type Status = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'expired'
type Current = { content: string; version: number } | null
export interface LiveNotesHandle { flush(): Promise<boolean> }

export const LiveNotes = forwardRef<LiveNotesHandle, { sessionId: string; t: T; locale: string }>(function LiveNotes({ sessionId, t, locale }, ref) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorKey, setErrorKey] = useState('sr_note_error')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [current, setCurrent] = useState<Current>(null)
  const [showCurrent, setShowCurrent] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [unsaved, setUnsaved] = useState(false) // para pintar (los refs no se leen al renderizar)
  const textRef = useRef(''); const savedText = useRef(''); const version = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<{ content: string; id: string } | null>(null)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const usedToken = useRef('') // ES-265: el token con que falló el guardado, para no cerrar un inicio de sesión más nuevo

  const dirty = () => textRef.current !== savedText.current

  const save = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return inFlight.current
    const content = textRef.current
    if (!content.trim() || content === savedText.current) return true
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const requestId = pending.current && pending.current.content === content ? pending.current.id : newRequestId()
    pending.current = { content, id: requestId }
    setStatus('saving')
    const run = (async () => {
      try {
        const token = getToken()
        const res = await fetch(`${API}/api/sessions/therapist/${sessionId}/notes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content, requestId, ...(version.current !== null ? { version: version.current } : {}) }),
        })
        const body = await res.json().catch(() => ({})) as { code?: string; note?: { version?: number }; current?: Current }
        if (res.ok) {
          version.current = body.note?.version ?? (version.current ?? 0) + 1
          savedText.current = content; pending.current = null; setSavedAt(new Date()); setStatus('saved'); setUnsaved(textRef.current !== content)
          if (textRef.current !== content) timer.current = setTimeout(() => { void save() }, 2000) // se siguió escribiendo mientras guardaba
          return true
        }
        if (res.status === 401) { usedToken.current = token; if (timer.current) { clearTimeout(timer.current); timer.current = null } setStatus('expired'); return false } // ES-265: sesión vencida con texto sin guardar → aviso con «Entrar» (no se pierde a ciegas)
        if (res.status === 409 && body.code === 'note_changed') { setCurrent(body.current ?? null); setShowCurrent(false); setStatus('conflict'); return false }
        setErrorKey(body.code === 'too_long' ? 'sr_note_too_long' : res.status === 403 ? 'sr_note_access' : res.status === 400 ? 'sr_note_closed' : 'sr_note_error')
        setStatus('error'); return false
      } catch { setErrorKey('sr_note_error'); setStatus('error'); return false } finally { inFlight.current = null }
    })()
    inFlight.current = run
    return run
  }, [sessionId])

  useImperativeHandle(ref, () => ({ flush: async () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } const before = inFlight.current; if (before) await before; return dirty() ? save() : true } }), [save])

  // Recuperar la nota viva al montar (recargar la sala no pierde lo escrito)
  useEffect(() => {
    let cancelled = false
    const token = getToken()
    void fetch(`${API}/api/sessions/therapist/${sessionId}/notes`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (res.status === 401) { invalidateStoredSession(token); return [] } return res.ok ? res.json() : [] }) // ES-265: aún no hay texto escrito → a /login sin aviso
      .then((rows: { isLive?: boolean; content: string; version?: number }[]) => {
        if (cancelled) return
        const live = Array.isArray(rows) ? rows.find(row => row.isLive) : undefined
        if (live) { textRef.current = live.content; savedText.current = live.content; version.current = live.version ?? 1; setText(live.content) }
      }).catch(() => { /* sin nota previa: se empieza en blanco */ }).finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current) }
  }, [sessionId])

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty() || status === 'error' || status === 'conflict' || status === 'expired') event.preventDefault() }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [status])

  const change = (value: string) => {
    textRef.current = value; setText(value); setUnsaved(value !== savedText.current)
    if (status === 'saved' || status === 'idle') setStatus('idle')
    if (timer.current) clearTimeout(timer.current)
    if (value.trim() && value.length <= MAX_LIVE) timer.current = setTimeout(() => { void save() }, 2000)
  }
  const keepMine = () => { if (current) version.current = current.version; setCurrent(null); setShowCurrent(false); void save() }

  const time = savedAt ? savedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : ''
  const message = status === 'saving' ? t('sr_note_saving') : status === 'saved' ? t('sr_note_saved', { time }) : status === 'error' ? t(errorKey) : status === 'conflict' ? t('sr_note_conflict') : status === 'expired' ? t('session_expired_note') : ''
  const showSaveNow = status !== 'expired' && (status === 'error' || (unsaved && status !== 'saving' && status !== 'conflict'))
  return (
    <div className="sr-notes">
      <label htmlFor="sr-live-notes" className="sr-label">{t('sr_notes')}</label>
      <textarea id="sr-live-notes" className="sr-textarea" value={text} disabled={!loaded} maxLength={MAX_LIVE} placeholder={t('sr_notes_placeholder')} onChange={event => change(event.target.value)} aria-describedby="sr-note-status" />
      <div id="sr-note-status" role="status" className={status === 'error' || status === 'conflict' || status === 'expired' ? 'sr-status sr-status-bad' : 'sr-status'}>{message}</div>
      {status === 'expired' && <button type="button" className="sr-btn sr-btn-primary" onClick={() => { if (!enterAgain(usedToken.current)) { setErrorKey('session_renewed'); setStatus('error'); document.getElementById('sr-live-notes')?.focus() } }}>{t('session_enter')}</button>}
      {showSaveNow && <button type="button" className="sr-btn" onClick={() => void save()}>{t('sr_save_now')}</button>}
      {status === 'conflict' && (
        <div className="sr-conflict">
          <div className="sr-actions">
            <button type="button" className="sr-btn" aria-expanded={showCurrent} onClick={() => setShowCurrent(value => !value)}>{showCurrent ? t('sr_hide_current') : t('sr_see_current')}</button>
            <button type="button" className="sr-btn sr-btn-primary" onClick={keepMine}>{t('sr_keep_mine')}</button>
          </div>
          {showCurrent && <p className="sr-current">{current ? current.content : t('sr_note_none')}</p>}
        </div>
      )}
    </div>
  )
})
