// ES-116 + ES-349 (parte 1): catálogo de habilidades con Cartografía (tokens --cg-*), dentro del marco de Administración (AdminLayout: barra lateral, «Saltar al contenido», un solo main, selector ES/EN).
// La lógica (versiones, borrador, guardado con marca de versión de la fila, conflicto, publicación y habilidades en uso) no cambia; solo la apariencia. Sin textos nuevos: todo sale de skcat.* (ES/EN).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import '../cartografia/pages.css'
import { Banner, Button, Card, Chip, CheckField, DataTable, Dialog, SelectField, TextAreaField, TextField } from '../cartografia'
import type { ChipTone } from '../cartografia'
import { registerCatalogGuard } from '../catalogGuard'
import { useLanguage } from '../i18n/useLanguage'
import { territories } from '../skill-map/territories'
import { skillCatalogApi, SkillCatalogError, type Descriptor, type Detail, type SkillRow } from './api'
import { emptyForm, fromSkill, isDirty, KEY_RE, LEVELS, missingFieldAnchor, missingLabel, toBody, validate, type FieldError, type Form } from './model'
import './skillCatalog.css'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const readSession = () => { try { return JSON.stringify([localStorage.getItem('elevation_token') ?? '', localStorage.getItem('elevation_role') ?? '']) } catch { return '["",""]' } }
const fmt = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
const STATUS_TONE: Record<string, { tone: ChipTone; symbol?: string }> = { draft: { tone: 'wait' }, published: { tone: 'ok', symbol: '✓' }, archived: { tone: 'neutral' } }
function useSession() {
  const [session, setSession] = useState(readSession)
  useEffect(() => {
    const update = () => setSession(readSession())
    window.addEventListener('storage', update); window.addEventListener('focus', update)
    return () => { window.removeEventListener('storage', update); window.removeEventListener('focus', update) }
  }, [])
  return session
}
// El marco de Administración ya trae la cabecera, el selector de idioma y el «Saltar al contenido»: aquí solo el título de la pantalla.
function Page({ title, chip, children }: { title: ReactNode; chip?: ReactNode; children: ReactNode }) {
  return <div className="pg sk"><header className="pg-head"><h1 className="pg-title">{title}</h1>{chip}</header>{children}</div>
}
function StatusChip({ status, label }: { status: string; label: string }) {
  const style = STATUS_TONE[status] ?? { tone: 'neutral' as ChipTone }
  return <Chip tone={style.tone} symbol={style.symbol}>{label}</Chip>
}
// Aviso con foco: estado (role=status) o error (role=alert).
function Notice({ text, error = false }: { text: string; error?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (text) ref.current?.focus() }, [text])
  return <div ref={ref} tabIndex={-1} role={error ? 'alert' : 'status'} className="pg-focus pg-live">{text && <Banner kind={error ? 'error' : 'note'} title={text} />}</div>
}
export function SkillCatalogManager() {
  const session = useSession(); const location = useLocation(); const params = useParams(); const { t } = useLanguage()
  const [token, role] = JSON.parse(session) as string[]
  if ((params.id && !/^[1-9][0-9]{0,8}$/.test(params.id)) || (params.skillKey && params.skillKey !== 'new' && !KEY_RE.test(params.skillKey))) return <Page title={t('skcat.title')}><Notice error text={t('skcat.e_notfound')} /></Page>
  return token && ['admin', 'superadmin'].includes(role) ? <ManagerSession key={session + location.pathname + location.search} session={session} /> : <Navigate to="/login" replace />
}

