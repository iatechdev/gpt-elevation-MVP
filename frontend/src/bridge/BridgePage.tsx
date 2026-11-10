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
import { SourcesPanel } from './SourcesPanel'
import { modalKeyDown } from '../a11y/modalKeys.ts'
import { readPermissions, setPermission } from './insightsApi'
import { emptyProposals, sourceIds, withSource } from './sources'
import { formatDate, pending, sameFields, sortInsights, whyNot, withInsight, withoutField } from './logic'
import type { DirectField } from '../compass/model'
import type { Insight, SourceId } from './logic'
import './bridge.css'

const backend = import.meta.env?.VITE_BACKEND_URL || ''
type Notice = { kind: 'ok' | 'error'; text: string } | null
type Focus = { kind: 'authorize'; id: string } | { kind: 'pro' } | null

export function BridgePage() {
  const { lang } = useLanguage(); const c = bridgeCopy[lang]; const token = useSpaceToken()
  const api = useMemo(() => compassApi(backend, token), [token])
  // ES-121: a las ideas de ejemplo (solo con el interruptor) se suman las propuestas de la IA por fuente. Viven solo en esta pantalla: no se guardan.
  const [proposals, setProposals] = useState(emptyProposals)
  const insights = useMemo(() => sortInsights([...loadInsights(lang), ...Object.values(proposals).flat()]), [lang, proposals])
  const onResult = useCallback((source: SourceId, list: Insight[]) => setProposals(current => withSource(current, source, list)), [])
  const onExpired = useCallback(() => setExpired(true), [])
  const [ctx, setCtx] = useState<CareerContext | null>(null); const [loadError, setLoadError] = useState(false); const [expired, setExpired] = useState(!token)
  const [peek, setPeek] = useState<ReadonlySet<string>>(new Set()); const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<Notice>(null); const [askAll, setAskAll] = useState(false)
  // ES-168: «Retirar todo» retira lo cruzado Y los permisos de lectura de las tres fuentes. SourcesPanel avisa de los permisos y se recarga con reloadKey.
  const [perms, setPerms] = useState<Record<SourceId, boolean> | null>(null); const [reloadKey, setReloadKey] = useState(0)
  const cancelAll = useRef<HTMLButtonElement | null>(null); const allDialog = useRef<HTMLDivElement | null>(null)
  const confirmButton = useRef<HTMLButtonElement | null>(null); const proHeading = useRef<HTMLHeadingElement | null>(null)
  const [focusTarget, setFocusTarget] = useState<Focus>(null)
  // El mismo intento (mismas claves y textos) conserva su requestId hasta que sale bien: si se pierde la respuesta, reintentar no crea una versión idéntica de más.
  const attempt = useRef<{ key: string; requestId: string } | null>(null)
  const exampleTexts = useMemo(() => new Set(['es', 'en'].flatMap(l => loadInsights(l as 'es' | 'en').map(insight => insight.text))), [])

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(false)
    try { setCtx(await api.read(signal)) } catch (error) {
      if (signal?.aborted) return
      if (error instanceof CompassError && error.status === 401) setExpired(true); else setLoadError(true)
    }
  }, [api])
  useEffect(() => { if (!token) return; const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [token, load])
  useEffect(() => { if (confirming) confirmButton.current?.focus() }, [confirming])
  // El foco vuelve a un elemento que sigue en pantalla: el botón «Autorizar cruce» (al cancelar) o el título de «Tu perfil profesional» (cuando la tarjeta se mueve o se retira algo).
  useEffect(() => {
    if (!focusTarget) return
    const target = focusTarget.kind === 'authorize' ? document.querySelector<HTMLElement>(`[data-authorize="${CSS.escape(focusTarget.id)}"]`) : proHeading.current
    target?.focus(); setFocusTarget(null)
  }, [focusTarget, ctx, confirming])

  const active: Field[] = ctx?.active?.fields ?? []
  const todo = ctx ? pending(insights, active) : []
  const explain = (error: unknown): string => {
    if (!(error instanceof CompassError)) return c.saveError
    if (error.status === 401) { setExpired(true); return c.session }
    return ({ field_not_shareable: c.notShareable, consent_required: c.consent, preview_expired: c.expired, preview_mismatch: c.saveError, conflict: c.conflict } as Record<string, string>)[error.code] ?? c.saveError
  }
  // Una acción = una versión nueva del contexto aprobado. ANTES de componerla se relee la versión activa: si otra pestaña la cambió desde que esta pantalla la mostró,
  // no se compone nada (volvería a cruzar un texto revocado o perdería uno autorizado); se actualiza la pantalla y se avisa. Sin textos que cruzar, se revoca la versión activa.
  const commit = async (build: (current: Field[]) => DirectField[], done: string, after: Focus, checkStale = true) => {
    setBusy(true); setNotice(null)
    try {
      const fresh = await api.read(); const current = fresh.active?.fields ?? []
      if (checkStale && !sameFields(current, active)) { setCtx(fresh); setConfirming(null); setNotice({ kind: 'error', text: c.stale }); setFocusTarget({ kind: 'pro' }); return }
      const fields = build(current)
      if (!fields.length) await api.revoke()
      else {
        const key = JSON.stringify(fields.map(field => [field.key, field.text]))
        if (attempt.current?.key !== key) attempt.current = { key, requestId: crypto.randomUUID() }
        const preview = await api.preview(fields, lang)
        await api.confirm({ fields, token: preview.token, requestId: attempt.current.requestId })
      }
      attempt.current = null
      await load(); setConfirming(null); setNotice({ kind: 'ok', text: done }); setFocusTarget(after)
    } catch (error) { setNotice({ kind: 'error', text: explain(error) }) } finally { setBusy(false) }
  }
  const authorize = (insight: Insight) => commit(current => withInsight(current, insight), c.crossed, { kind: 'pro' })
  const remove = (field: Field) => commit(current => withoutField(current, field), c.removed, { kind: 'pro' })
  const anyPerm = !!perms && sourceIds.some(source => perms[source])
  useEffect(() => { if (askAll) cancelAll.current?.focus() }, [askAll])
  const closeAll = () => { setAskAll(false); requestAnimationFrame(() => (document.querySelector('[data-withdraw-all]') as HTMLElement | null)?.focus()) }
  const trapAll = (event: React.KeyboardEvent<HTMLDivElement>) => modalKeyDown(event, allDialog.current, () => { if (!busy) closeAll() }) // ES-236: Esc y Tab atrapado en el helper común
  // Retira lo cruzado (si lo hay) y después los permisos activos, uno por uno. Un corte a medias no se declara éxito: se relee todo y se dice la verdad.
  const withdrawAll = async () => {
    setBusy(true); setNotice(null)
    try {
      if (active.length) await api.revoke()
      const opts = { baseUrl: backend, token }
      const current = await readPermissions(opts)
      for (const source of sourceIds) if (current[source]) await setPermission(opts, source, false)
      const after = await readPermissions(opts)
      setProposals(emptyProposals); setReloadKey(key => key + 1); await load()
      const fresh = await api.read()
      const clean = !fresh.active && sourceIds.every(source => !after[source])
      setNotice(clean ? { kind: 'ok', text: c.withdrawAllDone } : { kind: 'error', text: c.withdrawAllUncertain })
    } catch (error) {
      if (error instanceof CompassError && error.status === 401) setExpired(true)
      else { setReloadKey(key => key + 1); await load().catch(() => undefined); setNotice({ kind: 'error', text: c.withdrawAllUncertain }) }
    } finally { setBusy(false); setAskAll(false); setFocusTarget({ kind: 'pro' }) }
  }
  const ask = (id: string) => { setConfirming(id); setNotice(null) }
  const cancel = () => { const id = confirming; setConfirming(null); if (id) setFocusTarget({ kind: 'authorize', id }) }
  const togglePeek = (id: string) => setPeek(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })

  if (expired) return <SpaceShell><div role="alert" className="bridge-note">{c.session} <Link className="elv-link" to="/login">{c.login}</Link></div></SpaceShell>
  const version = ctx?.active
  return <SpaceShell>
    <section className="bridge" aria-labelledby="bridge-title">
      <header className="bridge-head">
        <p className="bridge-zone">◈ {c.zone}</p>
        <h1 id="bridge-title">{c.title}</h1>
        <p>{c.intro}</p><p className="bridge-small">{c.onlyText}</p>
        {insights.some(insight => insight.example) && <p className="bridge-tag" role="note">{c.exampleNote} {c.exampleWarn}</p>}
      </header>
      <p className="bridge-live" role="status" aria-live="polite">{busy ? c.saving : notice?.kind === 'ok' ? notice.text : ''}</p>
      {notice?.kind === 'error' && <p className="bridge-note bridge-error" role="alert">{notice.text}</p>}
      {!ctx && !loadError && <p role="status" aria-busy="true" className="bridge-note">{c.loading}</p>}
      {loadError && <p className="bridge-note bridge-error" role="alert"><button type="button" className="elv-link" onClick={() => void load()}>{c.loadError}</button></p>}
      {ctx && <div className="bridge-cols">
        <section className="bridge-col" aria-labelledby="bridge-private">
          <h2 id="bridge-private">🔒 {c.private}</h2>
          <SourcesPanel baseUrl={backend} token={token} lang={lang} onResult={onResult} onExpired={onExpired} onPerms={setPerms} reloadKey={reloadKey} />
          {!todo.length && <div className="bridge-empty" role="status"><p>{insights.length ? c.nothing : c.empty}</p>{!insights.length && <p className="bridge-small">{c.emptyNote} <Link className="elv-link" to="/app/compass">{c.toCompass}</Link></p>}</div>}
          {todo.map(insight => {
            const open = peek.has(insight.id); const asking = confirming === insight.id; const blocked = whyNot(active, insight)
            return <article key={insight.id} className={`bridge-card${asking ? ' bridge-card-asking' : ''}`} onKeyDown={event => { if (asking && event.key === 'Escape') { event.stopPropagation(); cancel() } }}>
              <div className="bridge-row">
                <span className="bridge-small">{formatDate(insight.date, lang)}{insight.example && <span className="bridge-pill bridge-pill-dash"> {c.example}</span>}{insight.source && <span className="bridge-pill bridge-pill-dash"> {c[`src_from_${insight.source}` as keyof typeof c]}</span>}</span>
                <span><span className={`bridge-pill${insight.status === 'unassessed' ? ' bridge-pill-dash' : ''}`}>{insight.status === 'hypothesis' ? c.hypothesis : c.unassessed}</span>
                  <button type="button" className="bridge-eye" aria-pressed={open} aria-label={open ? c.hide : c.show} onClick={() => togglePeek(insight.id)}>{open ? '◉' : '◎'}</button></span>
              </div>
              <div className={`bridge-frag${open ? '' : ' bridge-blur'}`} data-label={c.show}><span aria-hidden={!open}>{insight.fragment}</span></div>
              <div className="bridge-insight"><b>{c.insight}</b>{insight.text}<small>{c[insight.key]}</small></div>
              {asking
                ? <div className="bridge-ask" role="group" aria-label={c.confirmQ}><p>{c.confirmQ}</p>
                  <div><button type="button" ref={confirmButton} className="bridge-ok" disabled={busy} onClick={() => void authorize(insight)}>{busy ? c.saving : c.confirm}</button><button type="button" className="bridge-no" disabled={busy} onClick={cancel}>{c.cancel}</button></div></div>
                : <><button type="button" className="bridge-cta" disabled={busy || blocked !== null} data-authorize={insight.id} onClick={() => ask(insight.id)}>{c.authorize}</button>
                  {blocked && <p className="bridge-small" role="note">{blocked === 'limit_total' ? c.limitTotal : c.limitKey}</p>}</>}
            </article>
          })}
        </section>
        <div className="bridge-arrow" aria-hidden="true">↓</div>
        <section className="bridge-col" aria-labelledby="bridge-pro">
          <h2 id="bridge-pro" ref={proHeading} tabIndex={-1}>{c.professional}</h2>
          {version?.needsReview && <div className="bridge-review" role="note"><strong>{c.review}</strong><p>{version.reviewReason === 'source_revoked' ? c.reviewSourceRevoked : c.reviewText}</p></div>}
          {!active.length && <div className="bridge-empty" role="status"><p>{c.nothing}</p></div>}
          {version && active.length > 0 && <>
            <p className="bridge-small">{c.version.replace('{v}', String(version.version)).replace('{date}', formatDate(version.approvedAt.slice(0, 10), lang))}</p>
            <ul className="bridge-list">{active.map(field => <li key={`${field.key}|${field.text}`} className="bridge-done">
              <div className="bridge-row"><span className="bridge-pill bridge-pill-ok">✓ {c.hypothesis}</span>{exampleTexts.has(field.text) && insights.some(insight => insight.example) && <span className="bridge-pill bridge-pill-dash">{c.example}</span>}<small className="bridge-small">{c[field.key]}</small></div>
              <p>{field.text}</p>
              <button type="button" className="bridge-link" disabled={busy} onClick={() => void remove(field)}>{c.revoke}<span className="bridge-sr"> — {field.text}</span></button>
            </li>)}</ul></>}
        </section>
      </div>}
      {ctx && (active.length > 0 || anyPerm) && <footer className="bridge-foot">
        <button type="button" className="bridge-link" disabled={busy} data-withdraw-all onClick={() => setAskAll(true)}>{c.revokeAll}</button>
      </footer>}
      {askAll && <div className="bridge-modal-bg">
        <div ref={allDialog} className="bridge-modal" role="dialog" aria-modal="true" aria-labelledby="bridge-all-title" onKeyDown={trapAll}>
          <h3 id="bridge-all-title">{c.revokeAllQ}</h3>
          <ul>{active.length > 0 && <li>{c.withdrawAllCrossed}</li>}{anyPerm && <li>{c.withdrawAllPerms}</li>}<li>{c.withdrawAllKeep}</li></ul>
          <div className="bridge-modal-btns">
            <button type="button" ref={cancelAll} className="bridge-no" disabled={busy} onClick={closeAll}>{c.cancel}</button>
            <button type="button" className="bridge-ok" disabled={busy} onClick={() => void withdrawAll()}>{busy ? c.saving : c.revokeAll}</button>
          </div>
        </div>
      </div>}
    </section>
  </SpaceShell>
}
