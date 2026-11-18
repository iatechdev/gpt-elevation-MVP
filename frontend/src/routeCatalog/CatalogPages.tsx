// ES-187 + ES-310 (PR 4): administración del catálogo de rutas con Cartografía (tokens --cg-*), dentro del marco de Administración (AdminLayout).
// La lógica (guardado con versión del elemento, conflicto 409, respuesta perdida, publicación) no cambia; solo la apariencia.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import '../cartografia/pages.css'
import { Banner, Button, Card, Chip, Dialog, ItemList, LinkButton, TextField } from '../cartografia'
import type { ChipTone } from '../cartografia'
import { registerCatalogGuard } from '../catalogGuard'
import { CatalogError, type Descriptor, type Detail } from './api'
import { canonical, fieldLabel, kinds, object, payload, schemas, string, validKey, type Data, type Kind } from './schema'
import { CatalogFields } from './CatalogFields'
import './catalog.css'

import { readSession, useClient, useSession, useWords } from './shared'
const STATUS_TONE: Record<string, { tone: ChipTone; symbol?: string }> = { draft: { tone: 'wait' }, published: { tone: 'ok', symbol: '✓' }, archived: { tone: 'neutral' } }
function Page({ go, children }: { go?: (path: string) => void; children: ReactNode }) {
  const { tr } = useWords(); const navigate = useNavigate()
  return <div className="pg rc"><header className="pg-head"><h1 className="pg-title">{tr('title')}</h1></header><p className="pg-nav"><LinkButton onClick={() => (go ?? navigate)('/admin/dashboard')}>{tr('admin_back')}</LinkButton></p>{children}</div>
}
// Aviso con foco (como antes): estado (role=status) o error (role=alert, con ⚠ por el aviso). `children` cuelga del mismo aviso (conflicto de edición).
function Notice({ text, error = false, focus = true, children }: { text: string; error?: boolean; focus?: boolean; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (text && focus) ref.current?.focus() }, [text, focus])
  return <div ref={ref} tabIndex={-1} role={error ? 'alert' : 'status'} className="pg-focus pg-live">{text && <div className={error ? 'cg-banner cg-banner--error' : 'cg-banner'}><span className="cg-banner__title">{text}</span>{children}</div>}</div>
}
export function CatalogManager() {
  const session = useSession(); const location = useLocation(); const [token, role] = JSON.parse(session) as string[]
  const params = useParams(); const { tr } = useWords()
  if ((params.id && !/^[1-9][0-9]{0,8}$/.test(params.id)) || (params.kind && !kinds.includes(params.kind as Kind)) || (params.itemKey && !validKey(params.itemKey))) return <Page><Notice text={tr('not_found')} error /></Page>
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
  const stamp = useRef<string | undefined>(undefined); const [clash, setClash] = useState<{ current: Data | null } | null>(null); const [showTheirs, setShowTheirs] = useState(false)
  const [confirmation, setConfirmation] = useState<'remove' | 'publish' | null>(null); const locked = useRef(false); const initialized = useRef(false)
  const dirty = kind !== null && (canonical(data) !== baseline || (newItem && !!key))
  const editable = ready && version?.status === 'draft'
  const go = (path: string) => { if (!busy && (!dirty || window.confirm(tr('leave')))) navigate(path) }
  const message = (value: string, failed = false) => { setNotice(value); setError(failed); if (value === 'session' || value === 'forbidden') { setVersion(null); setVersions([]); setReady(false); setData({}) } }
  const explain = (e: unknown) => e instanceof CatalogError ? e.status === 401 ? 'session' : e.status === 403 ? 'forbidden' : ['forbidden_label', 'synthetic_content_not_allowed', 'catalog_limit', 'draft_exists'].includes(e.code) ? e.code : e.status === 409 ? 'conflict' : e.code === 'incomplete_catalog' ? 'missing' : e.status === 400 ? 'invalid' : 'save_error' : 'save_error'
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
          if (!initialized.current) { stamp.current = string(found?.updatedAt) || undefined; setData(initial); setSynthetic(found?.synthetic === true); setBaseline(canonical(initial)); initialized.current = true }
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
    // ES-310: dentro del marco de Administración hay barra lateral y marca; un clic en un enlace de otra ruta con cambios sin guardar pide confirmar, como el botón «Volver» y el historial.
    const links = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!dirty || !link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = new URL((link as HTMLAnchorElement).href, window.location.href)
      if (target.origin !== window.location.origin || (target.pathname === window.location.pathname && target.search === window.location.search) || (target.hash && target.pathname === window.location.pathname)) return
      if (!window.confirm(tr('leave'))) { event.preventDefault(); event.stopPropagation() }
    }
    document.addEventListener('click', links, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', links, true); unregister() }
  }, [dirty, busy, tr])
  async function run(action: 'create' | 'save' | 'remove' | 'publish') {
    if (locked.current || !ready || !current() || (action !== 'create' && !editable)) return
    if (action === 'save' && (!kind || !validKey(key))) { message('invalid', true); return }
    if (action === 'save' && newItem && !stamp.current && version?.items[kind!].some(item => item.itemKey === key)) { message('conflict', true); return }
    locked.current = true; setBusy(true); setReady(false); setConfirmation(null); message('')
    let acknowledged: unknown; let failure: unknown
    try {
      if (action === 'create') acknowledged = await api.create()
      if (action === 'save') acknowledged = await api.save(id, kind!, key, payload(kind!, data, synthetic), newItem ? (stamp.current ?? null) : stamp.current)
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
          // E213-1: respuesta perdida (red o 5xx). El servidor pudo guardar: si lo releído coincide con lo enviado, se adopta su versión y se dice «Guardado»; si no, el siguiente guardado daría un 409 falso contra el propio cambio.
          const lost = !acknowledged && !(failure instanceof CatalogError && failure.status < 500)
          const expected = acknowledged ? payload(kind!, object(acknowledged), synthetic) : payload(kind!, data, synthetic)
          if ((acknowledged || lost) && persisted && canonical(payload(kind!, persisted, persisted.synthetic === true)) === canonical(expected)) { setData(payload(kind!, persisted, persisted.synthetic === true)); setBaseline(canonical(payload(kind!, persisted, persisted.synthetic === true))); stamp.current = string(persisted.updatedAt) || undefined; setClash(null); setShowTheirs(false); message('saved'); if (newItem) navigate(`/admin/route-catalog/${id}/${kind}/${key}`) }
          else if (failure instanceof CatalogError && (failure.code === 'item_changed' || failure.code === 'item_exists')) { setClash({ current: failure.current ?? null }); setShowTheirs(false); message(failure.code === 'item_exists' ? 'item_exists' : failure.current ? 'item_changed' : 'item_removed', true) }
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
  const keepMine = () => { stamp.current = string(clash?.current?.updatedAt) || undefined; setClash(null); setShowTheirs(false); message('keep_ready'); window.setTimeout(() => document.getElementById('catalog-save')?.focus(), 0) }
  const differences = clash?.current && kind ? (() => { const theirs = payload(kind, clash.current, clash.current.synthetic === true); const mine = payload(kind, data, synthetic); return schemas[kind].filter(field => canonical(theirs[field.key]) !== canonical(mine[field.key])).map(field => ({ label: field[lang], value: typeof theirs[field.key] === 'string' ? string(theirs[field.key]) : JSON.stringify(theirs[field.key] ?? '') })) })() : []
  const openDraft = versions.find(row => row.status === 'draft')
  const retry = () => { if (!busy) { setReady(false); setNotice(''); setBusy(true); setAttempt(n => n + 1) } }
  const head = version ? <h2>{tr('version')} {version.version} · {tr(version.status)}</h2> : null
  const missingHere = version ? Object.keys(version.missing).length : 0
  return <Page go={go}><Notice text={notice ? tr(notice) : ''} error={error}>{clash && kind && <div className="catalog-conflict"><div className="pg-actions">{clash.current && <LinkButton aria-expanded={showTheirs} onClick={() => setShowTheirs(open => !open)}>{tr(showTheirs ? 'hide_theirs' : 'see_theirs')}</LinkButton>}<Button variant="ghost" onClick={keepMine}>{tr('keep_mine')}</Button></div>{clash.current && showTheirs && (differences.length ? <ul>{differences.map(row => <li key={row.label}><strong>{row.label}</strong>: {row.value || tr('none')}</li>)}</ul> : <p>{tr('no_differences')}</p>)}</div>}</Notice>{busy && <p role="status" className="pg-count">{tr('loading')}</p>}{!ready && !busy && <div className="pg-actions"><Button variant="ghost" onClick={retry}>{tr('retry')}</Button></div>}{notice === 'session' && <p><Link className="cg-linkbtn" to="/login">{tr('login')}</Link></p>}
    {ready && !id && <><div className="pg-actions"><Button disabled={busy || !!openDraft} aria-describedby={openDraft ? 'catalog-draft-reason' : undefined} onClick={() => void run('create')}>{tr('create')}</Button></div>{openDraft && <p className="cg-hint" id="catalog-draft-reason">{tr('draft_exists')} ({tr('version')} {openDraft.version}) <LinkButton onClick={() => go(`/admin/route-catalog/${openDraft.id}`)}>{tr('open_draft')}</LinkButton></p>}{!versions.length && <p>{tr('none')}</p>}{versions.length > 0 && <Card as="section" className="pg-card"><ItemList label={tr('version')} items={versions.map(row => ({ id: String(row.id), top: <div className="pg-itemtop"><span>{tr('version')} {row.version} · <Chip tone={STATUS_TONE[row.status]?.tone} symbol={STATUS_TONE[row.status]?.symbol}>{tr(row.status)}</Chip></span><Button variant="ghost" onClick={() => go(`/admin/route-catalog/${row.id}`)}>{tr('open')}<span className="cg-sr"> · {tr('version')} {row.version}</span></Button></div>,
      body: <p className="pg-count">{row.itemCount} · {row.publishedAt && new Date(row.publishedAt).toLocaleDateString(lang)}</p> }))} /></Card>}</>}
    {ready && version && <><div className="pg-actions"><Button variant="ghost" disabled={busy} onClick={() => go(kind ? `/admin/route-catalog/${id}` : '/admin/route-catalog')}>{tr('draft_back')}</Button></div>
      {kind ? <Card as="section" className="pg-card">{head}{version.status !== 'draft' && <p>{tr('readonly')}</p>}<h3>{tr(kind)}</h3>{(version.missing[`${kind}/${key}`] ?? []).length > 0 && <Banner kind="note" title={tr('missing')}><ul>{version.missing[`${kind}/${key}`].map(field => <li key={field}><a className="cg-linkbtn" href={`#item-${field.split('.')[0]}`}>{fieldLabel(kind, field, lang)}</a></li>)}</ul></Banner>}<p className="cg-hint">{tr('verify_help')}</p><p className="cg-hint">{tr('limitations')}</p>{synthetic && <Banner kind="note" title={tr('synthetic')} />}<p role="status" className="pg-count">{dirty ? tr('unsaved') : ''}</p><form className="pg-form" onSubmit={event => { event.preventDefault(); void run('save') }}><fieldset className="rc-set" disabled={!editable || busy}><TextField id="item-key" label={tr('key')} value={key} required pattern="[a-z][a-z0-9_]{2,47}" maxLength={48} disabled={!newItem} onChange={event => setKey(event.target.value)} /><CatalogFields specs={schemas[kind]} value={data} items={version.items} onChange={setData} /><div className="pg-actions"><Button id="catalog-save" type="submit">{tr('save')}</Button>{!newItem && <Button variant="danger" onClick={() => setConfirmation('remove')}>{tr('remove')}</Button>}</div></fieldset></form><div className="pg-actions"><Button variant="ghost" disabled={busy} onClick={() => go(`/admin/route-catalog/${id}`)}>{tr('cancel')}</Button></div></Card>
        : <><Card as="section" className="pg-card">{head}{version.status !== 'draft' && <p>{tr('readonly')}</p>}{missingHere > 0 && <div id="catalog-publish-reason"><Banner kind="note" title={tr('missing')}><ul>{Object.entries(version.missing).map(([path, values]) => <li key={path}><a className="cg-linkbtn" href={`#${path.split('/')[0]}`}>{tr(path.split('/')[0])} · {path.split('/')[1]}: {values.map(v => fieldLabel(kinds.includes(path.split('/')[0] as Kind) ? path.split('/')[0] as Kind : 'roles', v, lang)).join(', ')}</a></li>)}</ul></Banner></div>}{editable && <div className="pg-actions"><Button variant="ghost" disabled={busy || missingHere > 0} aria-describedby={missingHere > 0 ? 'catalog-publish-reason' : undefined} onClick={() => setConfirmation('publish')}>{tr('publish_review')}</Button></div>}</Card>
          {kinds.map(section => <div id={section} key={section}><Card as="section" className="pg-card"><h3>{tr(section)} ({version.items[section].length})</h3>{editable && <div className="pg-actions"><Button variant="ghost" disabled={busy} onClick={() => go(`/admin/route-catalog/${id}/${section}/new?create=1`)}>{tr('add')} · {tr(section)}</Button></div>}{version.items[section].length > 0 && <ItemList label={tr(section)} items={version.items[section].map(item => { const gaps = (version.missing[`${section}/${item.itemKey}`] ?? []).length; return { id: item.itemKey, top: <div className="pg-itemtop"><span>{string(object(item.labels)[lang]) || string(item.title) || item.itemKey}{item.synthetic === true && ` · ${tr('synthetic')}`}</span>{gaps ? <Chip tone="wait">{`${tr('missing_chip')} (${gaps})`}</Chip> : <Chip tone="ok" symbol="✓">{tr('complete')}</Chip>}</div>,
      body: <div className="pg-actions"><Button variant="ghost" disabled={busy} onClick={() => go(`/admin/route-catalog/${id}/${section}/${item.itemKey}`)}>{tr(editable ? 'edit' : 'read')} · {item.itemKey}</Button></div> } })} />}</Card></div>)}</>}
    </>}
    <Dialog open={confirmation !== null} onClose={() => setConfirmation(null)} title={tr(confirmation === 'remove' ? 'remove' : 'publish_review')} actions={<><Button variant="ghost" onClick={() => setConfirmation(null)}>{tr('cancel')}</Button><Button variant={confirmation === 'remove' ? 'danger' : 'primary'} disabled={busy} onClick={() => void run(confirmation === 'remove' ? 'remove' : 'publish')}>{tr(confirmation === 'remove' ? 'remove' : 'publish')}</Button></>}><p>{tr(confirmation === 'remove' ? 'remove_warning' : 'publish_warning')}</p>{version && <p>{tr('version')} {version.version} · {version.itemCount}</p>}</Dialog>
  </Page>
}
