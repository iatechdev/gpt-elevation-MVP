// ES-173 (HU-P22): «Tu opinión» con «Cartografía» (diseño aprobado, comentarios 11859 y 11999). DOS modos en la misma pantalla:
//  · simulación (por defecto, VITE_ENABLE_PILOT_FEEDBACK_PREVIEW): fixtures en memoria, franja «Vista de revisión · datos ficticios», NADA se envía a un servidor;
//  · REAL (VITE_ENABLE_PILOT_FEEDBACK_LIVE, APAGADA por defecto hasta que Mauricio firme el contrato real, decisión 10): servidor real, sin franja de «ficticios», textos verdaderos.
// Texto legal del permiso: lo define Alejo (pendiente; no se inventa aquí).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, CheckField, ScaleField } from '../cartografia/controls'
import { Banner, Card } from '../cartografia/pieces'
import { Dialog } from '../cartografia/interactive'
import { CartografiaRoot } from '../cartografia/theme'
import { LangSwitch } from '../shell/Frame'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { canSave, emptyAnswers, hasAnswers, makeIntent, previewEnabled, sameAnswers } from './model'
import type { Answers, Feedback, Intent } from './model'
import { createFixtureRepository, FixtureError, scenario } from './fixtures'
import { createLiveRepository, liveEnabled } from './liveRepository'
import { usePilotGuard, usePilotToken } from './hooks'
import '../progress/progress.css'

type Notice = 'loadError' | 'saveError' | 'unknown' | 'conflict' | 'saved' | 'removed' | 'noConsent' | 'granted' | 'revoked'
type Dialogs = 'answer' | 'permission' | null
const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const isLive = () => liveEnabled(import.meta.env.VITE_ENABLE_PILOT_FEEDBACK_LIVE)
type Key = 'initialValue' | 'listened' | 'respected' | 'professionalClarity' | 'valueArea'
const SKIP = 'skip'

function Shell({ children }: { children?: ReactNode }) {
  const { lang } = useLanguage(); const c = copy[lang]; const live = isLive(); const enabled = live || previewEnabled(import.meta.env.VITE_ENABLE_PILOT_FEEDBACK_PREVIEW)
  return (
    <CartografiaRoot className="prg">
      <a className="cg-skip" href="#pilot-main">{c.skip}</a>
      <header className="cg-header"><Link className="cg-btn cg-btn--ghost" to="/app/dashboard"><span aria-hidden="true">← </span>{c.back}</Link><div className="cg-header__end"><LangSwitch /></div></header>
      <main id="pilot-main" className="cg-page prg-main" tabIndex={-1}>
        {enabled ? (live ? children : <><Banner title={c.preview}><p>{c.local}</p></Banner>{children}</>) : <p role="status">{c.disabled}</p>}
      </main>
    </CartografiaRoot>
  )
}

export function FeedbackPage() {
  const token = usePilotToken()
  const live = isLive()
  return <Shell>{(live || previewEnabled(import.meta.env.VITE_ENABLE_PILOT_FEEDBACK_PREVIEW)) && <FeedbackSession key={token} token={token} live={live} />}</Shell>
}

