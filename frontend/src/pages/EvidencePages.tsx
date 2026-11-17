import '../evidence/register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { evidenceApi, EvidenceError, type CreateBody, type UpdateBody } from '../evidence/api'
import { OriginBlock } from '../evidence/ResumeOrigin'
import { formatDate, resumeSkillsApi, selectable } from '../evidence/resumeSkills'
import { blankDraft, draftFromPayload, draftPayload, type Draft, type Payload, type Evidence, type Detail } from '../evidence/model'
import { EvidenceShell } from '../evidence/Shell'
import { Banner, Button, Card, CheckField, Chip, Dialog, ScaleField } from '../cartografia'
import { Notice } from '../space/PersonScreen'
import { EvidenceContent } from '../evidence/EvidenceContent'
import { EvidenceFormFields } from '../evidence/FormFields'
import { registerEvidenceGuard } from '../evidence/navigationGuard'
import { readEvidenceToken, useEvidenceToken } from '../evidence/session'

const backend = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const statusOf = (error: unknown) => error instanceof EvidenceError ? error.status : 503
function ReadError({ status, retry }: { status: number; retry?: () => void }) {
  const { t } = useLanguage()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.focus() }, [status])
  return <div tabIndex={-1} ref={ref} className="pg-focus">
    <Banner kind="error" title={t(`evidence.${status === 401 ? 'expired' : status === 403 ? 'forbidden' : status === 404 ? 'not_found' : 'load_error'}`)}>
      <div className="pg-actions">{status === 401 ? <Link className="cg-btn" to="/login">{t('evidence.signin')}</Link> : retry && <Button variant="ghost" onClick={retry}>{t('evidence.retry')}</Button>}</div>
    </Banner>
  </div>
}
function Metadata({ row }: { row: Evidence }) {
  const { t, lang } = useLanguage()
  return <div className="pg-meta-list"><div className="pg-chips">{row.status === 'confirmed' ? <Chip tone="ok" symbol="✓">{t(`evidence.${row.status}`)}</Chip> : <Chip symbol="○">{t(`evidence.${row.status}`)}</Chip>}</div>
    <p className="cg-hint">{t('evidence.version')}: {row.version} · <time dateTime={row.createdAt}>{formatDate(row.createdAt, lang)}</time></p>
    <p className="cg-hint">{t('evidence.authoring')}: {t(`evidence.${row.authoring}`)}</p>
  </div>
}
export function EvidenceListPage() {
  const { t } = useLanguage(); const token = useEvidenceToken(); const location = useLocation()
  const api = useMemo(() => evidenceApi(backend, token), [token])
  const [state, setState] = useState<{ rows?: Evidence[]; token?: string; error?: number }>({})
  const [attempt, setAttempt] = useState(0)
  const [toReview, setToReview] = useState(0) // ES-110: habilidades de la hoja de vida que la persona aún no ha decidido
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [deleteError, setDeleteError] = useState(false)
  const [filter, setFilter] = useState<'all' | 'draft' | 'confirmed'>('all')
  const [focusAll, setFocusAll] = useState(false); const filterBox = useRef<HTMLDivElement>(null)
  const added = Number((location.state as { added?: unknown } | null)?.added) || 0
  useEffect(() => {
    const controller = new AbortController()
    void api.list(controller.signal).then(rows => { if (!controller.signal.aborted && token === readEvidenceToken()) setState({ rows, token }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ error: statusOf(error), token }) })
    return () => controller.abort()
  }, [api, attempt, token])
  useEffect(() => {
    const controller = new AbortController()
    void resumeSkillsApi(backend, token).list(controller.signal).then(list => { if (!controller.signal.aborted) setToReview(list.filter(selectable).length) }).catch(() => { if (!controller.signal.aborted) setToReview(0) })
    return () => controller.abort()
  }, [token, attempt])
  useEffect(() => { if (focusAll) { filterBox.current?.querySelector<HTMLInputElement>('input[value="all"]')?.focus(); setFocusAll(false) } }, [focusAll, filter]) // ES-235: «Ver todas» desaparece al usarse; el foco pasa al radio «Todas»
  const retry = () => { setState({}); setAttempt(v => v + 1) }
  const same = state.token === token && token === readEvidenceToken()
  const ask = (id: number) => { setConfirmId(id); setDeleteError(false); setNotice('') }
  const cancel = () => { if (busy) return; setConfirmId(null) } // ES-308: el <Dialog> de Cartografía devuelve el foco a quien abrió la confirmación (y atrapa Tab, cierra con Esc)
  async function remove(id: number) {
    setBusy(true); setDeleteError(false)
    try { await api.remove(id); setConfirmId(null); setNotice(t('evidence.deleted_live')); setAttempt(v => v + 1) } catch { setDeleteError(true) } finally { setBusy(false) }
  }
  const shown = state.rows ? state.rows.filter(row => filter === 'all' || row.status === filter) : []
  const asking = state.rows?.find(row => row.id === confirmId)
  return <EvidenceShell title={t('evidence.title')} lead={t('evidence.intro')}>
    <div className="pg-actions"><Link className="cg-btn" to="/app/evidence/new">{t('evidence.new')}</Link></div>
    {added > 0 && <Notice text={t('evidence.rs_added_ok').replace('{n}', String(added))}><small className="cg-hint pg-block">{t('evidence.rs_added_help')}</small></Notice>}
    <Notice text={notice} />
    {toReview > 0 && <Banner title={t('evidence.rs_banner_title')}><p>{t('evidence.rs_banner_body')}</p>
      <div className="pg-actions"><Link className="cg-btn" to="/app/evidence/resume-skills">{t('evidence.rs_banner_cta')}</Link></div></Banner>}
    {!token || token !== readEvidenceToken() ? <ReadError status={401} /> : same && state.error ? <ReadError status={state.error} retry={retry} />
      : same && state.rows ? state.rows.length ? <>
      <div ref={filterBox}><ScaleField legend={t('evidence.filter_status')} name="evidence-status" value={filter} onChange={value => setFilter(value as typeof filter)}
        options={(['all', 'draft', 'confirmed'] as const).map(value => ({ value, label: t(value === 'all' ? 'evidence.filter_all' : 'evidence.' + value) }))} /></div>
      <p role="status" aria-live="polite" className="pg-count">{shown.length === 1 ? t('evidence.filter_count_one') : t('evidence.filter_count').replace('{n}', String(shown.length))}</p>
      {shown.length ? <div className="pg-grid">
        {shown.map(row => <Card as="article" className={'pg-card' + (row.origin?.needsReview ? ' pg-card-review' : '')} key={row.id}>
          <h2>{row.payload.title}</h2><Metadata row={row} /><OriginBlock row={row} />
          <p><strong>{t('evidence.goal')}: </strong>{row.payload.goal || t('evidence.not_indicated')}</p>
          <p><strong>{t('evidence.delivered')}: </strong>{row.payload.delivered?.text || t('evidence.not_indicated')}</p>
          <p><strong>{t('evidence.observedEffect')}: </strong>{row.payload.observedEffect ? row.payload.observedEffect.known ? row.payload.observedEffect.claim.text : t('evidence.unknown') : t('evidence.not_indicated')}</p>
          {row.origin && row.payload.artifactRefs?.[0]?.kind === 'text' && <blockquote className="pg-quote">{row.payload.artifactRefs[0].excerpt}</blockquote>}
          <div className="pg-actions">
            <Link className="cg-linkbtn" to={'/app/evidence/' + row.id}>{t('evidence.detail')}</Link>
            {!row.fromChat && <Link className="cg-btn" aria-label={t('evidence.action_edit') + ': ' + row.payload.title} to={'/app/evidence/' + row.id + '/edit'}>{t('evidence.action_edit')}</Link>}
            <Button variant="ghost" disabled={busy} aria-label={t('evidence.action_delete') + ': ' + row.payload.title} onClick={() => ask(row.id)}>{t('evidence.action_delete')}</Button>
          </div>
        </Card>)}
      </div> : <p>{t('evidence.filter_none')} <button type="button" className="cg-linkbtn" onClick={() => { setFilter('all'); setFocusAll(true) }}>{t('evidence.filter_show_all')}</button></p>}</> : <p role="status">{t('evidence.empty')}</p> : <p className="cg-hint" role="status">{t('evidence.loading')}</p>}
    {/* Fuera de la lista: el diálogo sigue montado mientras se recarga tras borrar. */}
    <Dialog open={confirmId !== null} onClose={cancel} title={t('evidence.delete_title')}
      actions={<>
        <Button variant="ghost" disabled={busy} onClick={cancel}>{t('evidence.delete_cancel')}</Button>
        <Button variant="danger" disabled={busy} onClick={() => { if (confirmId !== null) void remove(confirmId) }}>{t('evidence.delete_yes')}</Button>
      </>}>
      <div className="pg-dialog">{asking && <p><strong>{asking.payload.title}</strong></p>}<p>{t('evidence.delete_body')}</p>
        {deleteError && <p role="alert" className="cg-error">{t('evidence.delete_error')}</p>}</div>
    </Dialog>
  </EvidenceShell>
}
export function EvidenceDetailPage() {
  const { id: rawId } = useParams(); const id = rawId && /^[1-9]\d{0,8}$/.test(rawId) ? Number(rawId) : 0
  const { t, lang } = useLanguage(); const token = useEvidenceToken()
  const api = useMemo(() => evidenceApi(backend, token), [token])
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ data?: Detail; token?: string; id?: number; error?: number }>({})
  useEffect(() => {
    const controller = new AbortController()
    void api.detail(id, controller.signal).then(data => { if (!controller.signal.aborted && token === readEvidenceToken()) setState({ data, token, id }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ error: statusOf(error), token, id }) })
    return () => controller.abort()
  }, [api, id, token, attempt])
  const same = state.token === token && token === readEvidenceToken() && state.id === id
  const data = same ? state.data : undefined
  return <EvidenceShell title={t('evidence.detail')}>
    {!token || token !== readEvidenceToken() ? <ReadError status={401} /> : same && state.error ? <ReadError status={state.error} retry={() => { setState({}); setAttempt(v => v + 1) }} />
      : data ? <>
        {data.versions[0].fromChat ? <Banner title={t('evidence.edit_chat_only')} />
          : <div className="pg-actions"><Link className="cg-btn" to={'/app/evidence/' + data.id + '/edit'}>{t('evidence.action_edit')}</Link></div>}
        <Card as="article" className="pg-card"><h2>{t('evidence.current')}</h2>
          <Metadata row={data.versions[0]} /><OriginBlock row={data.versions[0]} /><EvidenceContent payload={data.versions[0].payload} />
        </Card>
        {data.versions.length > 1 && <details className="pg-details"><summary>{t('evidence.history')}</summary>
          {data.versions.slice(1).map(row => <section className="pg-history" key={row.version}><h2>{t('evidence.previous')}: {row.version}</h2>
            <p>{t(`evidence.${row.status}`)} · <time dateTime={row.createdAt}>{formatDate(row.createdAt, lang)}</time></p><EvidenceContent payload={row.payload} />
          </section>)}
        </details>}
      </> : <p className="cg-hint" role="status">{t('evidence.loading')}</p>}
  </EvidenceShell>
}
type Pending = { body: CreateBody | UpdateBody; ack?: { id: number; version: number } }
// ES-110: `edit` lleva la evidencia a editar (cada guardado crea una versión nueva y el servidor conserva su origen).
type EditTarget = { id: number; baseVersion: number; draft: Draft }
function EvidenceEditor({ token, edit }: { token: string; edit?: EditTarget }) {
  const { t } = useLanguage(); const l = (key: string) => t(`evidence.${key}`)
  const api = useMemo(() => evidenceApi(backend, token), [token])
  const initial = useMemo(() => edit?.draft ?? blankDraft(), [edit])
  const [draft, setDraft] = useState<Draft>(initial)
  const [phase, setPhase] = useState<'editing' | 'review' | 'saving' | 'uncertain' | 'saved'>('editing')
  const [preview, setPreview] = useState<Payload | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [saved, setSaved] = useState<{ row: Evidence; current: boolean } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [authError, setAuthError] = useState(0)
  const ref = useRef<HTMLDivElement>(null); const heading = useRef<HTMLHeadingElement>(null); const alive = useRef(true)
  const dirty = phase !== 'saved' && JSON.stringify(draft) !== JSON.stringify(initial)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => { if (message) ref.current?.focus() }, [message, errors])
  useEffect(() => { if (phase === 'review' || phase === 'saved') heading.current?.focus() }, [phase])
  useEffect(() => {
    if (!dirty) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', unload)
    const unregister = registerEvidenceGuard(() => phase === 'saving' || !window.confirm(l('leave')))
    return () => { window.removeEventListener('beforeunload', unload); unregister() }
  })
  const onLeave = (event: MouseEvent<HTMLAnchorElement>) => { if (phase === 'saving' || (dirty && !window.confirm(l('leave')))) event.preventDefault() }
  function change<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft(old => ({ ...old, [key]: value })); setErrors([]); setMessage(''); setReviewed(false) }
  const prepare = (status: 'draft' | 'confirmed') => {
    const result = draftPayload(draft, status)
    if (result.errors.length) { setErrors(result.errors); setMessage('invalid'); return null }
    return result.payload
  }
  const write = async (attempt: Pending) => {
    if (token !== readEvidenceToken()) { setAuthError(401); return }
    setPhase('saving'); setMessage(''); setPending(attempt)
    let ack = attempt.ack
    try {
      ack ??= edit ? await api.update(edit.id, attempt.body as UpdateBody) : await api.create(attempt.body)
      if (!alive.current || token !== readEvidenceToken()) return
      const withAck = { body: attempt.body, ack }; setPending(withAck)
      const detail = await api.detail(ack.id)
      if (!alive.current || token !== readEvidenceToken()) return
      const row = detail.versions.find(value => value.version === ack?.version)
      if (!row) throw new Error('Unverified version')
      setSaved({ row, current: detail.currentVersion === row.version }); setPhase('saved'); setPending(null)
    } catch (error) {
      if (!alive.current || token !== readEvidenceToken()) return
      if (error instanceof EvidenceError && [401, 403].includes(error.status)) { setPhase('uncertain'); setAuthError(error.status); return }
      if (!ack && error instanceof EvidenceError && [400, 422, 409].includes(error.status)) {
        setPhase('editing'); setPending(null); setErrors(error.fields); setMessage(error.status === 409 ? 'conflict' : 'invalid')
      } else {
        setPending({ body: attempt.body, ...(ack ? { ack } : {}) }); setPhase('uncertain'); setMessage(ack ? 'uncertain' : 'uncertain_write')
      }
    }
  }
  const bodyFor = (payload: Payload, status: 'draft' | 'confirmed'): CreateBody | UpdateBody => edit ? { payload, status, requestId: crypto.randomUUID(), baseVersion: edit.baseVersion } : { payload, status, requestId: crypto.randomUUID() }
  const saveDraft = () => { const payload = prepare('draft'); if (payload) void write({ body: bodyFor(payload, 'draft') }) }
  const review = () => { const payload = prepare('confirmed'); if (payload) { setPreview(payload); setReviewed(false); setMessage(''); setPhase('review') } }
  return <EvidenceShell title={l(edit ? 'edit_title' : 'new')} lead={l('privacy')} onLeave={onLeave}>
    {!token || token !== readEvidenceToken() || authError ? <ReadError status={authError || 401} /> : <div className="pg-editor">
      {edit && <p className="cg-hint">{l('edit_new_version')}</p>}
      {message && <div ref={ref} tabIndex={-1} className="pg-focus"><Banner kind="error" title={l(message)}>
        {errors.length > 0 && <ul>{errors.map(key => <li key={key}>{key === 'draft_minimum' ? l(key) : <a href={`#${key}`} className="cg-linkbtn">{l(key === 'title' ? 'field_title' : key)}</a>}</li>)}</ul>}
      </Banner></div>}
      {phase === 'editing' && <form noValidate onSubmit={event => { event.preventDefault(); review() }}>
        <Card className="pg-card pg-form"><EvidenceFormFields draft={draft} change={change} errors={errors} />
          <p role="status" className="cg-hint">{dirty ? l('unsaved') : l('privacy')}</p><div className="pg-actions">
            <Button variant="ghost" onClick={saveDraft}>{l('save')}</Button><Button type="submit">{l('review')}</Button>
          </div>
        </Card>
      </form>}
      {phase === 'review' && preview && <Card className="pg-card">
        <h2 ref={heading} tabIndex={-1}>{l('review')}</h2><p>{l('review_effect')}</p><Banner title={l('warning')} /><EvidenceContent payload={preview} />
        <CheckField label={l('reviewed')} checked={reviewed} onChange={event => setReviewed(event.target.checked)} />
        <div className="pg-actions"><Button variant="ghost" onClick={() => setPhase('editing')}>{l('edit')}</Button>
          <Button disabled={!reviewed} onClick={() => { if (reviewed) void write({ body: bodyFor(preview, 'confirmed') }) }}>{l('confirm')}</Button>
        </div>
      </Card>}
      {(phase === 'saving' || phase === 'uncertain') && pending && <Card className="pg-card">
        {phase === 'saving' && <p role="status">{l('saving')}</p>}<EvidenceContent payload={pending.body.payload} />
        {phase === 'uncertain' && <div className="pg-actions"><Button onClick={() => void write(pending)}>{l('retry')}</Button></div>}
      </Card>}
      {phase === 'saved' && saved && <Card className="pg-card">
        <div role="status"><h2 ref={heading} tabIndex={-1}>{l(saved.current && saved.row.status === 'confirmed' ? 'confirmed_saved' : saved.current && saved.row.status === 'draft' ? 'draft_saved' : 'saved_version')}</h2></div>
        <Metadata row={saved.row} /><EvidenceContent payload={saved.row.payload} /><p><Link className="cg-linkbtn" to={`/app/evidence/${saved.row.id}`}>{l('detail')}</Link></p>
      </Card>}
    </div>}
  </EvidenceShell>
}
export function EvidenceCreatePage() { const token = useEvidenceToken(); return <EvidenceEditor key={token} token={token} /> }

