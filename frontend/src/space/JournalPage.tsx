import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { entry, listEntries, readEntry, request, SpaceError, validDate, validDraft } from './api'
import type { Entry } from './api'
import { useDraftGuard, useSpaceToken } from './hooks'
import { Button, Dialog, TextAreaField, TextField } from '../cartografia'
import { PersonScreen } from './PersonScreen'
import { JournalRecent, JournalRecentList } from './JournalRecent'
import { journalCopy, journalDate } from './journalCopy'
import './journal.css'

// ES-138: fecha local de hoy (no la UTC del servidor) como valor inicial de una entrada nueva.
const localToday = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }

export function JournalPage() {
  const token = useSpaceToken(); const location = useLocation()
  return <JournalSession key={`${token}:${location.pathname}`} token={token} />
}
function JournalSession({ token }: { token: string }) {
  const { lang } = useLanguage(); const c = copy[lang]; const j = journalCopy[lang]; const navigate = useNavigate()
  const { id: rawId } = useParams(); const location = useLocation()
  const isNew = location.pathname.endsWith('/new'); const id = rawId && /^[1-9]\d{0,9}$/.test(rawId) ? Number(rawId) : null
  const isList = !isNew && !rawId
  const [entries, setEntries] = useState<Entry[]>([]); const [saved, setSaved] = useState<Entry | null>(null)
  const [defaultDate] = useState(localToday); const [date, setDate] = useState(isNew ? defaultDate : ''); const [errors, setErrors] = useState<{ date?: string; content?: string }>({}); const [content, setContent] = useState(''); const [editing, setEditing] = useState(isNew)
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [expired, setExpired] = useState(!token)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [notice, setNotice] = useState(''); const [unavailable, setUnavailable] = useState(false)
  const [uncertain, setUncertain] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [inspection, setInspection] = useState(false); const [conflict, setConflict] = useState<Entry | null>(null)
  const [dialog, setDialog] = useState<'delete' | 'cancel' | 'discard' | null>(null)
  const alive = useRef(true); const lock = useRef(false); const acknowledgedId = useRef<number | null>(null)
  const requestId = useRef(crypto.randomUUID()) // ES-163: identifica este borrador nuevo; reintentar con el mismo no duplica la entrada
  const current = useCallback(() => alive.current && localStorage.getItem('elevation_token') === token, [token])
  const dirty = editing && (date !== (saved?.date || (isNew ? defaultDate : '')) || content !== (saved?.content || ''))
  useDraftGuard(!expired && (dirty || busy || !!uncertain), c.leave)
  const failure = (error: unknown, fallback: string) => {
    if (!current()) return
    if (error instanceof SpaceError && error.status === 401) { setExpired(true); setContent(''); setEntries([]); setSaved(null); setConflict(null) }
    else if (error instanceof SpaceError && error.status === 404) { setUnavailable(true); setNotice(c.unavailable) }
    else setNotice(fallback)
  }
  const loadFailure = useEffectEvent((error: unknown) => failure(error, c.loadError))
  useEffect(() => {
    alive.current = true
    const load = async () => {
      try {
        if (!isList && !isNew) {
          if (!id) throw new SpaceError(404)
          const row = await readEntry(token, id)
          if (current()) { setSaved(row); setDate(row.date); setContent(row.content) }
        }
      } catch (error) { loadFailure(error) }
      finally { if (current()) setLoading(false) }
    }
    void load()
    return () => { alive.current = false }
    // Token/path changes remount the session; language changes do not reload private drafts.
  }, [token, id, isNew, isList, current, loadAttempt])

  const inspect = async () => {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try {
      if (uncertain === 'create') { const rows = await listEntries(token); if (current()) { setEntries(rows); setInspection(true) } }
      else if (id || acknowledgedId.current) {
        const row = await readEntry(token, (id || acknowledgedId.current)!)
        if (current()) {
          setSaved(row); setUncertain(null)
          if (row.date === date && row.content === content) { setNotice(c.current); if (isNew) navigate(`/app/diary/${row.id}`, { replace: true }) }
          else { setConflict(row); setNotice(c.changed) }
        }
      }
    } catch (error) {
      if (current() && error instanceof SpaceError && error.status === 404 && uncertain === 'delete') { setUnavailable(true); setContent(''); setSaved(null); setUncertain(null); setNotice(c.deleted) }
      else failure(error, c.loadError)
    } finally { if (current()) setBusy(false); lock.current = false }
  }
  const save = async (retry = false) => {
    if (lock.current || (uncertain && !retry) || conflict) return
    // ES-138: errores propios (ES/EN) asociados a cada campo en lugar de la burbuja nativa del navegador.
    const found = { date: !date ? c.dateMissing : !validDate(date) ? c.dateInvalid : undefined, content: !content.trim() ? c.contentMissing : undefined }
    if (found.date || found.content || !validDraft(date, content)) {
      setErrors(found); setNotice('')
      document.getElementById(found.date ? 'entry-date' : 'entry-content')?.focus(); return
    }
    setErrors({})
    lock.current = true; setBusy(true); setNotice('')
    if (retry) { setUncertain(null); setInspection(false) } // «Reintentar guardar»: mismo requestId, el servidor devuelve la entrada ya creada si el intento anterior llegó
    let attempted = false
    try {
      if (saved) {
        const latest = await readEntry(token, saved.id)
        if (!current()) return
        if (latest.updatedAt !== saved.updatedAt) { setConflict(latest); setNotice(c.changed); return }
      }
      attempted = true
      const acknowledged = entry(await request(token, saved ? `/api/diary/${saved.id}` : '/api/diary', { method: saved ? 'PUT' : 'POST', body: JSON.stringify(saved ? { date, content } : { date, content, requestId: requestId.current }) }))
      acknowledgedId.current = acknowledged.id
      const row = await readEntry(token, acknowledged.id)
      if (!current()) return
      if (row.date !== date || row.content !== content) { setSaved(row); setConflict(row); setNotice(c.changed); return }
      setSaved(row); setEditing(false); setNotice(c.saved); requestId.current = crypto.randomUUID()
      if (isNew) navigate(`/app/diary/${row.id}`, { replace: true })
    } catch (error) {
      if (current() && attempted && !(error instanceof SpaceError && [400, 401, 403, 404].includes(error.status))) { setUncertain(saved || acknowledgedId.current ? 'edit' : 'create'); setNotice(saved || acknowledgedId.current ? j.unconfirmed : c.unknown) }
      else failure(error, c.saveError)
    } finally { if (current()) setBusy(false); lock.current = false }
  }
  const remove = async () => {
    setDialog(null); if (!saved || lock.current) return
    lock.current = true; setBusy(true)
    try {
      const result = await request(token, `/api/diary/${saved.id}`, { method: 'DELETE' }) as { id?: number; deleted?: boolean }
      if (result?.id !== saved.id || result.deleted !== true) throw new SpaceError(502)
      try { await readEntry(token, saved.id); throw new SpaceError(502) }
      catch (error) { if (!(error instanceof SpaceError) || error.status !== 404) throw error }
      if (current()) { setContent(''); setSaved(null); setUnavailable(true); setEditing(false); setNotice(c.deleted) }
    } catch (error) { if (current()) { setUncertain('delete'); failure(error, c.deleteError) } }
    finally { if (current()) setBusy(false); lock.current = false }
  }
  const rows = <JournalRecentList entries={entries} lang={lang} selected={id} />
  // ES-307 (PR 3): Cartografía. Mismas condiciones, acciones y textos; solo cambian las piezas (PersonScreen, cg-card, Button, TextField/TextAreaField, Dialog) y el estilo.
  const statusWarn = !!notice && notice !== c.saved
  return <PersonScreen title={j.title} lead={j.private} wide>
    <div className="pg-actions"><Button variant="ghost" disabled aria-describedby="journal-bridge-note">{j.bridge}</Button><p id="journal-bridge-note" className="cg-hint">{j.bridgeNote}</p></div>
    {expired ? <p role="alert" className="cg-banner cg-banner--error"><span className="cg-banner__title">{c.session} <Link to="/login">{c.login}</Link></span></p> : <div className="pg-work"><section className="cg-card pg-sheet" aria-labelledby="journal-entry-title">
    <div className="pg-sheet-top"><h2 id="journal-entry-title" className="pg-eyebrow">{j.entry}</h2><p id="journal-save-status" role="status" aria-live="polite" className={statusWarn ? 'pg-status pg-status--warn' : 'pg-status'}>{busy ? c.saving : loading ? c.loading : notice || (editing ? dirty ? c.dirty : isNew ? c.new : c.saved : saved ? c.saved : '')}</p></div>
    {isList ? <><p>{j.select}</p><p className="cg-hint" id="journal-privacy-list">{c.privacy}</p></> : !loading && <>
      {unavailable ? <p>{c.unavailable}</p> : editing ? <form noValidate onSubmit={event => { event.preventDefault(); void save() }}>
        <div className="pg-date"><TextField label={c.date} id="entry-date" type="date" required value={date} aria-invalid={!!errors.date} aria-describedby={errors.date ? 'entry-date-error' : 'journal-save-status'} disabled={busy || !!uncertain} onChange={event => { setDate(event.target.value); setNotice(''); setErrors(e => ({ ...e, date: undefined })) }} />{errors.date && <p id="entry-date-error" className="cg-error" role="alert">{errors.date}</p>}</div>
        <TextAreaField className="pg-paper" label={c.content} id="entry-content" rows={8} required maxLength={10000} aria-invalid={!!errors.content} aria-describedby={errors.content ? 'entry-content-error' : 'journal-save-status journal-privacy journal-draft-warning journal-counter'} value={content} disabled={busy || !!uncertain} onChange={event => { setContent(event.target.value); setNotice(''); setErrors(e => ({ ...e, content: undefined })) }} />{errors.content && <p id="entry-content-error" className="cg-error" role="alert">{errors.content}</p>}
        <div className="pg-paper-footer"><span id="journal-counter">{content.length.toLocaleString(lang)} / {(10000).toLocaleString(lang)} {j.count}</span><span>{j.manual}</span></div>
        <p className="cg-hint" id="journal-privacy">{c.privacy}</p><p className="cg-hint" id="journal-draft-warning">{j.draftWarning}</p>
        <div className="pg-actions"><Button type="submit" disabled={busy || !!uncertain || !!conflict || !dirty}>{j.save}</Button><Button variant="ghost" disabled={busy} onClick={() => setDialog('cancel')}>{c.cancel}</Button></div>
      </form> : saved && <article><h3><time dateTime={saved.date}>{journalDate(saved.date, lang)}</time></h3><p className="cg-hint">{c.updated}: {new Date(saved.updatedAt).toLocaleString(lang)}</p><p className="space-private-text pg-reading">{saved.content}</p><p className="cg-hint">{c.privacy}</p><div className="pg-actions"><Button variant="ghost" disabled={busy || !!uncertain} onClick={() => { setEditing(true); setNotice('') }}>{c.edit}</Button><Button variant="danger" disabled={busy || !!uncertain} onClick={() => setDialog('delete')}>{c.remove}</Button><Link to="/app/chat?journal=choose">{c.chooseChat}</Link></div></article>}
      {conflict && <Button variant="ghost" onClick={() => { if (!dirty || window.confirm(c.leave)) { setSaved(conflict); setDate(conflict.date); setContent(conflict.content); setConflict(null); setUncertain(null); setNotice('') } }}>{c.review}</Button>}
      {!saved && !isNew && !unavailable && notice === c.loadError && <Button variant="ghost" onClick={() => { setNotice(''); setLoading(true); setLoadAttempt(value => value + 1) }}>{c.retry}</Button>}
      {uncertain && <div className="cg-banner cg-banner--error"><p className="cg-banner__title">{uncertain === 'create' ? c.unknown : uncertain === 'delete' ? c.deleteError : j.unconfirmed}</p><div className="pg-actions">{uncertain === 'create' && <><Button disabled={busy} onClick={() => void save(true)}>{j.retrySave}</Button><p className="cg-hint">{j.retryHint}</p></>}<Button variant="ghost" disabled={busy} onClick={() => void inspect()}>{c.inspect}</Button></div>{uncertain === 'create' && <><p>{c.duplicate}</p><Button variant="ghost" disabled={busy} onClick={() => setDialog('discard')}>{c.discard}</Button></>}{inspection && rows}</div>}
      <p className="cg-hint">{c.deleteLimit}</p><Link to="/app/diary">{c.journal}</Link>
    </>}
    </section><JournalRecent key={`${saved?.updatedAt || ''}:${unavailable}`} token={token} lang={lang} selected={id} onSessionExpired={() => failure(new SpaceError(401), c.loadError)} /></div>}
    <Dialog open={!!dialog && !expired} onClose={() => setDialog(null)} title={dialog === 'delete' ? c.remove : c.leave}
      actions={<><Button variant="ghost" onClick={() => setDialog(null)}>{c.stay}</Button><Button variant={dialog === 'delete' ? 'danger' : 'primary'} onClick={() => {
        if (dialog === 'delete') { void remove(); return }
        setDialog(null)
        if (isNew || dialog === 'discard') navigate('/app/diary')
        else { setEditing(false); setDate(saved?.date || ''); setContent(saved?.content || ''); setNotice(''); setUncertain(null); setConflict(null) }
      }}>{dialog === 'delete' ? c.remove : c.discard}</Button></>}>
      {dialog === 'delete' && <p>{`${c.deleteWarning} ${c.deleteLimit}`}</p>}
    </Dialog>
  </PersonScreen>
}
