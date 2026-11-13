// ES-175 (HU-P24) · «Mis revisiones» de la persona, CONECTADA al servidor real (#262), con el sistema «Cartografía» (diseño aprobado: comentarios 11856, 11858 y 11956).
// El servidor verifica propietario y permiso en cada acceso; esta pantalla solo muestra lo que responde, como TEXTO (React escapa), y conserva siempre lo que la persona escribió.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Chip, TextAreaField } from '../cartografia/controls'
import { Banner, Card } from '../cartografia/pieces'
import { CartografiaRoot } from '../cartografia/theme'
import { LangSwitch } from '../shell/Frame'
import { dateText } from '../routeCatalog/person'
import { API, useSession } from '../routeCatalog/shared'
import { useCopy } from './context'
import type { TextKey } from './copy'
import { PERSON_REVIEWS_SIGNED } from './personConfig'
import { failureOf, ReviewsError, reviewsApi, type Failure, type ReviewView } from './personApi'
import { LIMITS, textProblem } from './validation'
import './person-reviews.css'

type Api = ReturnType<typeof reviewsApi>

export function PersonReviews() {
  const session = useSession(); const token = (JSON.parse(session) as string[])[0]
  return token ? <Active key={session} token={token} /> : <Navigate to="/login" replace />
}

function Dialog({ onKeep, onLeave }: { onKeep: () => void; onLeave: () => void }) {
  const { t } = useCopy(); const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return (
    <dialog ref={ref} className="cg-dialog" aria-labelledby="leave-title" onCancel={event => { event.preventDefault(); onKeep() }}>
      <h2 id="leave-title" className="cg-h2">{t('dirty')}</h2>
      <div className="cg-dialog__actions"><button className="cg-btn" autoFocus onClick={onKeep}>{t('keep')}</button><button className="cg-btn cg-btn--ghost" onClick={onLeave}>{t('discard')}</button></div>
    </dialog>
  )
}

function Active({ token }: { token: string }) {
  const { t, lang } = useCopy()
  const api = useMemo(() => reviewsApi(API, token), [token])
  const [reviews, setReviews] = useState<ReviewView[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'session'>('loading')
  const [attempt, setAttempt] = useState(0); const [flash, setFlash] = useState<TextKey | ''>('')
  const [drafts, setDrafts] = useState<Record<number, true>>({}); const dirty = Object.keys(drafts).length > 0
  const [leave, setLeave] = useState<(() => void) | null>(null)
  const flashRef = useRef<HTMLParagraphElement>(null); const main = useRef<HTMLElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    void api.list(controller.signal).then(rows => { if (!controller.signal.aborted) { setReviews(rows); setStatus('ok') } })
      .catch(error => { if (!controller.signal.aborted) setStatus(error instanceof ReviewsError && [401, 403].includes(error.status) ? 'session' : 'error') })
    return () => controller.abort()
  }, [api, attempt])
  useEffect(() => { if (flash) flashRef.current?.focus() }, [flash])
  const setDirty = useCallback((id: number, value: boolean) => setDrafts(previous => { if (Boolean(previous[id]) === value) return previous; const next = { ...previous }; if (value) next[id] = true; else delete next[id]; return next }), [])
  // Con texto escrito, salir de la página pide confirmación (recarga o enlace interno); nada se pierde en silencio.
  useEffect(() => {
    if (!dirty) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.origin !== window.location.origin || anchor.hash || anchor.target) return
      event.preventDefault(); event.stopImmediatePropagation()
      setLeave(() => () => { window.location.assign(anchor.pathname + anchor.search) })
    }
    window.addEventListener('beforeunload', unload); document.addEventListener('click', click, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true) }
  }, [dirty])
  // E268-4: «Atrás» del navegador. Con texto escrito se añade UNA entrada de historial como tope: al pulsar atrás se vuelve a poner y se pregunta; «Descartar y salir» retrocede de verdad (2 pasos).
  const sentinel = useRef(false); const ignorePop = useRef(false)
  useEffect(() => {
    if (dirty && !sentinel.current) { window.history.pushState({ cgfGuard: true }, ''); sentinel.current = true }
    if (!dirty && sentinel.current) { sentinel.current = false; ignorePop.current = true; window.history.back() }
  }, [dirty])
  useEffect(() => {
    const pop = () => {
      if (ignorePop.current) { ignorePop.current = false; return }
      if (!sentinel.current) return
      window.history.pushState({ cgfGuard: true }, '') // se queda en la página; el diálogo decide
      setLeave(() => () => { sentinel.current = false; window.history.go(-2) })
    }
    window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop)
  }, [])
  const refresh = (key: TextKey | '') => { setFlash(key); setAttempt(n => n + 1) }

  let content: ReactNode
  if (status === 'loading') content = <p role="status" className="cg-muted">{t('loading')}</p>
  else if (status === 'session') content = <Banner kind="error" title={t('sessionExpired')}><div className="cg-row"><Link className="cg-btn" to="/login">{t('login')}</Link></div></Banner>
  else if (status === 'error') content = <Banner kind="error" title={t('reloadError')}><div className="cg-row"><button className="cg-btn" onClick={() => { setStatus('loading'); setAttempt(n => n + 1) }}>{t('retry')}</button></div></Banner>
  else if (!reviews?.length) content = <Banner title={t('reviewsEmpty')} />
  else content = <ul className="cgf-list" aria-label={t('history')}>{reviews.map(review => <li key={review.id}><ReviewCard review={review} api={api} lang={lang} blocked={dirty && !drafts[review.id]} setDirty={setDirty} onRefresh={refresh} onSession={() => setStatus('session')} /></li>)}</ul>

  return (
    <CartografiaRoot className="cgf">
      <a className="cg-skip" href="#fac-main">{t('skip')}</a>
      <header className="cg-header"><Link className="cg-btn cg-btn--ghost" to="/app/dashboard"><span aria-hidden="true">← </span>{t('backToDashboard')}</Link><div className="cg-header__end"><LangSwitch /></div></header>
      <main id="fac-main" className="cg-page cgf-main" ref={main} tabIndex={-1}>
        <h1 className="cg-h1">{t('own')}</h1>
        {!PERSON_REVIEWS_SIGNED && <Banner title={t('validationBanner')} />}
        <p className="cg-muted">{t('disclaimer')}</p>
        {flash && <p ref={flashRef} tabIndex={-1} role="status" className="cg-banner">{t(flash)}</p>}
        {content}
      </main>
      {leave && <Dialog onKeep={() => setLeave(null)} onLeave={() => { const go = leave; setDrafts({}); setLeave(null); go() }} />}
    </CartografiaRoot>
  )
}