// ES-110: editar una evidencia guardada (la procedencia «hoja de vida» no se pierde: la conserva el servidor).
export function EvidenceEditPage() {
  const { id: rawId } = useParams(); const id = rawId && /^[1-9]\d{0,8}$/.test(rawId) ? Number(rawId) : 0
  const { t } = useLanguage(); const token = useEvidenceToken()
  const api = useMemo(() => evidenceApi(backend, token), [token])
  const [state, setState] = useState<{ detail?: Detail; error?: number; id?: number }>({})
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void api.detail(id, controller.signal).then(detail => { if (!controller.signal.aborted) setState({ detail, id }) }).catch((error: unknown) => { if (!controller.signal.aborted) setState({ error: statusOf(error), id }) })
    return () => controller.abort()
  }, [api, id, attempt])
  const detail = state.id === id ? state.detail : undefined
  const current = detail?.versions[0]
  const target = useMemo(() => (detail && current ? { id: detail.id, baseVersion: detail.currentVersion, draft: draftFromPayload(current.payload) } : undefined), [detail, current])
  if (!token || token !== readEvidenceToken()) return <EvidenceShell title={t('evidence.edit_title')}><ReadError status={401} /></EvidenceShell>
  if (state.id === id && state.error) return <EvidenceShell title={t('evidence.edit_title')}><ReadError status={state.error} retry={() => { setState({}); setAttempt(v => v + 1) }} /></EvidenceShell>
  if (!target || !current) return <EvidenceShell title={t('evidence.edit_title')}><p className="cg-hint" role="status">{t('evidence.loading')}</p></EvidenceShell>
  if (current.fromChat) return <EvidenceShell title={t('evidence.edit_title')}><Banner title={t('evidence.edit_chat_only')} /><p><Link className="cg-linkbtn" to={'/app/evidence/' + id}>{t('evidence.detail')}</Link></p></EvidenceShell>
  return <EvidenceEditor key={id + '-' + target.baseVersion} token={token} edit={target} />
}
