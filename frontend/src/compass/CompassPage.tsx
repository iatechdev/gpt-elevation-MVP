import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { compassApi, CompassError } from './api'
import { fieldKeys, selectedFields, type CareerContext, type ContextVersion, type DirectField, type DraftField, type Preview } from './model'
import { registerCompassGuard } from './navigationGuard'
import { readCompassToken, useCompassToken } from './session'
import './compass.css'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const blank = (): DraftField => ({ id: crypto.randomUUID(), key: '', text: '', selected: false })
type Review = { preview: Preview; fields: DirectField[]; requestId: string }

export function CompassPage() {
  const token = useCompassToken()
  return token ? <CompassSession key={token} token={token} /> : <Navigate to="/login" replace />
}

function CompassSession({ token }: { token: string }) {
  const { t, lang, setLang } = useLanguage()
  const tr = (key: string) => t(`compass.${key}`)
  const navigate = useNavigate()
  const api = useMemo(() => compassApi(API, token), [token])
  const alive = useRef(false)
  const sequence = useRef(0)
  const locked = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  const [context, setContext] = useState<CareerContext | null>(null)
  const [ready, setReady] = useState(false)
  const [rows, setRows] = useState<DraftField[]>([blank()])
  const [review, setReview] = useState<Review | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [busy, setBusy] = useState('loading')
  const [notice, setNotice] = useState('')
  const [failed, setFailed] = useState(false)
  const [invalid, setInvalid] = useState<string[]>([])
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
  const explain = (error: unknown) => error instanceof CompassError ? error.status === 401 ? 'session' : error.status === 403 ? 'forbidden' : error.code === 'field_not_shareable' ? 'not_shareable' : error.status === 410 ? 'expired' : 'error' : 'error'
  const leave = () => { if (!busy && (!dirty || window.confirm(tr('leave')))) navigate('/app/dashboard') }
  const edit = () => { setReview(null); setAuthorized(false); setInvalid([]); message('') }
  const update = (id: string, patch: Partial<DraftField>) => { edit(); setRows(old => old.map(row => row.id === id ? { ...row, ...patch } : row)) }

  async function retryRead() {
    if (locked.current || !current()) return
    locked.current = true; setBusy('loading'); setReady(false); setContext(null)
    try { if (await load()) message('') } catch (error) { if (current()) message(explain(error) === 'session' ? 'session' : 'load_error', true) }
    finally { locked.current = false; if (current()) setBusy('') }
  }
  async function preview() {
    if (locked.current || !current() || !ready) return
    const selected = selectedFields(rows)
    if (selected.errors.length) { setInvalid(selected.errors); message('invalid', true); return }
    locked.current = true; setBusy('previewing'); edit()
    try {
      const value = await api.preview(selected.fields, lang)
      if (current()) { setReview({ preview: value, fields: selected.fields, requestId: crypto.randomUUID() }); setNow(Date.now()); message('unconfirmed') }
    } catch (error) {
      if (current()) {
        if (error instanceof CompassError && error.code === 'field_not_shareable' && error.fieldIndex !== undefined) {
          const row = rows.filter(item => item.selected)[error.fieldIndex]; if (row) setInvalid([row.id])
        }
        message(explain(error), true)
      }
    } finally { locked.current = false; if (current()) setBusy('') }
  }
  async function confirm() {
    if (locked.current || !current() || !review || !authorized || Date.parse(review.preview.expiresAt) <= Date.now() || !ready) return
    locked.current = true; setBusy('confirming'); setReady(false)
    let acknowledged: ContextVersion | null = null
    let failure: unknown
    try { acknowledged = await api.confirm({ fields: review.fields, token: review.preview.token, requestId: review.requestId }) } catch (error) { failure = error }
    if (!current()) { locked.current = false; return }
    setReview(null); setAuthorized(false); setContext(null)
    try {
      const value = await load()
      if (value && acknowledged && value.active?.version === acknowledged.version && JSON.stringify(value.active.fields) === JSON.stringify(acknowledged.fields)) {
        setRows([blank()]); message('confirmed')
      } else if (value) message(failure instanceof CompassError && failure.status < 500 ? explain(failure) : 'uncertain', true)
    } catch (error) { if (current()) message(explain(error) === 'session' ? 'session' : 'uncertain', true) }
    finally { locked.current = false; if (current()) setBusy('') }
  }
  async function withdraw() {
    if (locked.current || !current() || !ready) return
    dialog.current?.close(); locked.current = true; setBusy('withdrawing'); setReady(false); edit()
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
    return <dl>{version.fields.map((field, index) => <div key={index}><dt>{tr(field.key)}</dt><dd>{field.text}</dd></div>)}</dl>
  }
  return <div className="compass-scope">
    <a className="compass-skip" href="#compass-main">{tr('skip')}</a>
    <header><button className="elv-btn" disabled={!!busy} onClick={leave}>{tr('back')}</button>
      <div role="group" aria-label={tr('language')}>{(['es', 'en'] as const).map(language => <button className="elv-btn" key={language} aria-pressed={lang === language} onClick={() => setLang(language)}>{language.toUpperCase()}</button>)}</div>
    </header>
    <main id="compass-main" tabIndex={-1}>
      <h1>{tr('title')}</h1><p>{tr('intro')}</p><p>{tr('privacy')} {tr('caution')}</p>
      <div ref={noticeRef} tabIndex={-1} role={failed ? 'alert' : 'status'} aria-live="polite" className={failed ? 'compass-error' : 'compass-notice'}>{notice && tr(notice)}</div>
      {busy && <p role="status">{tr(busy)}</p>}
      {!ready && !busy && <button className="elv-btn" onClick={() => void retryRead()}>{tr('retry')}</button>}
      {notice === 'session' && <a className="elv-link" href="/login">{t('nav_login')}</a>}
      {ready && context && <>
        <section className="elv-card compass-card" aria-labelledby="current-heading"><h2 id="current-heading">{tr('current')}</h2>
          {context.active ? <><p>{tr('version')} {context.active.version} · {tr('active')}</p>{fields(context.active)}
            {context.active.needsReview && <p className="compass-warning">{tr('needs_review')}. {tr('source_changed')}</p>}
            <button className="elv-btn" disabled={!!busy} onClick={() => dialog.current?.showModal()}>{tr('withdraw')}</button></> : <p>{tr('empty')}</p>}
          <p>{tr('derivatives')}</p>
        </section>
        <details className="elv-card compass-card"><summary>{tr('history')} ({context.versions.length})</summary>
          {context.versions.map(version => <article key={version.version}><h3>{tr('version')} {version.version} · {tr(version.status)}</h3><time dateTime={version.approvedAt}>{new Date(version.approvedAt).toLocaleString(lang)}</time>{fields(version)}</article>)}
        </details>
        <section className="elv-card compass-card" aria-labelledby="new-heading"><h2 id="new-heading">{tr('new')}</h2><p>{tr('limit')}</p>{context.active && <p className="compass-warning">{tr('replaces')}</p>}
          {!review ? <form onSubmit={event => { event.preventDefault(); void preview() }}>
            <fieldset disabled={!!busy}>
              {rows.map((row, index) => <fieldset className="elv-fieldset compass-field" key={row.id}><legend>{index + 1} · {tr('unconfirmed')}</legend>
                <label htmlFor={`category-${row.id}`}>{tr('category')}</label><select className="elv-select" id={`category-${row.id}`} value={row.key} aria-invalid={invalid.includes(row.id)} onChange={event => update(row.id, { key: event.target.value as DraftField['key'] })}><option value="">{tr('category')}</option>{fieldKeys.map(key => <option key={key} value={key}>{tr(key)}</option>)}</select>
                <label htmlFor={`text-${row.id}`}>{tr('text')}</label><textarea className="elv-textarea" id={`text-${row.id}`} value={row.text} maxLength={500} rows={4} aria-invalid={invalid.includes(row.id)} aria-describedby={`count-${row.id}`} onChange={event => update(row.id, { text: event.target.value })} /><span id={`count-${row.id}`}>{row.text.length}/500</span>
                <label className="compass-check"><input className="elv-checkbox" type="checkbox" checked={row.selected} onChange={event => update(row.id, { selected: event.target.checked })} />{tr('select')}</label>
                {invalid.includes(row.id) && <p className="compass-error">{tr('invalid')}</p>}
                <button className="elv-btn" type="button" onClick={() => { edit(); setRows(old => old.filter(item => item.id !== row.id)) }}>{tr('reject')}</button>
              </fieldset>)}
              <div className="compass-actions"><button className="elv-btn" type="button" disabled={rows.length >= 12} onClick={() => { edit(); setRows(old => [...old, blank()]) }}>{tr('add')}</button><button className="elv-btn compass-primary" type="submit">{tr('preview')}</button></div>
            </fieldset>
          </form> : <section aria-labelledby="preview-heading"><h3 id="preview-heading">{tr('preview')}</h3>
            <dl>{review.preview.representation.map((field, index) => <div key={index}><dt>{tr(field.key)}</dt><dd>{field.text}</dd></div>)}</dl>
            <p>{tr('expires')}: <time dateTime={review.preview.expiresAt}>{new Date(review.preview.expiresAt).toLocaleTimeString(lang)}</time></p>
            {expired && <p role="alert">{tr('expired')}</p>}
            <label className="compass-check"><input className="elv-checkbox" type="checkbox" checked={authorized} disabled={!!busy || expired} onChange={event => setAuthorized(event.target.checked)} />{tr('authorize')}</label>
            <div className="compass-actions"><button className="elv-btn" disabled={!!busy} onClick={edit}>{tr('edit')}</button>{expired ? <button className="elv-btn" onClick={() => void preview()}>{tr('renew')}</button> : <button className="elv-btn compass-primary" disabled={!authorized || !!busy} onClick={() => void confirm()}>{tr('confirm')}</button>}</div>
          </section>}
        </section>
        {context.active && <p>{tr('unchanged')}</p>}<button className="elv-btn" disabled={!!busy} onClick={leave}>{tr(context.active ? 'no_changes' : 'skip_transfer')}</button>
      </>}
      <dialog ref={dialog} aria-labelledby="withdraw-title"><h2 id="withdraw-title">{tr('withdraw_confirm')}</h2><p>{tr('withdraw_help')}</p><div className="compass-actions"><button className="elv-btn" autoFocus onClick={() => dialog.current?.close()}>{tr('cancel')}</button><button className="elv-btn compass-primary" onClick={() => void withdraw()}>{tr('withdraw_confirm')}</button></div></dialog>
    </main>
  </div>
}