function FeedbackSession({ token, live }: { token: string; live: boolean }) {
  const { lang } = useLanguage(); const c = copy[lang]
  // En modo real cada clave puede tener una variante verdadera (prefijo l_); en simulación se usan los textos de simulación.
  const tx = (key: string): string => { const all = c as Record<string, string>; return (live ? all['l_' + key] : undefined) ?? all[key] }
  const repository = useMemo(() => (live ? createLiveRepository({ baseUrl: API, token }) : createFixtureRepository(scenario(import.meta.env.VITE_PILOT_FEEDBACK_SCENARIO))), [live, token])
  const setPermission = useMemo(() => ('setPermission' in repository ? repository.setPermission : null), [repository])
  const [saved, setSaved] = useState<Feedback | null>(null); const [draft, setDraft] = useState<Answers>(emptyAnswers)
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [intent, setIntent] = useState<Intent | null>(null); const [retryable, setRetryable] = useState(false); const [dialog, setDialog] = useState<Dialogs>(null); const [skipped, setSkipped] = useState<string[]>([])
  const alive = useRef(true); const lock = useRef(false)
  const current = useCallback(() => alive.current && localStorage.getItem('elevation_token') === token, [token])
  const dirty = !sameAnswers(draft, saved?.answers || emptyAnswers())
  usePilotGuard(dirty || !!intent || busy, tx('exitWarning'))
  // `adopt`: en la PRIMERA carga el borrador parte de lo guardado (al volver a la pantalla se ve la respuesta propia); al revisar tras un conflicto el borrador se conserva.
  const load = useCallback(async (adopt = false) => {
    try { const row = await repository.read(); if (current()) { setSaved(row); setNotice(null); if (adopt && row.answers) setDraft(structuredClone(row.answers)) } }
    catch { if (current()) setNotice('loadError') }
    finally { if (current()) setLoading(false) }
  }, [repository, current])
  useEffect(() => { alive.current = true; void load(true); return () => { alive.current = false } }, [load])
  const finish = async (result: Feedback, requested: Intent) => {
    const verified = await repository.read()
    if (!current()) return
    if (result.lastRequestId !== requested.requestId || verified.lastRequestId !== requested.requestId || !sameAnswers(verified.answers, requested.answers)) throw new FixtureError('unknown')
    setSaved(verified); setDraft(structuredClone(verified.answers!)); setIntent(null); setRetryable(false); setNotice('saved')
  }
  const send = async (requested?: Intent) => {
    if (lock.current || !canSave(saved) || !saved || (!requested && intent) || !hasAnswers(draft)) return
    const body = requested || makeIntent(draft, saved.version); lock.current = true; setBusy(true); setIntent(body); setNotice(null)
    try { await finish(await repository.save(body), body) }
    catch (error) {
      if (!current()) return
      const code = error instanceof FixtureError ? error.code : 'unknown'
      setNotice(code === 'conflict' ? 'conflict' : code === 'unknown' ? 'unknown' : code === 'unconfigured' && live ? 'noConsent' : 'saveError')
      if (code !== 'unknown') setIntent(null)
      if (code === 'unconfigured' && live) void repository.read().then(row => { if (current()) setSaved(row) }).catch(() => undefined)
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
    setDialog(null); if (!saved || lock.current) return
    lock.current = true; setBusy(true)
    try { await repository.withdraw(saved.version); const row = await repository.read(); if (current()) { if (row.answers !== null) throw new FixtureError('unknown'); setSaved(row); setDraft(emptyAnswers()); setSkipped([]); setIntent(null); setNotice('removed') } }
    catch (error) { if (current()) setNotice(error instanceof FixtureError && error.code === 'conflict' ? 'conflict' : 'unknown') }
    finally { if (current()) setBusy(false); lock.current = false }
  }
  // Modo real: dar o retirar el permiso pilot_feedback. Retirarlo NO borra lo respondido (solo impide guardar); se relee el estado real después.
  const changePermission = async (granted: boolean) => {
    setDialog(null); if (!setPermission || lock.current) return
    lock.current = true; setBusy(true); setNotice(null)
    try { await setPermission(granted); const row = await repository.read(); if (current()) { setSaved(row); setNotice(granted ? 'granted' : 'revoked') } }
    catch { if (current()) setNotice('saveError') }
    finally { if (current()) setBusy(false); lock.current = false }
  }
  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => setDraft(previous => ({ ...previous, [key]: value, ...(key === 'initialValue' && value !== 'yes' ? { valueArea: null } : {}) }))
  const locked = busy || !!intent || !canSave(saved)
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
  const status = loading ? c.loading : busy ? tx('saving') : notice ? tx(notice) : dirty ? c.dirty : saved?.answers ? tx('saved') : tx('empty')
  const failure = notice === 'noConsent' || notice === 'loadError' || notice === 'saveError' || notice === 'unknown' || notice === 'conflict'
  return <>
    <h1 className="cg-h1">{c.title}</h1>
    <p className="cg-muted">{c.optional}</p>
    <p className="cg-muted">{tx('permission')}</p>
    <p className="cg-muted cg-small">{tx('window')}</p>
    {failure ? <Banner kind="error" title={status} /> : <p role="status" aria-live="polite" className="prg-status">{status}</p>}
    {notice === 'loadError' && <div className="prg-actions"><Button onClick={() => { void load(true) }}>{c.retry}</Button></div>}
    {live && !loading && saved && (saved.permission === 'missing'
      ? <Card as="div" className="prg-question"><h2 className="cg-h2">{c.grantTitle}</h2><p>{c.grantText}</p><div className="prg-actions"><Button disabled={busy} onClick={() => void changePermission(true)}>{c.grant}</Button></div></Card>
      : <div className="prg-actions"><span className="cg-muted cg-small">{c.permissionActive}</span><Button variant="ghost" disabled={busy || !!intent} onClick={() => setDialog('permission')}>{c.revokePermission}</Button></div>)}
    {!loading && saved && <form className="prg-form" onSubmit={event => { event.preventDefault(); void send() }}>
      {group('initialValue')}{draft.initialValue === 'yes' && group('valueArea')}{group('listened')}{group('respected')}{group('professionalClarity')}
      <Card as="div" className="prg-question">
        <fieldset className="prg-checks" disabled={locked}><legend className="cg-label">{c.helpedBy}</legend>
          {(['ideas', 'experience', 'next_step', 'other'] as const).map(value => <CheckField key={value} label={c[value]} checked={draft.helpedBy.includes(value)} onChange={event => set('helpedBy', event.target.checked ? [...draft.helpedBy, value] : draft.helpedBy.filter(v => v !== value))} />)}
        </fieldset>
      </Card>
      <div className="prg-actions"><Button type="submit" disabled={locked || !hasAnswers(draft) || !dirty || notice === 'conflict'}>{tx('save')}</Button></div>
    </form>}
    {intent && <div className="prg-actions"><Button variant="ghost" disabled={busy} onClick={() => void check()}>{c.check}</Button>{retryable && <Button variant="ghost" disabled={busy} onClick={() => void send(intent)}>{c.retrySave}</Button>}</div>}
    {notice === 'conflict' && <div className="prg-actions"><Button variant="ghost" onClick={() => { void load() }}>{tx('review')}</Button></div>}
    {!loading && <div className="prg-actions"><Link className="cg-btn cg-btn--ghost" to="/app/dashboard">{c.leave}</Link>{saved?.answers && <Button variant="ghost" disabled={busy || !!intent} onClick={() => setDialog('answer')}>{tx('withdraw')}</Button>}</div>}
    <Dialog open={dialog === 'answer'} onClose={() => setDialog(null)} title={tx('withdraw')} actions={<><Button variant="ghost" onClick={() => setDialog(null)}>{c.cancelled}</Button><Button variant="danger" onClick={() => void withdraw()}>{c.confirm}</Button></>}>
      <p>{tx('withdrawText')}</p>
    </Dialog>
    <Dialog open={dialog === 'permission'} onClose={() => setDialog(null)} title={c.revokePermission} actions={<><Button variant="ghost" onClick={() => setDialog(null)}>{c.cancelled}</Button><Button variant="danger" onClick={() => void changePermission(false)}>{c.revokeConfirm}</Button></>}>
      <p>{c.revokeText}</p>
    </Dialog>
  </>
}
