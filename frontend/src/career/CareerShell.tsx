import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { CareerContext } from './context'
import { tr } from './copy'
import type { CopyKey } from './copy'
import { createFixture, FixtureError } from './fixture'
import type { Command } from './fixture'
import { createServerClient } from './serverClient'
import { rememberReturn } from '../access/returnTo'
import { registerCareerGuard } from './navigationGuard'
import { registerLeaveGuard } from '../shell/leaveGuard'
import { PersonScreen } from '../space/PersonScreen'
import { Button } from '../cartografia/controls'
import { Banner } from '../cartografia/pieces'
import { Dialog } from '../cartografia/interactive'
import './career.css'

const enabled = import.meta.env.VITE_ENABLE_CAREER_PREVIEW === 'true'
// ES-237 (2b): con VITE_CAREER_SOURCE=api las pantallas leen y escriben contra el servidor; sin ella sigue el simulador (se retira en el paso 4).
const serverMode = import.meta.env.VITE_CAREER_SOURCE === 'api'
const token = () => { try { return localStorage.getItem('elevation_token') ?? '' } catch { return '' } }
export function CareerEntry() {
  const { lang } = useLanguage()
  if (!enabled) return null
  return <section className="cg-card pg-card" aria-labelledby="career-entry-title"><h2 id="career-entry-title">{tr(lang, 'title')}</h2><p>{tr(lang, 'preview', serverMode)}</p><div className="pg-actions"><Link className="cg-btn cg-btn--ghost" to="/app/next-step">{tr(lang, 'title')} →</Link></div></section>
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
  const { lang } = useLanguage(), routerNavigate = useNavigate(), location = useLocation()
  const [client] = useState(() => serverMode ? createServerClient({ baseUrl: import.meta.env.VITE_BACKEND_URL || '', token }) : createFixture(import.meta.env.VITE_CAREER_FIXTURE_SCENARIO ?? 'normal'))
  const state = useSyncExternalStore(client.subscribe, client.snapshot)
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [uncertain, setUncertain] = useState(false), [expired, setExpired] = useState(false)
  const [message, setMessage] = useState<CopyKey | null>(null), [error, setError] = useState<CopyKey | null>(null)
  const [pending, setPending] = useState<string | number | null>(null)
  const dirtyRef = useRef(false), restoring = useRef(false), pendingBack = useRef(0), index = useRef<number>(window.history.state?.idx ?? 0)
  const mounted = useRef(true)
  const previousPath = useRef(location.pathname)
  const inFlight = useRef(false), notice = useRef<HTMLDivElement>(null)
  const dirtyKeys = useRef(new Set<string>()), lastForm = useRef('global'), lastError = useRef<CopyKey | null>(null)
  const uncertainRef = useRef(false)
  const [dirtyCount, setDirtyCount] = useState(0)
  const t = useCallback((key: CopyKey) => tr(lang, key, serverMode), [lang])
  // ES-330: la sesión venció (401): se recuerda esta pantalla para volver tras iniciar sesión y se muestra el aviso con el enlace a /login.
  const expire = useCallback(() => { rememberReturn(location.pathname, location.search); setExpired(true) }, [location.pathname, location.search])
  const setDirtyValue = useCallback((value: boolean, key = 'global') => { if (value) { dirtyKeys.current.add(key); setMessage(null) } else dirtyKeys.current.delete(key); dirtyRef.current = dirtyKeys.current.size > 0; setDirty(dirtyRef.current); setDirtyCount(dirtyKeys.current.size) }, [])
  const otherDirty = useCallback((key: string) => [...dirtyKeys.current].some(k => k !== key), [])
  const active = useCallback(() => mounted.current && token() === session && Boolean(session), [session])
  const load = useCallback(async () => {
    if (!active() || inFlight.current) return
    inFlight.current = true; setBusy(true); setError(null); setMessage(null)
    try { await client.load(); if (active()) { setUncertain(false); uncertainRef.current = false; if (lastError.current === 'lostAck') setDirtyValue(false, lastForm.current); lastError.current = null } }
    catch (e) { if (active()) { if (e instanceof FixtureError && e.code === 'expired') expire(); else setError(e instanceof FixtureError && e.code === 'pending' ? 'pending' : 'loadError') } }
    finally { inFlight.current = false; if (active()) setBusy(false) }
  }, [active, client, expire, setDirtyValue])
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
    }
    const detach = registerCareerGuard(pop)
    // ES-153: los enlaces del marco de persona abren este mismo diálogo (antes solo lo abrían los enlaces de la propia pantalla)
    const leave = registerLeaveGuard(to => {
      if (!dirtyRef.current && !inFlight.current && !uncertainRef.current) return false
      setPending(to); return true
    })
    window.addEventListener('beforeunload', before)
    return () => { window.removeEventListener('beforeunload', before); detach(); leave() }
  }, [])
  const navigate = useCallback((to: string) => {
    if (dirtyRef.current || inFlight.current || uncertain) { setPending(to) }
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
        const code = e instanceof FixtureError ? e.code : 'saveError'
        if (code === 'expired') { expire(); return { ok: false } }
        setError(code); lastError.current = code
        if (code === 'lostAck' || code === 'conflict' || code === 'routesChanged') { setUncertain(true); uncertainRef.current = true }
        window.setTimeout(() => { if (!document.querySelector('.career-scope [role="dialog"]')) notice.current?.focus() }, 0)
      }
      return { ok: false }
    } finally { inFlight.current = false; if (active()) setBusy(false) }
  }, [active, client, expire, otherDirty, setDirtyValue, uncertain])
  const stay = () => setPending(null) // el Dialog devuelve el foco a quien lo abrió
  const leave = () => { const target = pending; dirtyKeys.current.clear(); setDirtyValue(false); setPending(null); if (typeof target === 'number') window.history.go(target); else if (target !== null) routerNavigate(target) }
  const nav = (to: string, key: CopyKey) => <Link to={to} aria-current={location.pathname === to ? 'page' : undefined} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navigate(to) } }}>{t(key)}</Link>
  return <PersonScreen title={t('title')} wide>
    <div id="career-main" tabIndex={-1} className="pc-main">
      {session && token() === session && enabled && <nav className="pc-subnav" aria-label={t('title')}>{nav('/app/next-step', 'routes')}{nav('/app/next-step/experiments', 'experiments')}{nav('/app/next-step/plan', 'plan')}</nav>}
      {!session || token() !== session ? <p role="alert">{t('session')}</p> : !enabled ? <p role="status">{t('disabled')}</p> : expired ? <Banner kind="error" title={t('sessionExpired')}><div className="cg-row"><Link className="cg-btn" to="/login">{t('signIn')}</Link></div></Banner> : <>
        <Banner title={t('preview')} />
        {dirty && <p>{t('unsaved')}</p>}
        {dirtyCount > 1 && <p className="pc-warn" role="status">{t('otherDraft')}</p>}
        <div ref={notice} tabIndex={-1} aria-live="polite" className={error ? 'cg-error' : ''}>
          {(busy || error || message) && <p>{busy ? t(state.loaded ? 'saving' : 'loading') : error ? t(error) : message ? t(message) : null}</p>}
          {error && error !== 'validate' && <button type="button" className="cg-btn cg-btn--ghost" disabled={busy} onClick={() => void load()}>{uncertain ? t('recover') : t('retry')}</button>}
        </div>
        {!state.loaded ? <p role="status">{error ? t('empty') : t('loading')}</p> : <CareerContext.Provider value={{ state, client, reload: () => void load(), lang, t, busy, uncertain, dirty: dirty || dirtyCount > 0, setDirty: setDirtyValue, otherDirty, send, navigate }}><div aria-busy={busy}><Outlet /></div></CareerContext.Provider>}
      </>}
    </div>
    <Dialog open={pending !== null} onClose={stay} title={t('leaveTitle')} actions={<><Button onClick={stay}>{t('keep')}</Button><Button variant="ghost" disabled={busy} onClick={leave}>{t('leave')}</Button></>} />
  </PersonScreen>
}
