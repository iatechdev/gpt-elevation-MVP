// ES-178 (F2): agendar una sesión desde la ficha. Diálogo nativo (Esc, foco atrapado), fecha y hora futuras, duración 30/45/50/60/90 y errores POR CAMPO (con `code` y `field` del servidor) con foco al primero.
// ES-309 (PR 2): en Cartografía (Button, Dialog, TextField, SelectField); sin estilos en línea. El diálogo nativo pasa al Dialog compartido (mismo foco, Tab, Esc y retorno del foco). Ni la lógica ni los textos cambian.
// El POST no es idempotente: si la respuesta se pierde se consulta las sesiones agendadas antes de decir nada («Comprobar»); nunca se reenvía a ciegas.
import { useState } from 'react'
import { Button, Dialog, SelectField, TextField } from '../../cartografia'
import { invalidateStoredSession } from '../../access/session'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''
const DURATIONS = [30, 45, 50, 60, 90] as const
type T = (key: string, params?: Record<string, string | number>) => string
type Field = 'scheduledAt' | 'duration'
type Problem = { field?: Field; key: string; check?: boolean }

const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) // valor de <input type="datetime-local"> en hora local
const earliest = () => localInput(new Date(Date.now() + 5 * 60000))

export function ScheduleSession({ personId, personName, t, locale }: { personId: string; personName: string; t: T; locale: string }) {
  const [open, setOpen] = useState(false)
  const [when, setWhen] = useState(earliest())
  const [duration, setDuration] = useState<number>(50)
  const [busy, setBusy] = useState(false)
  const [problems, setProblems] = useState<Problem[]>([])
  const [notice, setNotice] = useState('')
  const textOf = (date: Date) => date.toLocaleString(locale, { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  const closeDialog = () => { setOpen(false); setProblems([]) } // el Dialog devuelve el foco al botón que lo abrió
  const begin = () => { setWhen(earliest()); setDuration(50); setProblems([]); setNotice(''); setOpen(true) }
  const focusFirst = (list: Problem[]) => window.setTimeout(() => { const first = list.find(p => p.field)?.field; document.getElementById(first === 'duration' ? 'fu-sch-duration' : 'fu-sch-when')?.focus() }, 0)
  const fail = (list: Problem[]) => { setProblems(list); focusFirst(list) }
  const done = (date: Date) => { setNotice(t('fu_sch_done', { when: textOf(date) })); closeDialog() }
  const errorOf = (field: Field) => problems.find(p => p.field === field)

  // Respuesta perdida: ¿ya está entre las sesiones agendadas de esta persona, a esa hora? (la lista de «próximas» solo trae 5)
  async function reconcile(start: Date) {
    setBusy(true)
    try {
      const token = getToken()
      const res = await fetch(`${API}/api/sessions/therapist?status=scheduled`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 401) { invalidateStoredSession(token); return } // ES-265
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
      const token = getToken()
      const res = await fetch(`${API}/api/sessions/therapist`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ patientId: Number(personId), scheduledAt: start.toISOString(), duration }) })
      const body = await res.json().catch(() => ({})) as { code?: string; field?: string }
      if (res.ok) { done(start); return }
      if (res.status === 401) { invalidateStoredSession(token); return } // ES-265
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
      <Button onClick={begin}>{t('fu_sch_open')}</Button>
      {notice && <p role="status" className="pf-notice tp-live tp-live--ok">{notice}</p>}
      <Dialog
        open={open}
        onClose={closeDialog}
        title={t('fu_sch_title')}
        actions={<>
          <Button variant="ghost" onClick={closeDialog} disabled={busy}>{t('fu_cancel')}</Button>
          <Button type="submit" form="fu-sch-form" disabled={busy}>{busy ? t('fu_sch_sending') : t('fu_sch_confirm')}</Button>
        </>}
      >
        <form id="fu-sch-form" className="tp-dlg-form" noValidate onSubmit={event => { event.preventDefault(); void submit() }}>
          <p className="pf-small">{t('fu_sch_with', { name: personName })}</p>
          <TextField id="fu-sch-when" type="datetime-local" label={t('fu_sch_when')} value={when} min={earliest()} aria-invalid={whenError ? true : undefined} aria-describedby={whenError ? 'fu-sch-when-error' : undefined} onChange={event => { setWhen(event.target.value); setProblems(list => list.filter(p => p.field !== 'scheduledAt')) }} />
          <p id="fu-sch-when-error" role="alert" className="cg-error pf-err">{whenError ? t(whenError.key) : ''}</p>
          <SelectField id="fu-sch-duration" label={t('fu_sch_duration_label')} value={duration} aria-invalid={durationError ? true : undefined} aria-describedby={durationError ? 'fu-sch-duration-error' : undefined} onChange={event => { setDuration(Number(event.target.value)); setProblems(list => list.filter(p => p.field !== 'duration')) }}>
            {DURATIONS.map(minutes => <option key={minutes} value={minutes}>{t('fu_sch_minutes', { n: minutes })}</option>)}
          </SelectField>
          <p id="fu-sch-duration-error" role="alert" className="cg-error pf-err">{durationError ? t(durationError.key) : ''}</p>
          <div role="alert" className="tp-dlg-error">
            {general.map(problem => <div key={problem.key}><p>{t(problem.key)}</p>{problem.check && <Button variant="ghost" disabled={busy} onClick={() => void reconcile(new Date(when))}>{t('fu_check')}</Button>}</div>)}
          </div>
        </form>
      </Dialog>
    </>
  )
}
