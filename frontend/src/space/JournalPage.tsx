import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { entry, listEntries, readEntry, request, SpaceError, validDraft } from './api'
import type { Entry } from './api'
import { useDraftGuard, useSpaceToken } from './hooks'
import { SpaceShell } from './SpaceShell'
import { ConfirmDialog } from './ConfirmDialog'

export function JournalPage() {
  const token = useSpaceToken(); const location = useLocation()
  return <JournalSession key={`${token}:${location.pathname}`} token={token} />
}
function JournalSession({ token }: { token: string }) {
  const { lang } = useLanguage(); const c = copy[lang]; const navigate = useNavigate()
  const { id: rawId } = useParams(); const location = useLocation()
  const isNew = location.pathname.endsWith('/new'); const id = rawId && /^[1-9]\d{0,9}$/.test(rawId) ? Number(rawId) : null
  const isList = !isNew && !rawId
  const [entries, setEntries] = useState<Entry[]>([]); const [saved, setSaved] = useState<Entry | null>(null)
  const [date, setDate] = useState(''); const [content, setContent] = useState(''); const [editing, setEditing] = useState(isNew)
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [expired, setExpired] = useState(!token)
  const [notice, setNotice] = useState(''); const [unavailable, setUnavailable] = useState(false)
  const [uncertain, setUncertain] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [inspection, setInspection] = useState(false); const [conflict, setConflict] = useState<Entry | null>(null)
  const [dialog, setDialog] = useState<'delete' | 'cancel' | 'discard' | null>(null)
  const alive = useRef(true); const lock = useRef(false); const acknowledgedId = useRef<number | null>(null)
  const current = useCallback(() => alive.current && localStorage.getItem('elevation_token') === token, [token])
  const dirty = editing && (date !== (saved?.date || '') || content !== (saved?.content || ''))
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
        if (isList) { const rows = await listEntries(token); if (current()) setEntries(rows) }
        else if (!isNew) {
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
  }, [token, id, isNew, isList, current])

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
  const save = async () => {
    if (lock.current || uncertain || conflict) return
    if (!validDraft(date, content)) { setNotice(c.invalid); document.getElementById(!date ? 'entry-date' : 'entry-content')?.focus(); return }
    lock.current = true; setBusy(true); setNotice('')
    let attempted = false
    try {
      if (saved) {
        const latest = await readEntry(token, saved.id)
        if (!current()) return
        if (latest.updatedAt !== saved.updatedAt) { setConflict(latest); setNotice(c.changed); return }
      }
      attempted = true
      const acknowledged = entry(await request(token, saved ? `/api/diary/${saved.id}` : '/api/diary', { method: saved ? 'PUT' : 'POST', body: JSON.stringify({ date, content }) }))
      acknowledgedId.current = acknowledged.id
      const row = await readEntry(token, acknowledged.id)
      if (!current()) return
      if (row.date !== date || row.content !== content) { setSaved(row); setConflict(row); setNotice(c.changed); return }
      setSaved(row); setEditing(false); setNotice(c.saved)
      if (isNew) navigate(`/app/diary/${row.id}`, { replace: true })
    } catch (error) {
      if (current() && attempted && !(error instanceof SpaceError && [400, 401, 403, 404].includes(error.status))) { setUncertain(saved || acknowledgedId.current ? 'edit' : 'create'); setNotice(saved || acknowledgedId.current ? c.saveError : c.unknown) }
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
  const rows = <><p className="space-note">{c.limit}</p>{!entries.length && <p>{c.empty}</p>}{entries.map(e => <article className="elv-card space-card" key={e.id}><h2>{e.date}</h2><p className="space-private-text">{e.content.slice(0, 160)}{e.content.length > 160 ? '…' : ''}</p><Link className="elv-link" to={`/app/diary/${e.id}`}>{c.open}<span className="sr-only"> {e.date}</span></Link></article>)}</>
  return <SpaceShell><h1>{c.title}</h1><p>{c.privacy}</p>{expired ? <p role="alert">{c.session} <Link to="/login">{c.login}</Link></p> : <>
    <p role="status" aria-live="polite" className={notice ? 'space-warning' : ''}>{busy ? c.saving : loading ? c.loading : notice}</p>
    {isList ? <><Link className="elv-btn elv-btn-primary" to="/app/diary/new">{c.new}</Link>{!loading && !notice && rows}{notice && <button className="elv-btn" onClick={() => { void listEntries(token).then(rows => { if (current()) { setEntries(rows); setNotice('') } }).catch(error => failure(error, c.loadError)) }}>{c.retry}</button>}</> : !loading && <>
      {unavailable ? <p>{c.unavailable}</p> : editing ? <form onSubmit={event => { event.preventDefault(); void save() }}>
        <p>{isNew || dirty ? c.dirty : c.saved}</p>
        <label htmlFor="entry-date">{c.date}</label><input className="elv-input" id="entry-date" type="date" required value={date} disabled={busy || !!uncertain} onChange={event => setDate(event.target.value)} />
        <label htmlFor="entry-content">{c.content}</label><textarea className="elv-textarea" id="entry-content" rows={10} required maxLength={10000} value={content} disabled={busy || !!uncertain} onChange={event => setContent(event.target.value)} /><p className="space-note">{content.length}/10.000</p>
        <div className="space-actions"><button className="elv-btn elv-btn-primary" disabled={busy || !!uncertain || !!conflict || !dirty}>{c.save}</button><button type="button" className="elv-btn" disabled={busy} onClick={() => setDialog('cancel')}>{c.cancel}</button></div>
      </form> : saved && <article><h2>{saved.date}</h2><p className="space-note">{c.updated}: {new Date(saved.updatedAt).toLocaleString(lang)}</p><p className="space-private-text">{saved.content}</p><div className="space-actions"><button className="elv-btn" disabled={busy || !!uncertain} onClick={() => { setEditing(true); setNotice('') }}>{c.edit}</button><button className="elv-btn" disabled={busy || !!uncertain} onClick={() => setDialog('delete')}>{c.remove}</button><Link className="elv-link" to="/app/chat?journal=choose">{c.chooseChat}</Link></div></article>}
      {conflict && <button type="button" className="elv-btn" onClick={() => { if (!dirty || window.confirm(c.leave)) { setSaved(conflict); setDate(conflict.date); setContent(conflict.content); setConflict(null); setUncertain(null); setNotice('') } }}>{c.review}</button>}
      {uncertain && <div className="space-card"><p>{uncertain === 'create' ? c.unknown : uncertain === 'delete' ? c.deleteError : c.saveError}</p><button className="elv-btn" disabled={busy} onClick={() => void inspect()}>{c.inspect}</button>{uncertain === 'create' && <><p>{c.duplicate}</p><button className="elv-btn" disabled={busy} onClick={() => setDialog('discard')}>{c.discard}</button></>}{inspection && rows}</div>}
      <p className="space-note">{c.deleteLimit}</p><Link className="elv-link" to="/app/diary">{c.journal}</Link>
    </>}
    {dialog && <ConfirmDialog text={dialog === 'delete' ? `${c.deleteWarning} ${c.deleteLimit}` : c.leave} cancel={c.stay} confirm={dialog === 'delete' ? c.remove : c.discard} onClose={() => setDialog(null)} onConfirm={() => {
      if (dialog === 'delete') { void remove(); return }
      setDialog(null)
      if (isNew || dialog === 'discard') navigate('/app/diary')
      else { setEditing(false); setDate(saved?.date || ''); setContent(saved?.content || ''); setNotice(''); setUncertain(null); setConflict(null) }
    }} />}
  </>}</SpaceShell>
}
