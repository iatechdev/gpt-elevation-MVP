// ES-172 (HU-P21): catálogo de rutas, vista de la persona (/app/route-catalog y /app/route-catalog/roles/:roleKey) con el sistema «Cartografía».
// Mismo contenido y misma API que antes (GET /api/route-catalog/published, propietario/rol verificados en el servidor); cambian la piel, la jerarquía y la rejilla.
// La lógica pura (filtros, fechas, estados con palabra + símbolo, nombres de habilidad) vive en person.ts y tiene pruebas propias.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { Button, Chip, SelectField } from '../cartografia/controls'
import { Banner, Card } from '../cartografia/pieces'
import { CartografiaRoot } from '../cartografia/theme'
import { LangSwitch } from '../shell/Frame'
import { CatalogError, type Published } from './api'
import { API, readSession, useClient, useNames, useSession, useWords } from './shared'
import { dateText, exposureStatus, filterRoles, offerStatus, roleNotice, skillLabels, sourceNotice, type Filters, type StatusView } from './person'
import { array, object, safeUrl, string, type Data } from './schema'
import './person.css'

function Screen({ children }: { children: ReactNode }) {
  const { tr } = useWords(); const main = useRef<HTMLElement>(null)
  return (
    <CartografiaRoot className="cgp">
      <a className="cg-skip" href="#catalog-main" onClick={event => { event.preventDefault(); main.current?.focus(); main.current?.scrollIntoView() }}>{tr('skip')}</a>
      <header className="cg-header">
        <Link className="cg-btn cg-btn--ghost" to="/app/dashboard"><span aria-hidden="true">← </span>{tr('back')}</Link>
        <div className="cg-header__end"><LangSwitch /></div>
      </header>
      <main id="catalog-main" tabIndex={-1} ref={main} className="cg-page cgp-main">{children}</main>
    </CartografiaRoot>
  )
}

/** Aviso con foco: al aparecer, el lector de pantalla lo anuncia y el teclado queda sobre él (error, vacío, sesión vencida). */
function Notice({ kind, title, children }: { kind: 'note' | 'error'; title: string; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.focus() }, [title])
  return <div ref={ref} tabIndex={-1} className="cgp-notice"><Banner kind={kind} title={title}>{children}</Banner></div>
}

function StatusChip({ view }: { view: StatusView }) {
  const { tr } = useWords()
  return <Chip tone={view.tone} symbol={view.symbol}>{tr(view.key)}</Chip>
}

/** Enlace externo: solo https y sin credenciales (safeUrl); se abre en pestaña nueva y SE DICE (texto visible), con el servidor de destino. */
function Outbound({ url, children }: { url: unknown; children: ReactNode }) {
  const { tr } = useWords(); const safe = safeUrl(url)
  if (!safe) return <span>{children}</span>
  return <a className="cgp-out" href={safe} target="_blank" rel="noopener noreferrer">{children} · {new URL(safe).hostname} <small>({tr('new_tab')})</small></a>
}

export function CatalogBrowser() {
  const session = useSession(); const location = useLocation(); const token = (JSON.parse(session) as string[])[0]
  return token ? <BrowserSession key={session + location.pathname + location.search} session={session} /> : <Navigate to="/login" replace />
}