type Notice = { key: string; error: boolean; params?: Record<string, string | number> }
function ManagerSession({ session }: { session: string }) {
  const { t, lang } = useLanguage(); const params = useParams(); const navigate = useNavigate(); const location = useLocation()
  const token = (JSON.parse(session) as string[])[0]
  const api = useMemo(() => skillCatalogApi(API, token), [token])
  const alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const current = () => alive.current && readSession() === session
  const id = params.id ? Number(params.id) : 0
  const skillKey = params.skillKey ?? ''; const creating = skillKey === 'new'
  const [versions, setVersions] = useState<Descriptor[]>([]); const [detail, setDetail] = useState<Detail | null>(null)
  const [form, setForm] = useState<Form>(emptyForm); const [baseline, setBaseline] = useState<Form>(emptyForm); const [newKey, setNewKey] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldError, true>>>({})
  const [busy, setBusy] = useState(true); const [ready, setReady] = useState(false); const [notice, setNotice] = useState<Notice | null>(null)
  const [showPublish, setShowPublish] = useState(false); const [confirmRemove, setConfirmRemove] = useState(false); const [attempt, setAttempt] = useState(0)
  const [conflict, setConflict] = useState<SkillRow | null | undefined>(undefined)
  const [inUse, setInUse] = useState<{ skillKey: string; people: number }[] | null>(null)
  const [rowStamp, setRowStamp] = useState<string | undefined>(undefined)
  const locked = useRef(false); const initialized = useRef(false)
  const conflictRef = useRef<HTMLDivElement>(null); const inUseRef = useRef<HTMLDivElement>(null)
  const editable = ready && detail?.status === 'draft'
  const dirty = !!skillKey && (isDirty(form, baseline) || (creating && !!newKey))
  const say = (key: string, error = false, p?: Record<string, string | number>) => setNotice({ key, error, params: p })
  const text = notice ? fmt(t(`skcat.${notice.key}`), notice.params ?? {}) : ''
  const go = (path: string) => { if (!busy && (!dirty || window.confirm(t('skcat.leave')))) navigate(path) }
  const explain = (e: unknown, mutating = false) => {
    if (!(e instanceof SkillCatalogError)) return mutating ? 'e_uncertain' : 'e_generic'
    if (e.status === 401) return 'e_session'
    if (e.status === 403) return 'e_forbidden'
    if (e.code === 'catalog_not_editable') return 'e_not_editable'
    if (e.code === 'conflict') return 'e_conflict'
    if (e.status === 404) return 'e_notfound'
    if (e.status === 400) return 'e_invalid'
    return 'e_generic'
  }
  useEffect(() => {
    let cancelled = false
    setBusy(true)
    void (id ? api.get(id) : api.list()).then(value => {
      if (cancelled || !current()) return
      if (Array.isArray(value)) setVersions(value)
      else {
        setDetail(value)
        if (skillKey && !creating) {
          const row = value.skills.find(skill => skill.skillKey === skillKey)
          if (!row) { say('e_notfound', true); return }
          if (!initialized.current) { const initial = fromSkill(row); setForm(initial); setBaseline(initial); setRowStamp(row.updatedAt); initialized.current = true }
        }
      }
      setReady(true)
    }).catch(e => { if (!cancelled && current()) say(explain(e), true) }).finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, id, skillKey, attempt])
  useEffect(() => {
    if (!dirty && !busy) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', unload)
    const unregister = registerCatalogGuard(() => busy || !window.confirm(t('skcat.leave')))
    // Dentro del marco de Administración hay barra lateral y marca: un clic en un enlace de otra ruta con cambios sin guardar pide confirmar, como el botón «Volver» y el historial.
    const links = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!dirty || !link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = new URL((link as HTMLAnchorElement).href, window.location.href)
      if (target.origin !== window.location.origin || (target.pathname === window.location.pathname && target.search === window.location.search) || (target.hash && target.pathname === window.location.pathname)) return
      if (!window.confirm(t('skcat.leave'))) { event.preventDefault(); event.stopPropagation() }
    }
    document.addEventListener('click', links, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', links, true); unregister() }
  }, [dirty, busy, t])

  async function refresh() { const value = await api.get(id); if (current()) setDetail(value); return value }
  async function run(action: 'create' | 'save' | 'remove' | 'publish') {
    if (locked.current || !current() || (action !== 'create' && !editable)) return
    if (action === 'save') {
      const errors = validate(form, newKey, creating); setFieldErrors(errors)
      if (Object.keys(errors).length) { say(errors.key ? 'err_key' : 'e_invalid', true); return }
      if (creating && detail?.skills.some(skill => skill.skillKey === newKey)) { say('e_exists', true); return }
    }
    locked.current = true; setBusy(true); setNotice(null); setConfirmRemove(false)
    try {
      if (action === 'create') {
        try { const draft = await api.create(); if (current()) navigate(`/admin/skill-catalog/${draft.id}`) }
        catch (e) { if (e instanceof SkillCatalogError && e.code === 'draft_exists' && e.draftId && current()) navigate(`/admin/skill-catalog/${e.draftId}`); else throw e }
      } else if (action === 'save') {
        const key = creating ? newKey : skillKey
        await api.save(id, key, toBody(form), creating ? undefined : rowStamp)
        if (!current()) return
        setConflict(undefined)
        if (creating) { navigate(`/admin/skill-catalog/${id}`); return }
        const refreshed = await refresh(); const row = refreshed.skills.find(skill => skill.skillKey === key)
        if (row) { const persisted = fromSkill(row); setForm(persisted); setBaseline(persisted); setRowStamp(row.updatedAt) }
        say('saved')
      } else if (action === 'remove') {
        await api.remove(id, skillKey); if (current()) navigate(`/admin/skill-catalog/${id}`)
      } else {
        const published = await api.publish(id)
        if (!current()) return
        await refresh(); setShowPublish(false); say('pub_done', false, { n: published.version })
      }
    } catch (e) {
      if (!current()) return
      if (action === 'save' && e instanceof SkillCatalogError && e.code === 'skill_changed') { setConflict(e.current); say('conflict_changed', true); return }
      if (action === 'publish' && e instanceof SkillCatalogError && e.code === 'skill_in_use') { setInUse(e.inUse); setShowPublish(true); try { await refresh() } catch { /* el aviso queda con los datos del error */ } return }
      setInUse(null)
      if (action === 'publish' && e instanceof SkillCatalogError && e.code === 'incomplete_catalog') { try { await refresh() } catch { /* se muestra el aviso genérico */ } }
      say(action === 'publish' && e instanceof SkillCatalogError && e.code === 'incomplete_catalog' ? 'pub_help_blocked' : explain(e, true), true)
    } finally { locked.current = false; if (current()) setBusy(false) }
  }
  const retry = () => { if (!busy) { setReady(false); setNotice(null); setAttempt(n => n + 1) } }
  const skillName = (row: SkillRow) => row.labels[lang] ?? row.labels.es ?? row.labels.en ?? row.skillKey
  const terrName = (tid: string) => territories.find(item => item.id === tid)?.labels[lang] ?? tid
  const incomplete = detail?.skills.filter(skill => skill.missing.length > 0) ?? []
  const loadConflict = () => {
    if (conflict === null) { setConflict(undefined); navigate(`/admin/skill-catalog/${id}`); return }
    if (conflict) { const adopted = fromSkill(conflict); setForm(adopted); setBaseline(adopted); setRowStamp(conflict.updatedAt); setConflict(undefined); setFieldErrors({}); say('saved') }
  }
  const anchor = location.hash ? location.hash.slice(1) : ''
  useEffect(() => {
    if (!anchor || !ready) return
    const el = document.getElementById(anchor)
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }) }
  }, [anchor, ready, skillKey])
  useEffect(() => {
    if (conflict !== undefined) conflictRef.current?.focus()
  }, [conflict])
  useEffect(() => {
    if (inUse && inUse.length > 0) inUseRef.current?.focus()
  }, [inUse])
  const loadingOrRetry = <>{busy && <p role="status">{t('skcat.loading')}</p>}{!ready && !busy && <div className="pg-actions"><Button variant="ghost" onClick={retry}>{t('skcat.retry')}</Button></div>}</>

  // ── Versiones ────────────────────────────────────────────────
  if (!id) {
    const draft = versions.find(v => v.status === 'draft')
    return <Page title={t('skcat.title')}>
      <p className="pg-lead">{t('skcat.lead')}</p>
      <Notice text={text} error={notice?.error} />
      {loadingOrRetry}
      {ready && <>
        {versions.length === 0 ? <p>{t('skcat.none')}</p> : <Card as="section" className="pg-card"><DataTable caption={t('skcat.title')} rowKey={row => String(row.id)} rows={versions} columns={[
          { key: 'version', header: t('skcat.version'), render: row => row.version },
          { key: 'status', header: t('skcat.col_status'), render: row => <StatusChip status={row.status} label={t(`skcat.status_${row.status}`)} /> },
          { key: 'published', header: t('skcat.published_on'), render: row => row.publishedAt ? row.publishedAt.slice(0, 10) : '—' },
          { key: 'count', header: t('skcat.skills_count'), render: row => row.skillCount },
          { key: 'open', header: t('skcat.view'), render: row => <Button variant={row.status === 'draft' ? 'primary' : 'ghost'} disabled={busy} onClick={() => go(`/admin/skill-catalog/${row.id}`)}>{row.status === 'draft' ? t('skcat.open_draft') : t('skcat.view')}</Button> },
        ]} /></Card>}
        <div className="pg-actions"><Button variant={versions.length ? 'ghost' : 'primary'} disabled={busy || !!draft} aria-describedby={draft ? 'skcat-create-reason' : undefined} onClick={() => void run('create')}>{t(versions.length ? 'skcat.create' : 'skcat.create_first')}</Button></div>
        {draft && <p className="cg-hint" id="skcat-create-reason">{t('skcat.create_help_open')}</p>}
      </>}
    </Page>
  }

  // ── Habilidad ────────────────────────────────────────────────
  if (skillKey) {
    const row = detail?.skills.find(skill => skill.skillKey === skillKey)
    const key = creating ? newKey : skillKey
    const set = (patch: Partial<Form>) => { setForm(prev => ({ ...prev, ...patch })); setNotice(null) }
    const setLevel = (n: typeof LEVELS[number], lang2: 'es' | 'en', value: string) => set({ levels: { ...form.levels, [n]: { ...form.levels[n], [lang2]: value } } })
    const missing = (value: string) => !creating && editable && !value.trim()
    // «Obligatorio para publicar» se dice con palabras (no solo con color) y cuelga del campo.
    const req = (value: string) => missing(value) ? t('skcat.required_publish') : undefined
    const readOnly = !editable
    const levelBlock = (n: typeof LEVELS[number]) => <div className="pc-pair" key={n}>
      {(['es', 'en'] as const).map(code => {
        const value = form.levels[n][code]; const fid = `skcat-l${n}${code}`
        return <TextAreaField key={code} id={fid} label={`${fmt(t('skcat.f_level'), { n })} · ${code.toUpperCase()}`} value={value} disabled={readOnly} error={fieldErrors.level ? t('skcat.err_level') : req(value)} onChange={e => setLevel(n, code, e.target.value)} />
      })}
    </div>
    const moreFilled = LEVELS.slice(2).some(n => form.levels[n].es || form.levels[n].en)
    const focusMoreLevel = /^skcat-l[34](?:es|en)$/.test(anchor)
    const title = creating ? t('skcat.new_title') : `${t('skcat.skill_title')} · ${row ? skillName(row) : skillKey}`
    return <Page title={title}>
      <div className="pg-actions"><Button variant="ghost" disabled={busy} onClick={() => go(`/admin/skill-catalog/${id}`)}>{t('skcat.skill_back')}</Button></div>
      <Notice text={text} error={notice?.error} />
      {conflict !== undefined && <div className="pg-focus" role="alert" tabIndex={-1} ref={conflictRef}><Banner kind="error" title={t(conflict === null ? 'skcat.conflict_removed' : 'skcat.conflict_changed')}>
        <div className="pg-actions"><Button variant="ghost" onClick={loadConflict}>{t(conflict === null ? 'skcat.skill_back' : 'skcat.conflict_load')}</Button></div></Banner></div>}
      {loadingOrRetry}
      {ready && detail && <>
        {readOnly && <p className="cg-hint">{t('skcat.readonly_help')}</p>}
        <Card as="section" className="pg-card"><form onSubmit={e => { e.preventDefault(); void run('save') }} noValidate>
          <fieldset className="sk-lock" disabled={busy} aria-busy={busy}>
          <div className="pc-pair">
            <TextField id="skcat-key" label={t('skcat.f_key')} type="text" value={key} disabled={!creating || readOnly} autoComplete="off" spellCheck={false} hint={fieldErrors.key ? undefined : t('skcat.f_key_help')} error={fieldErrors.key ? t('skcat.err_key') : undefined} onChange={e => { setNewKey(e.target.value.toLowerCase()); setNotice(null) }} />
            <SelectField id="skcat-type" label={t('skcat.f_type')} value={form.type} disabled={readOnly} onChange={e => set({ type: e.target.value === 'domain' ? 'domain' : 'transversal' })}>
              <option value="transversal">{t('skcat.transversal')}</option><option value="domain">{t('skcat.domain')}</option>
            </SelectField>
            {([['es', 'labelEs'], ['en', 'labelEn']] as const).map(([code, field]) => {
              const value = form[field]; const bad = code === 'es' ? fieldErrors.label_es : fieldErrors.label_en
              return <TextField key={code} id={`skcat-label-${code}`} label={t(`skcat.f_label_${code}`)} type="text" value={value} disabled={readOnly} error={bad ? t('skcat.err_label') : req(value)} onChange={e => set({ [field]: e.target.value } as Partial<Form>)} />
            })}
          </div>
          <h2 className="sk-h2">{t('skcat.f_levels')}</h2>
          <p className="cg-hint">{t('skcat.rubric_note')}</p>
          {(['1', '2'] as const).map(levelBlock)}
          <details className="pc-details" open={moreFilled || !!fieldErrors.level || focusMoreLevel}><summary>{t('skcat.f_more_levels')}</summary>{(['3', '4'] as const).map(levelBlock)}</details>
          <div className="pc-pair">
            {([['source', 'f_source', 'source'], ['verifiedBy', 'f_verified_by', 'verified_by']] as const).map(([field, label, errKey]) => {
              const value = form[field]; const bad = fieldErrors[errKey]
              return <TextField key={field} id={`skcat-${field}`} label={t(`skcat.${label}`)} type="text" value={value} disabled={readOnly} error={bad ? t('skcat.err_text') : req(value)} onChange={e => set({ [field]: e.target.value } as Partial<Form>)} />
            })}
            <TextField id="skcat-date" label={t('skcat.f_verified_at')} type="date" value={form.verifiedAt} disabled={readOnly} error={fieldErrors.verified_at ? t('skcat.err_date') : req(form.verifiedAt)} onChange={e => set({ verifiedAt: e.target.value })} />
          </div>
          <fieldset className="cg-field" disabled={readOnly}>
            <legend className="cg-label">{t('skcat.f_territories')}</legend>
            <p className="cg-hint">{t('skcat.f_territories_help')}</p>
            {territories.map(item => <CheckField key={item.id} checked={form.territories.includes(item.id)} onChange={e => set({ territories: e.target.checked ? [...form.territories, item.id] : form.territories.filter(x => x !== item.id) })} label={item.labels[lang]} />)}
          </fieldset>
          {editable && <div className="pg-actions sk-actions">
            {!creating && <Button variant="danger" disabled={busy} onClick={() => setConfirmRemove(true)}>{t('skcat.remove')}</Button>}
            <Button variant="ghost" disabled={busy} onClick={() => go(`/admin/skill-catalog/${id}`)}>{t('skcat.cancel')}</Button>
            <Button type="submit" disabled={busy || (!dirty && !creating)}>{busy ? t('skcat.saving') : t('skcat.save')}</Button>
          </div>}
          </fieldset>
        </form></Card>
      </>}
      <Dialog open={confirmRemove} onClose={() => setConfirmRemove(false)} title={fmt(t('skcat.rm_title'), { name: row ? skillName(row) : skillKey })}
        actions={<><Button variant="ghost" onClick={() => setConfirmRemove(false)}>{t('skcat.cancel')}</Button><Button variant="danger" disabled={busy} onClick={() => void run('remove')}>{t('skcat.rm_yes')}</Button></>}><p>{t('skcat.rm_body')}</p></Dialog>
    </Page>
  }

  // ── Versión: borrador editable o consulta ────────────────────
  const empty = detail?.skills.length === 0
  return <Page title={detail ? `${t('skcat.version')} ${detail.version}` : t('skcat.title')} chip={detail ? <StatusChip status={detail.status} label={t(`skcat.status_${detail.status}`)} /> : undefined}>
    <div className="pg-actions"><Button variant="ghost" disabled={busy} onClick={() => go('/admin/skill-catalog')}>{t('skcat.versions_back')}</Button></div>
    <Notice text={text} error={notice?.error} />
    {loadingOrRetry}
    {ready && detail && !showPublish && <>
      <p className="pg-lead">{t(editable ? 'skcat.draft_help' : 'skcat.readonly_help')}</p>
      {editable && <div className="pg-actions">
        <Button variant="ghost" disabled={busy} onClick={() => go(`/admin/skill-catalog/${id}/skills/new`)}>{t('skcat.add')}</Button>
        <Button disabled={busy} onClick={() => { setNotice(null); setShowPublish(true) }}>{t('skcat.publish_btn')}</Button>
      </div>}
      {editable && !empty && <p className="cg-hint" role="status">{incomplete.length ? fmt(t('skcat.missing_summary'), { n: incomplete.length }) : t('skcat.missing_ok')}</p>}
      {empty ? <p>{t('skcat.empty_skills')}</p> : <Card as="section" className="pg-card"><DataTable caption={t('skcat.title')} rowKey={skill => skill.skillKey} rows={detail.skills} columns={[
        { key: 'skill', header: t('skcat.col_skill'), render: skill => <strong>{skillName(skill)}</strong> },
        { key: 'key', header: t('skcat.col_key'), render: skill => <code>{skill.skillKey}</code> },
        { key: 'type', header: t('skcat.col_type'), render: skill => t(`skcat.${skill.type}`) },
        { key: 'territories', header: t('skcat.col_territories'), render: skill => (skill.territories.length ? <span className="sk-chips">{skill.territories.map(tid => <Chip key={tid}>{terrName(tid)}</Chip>)}</span> : <span className="cg-hint">{t('skcat.no_territory')}</span>) },
        { key: 'status', header: t('skcat.col_status'), render: skill => (skill.missing.length ? <Chip tone="bad" symbol="!">{fmt(t('skcat.status_missing'), { n: skill.missing.length })}</Chip> : <Chip tone="ok" symbol="✓">{t('skcat.status_complete')}</Chip>) },
        { key: 'edit', header: t('skcat.edit'), render: skill => <Button variant="ghost" disabled={busy} onClick={() => go(`/admin/skill-catalog/${id}/skills/${skill.skillKey}`)}>{editable ? t('skcat.edit') : t('skcat.view')}</Button> },
      ]} /></Card>}
    </>}
    {ready && detail && showPublish && <Card as="section" className="pg-card">
      <h2>{fmt(t('skcat.pub_title'), { n: detail.version })}</h2>
      <p>{t('skcat.pub_effect')}</p>
      {empty ? <p role="alert">{t('skcat.pub_empty')}</p> : incomplete.length > 0 ? <><h3>{t('skcat.pub_missing')}</h3>
        <ul>{incomplete.map(skill => <li key={skill.skillKey}><strong>{skillName(skill)}</strong>: {skill.missing.map(path => { const m = missingLabel(path); const label = fmt(t(`skcat.${m.key}`), { level: m.level ?? '', lang: m.lang ?? '' }); return <a key={path} className="cg-linkbtn" href={`/admin/skill-catalog/${id}/skills/${skill.skillKey}#${missingFieldAnchor(path)}`} onClick={e => { e.preventDefault(); navigate(`/admin/skill-catalog/${id}/skills/${skill.skillKey}#${missingFieldAnchor(path)}`) }}>{label}</a> }).reduce((acc: ReactNode[], el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}</li>)}</ul>
        <p className="cg-hint" role="status">{t('skcat.pub_help_blocked')}</p></> : <p role="status">{t('skcat.missing_ok')}</p>}
      {inUse && inUse.length > 0 && <div className="pg-focus" role="alert" tabIndex={-1} ref={inUseRef}><Banner kind="error" title={t('skcat.pub_in_use')}>
        <ul>{inUse.map(entry => <li key={entry.skillKey}><code>{entry.skillKey}</code> — {fmt(t('skcat.in_use_people'), { n: entry.people })}</li>)}</ul></Banner></div>}
      <div className="pg-actions">
        <Button variant="ghost" disabled={busy} onClick={() => setShowPublish(false)}>{t('skcat.pub_back')}</Button>
        <Button disabled={busy || empty || incomplete.length > 0} onClick={() => void run('publish')}>{fmt(t('skcat.pub_now'), { n: detail.version })}</Button>
      </div>
    </Card>}
  </Page>
}
