// ES-178 (F1): notas de seguimiento de la ficha. Tipos y filtro, crear y editar en un diálogo nativo, contador «n / 10.000», errores por código en ES/EN,
// control de edición concurrente (manda `expectedUpdatedAt`; 409 `note_changed` → «Ver la versión actual» / «Conservar la mía»), el texto no se pierde si algo falla
// ES-309 (PR 2): en Cartografía (Button, Chip, Dialog, campos, tokens --cg-*); sin estilos en línea. El diálogo nativo pasa al Dialog compartido (mismo foco, Tab, Esc y retorno del foco). Ni la lógica ni los textos cambian.
// y, si la respuesta se pierde, se relee antes de decir nada («Comprobar»). Sin emojis.
import { useEffect, useRef, useState } from 'react'
import { Button, Chip, Dialog, SelectField, TextAreaField, TextField } from '../../cartografia'
import { localToday } from './followupFormat'
import { enterAgain } from './sessionEnter'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''
export const MAX_NOTE = 10000
const TYPES = ['session_note', 'observation', 'goal'] as const
type NoteType = typeof TYPES[number]
type T = (key: string, params?: Record<string, string | number>) => string
interface Reload { (): Promise<FollowupNote[] | null> } // firma de llamada: el heurístico ES-154 confunde «=> Promise<» con texto fijo

export interface FollowupNote { id: number; content: string; type: NoteType; sessionDate: string; createdAt: string; updatedAt: string }
type Current = { content: string; type: NoteType; sessionDate: string; updatedAt: string }
type Problem = { key: string; params?: Record<string, string | number>; check?: boolean; enter?: boolean }

const today = () => localToday()