type Pending = { requestId: string; reason: string }

function ReviewCard({ review, api, lang, blocked, setDirty, onRefresh, onSession }: { review: ReviewView; api: Api; lang: 'es' | 'en'; blocked: boolean; setDirty: (id: number, value: boolean) => void; onRefresh: (key: TextKey | '') => void; onSession: () => void }) {
  const { t } = useCopy(); const field = useId()
  const [open, setOpen] = useState(false); const [text, setText] = useState(''); const [preview, setPreview] = useState(false); const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null); const [problem, setProblem] = useState<TextKey | ''>('')
  const pending = useRef<Pending | null>(null); const opener = useRef<HTMLButtonElement>(null); const status = useRef<HTMLParagraphElement>(null)
  const when = (value: string) => dateText(value, lang) ?? ''
  const hasDraft = open && (text.length > 0 || preview)
  useEffect(() => { setDirty(review.id, hasDraft) }, [hasDraft, review.id, setDirty])
  useEffect(() => () => setDirty(review.id, false), [review.id, setDirty])
  useEffect(() => { if (failure) status.current?.focus() }, [failure])
  useEffect(() => { if (open) document.getElementById(field)?.focus() }, [open, field])
  const reset = () => { setOpen(false); setText(''); setPreview(false); setFailure(null); setProblem(''); pending.current = null; requestAnimationFrame(() => opener.current?.focus()) }

  async function confirm() {
    // El MISMO texto reutiliza el MISMO requestId (un reintento no duplica); si cambia el texto, es otra solicitud.
    const current = pending.current?.reason === text ? pending.current : { requestId: crypto.randomUUID(), reason: text }
    pending.current = current; setBusy(true); setFailure(null)
    try {
      await api.object(review.id, { reason: text, requestId: current.requestId, locale: lang })
      setDirty(review.id, false); reset(); onRefresh('objectionSaved')
    } catch (error) {
      const result = failureOf(error)
      if (result.kind === 'session') { onSession(); return }
      if (result.kind === 'already') { reset(); onRefresh('alreadyObjected'); return }
      if (result.kind === 'gone') { reset(); onRefresh('reviewGone'); return }
      if (result.kind === 'invalid') { setPreview(false); setProblem(result.field ?? 'required'); setFailure(null); return }
      if (result.kind === 'conflict') onRefresh('requestConflict')
      setFailure(result)
    } finally { setBusy(false) }
  }
  function submit(event: React.FormEvent) {
    event.preventDefault()
    const found = textProblem(text, LIMITS.reason); if (found) { setProblem(found); document.getElementById(field)?.focus(); return }
    setProblem(''); setPreview(true)
  }
  const message: TextKey | '' = failure ? (failure.kind === 'consent' ? 'consentRevoked' : failure.kind === 'conflict' ? 'requestConflict' : failure.kind === 'uncertain' ? 'objectionUncertain' : '') : ''
  const answered = review.status === 'answered'

  return (
    <Card as="article" className="cgf-review">
      <h2 className="cg-h2">{t('reviewHeading')} · {t('materialVersionLabel')} {review.materialVersion}</h2>
      <p className="cg-small cg-muted">{t('author')}: {review.author ?? t('reviewerFallback')} · {when(review.createdAt)} · {t('contentLanguage')}: {review.locale.toUpperCase()}</p>
      <p className="cgf-chips">
        {review.status !== 'none' && (answered ? <Chip tone="ok" symbol="✓">{t('responded')}</Chip> : <Chip tone="wait" symbol="○">{t('awaiting')}</Chip>)}
        {review.materialChanged && <Chip tone="wait" symbol="!">{t('materialChanged')}</Chip>}
      </p>
      <h3 className="cg-tag">{t('observation')}</h3><p lang={review.locale} className="fac-prose">{review.observation}</p>
      <h3 className="cg-tag">{t('limits')}</h3><p lang={review.locale} className="fac-prose">{review.limits}</p>
      <p className="cg-small cg-muted">{t('reviewedEvidence')}: {review.evidence.map(e => e.title ?? t('evidenceUnavailable')).join(', ') || t('evidenceUnavailable')}</p>
      {review.objection && <section className="cgf-event" aria-label={t('objectionRecorded')}>
        <h3 className="cg-tag">{t('objectionRecorded')} · {t('person')} · {when(review.objection.createdAt)}</h3>
        <p className="cg-small cg-muted">{t('contentLanguage')}: {review.objection.locale.toUpperCase()}</p><p lang={review.objection.locale} className="fac-prose">{review.objection.reason}</p>
      </section>}
      {review.response && <section className="cgf-event" aria-label={t('response')}>
        <h3 className="cg-tag">{t('response')} · {review.response.author ?? t('reviewerFallback')} · {when(review.response.createdAt)}</h3>
        <p className="cg-small cg-muted">{t('contentLanguage')}: {review.response.locale.toUpperCase()}</p><p lang={review.response.locale} className="fac-prose">{review.response.text}</p>
      </section>}
      {!review.objection && !open && <div className="cg-row"><button type="button" className="cg-btn" ref={opener} disabled={blocked} onClick={() => setOpen(true)}>{t('object')}</button></div>}
      {!review.objection && open && (
        <form className="cgf-form" noValidate onSubmit={submit} aria-busy={busy}>
          <TextAreaField id={field} label={t('reason')} required maxLength={LIMITS.reason} value={text} disabled={busy || preview} hint={`${[...text].length} / ${LIMITS.reason} ${t('characters')}`} error={problem ? t(problem) : undefined}
            onChange={event => { setText(event.target.value); setProblem(''); setFailure(null) }} />
          {preview && <section className="cg-hintbox" aria-label={t('previewAction')}><h3 className="cg-tag">{t('previewAction')}</h3><p>{t('exact')}</p><p className="fac-prose">{text}</p><p>{t('contentLanguage')}: {lang.toUpperCase()}</p></section>}
          <p ref={status} tabIndex={-1} role={failure ? 'alert' : 'status'} className={failure ? 'cg-error' : 'cg-muted'}>{message ? t(message) : busy ? t('saving') : ''}</p>
          <div className="cg-row">
            {!preview && <button className="cg-btn" type="submit" disabled={busy}>{t('previewAction')}</button>}
            {preview && <button className="cg-btn" type="button" disabled={busy || failure?.kind === 'consent'} onClick={() => void confirm()}>{failure?.kind === 'uncertain' ? t('checkAgain') : t('confirmObjection')}</button>}
            {preview && !pending.current && <button className="cg-btn cg-btn--ghost" type="button" disabled={busy} onClick={() => setPreview(false)}>{t('edit')}</button>}
            <button className="cg-btn cg-btn--ghost" type="button" disabled={busy} onClick={reset}>{t('cancel')}</button>
          </div>
        </form>
      )}
      <p className="cg-small cg-muted">{t('disclaimer')}</p>
    </Card>
  )
}