function BrowserSession({ session }: { session: string }) {
  const { api } = useClient(session); const { tr, lang } = useWords(); const { roleKey } = useParams()
  const [catalog, setCatalog] = useState<Published | null>(null); const [status, setStatus] = useState('loading'); const [attempt, setAttempt] = useState(0)
  const [filters, setFilters] = useState<Filters>({ market: '', context: '', language: '' })
  useEffect(() => {
    let cancelled = false
    void api.published().then(value => { if (!cancelled && readSession() === session) { setCatalog(value); setStatus('') } })
      .catch(error => { if (!cancelled && readSession() === session) setStatus(error instanceof CatalogError && error.status === 401 ? 'session' : error instanceof CatalogError && error.code === 'catalog_unavailable' ? 'empty' : 'error') })
    return () => { cancelled = true }
  }, [api, session, attempt])
  const retry = () => { if (readSession() === session) { setStatus('loading'); setAttempt(n => n + 1) } }
  const role = catalog?.roles.find(row => row.roleKey === roleKey)
  const when = catalog ? dateText(catalog.publishedAt, lang) : null
  return (
    <Screen>
      {!roleKey && <><h1 className="cg-h1">{tr('title')}</h1><p className="cg-muted cgp-lead">{tr('intro')}</p></>}
      {status === 'loading' && <><div className="cg-relief cg-relief--loading cgp-loading" aria-hidden="true" /><p role="status" className="cg-muted">{tr('loading')}</p></>}
      {status === 'session' && <Notice kind="error" title={tr('session')}><div className="cg-row"><Link className="cg-btn" to="/login">{tr('login')}</Link></div></Notice>}
      {status === 'error' && <Notice kind="error" title={tr('error')}><div className="cg-row"><Button onClick={retry}>{tr('retry')}</Button></div></Notice>}
      {status === 'empty' && <Notice kind="note" title={tr('empty')} />}
      {catalog && !status && (
        <>
          <p className="cg-tag cgp-meta">{tr('version')} {catalog.version} · {when ? `${tr('publishedAt')} ${when}` : tr('publishedAt_unknown')}</p>
          {(['contexts', 'sources', 'roles', 'offers', 'resources'] as const).some(kind => catalog[kind].some(item => item.synthetic === true)) && <Banner title={tr('synthetic')} />}
          {roleKey
            ? role ? <RoleDetail role={role} catalog={catalog} session={session} /> : <><h1 className="cg-h1">{tr('title')}</h1><Notice kind="note" title={tr('not_found')} /><p><Link className="cg-btn cg-btn--ghost" to="/app/route-catalog">{tr('catalog_back')}</Link></p></>
            : <RoleList catalog={catalog} filters={filters} setFilters={setFilters} />}
        </>
      )}
    </Screen>
  )
}