export function FollowupNotes({ personId, notes, reload, t, locale }: { personId: string; notes: FollowupNote[]; reload: Reload; t: T; locale: string }) {
  const [filter, setFilter] = useState<'all' | NoteType>('all')
  const [editing, setEditing] = useState<FollowupNote | 'new' | null>(null)
  const [type, setType] = useState<NoteType>('session_note')
  const [date, setDate] = useState(today())
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [current, setCurrent] = useState<Current | null>(null) // versión vigente tras un 409
  const [showCurrent, setShowCurrent] = useState(false)
  const [expected, setExpected] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState('')
  const usedToken = useRef('') // ES-265: token con que se envió la nota
  const enterButton = useRef<HTMLButtonElement>(null)
  // Lo escrito sobrevive a Esc/Cancelar y a reabrir (una nota nueva o cada nota que se edita tiene su borrador); solo se descarta al guardar con éxito.
  const drafts = useRef(new Map<string | number, { type: NoteType; date: string; text: string }>())
  const draftKey = (target: FollowupNote | 'new' | null) => (target === 'new' ? 'new' : target ? target.id : null)
  const typeLabel = (value: string) => t(`fu_type_${value}`)
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) // las fechas de sesión son DATEONLY: un día, no un instante
  const shown = filter === 'all' ? notes : notes.filter(note => note.type === filter)

  // E243-1: al aparecer el aviso de sesión vencida el botón «Guardar» se desactiva y el foco caía a body: pasa a «Entrar» (sin quitárselo a quien ya se movió a otro control).
  useEffect(() => {
    if (!problem?.enter) return
    const active = document.activeElement
    if (active === null || active === document.body || document.querySelector('dialog.cg-dialog[open]')?.contains(active)) enterButton.current?.focus()
  }, [problem])
  useEffect(() => { const key = draftKey(editing); if (key !== null) drafts.current.set(key, { type, date, text }) }, [editing, type, date, text])
  const closeDialog = () => { setEditing(null); setProblem(null); setCurrent(null); setShowCurrent(false) } // el Dialog devuelve el foco al botón que lo abrió
  const begin = (note: FollowupNote | 'new') => {
    setNotice(''); setProblem(null); setCurrent(null); setShowCurrent(false)
    const saved = drafts.current.get(draftKey(note) as string | number)
    if (note === 'new') { setType(saved?.type ?? 'session_note'); setDate(saved?.date ?? today()); setText(saved?.text ?? ''); setExpected(undefined) }
    else { setType(saved?.type ?? note.type); setDate(saved?.date ?? note.sessionDate.slice(0, 10)); setText(saved?.text ?? note.content); setExpected(note.updatedAt) }
    setEditing(note)
  }
  const finished = (message: string) => { const key = draftKey(editing); if (key !== null) drafts.current.delete(key); setNotice(message); closeDialog() }

  // Respuesta perdida: el servidor pudo guardar. Se relee y se compara con lo enviado antes de decir nada.
  async function reconcile(note: FollowupNote | 'new', before: Set<number>) {
    setBusy(true)
    try {
      const fresh = await reload()
      if (!fresh) throw new Error('reload')
      const match = note === 'new'
        ? fresh.find(n => !before.has(n.id) && n.content === text && n.type === type && n.sessionDate.slice(0, 10) === date)
        : fresh.find(n => n.id === note.id && n.content === text && n.type === type && n.sessionDate.slice(0, 10) === date && n.updatedAt !== note.updatedAt)
      if (match) { finished(t('fu_saved')); return }
      setProblem({ key: 'fu_unsure', check: true })
    } catch { setProblem({ key: 'fu_unsure', check: true }) } finally { setBusy(false) }
  }

  async function save() {
    if (busy || !editing) return
    if (!text.trim()) { setProblem({ key: 'fu_err_required' }); return }
    if (text.length > MAX_NOTE) { setProblem({ key: 'fu_err_too_long', params: { max: MAX_NOTE.toLocaleString(locale) } }); return }
    const note = editing; const before = new Set(notes.map(n => n.id))
    setBusy(true); setProblem(null)
    let lost = false
    try {
      const isNew = note === 'new'
      const token = getToken(); usedToken.current = token
      const res = await fetch(isNew ? `${API}/api/therapist/pacientes/${personId}/notas` : `${API}/api/therapist/notas/${note.id}`, {
        method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text, type, sessionDate: date, ...(isNew || !expected ? {} : { expectedUpdatedAt: expected }) }),
      })
      const body = await res.json().catch(() => ({})) as { code?: string; current?: Current }
      if (res.ok) { await reload(); finished(t('fu_saved')); return }
      if (res.status === 409 && body.code === 'note_changed' && body.current) { setCurrent(body.current); setShowCurrent(false); setProblem({ key: 'fu_changed' }) }
      else if (res.status === 401) setProblem({ key: 'session_expired_note', enter: true }) // ES-265: sesión vencida con la nota escrita → aviso con «Entrar»
      else if (res.status === 403) setProblem({ key: 'fu_err_access' })
      else if (res.status === 404) setProblem({ key: 'fu_err_gone' })
      else if (res.status >= 500) lost = true
      else if (body.code === 'too_long') setProblem({ key: 'fu_err_too_long', params: { max: MAX_NOTE.toLocaleString(locale) } })
      else if (body.code === 'content_required' || res.status === 400) setProblem({ key: body.code === 'invalid_type' ? 'fu_err_type' : 'fu_err_required' })
      else setProblem({ key: 'fu_err_generic' })
    } catch { lost = true } finally { setBusy(false) }
    if (lost) await reconcile(note, before)
  }

  const keepMine = () => { if (!current) return; setExpected(current.updatedAt); setCurrent(null); setShowCurrent(false); setProblem({ key: 'fu_keep_ready' }); window.setTimeout(() => document.getElementById('fu-save')?.focus(), 0) }

  return (
    <section className="cg-card pf-block" aria-labelledby="fu-notes-title">
      <div className="pf-bar">
        <h2 id="fu-notes-title">{t('fu_notes')}</h2>
        <div className="pf-bar__tools">
          <SelectField label={t('fu_filter')} value={filter} onChange={event => setFilter(event.target.value as 'all' | NoteType)}>
            <option value="all">{t('fu_all')}</option>
            {TYPES.map(value => <option key={value} value={value}>{typeLabel(value)}</option>)}
          </SelectField>
          <Button onClick={() => begin('new')}>{t('fu_new')}</Button>
        </div>
      </div>
      {notice && <p role="status" className="tp-live tp-live--ok">{notice}</p>}
      {shown.length === 0 ? <p className="pf-small">{notes.length === 0 ? t('fu_empty') : t('fu_empty_filter')}</p> : (
        <ul className="cg-items">
          {shown.map(note => (
            <li key={note.id} className="cg-item">
              <div className="pf-row">
                <p className="pf-day"><Chip>{typeLabel(note.type)}</Chip>{day(note.sessionDate)}</p>
                <Button variant="ghost" onClick={() => begin(note)}>{t('fu_edit')}<span className="cg-sr"> · {typeLabel(note.type)} · {day(note.sessionDate)}</span></Button>
              </div>
              <p className="pf-text">{note.content}</p>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={closeDialog}
        title={editing === 'new' ? t('fu_new') : t('fu_edit')}
        actions={<>
          <Button variant="ghost" onClick={closeDialog} disabled={busy}>{t('fu_cancel')}</Button>
          <Button id="fu-save" type="submit" form="fu-form" disabled={busy}>{busy ? t('fu_saving') : t('fu_save')}</Button>
        </>}
      >
        <form id="fu-form" className="tp-dlg-form" onSubmit={event => { event.preventDefault(); void save() }}>
          <div className="pf-two">
            <SelectField label={t('fu_filter')} value={type} onChange={event => setType(event.target.value as NoteType)}>{TYPES.map(value => <option key={value} value={value}>{typeLabel(value)}</option>)}</SelectField>
            <TextField type="date" label={t('fu_date')} value={date} max={today()} onChange={event => setDate(event.target.value)} />
          </div>
          <TextAreaField id="fu-text" label={t('fu_text')} value={text} rows={7} aria-describedby="fu-counter fu-problem" onChange={event => setText(event.target.value)} />
          <p id="fu-counter" className={text.length > MAX_NOTE ? 'tp-counter pf-over' : 'tp-counter'}>{t('fu_counter', { n: text.length.toLocaleString(locale), max: MAX_NOTE.toLocaleString(locale) })}</p>
          <div id="fu-problem" role="alert" className="tp-dlg-error">
            {problem && <>
              <p>{t(problem.key, problem.params)}</p>
              {problem.enter && <button ref={enterButton} type="button" className="cg-btn cg-btn--ghost" onClick={() => { if (!enterAgain(usedToken.current)) { setProblem({ key: 'session_renewed' }); window.setTimeout(() => document.getElementById('fu-text')?.focus(), 0) } }}>{t('session_enter')}</button>}
              {problem.check && editing && <Button variant="ghost" disabled={busy} onClick={() => void reconcile(editing, new Set(notes.map(n => n.id)))}>{t('fu_check')}</Button>}
            </>}
          </div>
          {current && (
            <div className="pf-conflict">
              <div className="cg-row">
                <Button variant="ghost" aria-expanded={showCurrent} onClick={() => setShowCurrent(v => !v)}>{showCurrent ? t('fu_hide') : t('fu_see')}</Button>
                <Button onClick={keepMine}>{t('fu_keep')}</Button>
              </div>
              {showCurrent && <div className="tp-quote">
                <strong>{t('fu_current')}</strong> · {typeLabel(current.type)} · {day(current.sessionDate)}
                <p className="pf-text">{current.content}</p>
              </div>}
            </div>
          )}
        </form>
      </Dialog>
    </section>
  )
}
