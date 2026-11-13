// ES-173 (HU-P22): «Tu opinión» con «Cartografía» (diseño aprobado, comentario 11859). SIGUE siendo una SIMULACIÓN en memoria sobre fixtures: la franja
// «Vista de revisión · datos ficticios» se mantiene y nada se envía a un servidor hasta que Mauricio firme el contrato real (decisión 10).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, CheckField, ScaleField } from '../cartografia/controls'
import { Banner, Card } from '../cartografia/pieces'
import { Dialog } from '../cartografia/interactive'
import { CartografiaRoot } from '../cartografia/theme'
import { LangSwitch } from '../shell/Frame'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { emptyAnswers, hasAnswers, makeIntent, previewEnabled } from './model'
import type { Answers, Feedback, Intent } from './model'
import { createFixtureRepository, FixtureError, scenario } from './fixtures'
import { usePilotGuard, usePilotToken } from './hooks'
import '../progress/progress.css'

type Notice = 'loadError' | 'saveError' | 'unknown' | 'conflict' | 'saved' | 'removed'
type Key = 'initialValue' | 'listened' | 'respected' | 'professionalClarity' | 'valueArea'
const SKIP = 'skip'

function Shell({ children }: { children?: ReactNode }) {
  const { lang } = useLanguage(); const c = copy[lang]; const enabled = previewEnabled(import.meta.env.VITE_ENABLE_PILOT_FEEDBACK_PREVIEW)
  return (
    <CartografiaRoot className="prg">
      <a className="cg-skip" href="#pilot-main">{c.skip}</a>
      <header className="cg-header"><Link className="cg-btn cg-btn--ghost" to="/app/dashboard"><span aria-hidden="true">← </span>{c.back}</Link><div className="cg-header__end"><LangSwitch /></div></header>
      <main id="pilot-main" className="cg-page prg-main" tabIndex={-1}>
        {enabled ? <><Banner title={c.preview}><p>{c.local}</p></Banner>{children}</> : <p role="status">{c.disabled}</p>}
      </main>
    </CartografiaRoot>
  )
}

export function FeedbackPage() {
  const token = usePilotToken()
  return <Shell>{previewEnabled(import.meta.env.VITE_ENABLE_PILOT_FEEDBACK_PREVIEW) && <FeedbackSession key={token} token={token} />}</Shell>
}

function FeedbackSession({ token }: { token: string }) {
  const { lang } = useLanguage(); const c = copy[lang]
  const repository = useMemo(() => createFixtureRepository(scenario(import.meta.env.VITE_PILOT_FEEDBACK_SCENARIO)), [])
  const [saved, setSaved] = useState<Feedback | null>(null); const [draft, setDraft] = useState<Answers>(emptyAnswers)
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [intent, setIntent] = useState<Intent | null>(null); const [retryable, setRetryable] = useState(false); const [dialog, setDialog] = useState(false); const [skipped, setSkipped] = useState<string[]>([])
  const alive = useRef(true); const lock = useRef(false)
  const current = useCallback(() => alive.current && localStorage.getItem('elevation_token') === token, [token])
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved?.answers || emptyAnswers())
  usePilotGuard(dirty || !!intent || busy, c.exitWarning)
  const load = useCallback(async () => {
    try { const row = await repository.read(); if (current()) { setSaved(row); setNotice(null) } }
    catch { if (current()) setNotice('loadError') }
    finally { if (current()) setLoading(false) }
  }, [repository, current])
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false } }, [load])
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
  const locked = busy || !!intent || saved?.permission !== 'fixture_only'
  const group = (key: Key) => {
    const values = key === 'valueArea' ? ['personal', 'career', 'both', null] as const : key === 'professionalClarity' ? ['yes', 'no', 'unsure', 'not_explored', null] as const : ['yes', 'no', 'unsure', null] as const
    const selected = draft[key] ?? (skipped.includes(key) ? SKIP : '')
    return (
      <Card as="div" className="prg-question">
        <ScaleField legend={c[key]} name={key} disabled={locked} value={selected} options={values.map(value => ({ value: value ?? SKIP, label: value ? c[value] : c.skipQuestion }))}
          onChange={picked => { const value = picked === SKIP ? null : picked as Answers[Key]; set(key, value as never); setSkipped(previous => value === null ? [...new Set([...previous, key])] : previous.filter(v => v !== key)) }} />
      </Card>
    )
  }
  if (!token) return <Banner kind="error" title={c.session}><div className="cg-row"><Link className="cg-btn" to="/login">{c.login}</Link></div></Banner>
  const status = loading ? c.loading : busy ? c.saving : notice ? c[notice] : dirty ? c.dirty : saved?.answers ? c.saved : c.empty
  const failure = notice === 'loadError' || notice === 'saveError' || notice === 'unknown' || notice === 'conflict'
  return <>
    <h1 className="cg-h1">{c.title}</h1>
    <p className="cg-muted">{c.optional}</p>
    <p className="cg-muted">{c.permission}</p>
    <p className="cg-muted cg-small">{c.window}</p>
    {failure ? <Banner kind="error" title={status} /> : <p role="status" aria-live="polite" className="prg-status">{status}</p>}
    {notice === 'loadError' && <div className="prg-actions"><Button onClick={() => { void load() }}>{c.retry}</Button></div>}
    {!loading && saved && <form className="prg-form" onSubmit={event => { event.preventDefault(); void send() }}>
      {group('initialValue')}{draft.initialValue === 'yes' && group('valueArea')}{group('listened')}{group('respected')}{group('professionalClarity')}
      <Card as="div" className="prg-question">
        <fieldset className="prg-checks" disabled={locked}><legend className="cg-label">{c.helpedBy}</legend>
          {(['ideas', 'experience', 'next_step', 'other'] as const).map(value => <CheckField key={value} label={c[value]} checked={draft.helpedBy.includes(value)} onChange={event => set('helpedBy', event.target.checked ? [...draft.helpedBy, value] : draft.helpedBy.filter(v => v !== value))} />)}
        </fieldset>
      </Card>
      <div className="prg-actions"><Button type="submit" disabled={locked || !hasAnswers(draft) || !dirty || notice === 'conflict'}>{c.save}</Button></div>
    </form>}
    {intent && <div className="prg-actions"><Button variant="ghost" disabled={busy} onClick={() => void check()}>{c.check}</Button>{retryable && <Button variant="ghost" disabled={busy} onClick={() => void send(intent)}>{c.retrySave}</Button>}</div>}
    {notice === 'conflict' && <div className="prg-actions"><Button variant="ghost" onClick={() => { void load() }}>{c.review}</Button></div>}
    {!loading && <div className="prg-actions"><Link className="cg-btn cg-btn--ghost" to="/app/dashboard">{c.leave}</Link>{saved?.answers && <Button variant="ghost" disabled={busy || !!intent} onClick={() => setDialog(true)}>{c.withdraw}</Button>}</div>}
    <Dialog open={dialog} onClose={() => setDialog(false)} title={c.withdraw} actions={<><Button variant="ghost" onClick={() => setDialog(false)}>{c.cancelled}</Button><Button variant="danger" onClick={() => void withdraw()}>{c.confirm}</Button></>}>
      <p>{c.withdrawText}</p>
    </Dialog>
  </>
}
