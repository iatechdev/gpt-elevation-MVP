import './register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { Banner, Button, Card, CheckField, Chip, Dialog, LinkButton, SelectField, TextAreaField } from '../cartografia'
import { PersonScreen } from '../space/PersonScreen'
import { compassApi, CompassError } from './api'
import { fieldKeys, selectedFields, type CareerContext, type ContextVersion, type DirectField, type DraftField, type Preview } from './model'
import { registerCompassGuard } from './navigationGuard'
import { readCompassToken, useCompassToken } from './session'
import './compass.css'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const blank = (): DraftField => ({ id: crypto.randomUUID(), key: '', text: '', selected: false })
type Review = { preview: Preview; fields: DirectField[]; requestId: string; baseVersion: number }
// La respuesta de /confirm trae {key,text}; el GET trae además `origin`: se comparan solo clave y texto (la forma real de cada una).
const pairs = (items: readonly { key: string; text: string }[]) => JSON.stringify(items.map(item => [item.key, item.text]))

export function CompassPage() {
  const token = useCompassToken()
  return token ? <CompassSession key={token} token={token} /> : <Navigate to="/login" replace />
}

function CompassSession({ token }: { token: string }) {
  const { t, lang } = useLanguage()
  const tr = (key: string) => t(`compass.${key}`)
  const navigate = useNavigate()
  const api = useMemo(() => compassApi(API, token), [token])
  const alive = useRef(false)
  const sequence = useRef(0)
  const locked = useRef(false)
  const noticeRef = useRef<HTMLDivElement>(null)
  const [withdrawOpen, setWithdrawOpen] = useState(false) // ES-308: el <Dialog> de Cartografía devuelve el foco a quien lo abrió, atrapa Tab y cierra con Esc
  const [context, setContext] = useState<CareerContext | null>(null)
  const [ready, setReady] = useState(false)
  const [rows, setRows] = useState<DraftField[]>([blank()])
  const [review, setReview] = useState<Review | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [busy, setBusy] = useState('loading')
  const [notice, setNotice] = useState('')
  const [failed, setFailed] = useState(false)
  const [invalid, setInvalid] = useState<string[]>([])
  const [unsure, setUnsure] = useState(false) // ES-171: la confirmación pudo llegar al servidor; la revisión se conserva con su requestId y su token
  const [now, setNow] = useState(Date.now())
  const current = () => alive.current && readCompassToken() === token
  const dirty = rows.some(row => row.text.length > 0 || row.selected || row.key !== '')
  const expired = !!review && Date.parse(review.preview.expiresAt) <= now

  const load = useCallback(async () => {
    const own = ++sequence.current
    const value = await api.read()
    if (!alive.current || readCompassToken() !== token || own !== sequence.current) return null
    setContext(value); setReady(true)
    return value
  }, [api, token])
  useEffect(() => {
    alive.current = true
    void load().catch(error => {
      if (alive.current && readCompassToken() === token) {
        setNotice(error instanceof CompassError && error.status === 401 ? 'session' : 'load_error'); setFailed(true)
      }
    }).finally(() => { if (alive.current) setBusy('') })
    return () => { alive.current = false }
  }, [load, token])
  useEffect(() => {
    if (!review) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [review])
  useEffect(() => {
    if (!dirty && !busy) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', unload)
    const unregister = registerCompassGuard(() => !!busy || !window.confirm(t('compass.leave')))
    return () => { window.removeEventListener('beforeunload', unload); unregister() }
  }, [dirty, busy, t])
  useEffect(() => { if (notice) noticeRef.current?.focus() }, [notice])

  const message = (key: string, error = false) => {
    setNotice(key); setFailed(error)
    if (key === 'session') { setContext(null); setReady(false); setRows([blank()]); setReview(null); setAuthorized(false) }
  }
  const explain = (error: unknown) => error instanceof CompassError ? error.status === 401 ? 'session' : error.status === 403 ? 'forbidden' : error.code === 'field_not_shareable' ? 'not_shareable' : error.code === 'conflict' ? 'conflict' : error.status === 410 ? 'expired' : 'error' : 'error'
  const leave = () => { if (!busy && (!dirty || window.confirm(tr('leave')))) navigate('/app/dashboard') }
  const edit = () => { setReview(null); setAuthorized(false); setInvalid([]); setUnsure(false); message('') }
  const update = (id: string, patch: Partial<DraftField>) => { edit(); setRows(old => old.map(row => row.id === id ? { ...row, ...patch } : row)) }

  async function retryRead() {
    if (locked.current || !current()) return
    locked.current = true; setBusy('loading'); setReady(false); setContext(null)
    try { if (await load()) { if (unsure) message('confirm_uncertain', true); else message('') } } catch (error) { if (current()) message(explain(error) === 'session' ? 'session' : 'load_error', true) }
    finally { locked.current = false; if (current()) setBusy('') }
  }
  async function preview() {
    if (locked.current || !current() || !ready) return
    const selected = selectedFields(rows)
    if (selected.errors.length) { setInvalid(selected.errors); message('invalid', true); return }
    locked.current = true; setBusy('previewing'); edit()
    try {
      const value = await api.preview(selected.fields, lang)
      if (current()) { setReview({ preview: value, fields: selected.fields, requestId: crypto.randomUUID(), baseVersion: context?.active?.version ?? 0 }); setNow(Date.now()); message('unconfirmed') }
    } catch (error) {
      if (current()) {
        if (error instanceof CompassError && error.code === 'field_not_shareable' && error.fieldIndex !== undefined) {
          const row = rows.filter(item => item.selected)[error.fieldIndex]; if (row) setInvalid([row.id])
        }
        message(explain(error), true)
      }
    } finally { locked.current = false; if (current()) setBusy('') }
  }
  // ES-171: ¿ya quedó aplicada esta revisión? Con acuse: misma versión y campos. Sin acuse (respuesta perdida): una versión NUEVA con exactamente esos campos.
  const applied = (value: CareerContext, ack: ContextVersion | null, mine: Review) => !!value.active && (ack ? value.active.version === ack.version && pairs(value.active.fields) === pairs(ack.fields) : value.active.version > mine.baseVersion && pairs(value.active.fields) === pairs(mine.preview.representation))
  async function confirm() {
    if (locked.current || !current() || !review || !authorized || Date.parse(review.preview.expiresAt) <= Date.now() || !ready) return
    locked.current = true; setBusy('confirming'); setReady(false); setUnsure(false)
    const mine = review
    let acknowledged: ContextVersion | null = null
    let failure: unknown
    try { acknowledged = await api.confirm({ fields: mine.fields, token: mine.preview.token, requestId: mine.requestId }) } catch (error) { failure = error }
    if (!current()) { locked.current = false; return }
    // Sin acuse y sin una respuesta definitiva del servidor (corte, tiempo agotado, 5xx): la revisión se conserva para comprobar o reintentar con el MISMO requestId y token.
    const doubtful = !acknowledged && !(failure instanceof CompassError && failure.status < 500)
    if (!doubtful) { setReview(null); setAuthorized(false) }
    setContext(null)
    try {
      const value = await load()
      if (value && acknowledged && applied(value, acknowledged, mine)) { // el éxito automático exige el acuse del servidor; sin acuse solo «Comprobar» (a petición) puede inferirlo
        setReview(null); setAuthorized(false); setUnsure(false); setRows([blank()]); message('confirmed')
      } else if (value) {
        if (doubtful) { setUnsure(true); message('confirm_uncertain', true) } else message(explain(failure), true)
      }
    } catch (error) { if (current()) { if (doubtful) setUnsure(true); message(explain(error) === 'session' ? 'session' : doubtful ? 'confirm_uncertain' : 'uncertain', true) } }
    finally { locked.current = false; if (current()) setBusy('') }
  }
  async function check() {
    if (locked.current || !current() || !review) return
    const mine = review
    locked.current = true; setBusy('loading'); setReady(false)
    try {
      const value = await load()
      if (value) {
        if (applied(value, null, mine)) { setReview(null); setAuthorized(false); setUnsure(false); setRows([blank()]); message('confirmed') } else message('check_none', true)
      }
    } catch (error) { if (current()) message(explain(error) === 'session' ? 'session' : 'load_error', true) }
    finally { locked.current = false; if (current()) setBusy('') }
  }
  async function withdraw() {
    if (locked.current || !current() || !ready) return
    setWithdrawOpen(false); locked.current = true; setBusy('withdrawing'); setReady(false); edit()
    let acknowledged = false
    try { await api.revoke(); acknowledged = true } catch { /* A lost response must never trigger another POST automatically. */ }
    if (!current()) { locked.current = false; return }
    setContext(null)
    try {
      const value = await load()
      if (value) message(acknowledged && !value.active ? 'withdrawn' : 'withdrawal_uncertain', !acknowledged || !!value.active)
    } catch (error) { if (current()) message(explain(error) === 'session' ? 'session' : 'withdrawal_uncertain', true) }
    finally { locked.current = false; if (current()) setBusy('') }
  }
  function fields(version: ContextVersion) {
    return <dl className="compass-fields">{version.fields.map((field, index) => <div key={index}><dt>{tr(field.key)}</dt><dd>{field.text}</dd></div>)}</dl>
  }
  const confirmActions = unsure ? <><Button variant="ghost" disabled={!!busy} onClick={() => void check()}>{tr('check')}</Button><Button disabled={!authorized || !!busy} onClick={() => void confirm()}>{tr('retry')}</Button></> : <Button disabled={!authorized || !!busy} onClick={() => void confirm()}>{tr('confirm')}</Button>
  // ES-308 (PR 3): la Brújula va dentro del marco de persona (PersonLayout, ES-153): el encabezado, el idioma, el tema y «Saltar al contenido» los pone el marco. Aquí queda la cabecera de pantalla y el contenido, con las piezas de Cartografía. Ningún texto cambia.
  return <PersonScreen title={tr('title')} lead={`${tr('intro')} ${tr('privacy')}`}>
    <nav className="pg-nav"><LinkButton disabled={!!busy} onClick={leave}>{tr('back')}</LinkButton></nav>
    <p className="cg-hint">{tr('caution')}</p>
    <div ref={noticeRef} tabIndex={-1} role={failed ? 'alert' : 'status'} aria-live="polite" className={`pg-focus ${notice ? `cg-banner${failed ? ' cg-banner--error' : ''}` : 'pg-live'}`}>{notice && <span className="cg-banner__title">{tr(notice)}</span>}</div>
    {busy && <p className="cg-hint" role="status">{tr(busy)}</p>}
    {!ready && !busy && <div className="pg-actions"><Button variant="ghost" onClick={() => void retryRead()}>{tr('retry')}</Button></div>}
    {notice === 'session' && <p><a className="cg-linkbtn" href="/login">{t('nav_login')}</a></p>}
    {ready && context && <>
      <section className="cg-card pg-card" aria-labelledby="current-heading"><h2 id="current-heading">{tr('current')}</h2>
        {context.active ? <><p className="pg-itemtop"><span>{tr('version')} {context.active.version}</span><Chip tone="ok" symbol="✓">{tr('active')}</Chip></p>{fields(context.active)}
          {context.active.needsReview && <Banner title={`${tr('needs_review')}. ${tr('source_changed')}`} />}
          <div className="pg-actions"><Button variant="ghost" disabled={!!busy} onClick={() => setWithdrawOpen(true)}>{tr('withdraw')}</Button></div></> : <p>{tr('empty')}</p>}
        <p className="cg-hint">{tr('derivatives')}</p>
      </section>
      <Card as="details" className="pg-card pg-details"><summary>{tr('history')} ({context.versions.length})</summary>
        {context.versions.map(version => <article className="pg-history" key={version.version}><h3>{tr('version')} {version.version} · {tr(version.status)}</h3><time className="cg-hint" dateTime={version.approvedAt}>{new Date(version.approvedAt).toLocaleString(lang)}</time>{fields(version)}</article>)}
      </Card>
      <section className="cg-card pg-card" aria-labelledby="new-heading"><h2 id="new-heading">{tr('new')}</h2><p>{tr('limit')}</p>{context.active && <Banner title={tr('replaces')} />}
        {!review ? <form className="pg-form" onSubmit={event => { event.preventDefault(); void preview() }}>
          <fieldset className="compass-bare" disabled={!!busy}>
            {rows.map((row, index) => <fieldset className="pg-array" key={row.id}><legend className="cg-label">{index + 1} · {tr('unconfirmed')}</legend>
              <SelectField id={`category-${row.id}`} label={tr('category')} value={row.key} aria-invalid={invalid.includes(row.id) || undefined} onChange={event => update(row.id, { key: event.target.value as DraftField['key'] })}><option value="">{tr('category')}</option>{fieldKeys.map(key => <option key={key} value={key}>{tr(key)}</option>)}</SelectField>
              <TextAreaField id={`text-${row.id}`} label={tr('text')} value={row.text} maxLength={500} rows={4} aria-invalid={invalid.includes(row.id) || undefined} hint={`${row.text.length}/500`} error={invalid.includes(row.id) ? tr('invalid') : undefined} onChange={event => update(row.id, { text: event.target.value })} />
              <CheckField label={tr('select')} checked={row.selected} onChange={event => update(row.id, { selected: event.target.checked })} />
              <div className="pg-actions"><Button variant="ghost" onClick={() => { edit(); setRows(old => old.filter(item => item.id !== row.id)) }}>{tr('reject')}</Button></div>
            </fieldset>)}
            <div className="pg-actions"><Button variant="ghost" disabled={rows.length >= 12} onClick={() => { edit(); setRows(old => [...old, blank()]) }}>{tr('add')}</Button><Button type="submit">{tr('preview')}</Button></div>
          </fieldset>
        </form> : <section className="cg-card pg-card pg-card-review" aria-labelledby="preview-heading"><h3 id="preview-heading">{tr('preview')}</h3>
          <dl className="compass-fields">{review.preview.representation.map((field, index) => <div key={index}><dt>{tr(field.key)}</dt><dd>{field.text}</dd></div>)}</dl>
          <p>{tr('expires')}: <time dateTime={review.preview.expiresAt}>{new Date(review.preview.expiresAt).toLocaleTimeString(lang)}</time></p>
          {expired && <p className="cg-error" role="alert">{tr('expired')}</p>}
          <CheckField label={tr('authorize')} checked={authorized} disabled={!!busy || expired} onChange={event => setAuthorized(event.target.checked)} />
          <div className="pg-actions"><Button variant="ghost" disabled={!!busy} onClick={edit}>{tr('edit')}</Button>{expired ? <Button variant="ghost" onClick={() => void preview()}>{tr('renew')}</Button> : confirmActions}</div>
        </section>}
      </section>
      {context.active && <p className="cg-hint">{tr('unchanged')}</p>}<div className="pg-actions"><Button variant="ghost" disabled={!!busy} onClick={leave}>{tr(context.active ? 'no_changes' : 'skip_transfer')}</Button></div>
    </>}
    <Dialog open={withdrawOpen} onClose={() => { if (!busy) setWithdrawOpen(false) }} title={tr('withdraw_confirm')}
      actions={<><Button variant="ghost" onClick={() => setWithdrawOpen(false)}>{tr('cancel')}</Button><Button variant="danger" onClick={() => void withdraw()}>{tr('withdraw_confirm')}</Button></>}>
      <div className="pg-dialog"><p>{tr('withdraw_help')}</p></div>
    </Dialog>
  </PersonScreen>
}
