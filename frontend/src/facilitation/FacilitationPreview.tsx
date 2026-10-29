import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { createFixture, enabled, PreviewError, scenarioOf, type Command } from './fixture'
import { FacilitationContext, useCopy } from './context'
import { setBlocker } from './navigation'
import './facilitation.css'

const token = () => { try { return localStorage.getItem('elevation_token') ?? '' } catch { return '' } }
function Dialog({ action, close }: { action: () => void; close: () => void }) {
  const { t } = useCopy()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return <dialog ref={ref} aria-labelledby="leave-title" onCancel={e => { e.preventDefault(); close() }} onKeyDown={e => {
    if (e.key !== 'Tab') return
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
    const first = buttons[0], last = buttons[buttons.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
  }}>
    <h2 id="leave-title">{t('dirty')}</h2><div className="fac-actions">
      <button className="elv-btn" onClick={close} autoFocus>{t('keep')}</button>
      <button className="elv-btn" onClick={action}>{t('discard')}</button>
    </div>
  </dialog>
}
function SessionPreview() {
  const [session, setSession] = useState(token)
  useEffect(() => {
    const check = () => setSession(token())
    const timer = window.setInterval(check, 250)
    window.addEventListener('storage', check); window.addEventListener('focus', check)
    return () => { clearInterval(timer); window.removeEventListener('storage', check); window.removeEventListener('focus', check) }
  }, [])
  if (!session) return <Navigate to="/login" replace />
  return <ActivePreview key={session} session={session} />
}
export function FacilitationPreview() {
  const { t } = useCopy()
  if (!enabled(import.meta.env.VITE_ENABLE_FACILITATION_PREVIEW)) return <section className="fac-scope"><main className="fac-main"><h1>{t('title')}</h1><p>{t('unavailable')}</p><Link className="elv-btn" to="/">{t('home')}</Link></main></section>
  return <SessionPreview />
}
function ActivePreview({ session }: { session: string }) {
  const { t, lang, setLang } = useCopy()
  const [service] = useState(() => createFixture(scenarioOf(import.meta.env.VITE_FACILITATION_FIXTURE_SCENARIO)))
  const [snapshot, setSnapshot] = useState(service.current)
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState('')
  const [drafts, setDrafts] = useState<Record<string, true>>({})
  const dirty = Object.keys(drafts).length > 0
  const setDirty = useCallback((id: string, value: boolean) => {
    setDrafts(previous => {
      if (Boolean(previous[id]) === value) return previous
      const next = { ...previous }; if (value) next[id] = true; else delete next[id]
      return next
    })
  }, [])
  const [leave, setLeave] = useState<{ go: () => void } | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const main = useRef<HTMLElement>(null)
  const initialPath = useRef(location.pathname)
  const mounted = useRef(true)
  const refresh = () => {
    setLoading(true); setFailure('')
    window.setTimeout(() => {
      if (!mounted.current || token() !== session) return
      try { setSnapshot(service.read()) } catch (e) { setFailure(e instanceof PreviewError ? e.code : 'load-error') }
      setLoading(false)
    }, 180)
  }
  useEffect(() => {
    mounted.current = true
    const timer = window.setTimeout(() => {
      if (token() !== session) return
      try { setSnapshot(service.read()) } catch (e) { setFailure(e instanceof PreviewError ? e.code : 'load-error') }
      setLoading(false)
    }, 180)
    return () => { mounted.current = false; clearTimeout(timer) }
  }, [service, session])
  useEffect(() => {
    if (initialPath.current !== location.pathname) { initialPath.current = location.pathname; main.current?.focus() }
  }, [location.pathname])
  useEffect(() => {
    setBlocker(dirty ? go => { returnFocus.current = document.activeElement as HTMLElement; setLeave({ go }) } : null)
    const unload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    const click = (e: MouseEvent) => {
      if (!dirty || e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      const anchor = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.origin !== window.location.origin || anchor.hash || anchor.target) return
      if (anchor.pathname + anchor.search === window.location.pathname + window.location.search) { e.preventDefault(); e.stopImmediatePropagation(); return }
      e.preventDefault(); e.stopImmediatePropagation()
      returnFocus.current = document.activeElement as HTMLElement
      setLeave({ go: () => navigate(anchor.pathname + anchor.search) })
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', click, true)
    return () => { setBlocker(null); window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true) }
  }, [dirty, navigate, location.pathname])
  async function write(id: string, command: Command, revision: number, actor: 'reviewer' | 'participant') {
    await new Promise(resolve => window.setTimeout(resolve, 180))
    if (!mounted.current || token() !== session) throw new PreviewError('revoked')
    service.apply(id, command, revision, actor)
    setSnapshot(service.current())
  }
  if (token() !== session) return null
  let content: ReactNode = <Outlet />
  if (loading) content = <p role="status">{t('loading')}</p>
  else if (failure) content = <div role="alert"><p>{t(failure === 'revoked' ? 'noAccess' : 'loadError')}</p><p>{t('failedRead')}</p><button className="elv-btn" onClick={refresh}>{t('retry')}</button></div>
  return <FacilitationContext.Provider value={{ snapshot, service, loading, failure, refresh, write, dirty, setDirty }}>
    <section className="fac-scope">
      <a className="fac-skip elv-btn" href="#fac-main">{t('skip')}</a>
      <header className="fac-header"><span>Elevation</span><div className="fac-actions" aria-label={t('language')}>
        <button className="elv-btn" lang="es" aria-pressed={lang === 'es'} onClick={() => setLang('es')}>ES</button>
        <button className="elv-btn" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
      </div></header>
      <main id="fac-main" className="fac-main" ref={main} tabIndex={-1}>
        <h1>{t('title')}</h1><p className="fac-banner">{t('preview')}</p><p>{t('pendingAuth')}</p>
        <details><summary>{t('reading')}</summary><p>{t('privacy')}</p><p>{t('aggregate')}</p></details>
        <nav className="fac-actions" aria-label={t('title')}>
          <Link className="elv-btn" to="/facilitation">{t('roster')}</Link>
          <Link className="elv-btn" to="/app/professional-reviews">{t('own')}</Link>
          <Link className="elv-btn" to="/">{t('home')}</Link>
        </nav>
        {content}
      </main>
      {leave && <Dialog close={() => { setLeave(null); requestAnimationFrame(() => returnFocus.current?.focus()) }} action={() => { setBlocker(null); setDrafts({}); setLeave(null); leave.go() }} />}
    </section>
  </FacilitationContext.Provider>
}
