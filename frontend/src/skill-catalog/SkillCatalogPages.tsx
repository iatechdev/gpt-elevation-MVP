import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { registerCatalogGuard } from '../catalogGuard'
import { useLanguage } from '../i18n/useLanguage'
import { territories } from '../skill-map/territories'
import { skillCatalogApi, SkillCatalogError, type Descriptor, type Detail, type SkillRow } from './api'
import { emptyForm, fromSkill, isDirty, KEY_RE, LEVELS, missingLabel, toBody, validate, type FieldError, type Form } from './model'
import './skillCatalog.css'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const readSession = () => { try { return JSON.stringify([localStorage.getItem('elevation_token') ?? '', localStorage.getItem('elevation_role') ?? '']) } catch { return '["",""]' } }
const fmt = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
function useSession() {
  const [session, setSession] = useState(readSession)
  useEffect(() => {
    const update = () => setSession(readSession())
    window.addEventListener('storage', update); window.addEventListener('focus', update)
    return () => { window.removeEventListener('storage', update); window.removeEventListener('focus', update) }
  }, [])
  return session
}
function Shell({ go, children }: { go?: (path: string) => void; children: ReactNode }) {
  const { t, lang, setLang } = useLanguage(); const navigate = useNavigate()
  return <div className="skcat-scope elv-theme">
    <a className="skcat-skip" href="#skcat-main">{t('skcat.skip')}</a>
    <header className="skcat-header">
      <button type="button" className="elv-btn" onClick={() => (go ?? navigate)('/admin/dashboard')}>{t('skcat.back')}</button>
      <div className="skcat-lang" role="group" aria-label="Idioma / Language">
        {(['es', 'en'] as const).map(code => <button key={code} type="button" className="elv-btn" aria-pressed={lang === code} onClick={() => setLang(code)}>{code.toUpperCase()}</button>)}
      </div>
    </header>
    <main id="skcat-main" tabIndex={-1} className="skcat-main">{children}</main>
  </div>
}
function Notice({ text, error = false }: { text: string; error?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (text) ref.current?.focus() }, [text])
  return text ? <div ref={ref} tabIndex={-1} role={error ? 'alert' : 'status'} className={error ? 'skcat-error' : 'skcat-notice'}>{text}</div> : null
}
export function SkillCatalogManager() {
  const session = useSession(); const location = useLocation(); const params = useParams(); const { t } = useLanguage()
  const [token, role] = JSON.parse(session) as string[]
  if ((params.id && !/^[1-9][0-9]{0,8}$/.test(params.id)) || (params.skillKey && params.skillKey !== 'new' && !KEY_RE.test(params.skillKey))) return <Shell><Notice error text={t('skcat.e_notfound')} /></Shell>
  return token && ['admin', 'superadmin'].includes(role) ? <ManagerSession key={session + location.pathname + location.search} session={session} /> : <Navigate to="/login" replace />
}

