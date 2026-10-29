// ES-111: El Puente. Dos zonas: «Tu diario privado» (insights por decidir) y «Tu perfil profesional» (lo ya autorizado).
// Autorizar es insight a insight y con confirmación en la tarjeta; nada cruza por defecto ni en bloque. Cruza solo el texto del insight.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { SpaceShell } from '../space/SpaceShell'
import { useSpaceToken } from '../space/hooks'
import { compassApi, CompassError } from '../compass/api'
import type { CareerContext, Field } from '../compass/model'
import { bridgeCopy } from './copy'
import { loadInsights } from './insights'
import { formatDate, pending, sortInsights, whyNot, withInsight, withoutField } from './logic'
import type { Insight } from './logic'
import './bridge.css'

const backend = import.meta.env?.VITE_BACKEND_URL || ''
type Notice = { kind: 'ok' | 'error'; text: string } | null

export function BridgePage() {
  const { lang } = useLanguage(); const c = bridgeCopy[lang]; const token = useSpaceToken()
  const api = useMemo(() => compassApi(backend, token), [token])
  const insights = useMemo(() => sortInsights(loadInsights(lang)), [lang])
  const [ctx, setCtx] = useState<CareerContext | null>(null); const [loadError, setLoadError] = useState(false); const [expired, setExpired] = useState(!token)
  const [peek, setPeek] = useState<ReadonlySet<string>>(new Set()); const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<Notice>(null); const [askAll, setAskAll] = useState(false)
  const trigger = useRef<HTMLElement | null>(null); const confirmButton = useRef<HTMLButtonElement | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(false)
    try { setCtx(await api.read(signal)) } catch (error) {
      if (signal?.aborted) return
      if (error instanceof CompassError && error.status === 401) setExpired(true); else setLoadError(true)
    }
  }, [api])
  useEffect(() => { if (!token) return; const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [token, load])
  useEffect(() => { if (confirming) confirmButton.current?.focus() }, [confirming])

  const active: Field[] = ctx?.active?.fields ?? []
  const todo = ctx ? pending(insights, active) : []
  const explain = (error: unknown): string => {
    if (!(error instanceof CompassError)) return c.saveError
    if (error.status === 401) { setExpired(true); return c.session }
    return ({ field_not_shareable: c.notShareable, consent_required: c.consent, preview_expired: c.expired, preview_mismatch: c.saveError, conflict: c.conflict } as Record<string, string>)[error.code] ?? c.saveError
  }
  // Una acción = una versión nueva del contexto aprobado, con su propio requestId. Sin textos que cruzar, se revoca la versión activa.
  const commit = async (fields: ReturnType<typeof withInsight>, done: string) => {
    setBusy(true); setNotice(null)
    try {
      if (!fields.length) await api.revoke()
      else {
        const preview = await api.preview(fields, lang)
        await api.confirm({ fields, token: preview.token, requestId: crypto.randomUUID() })
      }
      await load(); setConfirming(null); setNotice({ kind: 'ok', text: done })
    } catch (error) { setNotice({ kind: 'error', text: explain(error) }) } finally { setBusy(false) }
  }
  const authorize = (insight: Insight) => commit(withInsight(active, insight), c.crossed)
  const remove = (field: Field) => commit(withoutField(active, field), c.removed)
  const revokeAll = async () => { setAskAll(false); await commit([], c.revoked) }
  const ask = (id: string, element: HTMLElement) => { trigger.current = element; setConfirming(id); setNotice(null) }
  const cancel = () => { setConfirming(null); trigger.current?.focus() }
  const togglePeek = (id: string) => setPeek(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })

  if (expired) return <SpaceShell><div role="alert" className="bridge-note">{c.session} <Link className="elv-link" to="/login">{c.login}</Link></div></SpaceShell>
  const version = ctx?.active
  return <SpaceShell>
    <section className="bridge" aria-labelledby="bridge-title">
      <header className="bridge-head">
        <p className="bridge-zone">◈ {c.zone}</p>
        <h1 id="bridge-title">{c.title}</h1>
        <p>{c.intro}</p><p className="bridge-small">{c.onlyText}</p>
        {insights.some(insight => insight.example) && <p className="bridge-tag" role="note">{c.exampleNote}</p>}
      </header>
      <p className="bridge-live" role="status" aria-live="polite">{busy ? c.saving : notice?.kind === 'ok' ? notice.text : ''}</p>
      {notice?.kind === 'error' && <p className="bridge-note bridge-error" role="alert">{notice.text}</p>}
      {!ctx && !loadError && <p role="status" aria-busy="true" className="bridge-note">{c.loading}</p>}
      {loadError && <p className="bridge-note bridge-error" role="alert"><button type="button" className="elv-link" onClick={() => void load()}>{c.loadError}</button></p>}
      {ctx && <div className="bridge-cols">
        <section className="bridge-col" aria-labelledby="bridge-private">
          <h2 id="bridge-private">🔒 {c.private}</h2>
          {!todo.length && <div className="bridge-empty" role="status"><p>{insights.length ? c.nothing : c.empty}</p>{!insights.length && <p className="bridge-small">{c.emptyNote} <Link className="elv-link" to="/app/compass">{c.toCompass}</Link></p>}</div>}
          {todo.map(insight => {
            const open = peek.has(insight.id); const asking = confirming === insight.id; const blocked = whyNot(active, insight)
            return <article key={insight.id} className={`bridge-card${asking ? ' bridge-card-asking' : ''}`} onKeyDown={event => { if (asking && event.key === 'Escape') { event.stopPropagation(); cancel() } }}>
              <div className="bridge-row">
                <span className="bridge-small">{formatDate(insight.date, lang)}{insight.example && <span className="bridge-pill bridge-pill-dash"> {c.example}</span>}</span>
                <span><span className={`bridge-pill${insight.status === 'unassessed' ? ' bridge-pill-dash' : ''}`}>{insight.status === 'hypothesis' ? c.hypothesis : c.unassessed}</span>
                  <button type="button" className="bridge-eye" aria-pressed={open} aria-label={open ? c.hide : c.show} onClick={() => togglePeek(insight.id)}>{open ? '◉' : '◎'}</button></span>
              </div>
              <div className={`bridge-frag${open ? '' : ' bridge-blur'}`} data-label={c.show}><span aria-hidden={!open}>{insight.fragment}</span></div>
              <div className="bridge-insight"><b>{c.insight}</b>{insight.text}<small>{c[insight.key]}</small></div>
              {asking
                ? <div className="bridge-ask" role="group" aria-label={c.confirmQ}><p>{c.confirmQ}</p>
                  <div><button type="button" ref={confirmButton} className="bridge-ok" disabled={busy} onClick={() => void authorize(insight)}>{busy ? c.saving : c.confirm}</button><button type="button" className="bridge-no" disabled={busy} onClick={cancel}>{c.cancel}</button></div></div>
                : <><button type="button" className="bridge-cta" disabled={busy || blocked !== null} onClick={event => ask(insight.id, event.currentTarget)}>{c.authorize}</button>
                  {blocked && <p className="bridge-small" role="note">{blocked === 'limit_total' ? c.limitTotal : c.limitKey}</p>}</>}
            </article>
          })}
        </section>
        <div className="bridge-arrow" aria-hidden="true">↓</div>
        <section className="bridge-col" aria-labelledby="bridge-pro">
          <h2 id="bridge-pro">{c.professional}</h2>
          {version?.needsReview && <div className="bridge-review" role="note"><strong>{c.review}</strong><p>{c.reviewText}</p></div>}
          {!active.length && <div className="bridge-empty" role="status"><p>{c.nothing}</p></div>}
          {version && active.length > 0 && <>
            <p className="bridge-small">{c.version.replace('{v}', String(version.version)).replace('{date}', formatDate(version.approvedAt.slice(0, 10), lang))}</p>
            <ul className="bridge-list">{active.map(field => <li key={`${field.key}|${field.text}`} className="bridge-done">
              <div className="bridge-row"><span className="bridge-pill bridge-pill-ok">✓ {c.hypothesis}</span><small className="bridge-small">{c[field.key]}</small></div>
              <p>{field.text}</p>
              <button type="button" className="bridge-link" disabled={busy} onClick={() => void remove(field)}>{c.revoke}<span className="bridge-sr"> — {field.text}</span></button>
            </li>)}</ul></>}
        </section>
      </div>}
      {ctx && active.length > 0 && <footer className="bridge-foot">
        {askAll ? <div className="bridge-ask" role="group" aria-label={c.revokeAllQ}><p>{c.revokeAllQ}</p><div><button type="button" className="bridge-ok" disabled={busy} onClick={() => void revokeAll()}>{c.confirm}</button><button type="button" className="bridge-no" onClick={() => setAskAll(false)}>{c.cancel}</button></div></div>
          : <button type="button" className="bridge-link" disabled={busy} onClick={() => setAskAll(true)}>{c.revokeAll}</button>}
      </footer>}
    </section>
  </SpaceShell>
}
