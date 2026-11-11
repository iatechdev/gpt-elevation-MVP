// ES-178 (F1): notas de seguimiento de la ficha. Tipos y filtro, crear y editar en un diálogo nativo, contador «n / 10.000», errores por código en ES/EN,
// control de edición concurrente (manda `expectedUpdatedAt`; 409 `note_changed` → «Ver la versión actual» / «Conservar la mía»), el texto no se pierde si algo falla
// y, si la respuesta se pierde, se relee antes de decir nada («Comprobar»). Sin emojis.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cardStyle } from './panelStyles'
import { localToday } from './followupFormat'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''
export const MAX_NOTE = 10000
const TYPES = ['session_note', 'observation', 'goal'] as const
type NoteType = typeof TYPES[number]
type T = (key: string, params?: Record<string, string | number>) => string
interface Reload { (): Promise<FollowupNote[] | null> } // firma de llamada: el heurístico ES-154 confunde «=> Promise<» con texto fijo

export interface FollowupNote { id: number; content: string; type: NoteType; sessionDate: string; createdAt: string; updatedAt: string }
type Current = { content: string; type: NoteType; sessionDate: string; updatedAt: string }
type Problem = { key: string; params?: Record<string, string | number>; check?: boolean }

const primary: CSSProperties = { minHeight: 44, minWidth: 44, padding: '0.5rem 1.1rem', background: '#4A6741', border: 'none', borderRadius: '0.85rem', color: '#fff', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const ghost: CSSProperties = { ...primary, background: 'transparent', border: '0.5px solid #4A6741', color: '#4A6741' }
const control: CSSProperties = { minHeight: 44, padding: '0.5rem 0.75rem', borderRadius: '0.65rem', border: '0.5px solid #78716C', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', color: '#1C1917', background: '#fff' }
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
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  // Lo escrito sobrevive a Esc/Cancelar y a reabrir (una nota nueva o cada nota que se edita tiene su borrador); solo se descarta al guardar con éxito.
  const drafts = useRef(new Map<string | number, { type: NoteType; date: string; text: string }>())
  const draftKey = (target: FollowupNote | 'new' | null) => (target === 'new' ? 'new' : target ? target.id : null)
  const typeLabel = (value: string) => t(`fu_type_${value}`)
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) // las fechas de sesión son DATEONLY: un día, no un instante
  const shown = filter === 'all' ? notes : notes.filter(note => note.type === filter)

  useEffect(() => { if (editing && dialog.current && !dialog.current.open) dialog.current.showModal() }, [editing])
  useEffect(() => { const key = draftKey(editing); if (key !== null) drafts.current.set(key, { type, date, text }) }, [editing, type, date, text])
  const closeDialog = () => dialog.current?.close()
  const onClosed = () => { setEditing(null); setProblem(null); setCurrent(null); setShowCurrent(false); opener.current?.focus() }
  const begin = (note: FollowupNote | 'new', from: HTMLElement | null) => {
    opener.current = from; setNotice(''); setProblem(null); setCurrent(null); setShowCurrent(false)
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
      const res = await fetch(isNew ? `${API}/api/therapist/pacientes/${personId}/notas` : `${API}/api/therapist/notas/${note.id}`, {
        method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: text, type, sessionDate: date, ...(isNew || !expected ? {} : { expectedUpdatedAt: expected }) }),
      })
      const body = await res.json().catch(() => ({})) as { code?: string; current?: Current }
      if (res.ok) { await reload(); finished(t('fu_saved')); return }
      if (res.status === 409 && body.code === 'note_changed' && body.current) { setCurrent(body.current); setShowCurrent(false); setProblem({ key: 'fu_changed' }) }
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
    <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.9rem' }} aria-labelledby="fu-notes-title">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 id="fu-notes-title" style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: 0 }}>{t('fu_notes')}</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '0.82rem', color: '#44403C', display: 'flex', alignItems: 'center', gap: 6 }}>{t('fu_filter')}
            <select style={control} value={filter} onChange={event => setFilter(event.target.value as 'all' | NoteType)}>
              <option value="all">{t('fu_all')}</option>
              {TYPES.map(value => <option key={value} value={value}>{typeLabel(value)}</option>)}
            </select>
          </label>
          <button type="button" style={primary} onClick={event => begin('new', event.currentTarget)}>{t('fu_new')}</button>
        </div>
      </div>
      {notice && <p role="status" style={{ margin: 0, fontSize: '0.85rem', color: '#2F4A29' }}>{notice}</p>}
      {shown.length === 0 ? <p style={{ margin: 0, fontSize: '0.85rem', color: '#44403C' }}>{notes.length === 0 ? t('fu_empty') : t('fu_empty_filter')}</p> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {shown.map(note => (
            <li key={note.id} style={{ padding: '0.75rem 1rem', background: '#F5F3EF', borderRadius: '0.65rem', border: '0.5px solid #D6D3D1' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#44403C' }}><strong>{typeLabel(note.type)}</strong> · {day(note.sessionDate)}</span>
                <button type="button" style={ghost} onClick={event => begin(note, event.currentTarget)}>{t('fu_edit')}<span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> · {typeLabel(note.type)} · {day(note.sessionDate)}</span></button>
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#1C1917', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{note.content}</p>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <dialog ref={dialog} aria-labelledby="fu-dialog-title" onClose={onClosed} style={{ width: 'min(560px, calc(100vw - 2rem))', border: 'none', borderRadius: '1rem', padding: '1.5rem', fontFamily: 'Inter, sans-serif', color: '#1C1917' }}>
          <form onSubmit={event => { event.preventDefault(); void save() }}>
            <h2 id="fu-dialog-title" style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', margin: '0 0 0.75rem' }}>{editing === 'new' ? t('fu_new') : t('fu_edit')}</h2>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', color: '#44403C' }}>{t('fu_filter')}
                <select style={control} value={type} onChange={event => setType(event.target.value as NoteType)}>{TYPES.map(value => <option key={value} value={value}>{typeLabel(value)}</option>)}</select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', color: '#44403C' }}>{t('fu_date')}
                <input type="date" style={control} value={date} max={today()} onChange={event => setDate(event.target.value)} />
              </label>
            </div>
            <label htmlFor="fu-text" style={{ display: 'block', fontSize: '0.82rem', color: '#44403C', marginBottom: 4 }}>{t('fu_text')}</label>
            <textarea id="fu-text" value={text} rows={7} aria-describedby="fu-counter fu-problem" onChange={event => setText(event.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem', borderRadius: '0.65rem', border: '0.5px solid #78716C', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', color: '#1C1917', resize: 'vertical', lineHeight: 1.6 }} />
            <p id="fu-counter" style={{ margin: '0.35rem 0 0.75rem', fontSize: '0.78rem', color: text.length > MAX_NOTE ? '#B91C1C' : '#44403C' }}>{t('fu_counter', { n: text.length.toLocaleString(locale), max: MAX_NOTE.toLocaleString(locale) })}</p>
            <div id="fu-problem" role="alert" style={{ color: '#B91C1C', fontSize: '0.85rem' }}>
              {problem && <>
                <p style={{ margin: 0 }}>{t(problem.key, problem.params)}</p>
                {problem.check && <button type="button" style={{ ...ghost, marginTop: '0.5rem' }} disabled={busy} onClick={() => void reconcile(editing, new Set(notes.map(n => n.id)))}>{t('fu_check')}</button>}
              </>}
            </div>
            {current && (
              <div style={{ margin: '0.75rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" style={ghost} aria-expanded={showCurrent} onClick={() => setShowCurrent(v => !v)}>{showCurrent ? t('fu_hide') : t('fu_see')}</button>
                  <button type="button" style={primary} onClick={keepMine}>{t('fu_keep')}</button>
                </div>
                {showCurrent && <div style={{ padding: '0.75rem', background: '#F5F3EF', borderRadius: '0.65rem', fontSize: '0.85rem', color: '#1C1917' }}>
                  <strong>{t('fu_current')}</strong> · {typeLabel(current.type)} · {day(current.sessionDate)}
                  <p style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{current.content}</p>
                </div>}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button type="button" style={ghost} onClick={closeDialog} disabled={busy}>{t('fu_cancel')}</button>
              <button id="fu-save" type="submit" style={{ ...primary, opacity: busy ? 0.7 : 1 }} disabled={busy}>{busy ? t('fu_saving') : t('fu_save')}</button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  )
}