type Notice = { key: string; error: boolean; params?: Record<string, string | number> }
function ManagerSession({ session }: { session: string }) {
  const { t, lang } = useLanguage(); const params = useParams(); const navigate = useNavigate()
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
  const locked = useRef(false); const initialized = useRef(false); const dialog = useRef<HTMLDialogElement>(null)
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
          if (!initialized.current) { const initial = fromSkill(row); setForm(initial); setBaseline(initial); initialized.current = true }
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
    return () => { window.removeEventListener('beforeunload', unload); unregister() }
  }, [dirty, busy, t])
  useEffect(() => { if (confirmRemove) dialog.current?.showModal(); else if (dialog.current?.open) dialog.current.close() }, [confirmRemove])

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
        await api.save(id, key, toBody(form))
        if (!current()) return
        if (creating) { navigate(`/admin/skill-catalog/${id}`); return }
        const refreshed = await refresh(); const row = refreshed.skills.find(skill => skill.skillKey === key)
        if (row) { const persisted = fromSkill(row); setForm(persisted); setBaseline(persisted) }
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
      if (action === 'publish' && e instanceof SkillCatalogError && e.code === 'incomplete_catalog') { try { await refresh() } catch { /* se muestra el aviso genérico */ } }
      say(action === 'publish' && e instanceof SkillCatalogError && e.code === 'incomplete_catalog' ? 'pub_help_blocked' : explain(e, true), true)
    } finally { locked.current = false; if (current()) setBusy(false) }
  }
  const retry = () => { if (!busy) { setReady(false); setNotice(null); setAttempt(n => n + 1) } }
  const skillName = (row: SkillRow) => row.labels[lang] ?? row.labels.es ?? row.labels.en ?? row.skillKey
  const terrName = (tid: string) => territories.find(item => item.id === tid)?.labels[lang] ?? tid
  const incomplete = detail?.skills.filter(skill => skill.missing.length > 0) ?? []

  // ── Versiones ────────────────────────────────────────────────
  if (!id) {
    const draft = versions.find(v => v.status === 'draft')
    return <Shell go={go}>
      <h1>{t('skcat.title')}</h1><p className="skcat-lead">{t('skcat.lead')}</p>
      <Notice text={text} error={notice?.error} />
      {busy && <p role="status">{t('skcat.loading')}</p>}
      {!ready && !busy && <button type="button" className="elv-btn" onClick={retry}>{t('skcat.retry')}</button>}
      {ready && <>
        {versions.length === 0 ? <p>{t('skcat.none')}</p> : <div className="skcat-card"><table className="skcat-table"><thead><tr>
          <th>{t('skcat.version')}</th><th>{t('skcat.col_status')}</th><th>{t('skcat.published_on')}</th><th>{t('skcat.skills_count')}</th><th><span className="skcat-sr">{t('skcat.view')}</span></th></tr></thead><tbody>
          {versions.map(row => <tr key={row.id}>
            <td data-label={t('skcat.version')}>{row.version}</td>
            <td data-label={t('skcat.col_status')}><span className={`skcat-badge is-${row.status}`}>{t(`skcat.status_${row.status}`)}</span></td>
            <td data-label={t('skcat.published_on')}>{row.publishedAt ? row.publishedAt.slice(0, 10) : '—'}</td>
            <td data-label={t('skcat.skills_count')}>{row.skillCount}</td>
            <td><button type="button" className={`elv-btn${row.status === 'draft' ? ' skcat-primary' : ''}`} disabled={busy} onClick={() => go(`/admin/skill-catalog/${row.id}`)}>{row.status === 'draft' ? t('skcat.open_draft') : t('skcat.view')}</button></td>
          </tr>)}</tbody></table></div>}
        <button type="button" className={`elv-btn${versions.length ? '' : ' skcat-primary'}`} disabled={busy || !!draft} onClick={() => void run('create')}>{t(versions.length ? 'skcat.create' : 'skcat.create_first')}</button>
        {draft && <p className="skcat-help">{t('skcat.create_help_open')}</p>}
      </>}
    </Shell>
  }

  // ── Habilidad ────────────────────────────────────────────────
  if (skillKey) {
    const row = detail?.skills.find(skill => skill.skillKey === skillKey)
    const key = creating ? newKey : skillKey
    const set = (patch: Partial<Form>) => { setForm(prev => ({ ...prev, ...patch })); setNotice(null) }
    const setLevel = (n: typeof LEVELS[number], lang2: 'es' | 'en', value: string) => set({ levels: { ...form.levels, [n]: { ...form.levels[n], [lang2]: value } } })
    const missing = (value: string) => !creating && editable && !value.trim()
    const req = (value: string, id2: string) => missing(value) ? <p className="skcat-help is-missing" id={id2}>{t('skcat.required_publish')}</p> : null
    const readOnly = !editable
    const levelBlock = (n: typeof LEVELS[number]) => <div className="skcat-grid2" key={n}>
      {(['es', 'en'] as const).map(code => {
        const value = form.levels[n][code]; const fid = `skcat-l${n}${code}`
        return <div key={code} className={missing(value) || fieldErrors.level ? 'skcat-field is-missing' : 'skcat-field'}>
          <label htmlFor={fid}>{fmt(t('skcat.f_level'), { n })} · {code.toUpperCase()}</label>
          <textarea id={fid} value={value} disabled={readOnly} aria-describedby={`${fid}-h`} onChange={e => setLevel(n, code, e.target.value)} />
          {fieldErrors.level ? <p className="skcat-help is-missing" id={`${fid}-h`} role="alert">{t('skcat.err_level')}</p> : req(value, `${fid}-h`)}
        </div>
      })}
    </div>
    const moreFilled = LEVELS.slice(2).some(n => form.levels[n].es || form.levels[n].en)
    return <Shell go={go}>
      <button type="button" className="elv-btn" disabled={busy} onClick={() => go(`/admin/skill-catalog/${id}`)}>{t('skcat.skill_back')}</button>
      <h1>{creating ? t('skcat.new_title') : `${t('skcat.skill_title')} · ${row ? skillName(row) : skillKey}`}</h1>
      <Notice text={text} error={notice?.error} />
      {busy && !ready && <p role="status">{t('skcat.loading')}</p>}
      {!ready && !busy && <button type="button" className="elv-btn" onClick={retry}>{t('skcat.retry')}</button>}
      {ready && detail && <>
        {readOnly && <p className="skcat-help">{t('skcat.readonly_help')}</p>}
        <form className="skcat-card" onSubmit={e => { e.preventDefault(); void run('save') }} noValidate>
          <fieldset className="skcat-lock" disabled={busy} aria-busy={busy}>
          <div className="skcat-grid2">
            <div className={fieldErrors.key ? 'skcat-field is-missing' : 'skcat-field'}>
              <label htmlFor="skcat-key">{t('skcat.f_key')}</label>
              <input id="skcat-key" type="text" value={key} disabled={!creating || readOnly} autoComplete="off" spellCheck={false} aria-describedby="skcat-key-h" onChange={e => { setNewKey(e.target.value.toLowerCase()); setNotice(null) }} />
              <p className={`skcat-help${fieldErrors.key ? ' is-missing' : ''}`} id="skcat-key-h" role={fieldErrors.key ? 'alert' : undefined}>{fieldErrors.key ? t('skcat.err_key') : t('skcat.f_key_help')}</p>
            </div>
            <div className="skcat-field">
              <label htmlFor="skcat-type">{t('skcat.f_type')}</label>
              <select id="skcat-type" value={form.type} disabled={readOnly} onChange={e => set({ type: e.target.value === 'domain' ? 'domain' : 'transversal' })}>
                <option value="transversal">{t('skcat.transversal')}</option><option value="domain">{t('skcat.domain')}</option>
              </select>
            </div>
            {([['es', 'labelEs'], ['en', 'labelEn']] as const).map(([code, field]) => {
              const value = form[field]; const fid = `skcat-label-${code}`; const bad = code === 'es' ? fieldErrors.label_es : fieldErrors.label_en
              return <div key={code} className={missing(value) || bad ? 'skcat-field is-missing' : 'skcat-field'}>
                <label htmlFor={fid}>{t(`skcat.f_label_${code}`)}</label>
                <input id={fid} type="text" value={value} disabled={readOnly} aria-describedby={`${fid}-h`} onChange={e => set({ [field]: e.target.value } as Partial<Form>)} />
                {bad ? <p className="skcat-help is-missing" id={`${fid}-h`} role="alert">{t('skcat.err_label')}</p> : req(value, `${fid}-h`)}
              </div>
            })}
          </div>
          <h2>{t('skcat.f_levels')}</h2>
          {(['1', '2'] as const).map(levelBlock)}
          <details className="skcat-more" open={moreFilled || !!fieldErrors.level}><summary>{t('skcat.f_more_levels')}</summary>{(['3', '4'] as const).map(levelBlock)}</details>
          <div className="skcat-grid2">
            {([['source', 'f_source', 'source'], ['verifiedBy', 'f_verified_by', 'verified_by']] as const).map(([field, label, errKey]) => {
              const value = form[field]; const fid = `skcat-${field}`; const bad = fieldErrors[errKey]
              return <div key={field} className={missing(value) || bad ? 'skcat-field is-missing' : 'skcat-field'}>
                <label htmlFor={fid}>{t(`skcat.${label}`)}</label>
                <input id={fid} type="text" value={value} disabled={readOnly} aria-describedby={`${fid}-h`} onChange={e => set({ [field]: e.target.value } as Partial<Form>)} />
                {bad ? <p className="skcat-help is-missing" id={`${fid}-h`} role="alert">{t('skcat.err_text')}</p> : req(value, `${fid}-h`)}
              </div>
            })}
            <div className={missing(form.verifiedAt) || fieldErrors.verified_at ? 'skcat-field is-missing' : 'skcat-field'}>
              <label htmlFor="skcat-date">{t('skcat.f_verified_at')}</label>
              <input id="skcat-date" type="date" value={form.verifiedAt} disabled={readOnly} aria-describedby="skcat-date-h" onChange={e => set({ verifiedAt: e.target.value })} />
              {fieldErrors.verified_at ? <p className="skcat-help is-missing" id="skcat-date-h" role="alert">{t('skcat.err_date')}</p> : req(form.verifiedAt, 'skcat-date-h')}
            </div>
          </div>
          <fieldset className="skcat-territories" disabled={readOnly}>
            <legend>{t('skcat.f_territories')}</legend>
            <p className="skcat-help">{t('skcat.f_territories_help')}</p>
            {territories.map(item => <label className="skcat-check" key={item.id}>
              <input type="checkbox" checked={form.territories.includes(item.id)} onChange={e => set({ territories: e.target.checked ? [...form.territories, item.id] : form.territories.filter(x => x !== item.id) })} />
              {item.labels[lang]}
            </label>)}
          </fieldset>
          {editable && <div className="skcat-actions">
            {!creating ? <button type="button" className="elv-btn skcat-danger" disabled={busy} onClick={() => setConfirmRemove(true)}>{t('skcat.remove')}</button> : <span />}
            <div className="skcat-actions-end">
              <button type="button" className="elv-btn" disabled={busy} onClick={() => go(`/admin/skill-catalog/${id}`)}>{t('skcat.cancel')}</button>
              <button type="submit" className="elv-btn skcat-primary" disabled={busy || (!dirty && !creating)}>{busy ? t('skcat.saving') : t('skcat.save')}</button>
            </div>
          </div>}
          </fieldset>
        </form>
      </>}
      <dialog ref={dialog} className="skcat-dialog" aria-labelledby="skcat-rm-title" onClose={() => setConfirmRemove(false)}>
        <h2 id="skcat-rm-title">{fmt(t('skcat.rm_title'), { name: row ? skillName(row) : skillKey })}</h2><p>{t('skcat.rm_body')}</p>
        <div className="skcat-actions-end"><button type="button" className="elv-btn" autoFocus onClick={() => setConfirmRemove(false)}>{t('skcat.cancel')}</button>
          <button type="button" className="elv-btn skcat-danger" disabled={busy} onClick={() => void run('remove')}>{t('skcat.rm_yes')}</button></div>
      </dialog>
    </Shell>
  }

  // ── Versión: borrador editable o consulta ────────────────────
  const empty = detail?.skills.length === 0
  return <Shell go={go}>
    <button type="button" className="elv-btn" disabled={busy} onClick={() => go('/admin/skill-catalog')}>{t('skcat.versions_back')}</button>
    {detail && <h1>{t('skcat.version')} {detail.version} <span className={`skcat-badge is-${detail.status}`}>{t(`skcat.status_${detail.status}`)}</span></h1>}
    <Notice text={text} error={notice?.error} />
    {busy && <p role="status">{t('skcat.loading')}</p>}
    {!ready && !busy && <button type="button" className="elv-btn" onClick={retry}>{t('skcat.retry')}</button>}
    {ready && detail && !showPublish && <>
      <div className="skcat-actions">
        <p className="skcat-lead">{t(editable ? 'skcat.draft_help' : 'skcat.readonly_help')}</p>
        {editable && <div className="skcat-actions-end">
          <button type="button" className="elv-btn" disabled={busy} onClick={() => go(`/admin/skill-catalog/${id}/skills/new`)}>{t('skcat.add')}</button>
          <button type="button" className="elv-btn skcat-primary" disabled={busy} onClick={() => { setNotice(null); setShowPublish(true) }}>{t('skcat.publish_btn')}</button>
        </div>}
      </div>
      {editable && !empty && <p className="skcat-help" role="status">{incomplete.length ? fmt(t('skcat.missing_summary'), { n: incomplete.length }) : t('skcat.missing_ok')}</p>}
      {empty ? <p>{t('skcat.empty_skills')}</p> : <div className="skcat-card"><table className="skcat-table"><thead><tr>
        <th>{t('skcat.col_skill')}</th><th>{t('skcat.col_key')}</th><th>{t('skcat.col_type')}</th><th>{t('skcat.col_territories')}</th><th>{t('skcat.col_status')}</th><th><span className="skcat-sr">{t('skcat.edit')}</span></th></tr></thead><tbody>
        {detail.skills.map(skill => <tr key={skill.skillKey}>
          <td data-label={t('skcat.col_skill')}><strong>{skillName(skill)}</strong></td>
          <td data-label={t('skcat.col_key')}><code>{skill.skillKey}</code></td>
          <td data-label={t('skcat.col_type')}>{t(`skcat.${skill.type}`)}</td>
          <td data-label={t('skcat.col_territories')}>{skill.territories.length ? skill.territories.map(tid => <span className="skcat-chip" key={tid}>{terrName(tid)}</span>) : <span className="skcat-help">{t('skcat.no_territory')}</span>}</td>
          <td data-label={t('skcat.col_status')}>{skill.missing.length ? <span className="skcat-badge is-missing">{fmt(t('skcat.status_missing'), { n: skill.missing.length })}</span> : <span className="skcat-badge is-complete">{t('skcat.status_complete')}</span>}</td>
          <td><button type="button" className="elv-btn" disabled={busy} onClick={() => go(`/admin/skill-catalog/${id}/skills/${skill.skillKey}`)}>{editable ? t('skcat.edit') : t('skcat.view')}</button></td>
        </tr>)}</tbody></table></div>}
    </>}
    {ready && detail && showPublish && <section className="skcat-card" aria-labelledby="skcat-pub">
      <h2 id="skcat-pub">{fmt(t('skcat.pub_title'), { n: detail.version })}</h2>
      <p>{t('skcat.pub_effect')}</p>
      {empty ? <p role="alert">{t('skcat.pub_empty')}</p> : incomplete.length > 0 ? <><h3>{t('skcat.pub_missing')}</h3>
        <ul>{incomplete.map(skill => <li key={skill.skillKey}><strong>{skillName(skill)}</strong>: {skill.missing.map(path => { const m = missingLabel(path); return fmt(t(`skcat.${m.key}`), { level: m.level ?? '', lang: m.lang ?? '' }) }).join(', ')}</li>)}</ul>
        <p className="skcat-help" role="status">{t('skcat.pub_help_blocked')}</p></> : <p role="status">{t('skcat.missing_ok')}</p>}
      <div className="skcat-actions-end">
        <button type="button" className="elv-btn" disabled={busy} onClick={() => setShowPublish(false)}>{t('skcat.pub_back')}</button>
        <button type="button" className="elv-btn skcat-primary" disabled={busy || empty || incomplete.length > 0} onClick={() => void run('publish')}>{fmt(t('skcat.pub_now'), { n: detail.version })}</button>
      </div>
    </section>}
  </Shell>
}