function RoleList({ catalog, filters, setFilters }: { catalog: Published; filters: Filters; setFilters: (value: Filters) => void }) {
  const { tr, lang } = useWords(); const names = useNames()
  const label = (item: Data) => string(object(item.labels)[lang]) || tr('unknown')
  const filtered = useMemo(() => filterRoles(catalog.roles, filters), [catalog, filters])
  const markets = [...new Set(catalog.roles.map(row => string(row.market)))].filter(Boolean)
  const languages = [...new Set(catalog.roles.flatMap(row => array(row.languagesRequired).map(string)))].filter(code => code && code !== 'unknown')
  const contexts = catalog.contexts.map(c => string(c.contextKey)).filter(Boolean)
  const active = Boolean(filters.market || filters.context || filters.language)
  const field = (name: keyof Filters, text: string, options: { value: string; text: string }[]) => (
    <SelectField label={text} value={filters[name]} onChange={event => setFilters({ ...filters, [name]: event.target.value })}>
      <option value="">{tr('all')}</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.text}</option>)}
    </SelectField>
  )
  return (
    <>
      <div className="cgp-filters">
        {field('market', tr('market'), markets.map(code => ({ value: code, text: names.country(code) })))}
        {field('language', tr('language_filter'), languages.map(code => ({ value: code, text: names.language(code) })))}
        {field('context', tr('context'), contexts.map(key => ({ value: key, text: label(catalog.contexts.find(c => c.contextKey === key) ?? {}) })))}
      </div>
      <div className="cg-row cgp-count">
        <p role="status" aria-live="polite" className="cg-muted">{tr('roles_count', { n: filtered.length, total: catalog.roles.length })}</p>
        {active && <Button variant="ghost" onClick={() => setFilters({ market: '', context: '', language: '' })}>{tr('clear_filters')}</Button>}
      </div>
      {!filtered.length && <p>{tr('no_results')}</p>}
      <ul className="cgp-grid" aria-label={tr('roles')}>
        {filtered.map(row => {
          const key = string(row.roleKey)
          return (
            <li key={key}>
              <Card as="article" className="cgp-role">
                <h2 className="cg-h2">{label(row)}</h2>
                <p className="cg-muted">{string(object(row.industry)[lang]) || tr('unknown')} · {names.country(row.market)} · {array(row.languagesRequired).map(value => names.language(value)).join(', ')}</p>
                <p><StatusChip view={roleNotice(row)} />{row.synthetic === true && <> <Chip tone="wait" symbol="ℹ">{tr('synthetic_short')}</Chip></>}</p>
                <div className="cg-row"><Link className="cg-btn" to={`/app/route-catalog/roles/${encodeURIComponent(key)}`}>{tr('profile')}<span className="cg-sr"> · {label(row)}</span></Link></div>
              </Card>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** Nombres de habilidad (D1=B): SOLO las etiquetas de GET /api/skill-map, en memoria; no se guardan niveles ni datos del mapa y, si falla, se dice «Capacidad por confirmar». */
function useSkillNames(session: string) {
  const { lang } = useWords(); const [names, setNames] = useState<Map<string, string>>(() => new Map())
  useEffect(() => {
    const controller = new AbortController(); const token = (JSON.parse(session) as string[])[0]
    void fetch(`${API}/api/skill-map`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(response => (response.ok ? response.json() : null)).then(body => { if (!controller.signal.aborted && readSession() === session) setNames(skillLabels(body, lang)) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [session, lang])
  return names
}

function RoleDetail({ role, catalog, session }: { role: Data; catalog: Published; session: string }) {
  const { tr, lang } = useWords(); const names = useNames(); const skills = useSkillNames(session)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => { title.current?.focus() }, [role.roleKey])
  const localized = (v: unknown) => string(object(v)[lang]) || tr('unknown')
  // E259-2: sin fecha válida la frase entera dice «por confirmar» (nunca «Consultada el Por confirmar»).
  const dated = (key: 'review' | 'consulted' | 'checked', value: unknown) => { const text = dateText(value, lang); return text ? `${tr(key)} ${text}` : tr(`${key}_unknown`) }
  const skillName = (key: unknown) => skills.get(string(key)) ?? tr('skill_unknown')
  const sourceTitle = (key: unknown) => string(catalog.sources.find(source => source.sourceKey === key)?.title) || tr('source_unknown')
  const resources = catalog.resources.filter(resource => array(resource.roleKeys).includes(role.roleKey))
  const offers = catalog.offers.filter(offer => offer.roleKey === role.roleKey)
  const sourceKeys = new Set([...array(role.sourceKeys), ...array(role.tasks).map(task => object(object(task).aiExposure).sourceKey), object(role.regulated).sourceKey, ...resources.map(resource => resource.sourceKey)])
  const sources = catalog.sources.filter(source => sourceKeys.has(source.sourceKey))
  const review = object(role.domainReview)
  return (
    <article className="cgp-detail" aria-labelledby="role-title">
      <p><Link className="cg-btn cg-btn--ghost" to="/app/route-catalog"><span aria-hidden="true">← </span>{tr('catalog_back')}</Link></p>
      <h1 className="cg-h1" id="role-title" tabIndex={-1} ref={title}>{localized(role.labels)}</h1>
      <p className="cg-muted">{localized(role.industry)} · {names.country(role.market)}</p>
      <p className="cg-muted">{array(role.languagesRequired).map(value => names.language(value)).join(', ')} · {array(role.modality).map(value => tr(string(value))).join(', ')}</p>
      <p>
        {review.present === true && <span className="cg-small cg-muted">{dated('review', review.at)} </span>}
        {role.verificationTask === true && <Chip tone="wait" symbol="⚑">{tr('verificationTask')}</Chip>}
      </p>
      <div className="cgp-sections">
        <Card as="section" className="cgp-section"><h2 className="cg-h2">{tr('tasks')}</h2>
          {array(role.tasks).length === 0 && <p>{tr('none')}</p>}
          <ul className="cg-items">{array(role.tasks).map((value, index) => { const task = object(value); const exposure = object(task.aiExposure); return (
            <li className="cg-item" key={index}>
              <p>{localized(task.text)}</p>
              <p className="cg-small cg-muted"><StatusChip view={exposureStatus(exposure.status)} />{exposure.note ? ` ${localized(exposure.note)}` : ''}{exposure.sourceKey ? ` · ${sourceTitle(exposure.sourceKey)}` : ''}</p>
            </li>) })}</ul>
        </Card>
        <Card as="section" className="cgp-section"><h2 className="cg-h2">{tr('barriers')}</h2>
          {array(role.barriers).length ? <ul className="cgp-list">{array(role.barriers).map((v, index) => <li key={index}>{localized(v)}</li>)}</ul> : <p>{tr('none')}</p>}
        </Card>
        <Card as="section" className="cgp-section"><h2 className="cg-h2">{tr('capabilities')}</h2>
          <p className="cg-small cg-muted">{tr('requirement')}</p>
          <ul className="cgp-list">{array(role.capabilities).map((v, index) => <li key={index}>{skillName(object(v).skillKey)} · {tr(string(object(v).importance))}</li>)}</ul>
        </Card>
        {object(role.regulated).isRegulated === true && <Card as="section" className="cgp-section"><h2 className="cg-h2">{tr('licensing_title')}</h2><Banner title={tr('licensing')}><p>{localized(object(role.regulated).note)}</p></Banner></Card>}
        <Card as="section" className="cgp-section cgp-wide"><h2 className="cg-h2">{tr('sources')}</h2>
          {!sources.length && <p>{tr('none')}</p>}
          <ul className="cg-items">{sources.map(source => (
            <li className="cg-item" key={string(source.sourceKey)}>
              <Outbound url={source.url}>{string(source.title)}</Outbound>
              <p className="cg-small cg-muted">{dated('consulted', source.consultedAt)} · {names.language(source.language)}</p>
              {sourceNotice(source) && <p><StatusChip view={sourceNotice(source)!} /></p>}
            </li>))}</ul>
        </Card>
        <Card as="section" className="cgp-section cgp-wide"><h2 className="cg-h2">{tr('offers')}</h2>
          {!offers.length && <p>{tr('none')}</p>}
          <ul className="cg-items">{offers.map(offer => { const state = offerStatus(offer.status); return (
            <li className="cg-item" key={string(offer.offerKey)}>
              <h3 className="cgp-h3"><Outbound url={offer.url}>{string(offer.title)}</Outbound></h3>
              <p className="cg-small">{string(offer.organization)} · {names.country(offer.market)} · {names.language(offer.language)} · {tr(string(offer.modality))}</p>
              <p className="cg-small"><Chip tone={state.tone} symbol={state.symbol}>{state.key === 'checked' ? dated('checked', offer.verifiedAt) : tr(state.key)}</Chip> {object(offer.salary).published === true ? string(object(offer.salary).text) : tr('unpublished_salary')}</p>
              {typeof offer.extract === 'string' && <p>{string(offer.extract)}</p>}
            </li>) })}</ul>
        </Card>
        <Card as="section" className="cgp-section cgp-wide"><h2 className="cg-h2">{tr('resources')}</h2>
          <p className="cg-small cg-muted">{tr('course_limit')}</p>
          {!resources.length && <p>{tr('none')}</p>}
          <ul className="cg-items">{resources.map(resource => (
            <li className="cg-item" key={string(resource.resourceKey)}>
              <h3 className="cgp-h3"><Outbound url={resource.url}>{string(resource.title)}</Outbound></h3>
              <p className="cg-small">{string(resource.provider)} · {names.language(resource.language)} · {tr(string(resource.level))}</p>
              <p>{tr('purpose')}: {localized(resource.purpose)}</p>
              <p className="cg-small cg-muted">{tr('duration')}: {typeof object(resource.duration).minutes === 'number' ? `${object(resource.duration).minutes} ${tr('minutes')}` : string(object(resource.duration).text) || tr('unknown')} · {tr('price')}: {object(resource.price).published === true ? `${object(resource.price).amount} ${string(object(resource.price).currency)}` : tr('unknown_price')}</p>
              <p className="cg-small cg-muted">{tr('skill')}: {skillName(resource.linkedSkillKey)}</p>
              {resource.exercise ? <p className="cg-small cg-muted">{tr('exercise')}: {localized(resource.exercise)}</p> : null}
            </li>))}</ul>
        </Card>
      </div>
    </article>
  )
}
