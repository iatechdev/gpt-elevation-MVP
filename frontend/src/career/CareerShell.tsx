import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { CareerContext } from './context'
import { tr } from './copy'
import type { CopyKey } from './copy'
import { createFixture, FixtureError } from './fixture'
import type { Command } from './fixture'
import { registerCareerGuard } from './navigationGuard'
import './career.css'

const enabled = import.meta.env.VITE_ENABLE_CAREER_PREVIEW === 'true'
const token = () => { try { return localStorage.getItem('elevation_token') ?? '' } catch { return '' } }
export function CareerEntry() {
  const { lang } = useLanguage()
  if (!enabled) return null
  return <div className="career-entry"><Link to="/app/next-step">{tr(lang, 'title')} →</Link><span>{tr(lang, 'preview')}</span></div>
}
export function CareerShell() {
  const [session, setSession] = useState(token)
  useEffect(() => {
    const check = () => setSession(token())
    window.addEventListener('storage', check); window.addEventListener('focus', check)
    const timer = window.setInterval(check, 500)
    return () => { window.removeEventListener('storage', check); window.removeEventListener('focus', check); window.clearInterval(timer) }
  }, [])
  return <CareerSession key={session} session={session} />
}
function CareerSession({ session }: { session: string }) {
  const { lang, setLang } = useLanguage(), routerNavigate = useNavigate(), location = useLocation()
  const [client] = useState(() => createFixture(import.meta.env.VITE_CAREER_FIXTURE_SCENARIO ?? 'normal'))
  const state = useSyncExternalStore(client.subscribe, client.snapshot)
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [uncertain, setUncertain] = useState(false)
  const [message, setMessage] = useState<CopyKey | null>(null), [error, setError] = useState<CopyKey | null>(null)
  const [pending, setPending] = useState<string | number | null>(null)
  const dirtyRef = useRef(false), restoring = useRef(false), pendingBack = useRef(0), index = useRef<number>(window.history.state?.idx ?? 0)
  const opener = useRef<HTMLElement | null>(null), keepRef = useRef<HTMLButtonElement>(null), mounted = useRef(true)
  const previousPath = useRef(location.pathname)
  const inFlight = useRef(false), notice = useRef<HTMLDivElement>(null)
  const dirtyKeys = useRef(new Set<string>()), lastForm = useRef('global'), lastError = useRef<CopyKey | null>(null)
  const uncertainRef = useRef(false)
  const [dirtyCount, setDirtyCount] = useState(0)
  const t = useCallback((key: CopyKey) => tr(lang, key), [lang])
  const setDirtyValue = useCallback((value: boolean, key = 'global') => { if (value) { dirtyKeys.current.add(key); setMessage(null) } else dirtyKeys.current.delete(key); dirtyRef.current = dirtyKeys.current.size > 0; setDirty(dirtyRef.current); setDirtyCount(dirtyKeys.current.size) }, [])
  const otherDirty = useCallback((key: string) => [...dirtyKeys.current].some(k => k !== key), [])
  const active = useCallback(() => mounted.current && token() === session && Boolean(session), [session])
  const load = useCallback(async () => {
    if (!active() || inFlight.current) return
    inFlight.current = true; setBusy(true); setError(null); setMessage(null)
    try { await client.load(); if (active()) { setUncertain(false); uncertainRef.current = false; if (lastError.current === 'lostAck') setDirtyValue(false, lastForm.current); lastError.current = null } }
    catch (e) { if (active()) setError(e instanceof FixtureError && e.code === 'pending' ? 'pending' : 'loadError') }
    finally { inFlight.current = false; if (active()) setBusy(false) }
  }, [active, client, setDirtyValue])
  useEffect(() => { mounted.current = true; if (enabled) void load(); return () => { mounted.current = false } }, [load])
  useEffect(() => { index.current = window.history.state?.idx ?? index.current; if (previousPath.current !== location.pathname) document.getElementById('career-main')?.focus(); previousPath.current = location.pathname }, [location.pathname])
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => { if (dirtyRef.current || inFlight.current || uncertainRef.current) e.preventDefault() }
    const pop = (e: PopStateEvent) => {
      if (restoring.current) { e.stopImmediatePropagation(); restoring.current = false; setPending(pendingBack.current); return }
      if (!dirtyRef.current && !inFlight.current && !uncertainRef.current) return
      const nextIndex: unknown = e.state?.idx
      if (typeof nextIndex !== 'number' || !Number.isSafeInteger(nextIndex)) return
      const delta = nextIndex - index.current
      if (!delta) return
      e.stopImmediatePropagation(); pendingBack.current = delta; restoring.current = true; window.history.go(-delta)
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
    const detach = registerCareerGuard(pop)
    window.addEventListener('beforeunload', before)
    return () => { window.removeEventListener('beforeunload', before); detach() }
  }, [])
  useEffect(() => { if (pending !== null) keepRef.current?.focus() }, [pending])
  const navigate = useCallback((to: string) => {
    if (dirtyRef.current || inFlight.current || uncertain) { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setPending(to) }
    else routerNavigate(to)
  }, [routerNavigate, uncertain])
  const send = useCallback(async (command: Command, key = 'global') => {
    if (!active() || inFlight.current || uncertain || otherDirty(key)) return { ok: false }
    lastForm.current = key
    inFlight.current = true; setBusy(true); setError(null); setMessage(null)
    try {
      const id = await client.send(command, crypto.randomUUID())
      if (!active()) return { ok: false }
      setMessage('saved'); setDirtyValue(false, key); return { ok: true, id }
    } catch (e) {
      if (active()) {
        const code = e instanceof FixtureError ? e.code : 'saveError'; setError(code); lastError.current = code
        if (code === 'lostAck' || code === 'conflict') { setUncertain(true); uncertainRef.current = true }
        window.setTimeout(() => { if (!document.querySelector('.career-scope [role="dialog"]')) notice.current?.focus() }, 0)
      }
      return { ok: false }
    } finally { inFlight.current = false; if (active()) setBusy(false) }
  }, [active, client, otherDirty, setDirtyValue, uncertain])
  const stay = () => { setPending(null); opener.current?.focus() }
  const leave = () => { const target = pending; dirtyKeys.current.clear(); setDirtyValue(false); setPending(null); if (typeof target === 'number') window.history.go(target); else if (target !== null) routerNavigate(target) }
  const nav = (to: string, key: CopyKey) => <Link to={to} aria-current={location.pathname === to ? 'page' : undefined} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navigate(to) } }}>{t(key)}</Link>
  return <section className="career-scope">
    <a className="career-skip" href="#career-main">{t('skip')}</a>
    <header className="career-header"><div>{nav('/app/dashboard', 'back')}<span aria-hidden="true"> ELEVATION</span></div><div className="career-languages">{(['es', 'en'] as const).map(l => <button key={l} type="button" aria-label={l === 'es' ? 'Español' : 'English'} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</div></header>
    <main id="career-main" tabIndex={-1}><h1>{t('title')}</h1>
      {session && token() === session && enabled && <nav aria-label={t('title')}>{nav('/app/next-step', 'routes')}{nav('/app/next-step/experiments', 'experiments')}{nav('/app/next-step/plan', 'plan')}</nav>}
      {!session || token() !== session ? <p role="alert">{t('session')}</p> : !enabled ? <p role="status">{t('disabled')}</p> : <>
        <p className="elv-alert career-banner" role="note">{t('preview')}</p>
        {dirty && <p>{t('unsaved')}</p>}
        {dirtyCount > 1 && <p className="career-warning" role="status">{t('otherDraft')}</p>}
        <div ref={notice} tabIndex={-1} aria-live="polite" className={error ? 'career-error' : ''}>
          {(busy || error || message) && <p>{busy ? t(state.loaded ? 'saving' : 'loading') : error ? t(error) : message ? t(message) : null}</p>}
          {error && error !== 'validate' && <button type="button" className="elv-btn elv-btn-outline" disabled={busy} onClick={() => void load()}>{uncertain ? t('recover') : t('retry')}</button>}
        </div>
        {!state.loaded ? <p role="status">{error ? t('empty') : t('loading')}</p> : <CareerContext.Provider value={{ state, client, lang, t, busy, uncertain, dirty: dirty || dirtyCount > 0, setDirty: setDirtyValue, otherDirty, send, navigate }}><div aria-busy={busy}><Outlet /></div></CareerContext.Provider>}
      </>}
    </main>
    {pending !== null && <div className="career-dialog-backdrop" onKeyDown={e => {
      if (e.key === 'Escape') { e.preventDefault(); stay() }
      if (e.key === 'Tab') { const controls = e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'); const first = controls[0], last = controls[controls.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() } }
    }}><div role="dialog" aria-modal="true" aria-labelledby="career-leave-title" className="career-dialog"><h2 id="career-leave-title">{t('leaveTitle')}</h2><button ref={keepRef} type="button" className="elv-btn" onClick={stay}>{t('keep')}</button><button type="button" className="elv-btn elv-btn-outline" disabled={busy} onClick={leave}>{t('leave')}</button></div></div>}
  </section>
}
