import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { registerCatalogGuard } from '../catalogGuard'
import { catalogApi, CatalogError, type Descriptor, type Detail, type Published } from './api'
import { array, canonical, fieldLabel, kinds, object, payload, safeUrl, schemas, string, validKey, type Data, type Kind } from './schema'
import { CatalogFields } from './CatalogFields'
import './catalog.css'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const readSession = () => { try { return JSON.stringify([localStorage.getItem('elevation_token') ?? '', localStorage.getItem('elevation_role') ?? '']) } catch { return '["",""]' } }
function useSession() {
  const [session, setSession] = useState(readSession)
  useEffect(() => { const update = () => setSession(readSession()); window.addEventListener('storage', update); window.addEventListener('focus', update); return () => { window.removeEventListener('storage', update); window.removeEventListener('focus', update) } }, [])
  return session
}
function useWords() { const language = useLanguage(); return { ...language, tr: (key: string) => language.t(`catalog.${key}`) } }
function useClient(session: string) {
  const token = (JSON.parse(session) as string[])[0]
  const api = useMemo(() => catalogApi(API, token), [token])
  const live = useRef(false)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  return { api, current: () => live.current && session === readSession() }
}
function Shell({ admin = false, go, children }: { admin?: boolean; go?: (path: string) => void; children: ReactNode }) {
  const { lang, setLang, tr } = useWords(); const navigate = useNavigate()
  return <div className="route-catalog-scope"><a className="catalog-skip" href="#catalog-main">{tr('skip')}</a><header><button className="elv-btn" onClick={() => (go ?? navigate)(admin ? '/admin/dashboard' : '/app/dashboard')}>{tr(admin ? 'admin_back' : 'back')}</button><div role="group" aria-label={tr('language')}>{(['es', 'en'] as const).map(l => <button className="elv-btn" key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</div></header><main id="catalog-main" tabIndex={-1}>{children}</main></div>
}
function Outbound({ url, children }: { url: unknown; children: ReactNode }) { const safe = safeUrl(url); return safe ? <a className="elv-link" href={safe} target="_blank" rel="noopener noreferrer">{children} · {new URL(safe).hostname}</a> : <span>{children}</span> }
function Notice({ text, error = false, focus = true }: { text: string; error?: boolean; focus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (text && focus) ref.current?.focus() }, [text, focus])
  return <div ref={ref} tabIndex={-1} role={error ? 'alert' : 'status'} className={error ? 'catalog-error' : 'catalog-notice'}>{text}</div>
}
export function CatalogBrowser() {
  const session = useSession(); const location = useLocation(); const token = (JSON.parse(session) as string[])[0]
  return token ? <BrowserSession key={session + location.pathname + location.search} session={session} /> : <Navigate to="/login" replace />
}
function BrowserSession({ session }: { session: string }) {
  const { api, current } = useClient(session); const { tr, lang } = useWords(); const { roleKey } = useParams()
  const [catalog, setCatalog] = useState<Published | null>(null); const [status, setStatus] = useState('loading'); const [attempt, setAttempt] = useState(0)
  const [market, setMarket] = useState(''); const [context, setContext] = useState(''); const [language, setLanguage] = useState('')
  useEffect(() => {
    let cancelled = false
    void api.published().then(value => { if (!cancelled && readSession() === session) { setCatalog(value); setStatus('') } }).catch(error => { if (!cancelled && readSession() === session) setStatus(error instanceof CatalogError && error.status === 401 ? 'session' : error instanceof CatalogError && error.code === 'catalog_unavailable' ? 'empty' : 'error') })
    return () => { cancelled = true }
  }, [api, session, attempt])
  const label = (item: Data) => string(object(item.labels)[lang]) || tr('unknown')
  const role = catalog?.roles.find(row => row.roleKey === roleKey)
  const filtered = catalog?.roles.filter(row => (!market || row.market === market) && (!context || array(row.contexts).includes(context)) && (!language || catalog.resources.some(resource => array(resource.roleKeys).includes(row.roleKey) && resource.language === language))) ?? []
  return <Shell><h1>{tr('title')}</h1><p>{tr('intro')}</p>{status && <><Notice text={tr(status)} focus={status !== 'loading'} error={status === 'error' || status === 'session'} />{status === 'session' ? <Link to="/login">{tr('login')}</Link> : status !== 'loading' && <button className="elv-btn" onClick={() => { if (current()) { setStatus('loading'); setAttempt(n => n + 1) } }}>{tr('retry')}</button>}</>}
    {catalog && !status && <><p>{tr('version')} {catalog.version} · {tr('publishedAt')} {new Date(catalog.publishedAt).toLocaleDateString(lang)}</p>{kinds.some(kind => catalog[kind].some(item => item.synthetic === true)) && <p className="catalog-warning">{tr('synthetic')}</p>}
      {roleKey ? <><Link className="elv-link" to="/app/route-catalog">{tr('catalog_back')}</Link>{role ? <RoleDetail role={role} catalog={catalog} /> : <Notice text={tr('not_found')} />}</> : <><div className="catalog-filters">{[{ name: 'market', value: market, set: setMarket, options: [...new Set(catalog.roles.map(r => string(r.market)))] }, { name: 'language_filter', value: language, set: setLanguage, options: [...new Set(catalog.resources.map(r => string(r.language)))] }, { name: 'context', value: context, set: setContext, options: catalog.contexts.map(c => string(c.contextKey)) }].map(filter => <div key={filter.name}><label htmlFor={`filter-${filter.name}`}>{tr(filter.name)}</label><select id={`filter-${filter.name}`} className="elv-select" value={filter.value} onChange={event => filter.set(event.target.value)}><option value="">{tr('all')}</option>{filter.options.filter(Boolean).map(option => <option key={option} value={option}>{filter.name === 'context' ? label(catalog.contexts.find(c => c.contextKey === option) ?? {}) : option}</option>)}</select></div>)}</div><div className="catalog-grid">{filtered.map(row => <article className="elv-card catalog-card" key={string(row.roleKey)}><h2>{label(row)}</h2><p>{string(row.market)} · {array(row.languagesRequired).map(value => value === 'unknown' ? tr('unknown') : string(value)).join(', ')}</p><p>{tr(row.verificationTask ? 'verificationTask' : 'sources_current')}</p>{row.synthetic === true && <p>{tr('synthetic')}</p>}<Link className="elv-btn" to={`/app/route-catalog/roles/${encodeURIComponent(string(row.roleKey))}`}>{tr('profile')}</Link></article>)}</div>{!filtered.length && <p>{tr('no_results')}</p>}</>}
    </>}
  </Shell>
}
function RoleDetail({ role, catalog }: { role: Data; catalog: Published }) {
  const { tr, lang } = useWords(); const localized = (v: unknown) => string(object(v)[lang]) || tr('unknown')
  const resources = catalog.resources.filter(resource => array(resource.roleKeys).includes(role.roleKey))
  const sourceKeys = new Set([...array(role.sourceKeys), ...array(role.tasks).map(task => object(object(task).aiExposure).sourceKey), object(role.regulated).sourceKey, ...resources.map(resource => resource.sourceKey)])
  return <article className="catalog-detail"><h2>{localized(role.labels)}</h2><p>{localized(role.industry)} · {string(role.market)}</p><p>{array(role.languagesRequired).map(value => value === 'unknown' ? tr('unknown') : string(value)).join(', ')} · {array(role.modality).map(value => tr(string(value))).join(', ')}</p>
    {object(role.domainReview).present === true && <p>{tr('review')} {string(object(role.domainReview).at)}</p>}{role.verificationTask === true && <p className="catalog-warning">{tr('verificationTask')}</p>}
    <section className="catalog-card"><h3>{tr('tasks')}</h3>{array(role.tasks).map((value, index) => { const task = object(value); const exposure = object(task.aiExposure); return <div key={index}><p>{localized(task.text)}</p><p>{tr(string(exposure.status) || 'unknown')}{exposure.note ? ` · ${localized(exposure.note)}` : ''}{exposure.sourceKey ? ` · ${string(exposure.sourceKey)}` : ''}</p></div> })}</section>
    <section className="catalog-card"><h3>{tr('barriers')}</h3>{array(role.barriers).length ? <ul>{array(role.barriers).map((v, index) => <li key={index}>{localized(v)}</li>)}</ul> : <p>{tr('none')}</p>}<h3>{tr('capabilities')}</h3><p>{tr('requirement')}</p><ul>{array(role.capabilities).map((v, index) => <li key={index}>{string(object(v).skillKey)} · {tr(string(object(v).importance))}</li>)}</ul></section>
    {object(role.regulated).isRegulated === true && <section className="catalog-card catalog-warning"><p>{tr('licensing')}</p><p>{localized(object(role.regulated).note)}</p></section>}
    <section className="catalog-card"><h3>{tr('sources')}</h3>{catalog.sources.filter(s => sourceKeys.has(s.sourceKey)).map(source => <article key={string(source.sourceKey)}><Outbound url={source.url}>{string(source.title)}</Outbound><p>{string(source.consultedAt)} · {string(source.language)}</p>{source.stale === true && <p className="catalog-warning">{tr('stale')}</p>}</article>)}</section>
    <section className="catalog-card"><h3>{tr('offers')}</h3>{!catalog.offers.some(offer => offer.roleKey === role.roleKey) && <p>{tr('none')}</p>}{catalog.offers.filter(offer => offer.roleKey === role.roleKey).map(offer => <article key={string(offer.offerKey)}><h4><Outbound url={offer.url}>{string(offer.title)}</Outbound></h4><p>{string(offer.organization)} · {string(offer.market)} · {string(offer.language)} · {tr(string(offer.modality))}</p><p>{offer.status === 'current' ? `${tr('checked')} ${string(offer.verifiedAt)}` : tr(offer.status === 'expired' ? 'expired' : 'unverified')}</p><p>{object(offer.salary).published === true ? string(object(offer.salary).text) : tr('unpublished_salary')}</p>{typeof offer.extract === 'string' && <p>{string(offer.extract)}</p>}</article>)}</section>
    <section className="catalog-card"><h3>{tr('resources')}</h3><p>{tr('course_limit')}</p>{!resources.length && <p>{tr('none')}</p>}{resources.map(resource => <article key={string(resource.resourceKey)}><h4><Outbound url={resource.url}>{string(resource.title)}</Outbound></h4><p>{string(resource.provider)} · {string(resource.language)} · {tr(string(resource.level))}</p><p>{tr('purpose')}: {localized(resource.purpose)}</p><p>{tr('duration')}: {typeof object(resource.duration).minutes === 'number' ? `${object(resource.duration).minutes} ${tr('minutes')}` : string(object(resource.duration).text)}</p><p>{tr('price')}: {object(resource.price).published === true ? `${object(resource.price).amount} ${string(object(resource.price).currency)}` : tr('unknown_price')}</p><p>{tr('skill')}: {string(resource.linkedSkillKey)}</p><p>{tr('exercise')}: {localized(resource.exercise)}</p></article>)}</section>
  </article>
}

export function CatalogManager() {
  const session = useSession(); const location = useLocation(); const [token, role] = JSON.parse(session) as string[]
  const params = useParams(); const { tr } = useWords()
  if ((params.id && !/^[1-9][0-9]{0,8}$/.test(params.id)) || (params.kind && !kinds.includes(params.kind as Kind)) || (params.itemKey && !validKey(params.itemKey))) return <Shell admin><Notice text={tr('not_found')} error /></Shell>
  return token && ['admin', 'superadmin'].includes(role) ? <ManagerSession key={session + location.pathname + location.search} session={session} /> : <Navigate to="/login" replace />
}
function ManagerSession({ session }: { session: string }) {
  const { api, current } = useClient(session); const { tr, lang } = useWords(); const params = useParams(); const location = useLocation(); const navigate = useNavigate()
  const id = params.id && /^[0-9]{1,9}$/.test(params.id) ? Number(params.id) : 0
  const kind = kinds.includes(params.kind as Kind) ? params.kind as Kind : null
  const itemKey = params.itemKey ?? ''; const newItem = itemKey === 'new' && new URLSearchParams(location.search).get('create') === '1'
  const [versions, setVersions] = useState<Descriptor[]>([]); const [version, setVersion] = useState<Detail | null>(null)
  const [data, setData] = useState<Data>({}); const [key, setKey] = useState(newItem ? '' : itemKey); const [baseline, setBaseline] = useState('{}'); const [synthetic, setSynthetic] = useState(false)
  const [busy, setBusy] = useState(true); const [ready, setReady] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState(false); const [attempt, setAttempt] = useState(0)
  const [confirmation, setConfirmation] = useState<'remove' | 'publish' | null>(null); const dialog = useRef<HTMLDialogElement>(null); const locked = useRef(false); const initialized = useRef(false)
  const dirty = kind !== null && (canonical(data) !== baseline || (newItem && !!key))
  const editable = ready && version?.status === 'draft'
  const go = (path: string) => { if (!busy && (!dirty || window.confirm(tr('leave')))) navigate(path) }
  const message = (value: string, failed = false) => { setNotice(value); setError(failed); if (value === 'session' || value === 'forbidden') { setVersion(null); setVersions([]); setReady(false); setData({}) } }
  const explain = (e: unknown) => e instanceof CatalogError ? e.status === 401 ? 'session' : e.status === 403 ? 'forbidden' : ['forbidden_label', 'synthetic_content_not_allowed', 'catalog_limit'].includes(e.code) ? e.code : e.status === 409 ? 'conflict' : e.code === 'incomplete_catalog' ? 'missing' : e.status === 400 ? 'invalid' : 'save_error' : 'save_error'
  useEffect(() => {
    let cancelled = false
    void (id ? api.get(id) : api.list()).then(value => {
      if (cancelled || readSession() !== session) return
      if (Array.isArray(value)) setVersions(value)
      else {
        setVersion(value)
        if (kind) {
          const found = newItem ? undefined : value.items[kind].find(item => item.itemKey === itemKey)
          if (!newItem && !found) { setNotice('not_found'); setError(true); return }
          const initial = found ? payload(kind, found, found.synthetic === true) : {}
          if (!initialized.current) { setData(initial); setSynthetic(found?.synthetic === true); setBaseline(canonical(initial)); initialized.current = true }
        }
      }
      setReady(true)
    }).catch(e => { if (!cancelled && readSession() === session) { setNotice(e instanceof CatalogError && e.status === 401 ? 'session' : e instanceof CatalogError && e.status === 403 ? 'forbidden' : 'error'); setError(true) } }).finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [api, id, itemKey, kind, newItem, session, attempt])
  useEffect(() => {
    if (!dirty && !busy) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', unload)
    const unregister = registerCatalogGuard(() => busy || !window.confirm(tr('leave')))
    return () => { window.removeEventListener('beforeunload', unload); unregister() }
  }, [dirty, busy, tr])
  useEffect(() => { if (confirmation) dialog.current?.showModal() }, [confirmation])
  async function run(action: 'create' | 'save' | 'remove' | 'publish') {
    if (locked.current || !ready || !current() || (action !== 'create' && !editable)) return
    if (action === 'save' && (!kind || !validKey(key))) { message('invalid', true); return }
    if (action === 'save' && newItem && version?.items[kind!].some(item => item.itemKey === key)) { message('conflict', true); return }
    locked.current = true; setBusy(true); setReady(false); dialog.current?.close(); setConfirmation(null); message('')
    let acknowledged: unknown; let failure: unknown
    try {
      if (action === 'create') acknowledged = await api.create()
      if (action === 'save') acknowledged = await api.save(id, kind!, key, payload(kind!, data, synthetic))
      if (action === 'remove') { await api.remove(id, kind!, key); acknowledged = true }
      if (action === 'publish') acknowledged = await api.publish(id)
    } catch (e) { failure = e }
    if (!current()) { locked.current = false; return }
    try {
      if (failure instanceof CatalogError && [401, 403].includes(failure.status)) { message(explain(failure), true); return }
      if (action === 'create') {
        const rows = await api.list(); if (!current()) return; setVersions(rows); setReady(true)
        const target = object(acknowledged).id ?? (failure instanceof CatalogError && failure.code === 'draft_exists' ? failure.draftId : undefined)
        if (typeof target === 'number' && rows.some(row => row.id === target && row.status === 'draft')) navigate(`/admin/route-catalog/${target}`)
        else message('uncertain', true)
      } else {
        const refreshed = await api.get(id); if (!current()) return; setVersion(refreshed); setReady(true)
        if (action === 'save') {
          const persisted = refreshed.items[kind!].find(item => item.itemKey === key)
          if (acknowledged && persisted && canonical(payload(kind!, persisted, persisted.synthetic === true)) === canonical(payload(kind!, object(acknowledged), synthetic))) { setData(payload(kind!, persisted, persisted.synthetic === true)); setBaseline(canonical(payload(kind!, persisted, persisted.synthetic === true))); message('saved'); if (newItem) navigate(`/admin/route-catalog/${id}/${kind}/${key}`) }
          else message(failure instanceof CatalogError && failure.status < 500 ? explain(failure) : 'uncertain', true)
        } else if (action === 'remove') {
          if (acknowledged && !refreshed.items[kind!].some(item => item.itemKey === key)) navigate(`/admin/route-catalog/${id}`)
          else message('uncertain', true)
        } else {
          if (failure) { message(failure instanceof CatalogError && failure.status < 500 ? explain(failure) : 'uncertain', true); return }
          const open = await api.published(); if (!current()) return
          if (acknowledged && refreshed.status === 'published' && open.version === object(acknowledged).version) message('published_success')
          else message(failure ? explain(failure) : 'uncertain', true)
        }
      }
    } catch (e) { if (current()) message(e instanceof CatalogError && [401, 403].includes(e.status) ? explain(e) : 'uncertain', true) }
    finally { locked.current = false; if (current()) setBusy(false) }
  }
  const retry = () => { if (!busy) { setReady(false); setNotice(''); setBusy(true); setAttempt(n => n + 1) } }
  return <Shell admin go={go}><h1>{tr('title')}</h1><Notice text={notice ? tr(notice) : ''} error={error} />{busy && <p role="status">{tr('loading')}</p>}{!ready && !busy && <button className="elv-btn" onClick={retry}>{tr('retry')}</button>}{notice === 'session' && <Link to="/login">{tr('login')}</Link>}
    {ready && !id && <><button className="elv-btn catalog-primary" disabled={busy} onClick={() => void run('create')}>{tr('create')}</button>{!versions.length && <p>{tr('none')}</p>}{versions.map(row => <article className="catalog-card" key={row.id}><h2>{tr('version')} {row.version} · {tr(row.status)}</h2><p>{row.itemCount} · {row.publishedAt && new Date(row.publishedAt).toLocaleDateString(lang)}</p><button className="elv-btn" onClick={() => go(`/admin/route-catalog/${row.id}`)}>{tr('open')}</button></article>)}</>}
    {ready && version && <><button className="elv-btn" disabled={busy} onClick={() => go(kind ? `/admin/route-catalog/${id}` : '/admin/route-catalog')}>{tr('draft_back')}</button><h2>{tr('version')} {version.version} · {tr(version.status)}</h2>{version.status !== 'draft' && <p>{tr('readonly')}</p>}
      {kind ? <><h3>{tr(kind)}</h3>{(version.missing[`${kind}/${key}`] ?? []).length > 0 && <section className="catalog-warning"><h4>{tr('missing')}</h4><ul>{version.missing[`${kind}/${key}`].map(field => <li key={field}><a href={`#item-${field.split('.')[0]}`}>{fieldLabel(kind, field, lang)}</a></li>)}</ul></section>}<p>{tr('verify_help')}</p><p>{tr('limitations')}</p>{synthetic && <p className="catalog-warning">{tr('synthetic')}</p>}<p role="status">{dirty ? tr('unsaved') : ''}</p><form onSubmit={event => { event.preventDefault(); void run('save') }}><fieldset disabled={!editable || busy}><label className="catalog-control" htmlFor="item-key">{tr('key')}<input className="elv-input" id="item-key" value={key} required pattern="[a-z][a-z0-9_]{2,47}" maxLength={48} disabled={!newItem} onChange={event => setKey(event.target.value)} /></label><CatalogFields specs={schemas[kind]} value={data} items={version.items} onChange={setData} /><div className="catalog-actions"><button className="elv-btn catalog-primary" type="submit">{tr('save')}</button>{!newItem && <button className="elv-btn" type="button" onClick={() => setConfirmation('remove')}>{tr('remove')}</button>}</div></fieldset></form><button className="elv-btn" disabled={busy} onClick={() => go(`/admin/route-catalog/${id}`)}>{tr('cancel')}</button></> : <>{Object.keys(version.missing).length > 0 && <section className="catalog-warning"><h3>{tr('missing')}</h3><ul>{Object.entries(version.missing).map(([path, values]) => <li key={path}><a href={`#${path.split('/')[0]}`}>{tr(path.split('/')[0])} · {path.split('/')[1]}: {values.map(v => fieldLabel(kinds.includes(path.split('/')[0] as Kind) ? path.split('/')[0] as Kind : 'roles', v, lang)).join(', ')}</a></li>)}</ul></section>}{kinds.map(section => <section className="catalog-card" id={section} key={section}><h3>{tr(section)} ({version.items[section].length})</h3>{editable && <button className="elv-btn" disabled={busy} onClick={() => go(`/admin/route-catalog/${id}/${section}/new?create=1`)}>{tr('add')} · {tr(section)}</button>}{version.items[section].map(item => <article key={item.itemKey}><p>{string(object(item.labels)[lang]) || string(item.title) || item.itemKey}{item.synthetic === true && ` · ${tr('synthetic')}`}</p><button className="elv-btn" disabled={busy} onClick={() => go(`/admin/route-catalog/${id}/${section}/${item.itemKey}`)}>{tr(editable ? 'edit' : 'read')} · {item.itemKey}</button></article>)}</section>)}{editable && <button className="elv-btn catalog-primary" disabled={busy || Object.keys(version.missing).length > 0} onClick={() => setConfirmation('publish')}>{tr('publish_review')}</button>}</>}
    </>}
    <dialog ref={dialog} onClose={() => setConfirmation(null)} aria-labelledby="catalog-confirm"><h2 id="catalog-confirm">{tr(confirmation === 'remove' ? 'remove' : 'publish_review')}</h2><p>{tr(confirmation === 'remove' ? 'remove_warning' : 'publish_warning')}</p>{version && <p>{tr('version')} {version.version} · {version.itemCount}</p>}<div className="catalog-actions"><button className="elv-btn" autoFocus onClick={() => dialog.current?.close()}>{tr('cancel')}</button><button className="elv-btn catalog-primary" disabled={busy} onClick={() => void run(confirmation === 'remove' ? 'remove' : 'publish')}>{tr(confirmation === 'remove' ? 'remove' : 'publish')}</button></div></dialog>
  </Shell>
}
