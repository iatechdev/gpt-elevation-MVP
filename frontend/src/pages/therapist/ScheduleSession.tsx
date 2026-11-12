// ES-178 (F2): agendar una sesión desde la ficha. Diálogo nativo (Esc, foco atrapado), fecha y hora futuras, duración 30/45/50/60/90 y errores POR CAMPO (con `code` y `field` del servidor) con foco al primero.
// El POST no es idempotente: si la respuesta se pierde se consulta las sesiones agendadas antes de decir nada («Comprobar»); nunca se reenvía a ciegas.
import { useEffect, useRef, useState, type CSSProperties } from 'react'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''
const DURATIONS = [30, 45, 50, 60, 90] as const
type T = (key: string, params?: Record<string, string | number>) => string
type Field = 'scheduledAt' | 'duration'
type Problem = { field?: Field; key: string; check?: boolean }

const primary: CSSProperties = { minHeight: 44, minWidth: 44, padding: '0.5rem 1.1rem', background: '#4A6741', border: 'none', borderRadius: '0.85rem', color: '#fff', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const ghost: CSSProperties = { ...primary, background: 'transparent', border: '0.5px solid #4A6741', color: '#4A6741' }
const control: CSSProperties = { minHeight: 44, padding: '0.5rem 0.75rem', borderRadius: '0.65rem', border: '0.5px solid #78716C', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', color: '#1C1917', background: '#fff', width: '100%', boxSizing: 'border-box' }
const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) // valor de <input type="datetime-local"> en hora local
const earliest = () => localInput(new Date(Date.now() + 5 * 60000))

export function ScheduleSession({ personId, personName, t, locale }: { personId: string; personName: string; t: T; locale: string }) {
  const [open, setOpen] = useState(false)
  const [when, setWhen] = useState(earliest())
  const [duration, setDuration] = useState<number>(50)
  const [busy, setBusy] = useState(false)
  const [problems, setProblems] = useState<Problem[]>([])
  const [notice, setNotice] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const whenRef = useRef<HTMLInputElement>(null)
  const durationRef = useRef<HTMLSelectElement>(null)
  const textOf = (date: Date) => date.toLocaleString(locale, { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  useEffect(() => { if (open && dialog.current && !dialog.current.open) dialog.current.showModal() }, [open])
  const closeDialog = () => dialog.current?.close()
  const onClosed = () => { setOpen(false); setProblems([]); opener.current?.focus() }
  const begin = () => { setWhen(earliest()); setDuration(50); setProblems([]); setNotice(''); setOpen(true) }
  const focusFirst = (list: Problem[]) => window.setTimeout(() => { const first = list.find(p => p.field)?.field; (first === 'duration' ? durationRef.current : whenRef.current)?.focus() }, 0)
  const fail = (list: Problem[]) => { setProblems(list); focusFirst(list) }
  const done = (date: Date) => { setNotice(t('fu_sch_done', { when: textOf(date) })); closeDialog() }
  const errorOf = (field: Field) => problems.find(p => p.field === field)

  // Respuesta perdida: ¿ya está entre las sesiones agendadas de esta persona, a esa hora? (la lista de «próximas» solo trae 5)
  async function reconcile(start: Date) {
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/sessions/therapist?status=scheduled`, { headers: { Authorization: `Bearer ${getToken()}` } })
      if (!res.ok) throw new Error(String(res.status))
      const rows = await res.json() as { patientId: number; scheduledAt: string }[]
      if (rows.some(row => String(row.patientId) === personId && Math.abs(new Date(row.scheduledAt).getTime() - start.getTime()) < 60000)) { done(start); return }
      setProblems([{ key: 'fu_sch_unsure', check: true }])
    } catch { setProblems([{ key: 'fu_sch_unsure', check: true }]) } finally { setBusy(false) }
  }

  async function submit() {
    if (busy) return
    const start = new Date(when)
    if (!when || Number.isNaN(start.getTime())) { fail([{ field: 'scheduledAt', key: 'fu_sch_required' }]); return }
    if (start.getTime() <= Date.now()) { fail([{ field: 'scheduledAt', key: 'fu_sch_past' }]); return }
    setBusy(true); setProblems([])
    let lost = false
    try {
      const res = await fetch(`${API}/api/sessions/therapist`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ patientId: Number(personId), scheduledAt: start.toISOString(), duration }) })
      const body = await res.json().catch(() => ({})) as { code?: string; field?: string }
      if (res.ok) { done(start); return }
      if (body.code === 'scheduled_in_past') fail([{ field: 'scheduledAt', key: 'fu_sch_past' }])
      else if (body.code === 'duration_invalid') fail([{ field: 'duration', key: 'fu_sch_duration' }])
      else if (body.code === 'session_conflict') fail([{ field: 'scheduledAt', key: 'fu_sch_conflict' }])
      else if (body.code === 'scheduled_invalid') fail([{ field: 'scheduledAt', key: 'fu_sch_required' }]) // ES-262: fecha fuera del rango que se puede guardar
      else if (body.code === 'invalid_input' || body.code === 'required') fail([{ field: body.field === 'duration' ? 'duration' : 'scheduledAt', key: body.field === 'duration' ? 'fu_sch_duration' : 'fu_sch_required' }])
      else if (res.status === 403) setProblems([{ key: 'fu_sch_noaccess' }])
      else if (res.status >= 500) lost = true
      else setProblems([{ key: 'fu_sch_error' }])
    } catch { lost = true } finally { setBusy(false) }
    if (lost) await reconcile(start)
  }

  const whenError = errorOf('scheduledAt'); const durationError = errorOf('duration'); const general = problems.filter(p => !p.field)
  return (
    <>
      <button ref={opener} type="button" style={primary} onClick={begin}>{t('fu_sch_open')}</button>
      {notice && <p role="status" style={{ flexBasis: '100%', margin: 0, fontSize: '0.85rem', color: '#2F4A29' }}>{notice}</p>}
      {open && (
        <dialog ref={dialog} aria-labelledby="fu-sch-title" onClose={onClosed} style={{ width: 'min(480px, calc(100vw - 2rem))', border: 'none', borderRadius: '1rem', padding: '1.5rem', fontFamily: 'Inter, sans-serif', color: '#1C1917' }}>
          <form noValidate onSubmit={event => { event.preventDefault(); void submit() }}>
            <h2 id="fu-sch-title" style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', margin: '0 0 0.25rem' }}>{t('fu_sch_title')}</h2>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#44403C', overflowWrap: 'anywhere' }}>{t('fu_sch_with', { name: personName })}</p>
            <label htmlFor="fu-sch-when" style={{ display: 'block', fontSize: '0.82rem', color: '#44403C', marginBottom: 4 }}>{t('fu_sch_when')}</label>
            <input ref={whenRef} id="fu-sch-when" type="datetime-local" style={control} value={when} min={earliest()} aria-invalid={whenError ? true : undefined} aria-describedby={whenError ? 'fu-sch-when-error' : undefined} onChange={event => { setWhen(event.target.value); setProblems(list => list.filter(p => p.field !== 'scheduledAt')) }} />
            <p id="fu-sch-when-error" role="alert" style={{ margin: '0.25rem 0 0.75rem', color: '#B91C1C', fontSize: '0.82rem' }}>{whenError ? t(whenError.key) : ''}</p>
            <label htmlFor="fu-sch-duration" style={{ display: 'block', fontSize: '0.82rem', color: '#44403C', marginBottom: 4 }}>{t('fu_sch_duration_label')}</label>
            <select ref={durationRef} id="fu-sch-duration" style={control} value={duration} aria-invalid={durationError ? true : undefined} aria-describedby={durationError ? 'fu-sch-duration-error' : undefined} onChange={event => { setDuration(Number(event.target.value)); setProblems(list => list.filter(p => p.field !== 'duration')) }}>
              {DURATIONS.map(minutes => <option key={minutes} value={minutes}>{t('fu_sch_minutes', { n: minutes })}</option>)}
            </select>
            <p id="fu-sch-duration-error" role="alert" style={{ margin: '0.25rem 0 0.75rem', color: '#B91C1C', fontSize: '0.82rem' }}>{durationError ? t(durationError.key) : ''}</p>
            <div role="alert" style={{ color: '#B91C1C', fontSize: '0.85rem' }}>
              {general.map(problem => <div key={problem.key}><p style={{ margin: 0 }}>{t(problem.key)}</p>{problem.check && <button type="button" style={{ ...ghost, marginTop: '0.5rem' }} disabled={busy} onClick={() => void reconcile(new Date(when))}>{t('fu_check')}</button>}</div>)}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button type="button" style={ghost} onClick={closeDialog} disabled={busy}>{t('fu_cancel')}</button>
              <button type="submit" style={{ ...primary, opacity: busy ? 0.7 : 1 }} disabled={busy}>{busy ? t('fu_sch_sending') : t('fu_sch_confirm')}</button>
            </div>
          </form>
        </dialog>
      )}
    </>
  )
}
