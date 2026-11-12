// ES-179: cierre de la sesión. Diálogo nativo (Esc = «Seguir en la sesión»), ánimo 1–5 en palabras (SIN emojis) y nota de cierre ≥ 10 (máx. 4.000). «Finalizar» NO es rojo (decisión 17).
// Un error conserva TODO (ánimo y texto). 409 `already_closed` = «Esta sesión ya terminó». Si la respuesta se pierde se consulta el estado antes de decir nada.
import { useEffect, useRef, useState } from 'react'
import { MAX_CLOSING, MIN_CLOSING, MOODS } from './roomFormat'
import { enterAgain } from './sessionEnter'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''
type T = (key: string, params?: Record<string, string | number>) => string
interface Flush { (): Promise<boolean> } // firma de llamada: el heurístico ES-154 confunde «=> Promise<» con texto fijo
export type CloseResult = { skipped: 'budget' | 'unavailable' | 'provider' | null }

export function CloseSession({ sessionId, t, flushNotes, onClosed, onAlreadyClosed }: { sessionId: string; t: T; flushNotes: Flush; onClosed: (result: CloseResult) => void; onAlreadyClosed: () => void }) {
  const [open, setOpen] = useState(false)
  const [mood, setMood] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<{ key: string; check?: boolean; enter?: boolean } | null>(null)
  const usedToken = useRef('') // ES-265: token con que se envió el cierre
  const enterButton = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement>(null)

  useEffect(() => { if (open && dialog.current && !dialog.current.open) dialog.current.showModal() }, [open])
  // E243-1: tras el aviso de sesión vencida el foco pasa a «Entrar» (el botón de guardar queda desactivado mientras se envía).
  useEffect(() => {
    if (!problem?.enter) return
    const active = document.activeElement
    if (active === null || active === document.body || dialog.current?.contains(active)) enterButton.current?.focus()
  }, [problem])
  const closeDialog = () => dialog.current?.close()
  const onDialogClosed = () => { setOpen(false); setProblem(null); opener.current?.focus() }

  async function confirmed(): Promise<boolean> { // ¿la sesión quedó cerrada aunque no llegó la respuesta?
    try {
      const res = await fetch(`${API}/api/sessions/therapist?status=completed`, { headers: { Authorization: `Bearer ${getToken()}` } })
      if (!res.ok) return false
      const rows = await res.json() as { id: number; status: string }[]
      return rows.some(row => String(row.id) === sessionId && row.status === 'completed')
    } catch { return false }
  }

  async function checkNow() { // «Comprobar»: solo consulta el estado, no vuelve a enviar el cierre
    setBusy(true)
    const done = await confirmed()
    setBusy(false)
    if (done) { closeDialog(); onClosed({ skipped: null }); return }
    setProblem({ key: 'sr_close_unsure', check: true })
  }

  async function submit() {
    if (busy) return
    if (mood === null) { setProblem({ key: 'sr_close_pick' }); return }
    if (note.trim().length < MIN_CLOSING) { setProblem({ key: 'sr_close_min' }); return }
    if (note.length > MAX_CLOSING) { setProblem({ key: 'sr_close_long' }); return }
    setBusy(true); setProblem(null)
    let lost = false
    try {
      await flushNotes() // que la nota en vivo quede guardada antes de cerrar (si no se puede, el cierre sigue: ya está en pantalla)
      const token = getToken(); usedToken.current = token
      const res = await fetch(`${API}/api/sessions/therapist/${sessionId}/end`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ therapistNote: note, patientMoodAfter: mood }) })
      const body = await res.json().catch(() => ({})) as { code?: string; recommendationSkipped?: 'budget' | 'unavailable' | 'provider' }
      if (res.ok) { closeDialog(); onClosed({ skipped: body.recommendationSkipped ?? null }); return }
      if (res.status === 409 && body.code === 'already_closed') { closeDialog(); onAlreadyClosed(); return }
      if (res.status === 401) setProblem({ key: 'session_expired_note', enter: true }) // ES-265: sesión vencida con el cierre escrito → aviso con «Entrar»
      else if (body.code === 'too_long') setProblem({ key: 'sr_close_long' })
      else if (res.status === 403) setProblem({ key: 'sr_close_access' })
      else if (res.status >= 500) lost = true
      else setProblem({ key: 'sr_close_error' })
    } catch { lost = true } finally { setBusy(false) }
    if (lost) {
      setBusy(true)
      const done = await confirmed()
      setBusy(false)
      if (done) { closeDialog(); onClosed({ skipped: null }); return }
      setProblem({ key: 'sr_close_unsure', check: true })
    }
  }

  return (
    <>
      <button ref={opener} type="button" className="sr-btn sr-btn-finish" onClick={() => { setProblem(null); setOpen(true) }}>{t('sr_finish')}</button>
      {open && (
        <dialog ref={dialog} aria-labelledby="sr-close-title" onClose={onDialogClosed} className="sr-dialog">
          <form onSubmit={event => { event.preventDefault(); void submit() }}>
            <h2 id="sr-close-title" className="sr-dialog-title">{t('sr_close_title')}</h2>
            <p className="sr-hint">{t('sr_close_hint')}</p>
            <fieldset className="sr-fieldset">
              <legend>{t('sr_mood_question')}</legend>
              <div className="sr-moods">
                {MOODS.map(value => (
                  <label key={value} className={mood === value ? 'sr-mood sr-mood-on' : 'sr-mood'}>
                    <input type="radio" name="sr-mood" value={value} checked={mood === value} onChange={() => setMood(value)} />
                    <span><strong>{value}</strong> {t(`sr_mood_${value}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label htmlFor="sr-close-note" className="sr-label-dark">{t('sr_close_note')}</label>
            <textarea id="sr-close-note" className="sr-textarea-light" rows={5} value={note} aria-describedby="sr-close-counter sr-close-problem" onChange={event => setNote(event.target.value)} />
            <p id="sr-close-counter" className="sr-hint">{t('sr_close_counter', { n: note.length.toLocaleString(), min: MIN_CLOSING, max: MAX_CLOSING.toLocaleString() })}</p>
            <div id="sr-close-problem" role="alert" className="sr-problem">
              {problem && <>
                <p>{t(problem.key)}</p>
                {problem.enter && <button ref={enterButton} type="button" className="sr-btn-light" onClick={() => { if (!enterAgain(usedToken.current)) { setProblem({ key: 'session_renewed' }); window.setTimeout(() => document.getElementById('sr-close-note')?.focus(), 0) } }}>{t('session_enter')}</button>}
                {problem.check && <button type="button" className="sr-btn-light" disabled={busy} onClick={() => void checkNow()}>{t('sr_check')}</button>}
              </>}
            </div>
            <div className="sr-actions sr-actions-end">
              <button type="button" className="sr-btn-light" onClick={closeDialog} disabled={busy}>{t('sr_keep_going')}</button>
              <button type="submit" className="sr-btn-primary-light" disabled={busy}>{busy ? t('sr_saving') : t('sr_save_close')}</button>
            </div>
          </form>
        </dialog>
      )}
    </>
  )
}
