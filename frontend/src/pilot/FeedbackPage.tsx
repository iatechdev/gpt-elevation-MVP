import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { emptyAnswers, hasAnswers, makeIntent, previewEnabled } from './model'
import type { Answers, Feedback, Intent } from './model'
import { createFixtureRepository, FixtureError, scenario } from './fixtures'
import { usePilotGuard, usePilotToken } from './hooks'
import { PreviewShell } from './PreviewShell'

export function FeedbackPage() {
  const token = usePilotToken()
  return <PreviewShell>{previewEnabled(import.meta.env.VITE_ENABLE_PILOT_FEEDBACK_PREVIEW) && <FeedbackSession key={token} token={token} />}</PreviewShell>
}
function FeedbackSession({ token }: { token: string }) {
  const { lang } = useLanguage(); const c = copy[lang]
  const repository = useMemo(() => createFixtureRepository(scenario(import.meta.env.VITE_PILOT_FEEDBACK_SCENARIO)), [])
  const [saved, setSaved] = useState<Feedback | null>(null); const [draft, setDraft] = useState<Answers>(emptyAnswers)
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<'loadError' | 'saveError' | 'unknown' | 'conflict' | 'saved' | 'removed' | null>(null)
  const [intent, setIntent] = useState<Intent | null>(null); const [retryable, setRetryable] = useState(false); const [dialog, setDialog] = useState(false); const [skipped, setSkipped] = useState<string[]>([])
  const alive = useRef(true); const lock = useRef(false); const dialogRef = useRef<HTMLDialogElement>(null); const cancelRef = useRef<HTMLButtonElement>(null)
  const current = useCallback(() => alive.current && localStorage.getItem('elevation_token') === token, [token])
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved?.answers || emptyAnswers())
  usePilotGuard(dirty || !!intent || busy, c.exitWarning)
  const load = useCallback(async () => {
    try { const row = await repository.read(); if (current()) { setSaved(row); setNotice(null) } }
    catch { if (current()) setNotice('loadError') }
    finally { if (current()) setLoading(false) }
  }, [repository, current])
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false } }, [load])
  useEffect(() => {
    if (!dialog) return
    const previous = document.activeElement; dialogRef.current?.showModal(); cancelRef.current?.focus()
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [dialog])
  const finish = async (result: Feedback, requested: Intent) => {
    const verified = await repository.read()
    if (!current()) return
    if (result.lastRequestId !== requested.requestId || verified.lastRequestId !== requested.requestId || JSON.stringify(verified.answers) !== JSON.stringify(requested.answers)) throw new FixtureError('unknown')
    setSaved(verified); setDraft(structuredClone(verified.answers!)); setIntent(null); setRetryable(false); setNotice('saved')
  }
  const send = async (requested?: Intent) => {
    if (lock.current || !saved || saved.permission !== 'fixture_only' || (!requested && intent) || !hasAnswers(draft)) return
    const body = requested || makeIntent(draft, saved.version); lock.current = true; setBusy(true); setIntent(body); setNotice(null)
    try { await finish(await repository.save(body), body) }
    catch (error) {
      if (!current()) return
      const code = error instanceof FixtureError ? error.code : 'unknown'
      setNotice(code === 'conflict' ? 'conflict' : code === 'unknown' ? 'unknown' : 'saveError')
      if (code !== 'unknown') setIntent(null)
    } finally { if (current()) setBusy(false); lock.current = false }
  }
  const check = async () => {
    if (!intent || lock.current) return
    lock.current = true; setBusy(true)
    try { const row = await repository.read(); if (row.lastRequestId === intent.requestId) await finish(row, intent); else if (current()) { setRetryable(true); setNotice('unknown') } }
    catch { if (current()) setNotice('unknown') }
    finally { if (current()) setBusy(false); lock.current = false }
  }
  const withdraw = async () => {
    setDialog(false); if (!saved || lock.current) return
    lock.current = true; setBusy(true)
    try { await repository.withdraw(saved.version); const row = await repository.read(); if (current()) { if (row.answers !== null) throw new FixtureError('unknown'); setSaved(row); setDraft(emptyAnswers()); setSkipped([]); setIntent(null); setNotice('removed') } }
    catch { if (current()) setNotice('unknown') }
    finally { if (current()) setBusy(false); lock.current = false }
  }
  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => setDraft(previous => ({ ...previous, [key]: value, ...(key === 'initialValue' && value !== 'yes' ? { valueArea: null } : {}) }))
  const group = (key: 'initialValue' | 'listened' | 'respected' | 'professionalClarity' | 'valueArea') => {
    const values = key === 'valueArea' ? ['personal', 'career', 'both', null] as const : key === 'professionalClarity' ? ['yes', 'no', 'unsure', 'not_explored', null] as const : ['yes', 'no', 'unsure', null] as const
    return <fieldset className="elv-fieldset pilot-card"><legend className="elv-fieldset-legend">{c[key]}</legend>{values.map(value => <label key={value || 'skip'}><input className="elv-radio" type="radio" name={key} checked={draft[key] === value && (value !== null || skipped.includes(key))} onChange={() => { set(key, value); setSkipped(previous => value === null ? [...new Set([...previous, key])] : previous.filter(v => v !== key)) }} />{value ? c[value] : c.skipQuestion}</label>)}</fieldset>
  }
  if (!token) return <p role="alert">{c.session} <Link to="/login">{c.login}</Link></p>
  return <><h1>{c.title}</h1><p>{c.optional}</p><p>{c.permission}</p><p className="pilot-note">{c.window}</p><p role="status" aria-live="polite">{loading ? c.loading : busy ? c.saving : notice ? c[notice] : dirty ? c.dirty : saved?.answers ? c.saved : c.empty}</p>
    {notice === 'loadError' && <button className="elv-btn" onClick={() => { void load() }}>{c.retry}</button>}
    {!loading && saved && <form onSubmit={event => { event.preventDefault(); void send() }}><fieldset disabled={busy || !!intent || saved.permission !== 'fixture_only'}>
      {group('initialValue')}{draft.initialValue === 'yes' && group('valueArea')}{group('listened')}{group('respected')}{group('professionalClarity')}
      <fieldset className="elv-fieldset pilot-card"><legend className="elv-fieldset-legend">{c.helpedBy}</legend>{(['ideas', 'experience', 'next_step', 'other'] as const).map(value => <label key={value}><input type="checkbox" className="elv-checkbox" checked={draft.helpedBy.includes(value)} onChange={event => set('helpedBy', event.target.checked ? [...draft.helpedBy, value] : draft.helpedBy.filter(v => v !== value))} />{c[value]}</label>)}</fieldset>
      <button className="elv-btn elv-btn-primary" disabled={!hasAnswers(draft) || !dirty || notice === 'conflict'}>{c.save}</button>
    </fieldset></form>}
    {intent && <div className="pilot-actions"><button className="elv-btn" disabled={busy} onClick={() => void check()}>{c.check}</button>{retryable && <button className="elv-btn" disabled={busy} onClick={() => void send(intent)}>{c.retrySave}</button>}</div>}
    {notice === 'conflict' && <button className="elv-btn" onClick={() => { void load() }}>{c.review}</button>}
    <div className="pilot-actions"><Link className="elv-link" to="/app/dashboard">{c.leave}</Link>{saved?.answers && <button className="elv-btn" disabled={busy || !!intent} onClick={() => setDialog(true)}>{c.withdraw}</button>}</div>
    {dialog && <dialog ref={dialogRef} onCancel={event => { event.preventDefault(); setDialog(false) }} aria-labelledby="pilot-dialog"><p id="pilot-dialog">{c.withdrawText}</p><div className="pilot-actions"><button className="elv-btn" ref={cancelRef} onClick={() => setDialog(false)}>{c.cancelled}</button><button className="elv-btn" onClick={() => void withdraw()}>{c.confirm}</button></div></dialog>}
  </>
}
