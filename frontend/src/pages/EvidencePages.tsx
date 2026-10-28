import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { evidenceApi, EvidenceError, type CreateBody } from '../evidence/api'
import { blankDraft, draftPayload, type Draft, type Payload, type Evidence, type Detail } from '../evidence/model'
import { EvidenceShell } from '../evidence/Shell'
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
  return <div role="alert" tabIndex={-1} ref={ref} className="evidence-error-box">
    <p>{t(`evidence.${status === 401 ? 'expired' : status === 403 ? 'forbidden' : status === 404 ? 'not_found' : 'load_error'}`)}</p>
    {status === 401 ? <Link className="elv-link" to="/login">{t('evidence.signin')}</Link> : retry && <button className="elv-btn" onClick={retry}>{t('evidence.retry')}</button>}
  </div>
}
function Metadata({ row }: { row: Evidence }) {
  const { t } = useLanguage()
  return <div className="evidence-metadata"><span className="elv-badge elv-badge-outline">{t(`evidence.${row.status}`)}</span>
    <p>{t('evidence.version')}: {row.version}</p><time dateTime={row.createdAt}>{row.createdAt}</time>
    <p>{t('evidence.authoring')}: {t(`evidence.${row.authoring}`)}</p>
  </div>
}
export function EvidenceListPage() {
  const { t } = useLanguage(); const token = useEvidenceToken()
  const api = useMemo(() => evidenceApi(backend, token), [token])
  const [state, setState] = useState<{ rows?: Evidence[]; token?: string; error?: number }>({})
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void api.list(controller.signal).then(rows => { if (!controller.signal.aborted && token === readEvidenceToken()) setState({ rows, token }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ error: statusOf(error), token }) })
    return () => controller.abort()
  }, [api, attempt, token])
  const retry = () => { setState({}); setAttempt(v => v + 1) }
  const same = state.token === token && token === readEvidenceToken()
  return <EvidenceShell title={t('evidence.title')}>
    <p>{t('evidence.intro')}</p><Link className="elv-btn" to="/app/evidence/new">{t('evidence.new')}</Link>
    {!token || token !== readEvidenceToken() ? <ReadError status={401} /> : same && state.error ? <ReadError status={state.error} retry={retry} />
      : same && state.rows ? state.rows.length ? <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {state.rows.map(row => <article className="elv-card evidence-card" key={row.id}><div className="elv-card-body">
          <h2 className="elv-card-title">{row.payload.title}</h2><Metadata row={row} />
          <p><strong>{t('evidence.goal')}: </strong>{row.payload.goal || t('evidence.not_indicated')}</p>
          <p><strong>{t('evidence.delivered')}: </strong>{row.payload.delivered?.text || t('evidence.not_indicated')}</p>
          <p><strong>{t('evidence.observedEffect')}: </strong>{row.payload.observedEffect ? row.payload.observedEffect.known ? row.payload.observedEffect.claim.text : t('evidence.unknown') : t('evidence.not_indicated')}</p>
          <Link className="elv-link" to={`/app/evidence/${row.id}`}>{t('evidence.detail')}</Link>
        </div></article>)}
      </div> : <p role="status">{t('evidence.empty')}</p> : <p role="status">{t('evidence.loading')}</p>}
  </EvidenceShell>
}
export function EvidenceDetailPage() {
  const { id: rawId } = useParams(); const id = rawId && /^[1-9]\d{0,8}$/.test(rawId) ? Number(rawId) : 0
  const { t } = useLanguage(); const token = useEvidenceToken()
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
        <p className="evidence-warning">{t('evidence.edit_pending')}</p>
        <article className="elv-card evidence-card"><div className="elv-card-body"><h2>{t('evidence.current')}</h2>
          <Metadata row={data.versions[0]} /><EvidenceContent payload={data.versions[0].payload} />
        </div></article>
        {data.versions.length > 1 && <details><summary>{t('evidence.history')}</summary>
          {data.versions.slice(1).map(row => <section className="evidence-history" key={row.version}><h2>{t('evidence.previous')}: {row.version}</h2>
            <p>{t(`evidence.${row.status}`)} · <time dateTime={row.createdAt}>{row.createdAt}</time></p><EvidenceContent payload={row.payload} />
          </section>)}
        </details>}
      </> : <p role="status">{t('evidence.loading')}</p>}
  </EvidenceShell>
}
type Pending = { body: CreateBody; ack?: { id: number; version: number } }
function EvidenceEditor({ token }: { token: string }) {
  const { t } = useLanguage(); const l = (key: string) => t(`evidence.${key}`)
  const api = useMemo(() => evidenceApi(backend, token), [token])
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [phase, setPhase] = useState<'editing' | 'review' | 'saving' | 'uncertain' | 'saved'>('editing')
  const [preview, setPreview] = useState<Payload | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [saved, setSaved] = useState<{ row: Evidence; current: boolean } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [authError, setAuthError] = useState(0)
  const ref = useRef<HTMLDivElement>(null); const heading = useRef<HTMLHeadingElement>(null); const alive = useRef(true)
  const dirty = phase !== 'saved' && JSON.stringify(draft) !== JSON.stringify(blankDraft())
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
      ack ??= await api.create(attempt.body)
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
  const saveDraft = () => { const payload = prepare('draft'); if (payload) void write({ body: { payload, status: 'draft', requestId: crypto.randomUUID() } }) }
  const review = () => { const payload = prepare('confirmed'); if (payload) { setPreview(payload); setReviewed(false); setMessage(''); setPhase('review') } }
  return <EvidenceShell title={l('new')} onLeave={onLeave}>
    {!token || token !== readEvidenceToken() || authError ? <ReadError status={authError || 401} /> : <div className="evidence-editor">
      <p>{l('privacy')}</p>
      {message && <div role="alert" className="evidence-error-box" ref={ref} tabIndex={-1}><p>{l(message)}</p>
        {errors.length > 0 && <ul>{errors.map(key => <li key={key}>{key === 'draft_minimum' ? l(key) : <a href={`#${key}`} className="elv-link">{l(key === 'title' ? 'field_title' : key)}</a>}</li>)}</ul>}
      </div>}
      {phase === 'editing' && <form noValidate onSubmit={event => { event.preventDefault(); review() }}>
        <fieldset className="elv-fieldset evidence-form"><EvidenceFormFields draft={draft} change={change} errors={errors} />
          <p role="status">{dirty ? l('unsaved') : l('privacy')}</p><div className="evidence-actions">
            <button type="button" className="elv-btn" onClick={saveDraft}>{l('save')}</button><button type="submit" className="elv-btn elv-btn-primary">{l('review')}</button>
          </div>
        </fieldset>
      </form>}
      {phase === 'review' && preview && <>
        <h2 ref={heading} tabIndex={-1}>{l('review')}</h2><p className="evidence-warning">{l('warning')}</p><EvidenceContent payload={preview} />
        <label className="evidence-choice"><input type="checkbox" className="elv-checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />{l('reviewed')}</label>
        <div className="evidence-actions"><button className="elv-btn" onClick={() => setPhase('editing')}>{l('edit')}</button>
          <button className="elv-btn elv-btn-primary" disabled={!reviewed} onClick={() => { if (reviewed) void write({ body: { payload: preview, status: 'confirmed', requestId: crypto.randomUUID() } }) }}>{l('confirm')}</button>
        </div>
      </>}
      {(phase === 'saving' || phase === 'uncertain') && pending && <>
        <p role="status">{phase === 'saving' ? l('saving') : l(pending.ack ? 'uncertain' : 'uncertain_write')}</p><EvidenceContent payload={pending.body.payload} />
        {phase === 'uncertain' && <button type="button" className="elv-btn" onClick={() => void write(pending)}>{l('retry')}</button>}
      </>}
      {phase === 'saved' && saved && <>
        <div role="status"><h2 ref={heading} tabIndex={-1}>{l(saved.current && saved.row.status === 'confirmed' ? 'confirmed_saved' : saved.current && saved.row.status === 'draft' ? 'draft_saved' : 'saved_version')}</h2></div>
        <Metadata row={saved.row} /><EvidenceContent payload={saved.row.payload} /><Link className="elv-link" to={`/app/evidence/${saved.row.id}`}>{l('detail')}</Link>
      </>}
    </div>}
  </EvidenceShell>
}
export function EvidenceCreatePage() { const token = useEvidenceToken(); return <EvidenceEditor key={token} token={token} /> }
