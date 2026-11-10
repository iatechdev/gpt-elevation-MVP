import { useEffect, useId, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useCopy, useFacilitation } from './context'
import { PreviewError, type Command, type Review, type Material, type Progress } from './fixture'
import type { TextKey } from './copy'
import { LIMITS, textProblem } from './validation'

function DateLabel({ value }: { value: string }) {
  const { lang } = useCopy()
  return <time dateTime={value}>{new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(value))} · America/Bogota</time>
}
export function Participants() {
  const { t } = useCopy()
  const { snapshot } = useFacilitation()
  return <section><h2>{t('roster')}</h2>
    {!snapshot.participants.length ? <p>{t('empty')}</p> : <ul className="fac-grid">{snapshot.participants.map(p => <li className="elv-card" key={p.id}>
      <div className="elv-card-body"><h3>{t('person')} {p.alias}</h3>
        <p>{t('invitation')}: {t(p.invitation)}</p><p>{t('progress')}: {t(p.progress)}</p>
        <Link className="elv-btn" to={'/facilitation/participants/' + p.id}>{t('view')} · {p.alias}</Link>
      </div>
    </li>)}</ul>}
    <p>{t('aggregate')}</p>
  </section>
}
export function ParticipantDetail() {
  const { id } = useParams()
  const { snapshot, refresh, dirty } = useFacilitation()
  const { t } = useCopy()
  const person = snapshot.participants.find(p => p.id === id)
  const [invite, setInvite] = useState(false)
  const [opened, setOpened] = useState<string | null>(null)
  if (!person) return <p role="alert">{t('noAccess')}</p>
  return <section><Link className="elv-btn" to="/facilitation">{t('back')}</Link>
    <h2>{t('person')} {person.alias}</h2>
    <div className="fac-columns"><section className="elv-card"><div className="elv-card-body">
      <h3>{t('progress')}</h3><ProgressSteps progress={person.progress} /><p>{t('invitation')}: {t(person.invitation)}</p>
      {person.invitation !== 'accepted' && <button className="elv-btn" disabled={dirty} onClick={() => setInvite(true)}>{t('invite')}</button>}
      {invite && <RecordForm command={{ kind: 'invitation', participantId: person.id }} close={() => setInvite(false)} />}
      <h3>{t('issues')}</h3><p>{t(person.issue ? 'recovery' : 'noIssues')}</p>
      <button className="elv-btn" disabled={dirty} onClick={refresh}>{t('refresh')}</button>
    </div></section>
    <section><h3>{t('materials')}</h3>{!person.materials.length && <p>{t('noMaterials')}</p>}
      {person.materials.map(m => <article key={m.id} className="elv-card"><div className="elv-card-body">
        <h4>{t('sampleTitle')} · {t('version')} {m.version}</h4>
        {!m.active ? <p>{t('withdrawn')}</p> : <>
          <p>{t('source')}</p><div className="fac-actions"><button className="elv-btn" disabled={dirty} onClick={() => setOpened(opened === m.id ? null : m.id)} aria-expanded={opened === m.id}>{t('material')}</button>
          <Link className="elv-btn" to={'/facilitation/participants/' + person.id + '/reviews/new?shareId=' + m.id}>{t('review')}</Link></div>
          {opened === m.id && <div><p>{t('sample')}</p><p>{t('evidenceTitle')}</p><p>{t('evidence')}</p></div>}
        </>}
      </div></article>)}
    </section></div>
    <ReviewHistory participantId={person.id} />
  </section>
}
const STEPS = ['context', 'choice', 'submitted', 'plan'] as const
// Progreso por pasos EN PALABRAS (Hecho / Pendiente), no solo color: la lista ordenada dice qué pasos se cumplieron.
function ProgressSteps({ progress }: { progress: Progress }) {
  const { t } = useCopy()
  const reached = (STEPS as readonly string[]).indexOf(progress)
  return <><ol className="fac-steps" aria-label={t('steps')}>{STEPS.map((step, index) => <li key={step}><span>{t(step)}</span>: <strong>{index <= reached ? t('done') : t('pending')}</strong></li>)}</ol>
    {progress === 'unknown' && <p>{t('unknown')}</p>}</>
}
export function NewReview() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { snapshot } = useFacilitation()
  const { t, lang } = useCopy()
  const person = snapshot.participants.find(p => p.id === id)
  const m = person?.materials.find(m => m.id === params.get('shareId') && m.active)
  if (!person || !m) return <p role="alert">{t('noAccess')}</p>
  return <section><Link className="elv-btn" to={'/facilitation/participants/' + person.id}>{t('back')}</Link>
    <h2>{t('review')} · {t('person')} {person.alias}</h2>
    <p>{t('sampleTitle')} · {t('version')} {m.version}</p><p>{t('source')}</p><p>{t('sample')}</p>
    <RecordForm key={m.id} material={m} command={{ kind: 'review', participantId: person.id, shareId: m.id, materialVersion: m.version, evidenceRefs: [], observation: '', limits: '', locale: lang }} />
    <ReviewHistory participantId={person.id} />
  </section>
}
export function OwnReviews() {
  const { t } = useCopy()
  return <section><h2>{t('own')}</h2><p>{t('participantDemo')}</p><ReviewHistory participantId="synthetic-A" own /></section>
}
function ReviewHistory({ participantId, own = false }: { participantId: string; own?: boolean }) {
  const { snapshot, dirty } = useFacilitation()
  const { t, lang } = useCopy()
  const [active, setActive] = useState<{ review: Review; mode: 'objection' | 'response'; objectionId?: string } | null>(null)
  const reviews = snapshot.reviews.filter(r => r.participantId === participantId)
  return <section><h3>{t('history')}</h3>{!reviews.length && <p>{t('noReviews')}</p>}
    {reviews.map(r => {
      const m = snapshot.participants.find(p => p.id === participantId)?.materials.find(m => m.id === r.shareId && m.active && m.version === r.materialVersion)
      return <article className="elv-card" key={r.id}><div className="elv-card-body">
        <h4>{t('sampleTitle')} · {t('version')} {r.materialVersion}</h4>
        <p>{t('author')}: {t('reviewer')} · {t('date')}: <DateLabel value={r.at} /></p>
        {!m && <p>{t('staleReview')}</p>}
        <p>{t('contentLanguage')}: {r.locale.toUpperCase()}</p>
        <h5>{t('observation')}</h5><p lang={r.locale} className="fac-prose">{r.observation}</p>
        <h5>{t('limits')}</h5><p lang={r.locale} className="fac-prose">{r.limits}</p>
        <p>{t('reviewedEvidence')}: {r.evidenceRefs.map(() => t('evidenceTitle')).join(', ')}</p>
        {snapshot.events.filter(e => e.reviewId === r.id).map(e => <section className="fac-event" key={e.id}>
          <h5>{t(e.type === 'objection' ? 'objectionRecorded' : 'response')}</h5>
          <p>{t('author')}: {t(e.author === 'reviewer' ? 'reviewer' : 'person')} · <DateLabel value={e.at} /></p>
          <p>{t('contentLanguage')}: {e.locale.toUpperCase()}</p><p lang={e.locale} className="fac-prose">{e.text}</p>
          {e.type === 'objection' && <><p>{t(snapshot.events.some(x => x.objectionId === e.id) ? 'responded' : 'awaiting')}</p>
            {!own && m && !snapshot.events.some(x => x.objectionId === e.id) && <button className="elv-btn" disabled={dirty} onClick={() => setActive({ review: r, mode: 'response', objectionId: e.id })}>{t('respond')}</button>}
          </>}
        </section>)}
        {own && <button className="elv-btn" disabled={dirty} onClick={() => setActive({ review: r, mode: 'objection' })}>{t('object')}</button>}
        {active?.review.id === r.id && <RecordForm key={r.id + active.mode + active.objectionId} close={() => setActive(null)}
          command={active.mode === 'objection' ? { kind: 'objection', reviewId: r.id, reason: '', locale: lang } : { kind: 'response', reviewId: r.id, objectionId: active.objectionId!, response: '', locale: lang }} />}
        <p>{t('disclaimer')}</p>
      </div></article>
    })}
  </section>
}
type TextField = 'observation' | 'limits' | 'reason' | 'response'
type Field = 'evidence' | TextField
const FIELD_ORDER: Field[] = ['evidence', 'observation', 'limits', 'reason', 'response']
function RecordForm({ command, material, close }: { command: Command; material?: Material; close?: () => void }) {
  const { t, lang } = useCopy()
  const { snapshot, service, setDirty, write, refresh, sync, dirty: anyDirty } = useFacilitation()
  const formId = useId()
  const [draft, setDraft] = useState(command)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<TextKey | ''>('')
  const [done, setDone] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, TextKey>>>({})
  const [focusField, setFocusField] = useState<Field | null>(null)
  const [currentVersion, setCurrentVersion] = useState<number | null>(null)
  const [pending, setPending] = useState<{ id: string; body: Command; revision: number } | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const status = useRef<HTMLParagraphElement>(null)
  const dirty = !done && (preview || draft.kind === 'invitation' ||
    (draft.kind === 'review' ? Boolean(draft.observation || draft.limits || draft.evidenceRefs.length) : draft.kind === 'objection' ? Boolean(draft.reason) : Boolean(draft.response)))
  const otherDirty = anyDirty && !dirty
  useEffect(() => { setDirty(formId, dirty); return () => setDirty(formId, false) }, [dirty, setDirty, formId])
  useEffect(() => { if (done || error) status.current?.focus() }, [done, error])
  useEffect(() => { if (focusField) { document.getElementById(`${formId}-${focusField}`)?.focus(); setFocusField(null) } }, [focusField, formId])
  const change = (next: Command) => {
    const hasText = draft.kind === 'review' ? Boolean(draft.observation || draft.limits) : draft.kind === 'objection' ? Boolean(draft.reason) : draft.kind === 'response' ? Boolean(draft.response) : false
    setDraft(next.kind !== 'invitation' && !hasText ? { ...next, locale: lang } : next)
    setError(''); setFieldErrors({}); setCurrentVersion(null)
  }
  const cancel = () => {
    setDirty(formId, false); setPreview(false); setPending(null); setDraft(command); setError(''); setFieldErrors({}); setCurrentVersion(null)
    if (error === 'conflict') refresh()
    close?.()
  }
  // Conflicto de versión: se muestra la versión vigente del material (lectura sin «Cargando…») y se ofrece usarla SIN perder lo escrito.
  function viewCurrent() {
    if (draft.kind !== 'review') return
    try {
      const latest = service.read().participants.find((p) => p.id === draft.participantId)?.materials.find((m) => m.id === draft.shareId && m.active)
      if (latest) setCurrentVersion(latest.version); else setError('noAccess')
    } catch { setError('noAccess') }
  }
  function adoptCurrentVersion() {
    if (draft.kind !== 'review' || currentVersion === null) return
    sync()
    setDraft({ ...draft, materialVersion: currentVersion, evidenceRefs: [] }) // el texto se conserva; las evidencias se vuelven a elegir sobre la versión vigente
    setPending(null); setPreview(false); setError(''); setCurrentVersion(null)
  }
  async function confirm() {
    setBusy(true); setError('')
    const p = pending ?? { id: crypto.randomUUID(), body: structuredClone(draft), revision: snapshot.revision }
    setPending(p)
    try {
      await write(p.id, p.body, p.revision, draft.kind === 'objection' ? 'participant' : 'reviewer')
      setDirty(formId, false); setDone(true)
    } catch (e) { setError(e instanceof PreviewError && e.code === 'conflict' ? 'conflict' : e instanceof PreviewError && e.code === 'revoked' ? 'noAccess' : 'saveError') }
    finally { setBusy(false) }
  }
  const textField = (field: TextField, label: TextKey, max: number, value: string) => { const problem = fieldErrors[field]; const near = value.length >= max * 0.9; const base = `${formId}-${field}`; return <div className="fac-field">
    <label htmlFor={base}>{t(label)}</label><textarea id={base} className="elv-textarea" required maxLength={max} value={value} disabled={busy || preview || otherDirty} aria-invalid={Boolean(problem)} aria-describedby={base + '-count' + (problem ? ' ' + base + '-error' : '')}
      onChange={e => change({ ...draft, [field]: e.target.value } as Command)} />
    <small id={base + '-count'}>{value.length} / {max} {t('characters')}</small>
    <span className="fac-sr" aria-live="polite">{near ? `${value.length} / ${max} ${t('characters')}` : ''}</span>
    {problem && <small id={base + '-error'} role="alert" className="fac-error">{t(problem)}</small>}
  </div> }
  if (done) return <p ref={status} tabIndex={-1} role="status">{t('synthetic')} {t(draft.kind === 'review' ? 'recorded' : draft.kind === 'objection' ? 'objectionRecorded' : draft.kind === 'response' ? 'responseRecorded' : 'invitationRequested')}</p>
  return <form className="fac-form" ref={form} noValidate onSubmit={e => {
    e.preventDefault()
    const errors: Partial<Record<Field, TextKey>> = {}
    if (draft.kind === 'review') {
      if (!draft.evidenceRefs.length) errors.evidence = 'selectEvidence'
      const o = textProblem(draft.observation, LIMITS.observation); if (o) errors.observation = o
      const l = textProblem(draft.limits, LIMITS.limits); if (l) errors.limits = l
    } else if (draft.kind === 'objection') { const r = textProblem(draft.reason, LIMITS.reason); if (r) errors.reason = r }
    else if (draft.kind === 'response') { const r = textProblem(draft.response, LIMITS.response); if (r) errors.response = r }
    const first = FIELD_ORDER.find((field) => errors[field])
    if (first) { setFieldErrors(errors); setFocusField(first); return } // un mensaje por campo y el foco al primero con problema
    setFieldErrors({}); setPreview(true)
  }}>
    {draft.kind === 'invitation' ? <p>{t('invitationNote')}</p> : <>
      {draft.kind === 'review' && <>
        <fieldset disabled={busy || preview || otherDirty}><legend>{t('examined')}</legend>
          {material?.evidenceRefs.map((ref, index) => <label className="fac-check" key={ref}><input id={index === 0 ? `${formId}-evidence` : undefined} className="elv-checkbox" type="checkbox" aria-invalid={Boolean(fieldErrors.evidence)} aria-describedby={fieldErrors.evidence ? `${formId}-evidence-error` : undefined} checked={draft.evidenceRefs.includes(ref)}
            onChange={e => change({ ...draft, evidenceRefs: e.target.checked ? [...draft.evidenceRefs, ref] : draft.evidenceRefs.filter(x => x !== ref) })} />{t('evidenceTitle')} · {t('version')} {material.version}</label>)}
          <p>{t('evidence')}</p>
          {fieldErrors.evidence && <p id={`${formId}-evidence-error`} role="alert" className="fac-error">{t(fieldErrors.evidence)}</p>}
        </fieldset>
        {textField('observation', 'observation', LIMITS.observation, draft.observation)}
        {textField('limits', 'limits', LIMITS.limits, draft.limits)}
      </>}
      {draft.kind === 'objection' && textField('reason', 'reason', LIMITS.reason, draft.reason)}
      {draft.kind === 'response' && textField('response', 'response', LIMITS.response, draft.response)}
    </>}
    {preview && <section className="fac-preview" aria-label={t('previewAction')}>
      <h3>{t('previewAction')}</h3><p>{t('exact')}</p>
      {draft.kind === 'review' && <><p>{t('sampleTitle')} · {t('version')} {draft.materialVersion}</p>
        <p>{t('examined')}: {draft.evidenceRefs.map(() => t('evidenceTitle')).join(', ')}</p>
        <h4>{t('observation')}</h4><p className="fac-prose">{draft.observation}</p>
        <h4>{t('limits')}</h4><p className="fac-prose">{draft.limits}</p></>}
      {draft.kind === 'objection' && <p className="fac-prose">{draft.reason}</p>}
      {draft.kind === 'response' && <p className="fac-prose">{draft.response}</p>}
      <p>{t('contentLanguage')}: {(draft.kind !== 'invitation' ? draft.locale : lang).toUpperCase()}</p>
    </section>}
    <p id={formId} ref={status} tabIndex={-1} role={error ? 'alert' : 'status'}>{error ? t(error) : busy ? t('saving') : ''}</p>
    {error === 'conflict' && draft.kind === 'review' && <div className="fac-conflict">
      {currentVersion === null
        ? <button className="elv-btn" type="button" onClick={viewCurrent}>{t('viewCurrent')}</button>
        : <><p>{t('currentIs')} {currentVersion}; {t('draftUses')} {draft.materialVersion}.</p><button className="elv-btn elv-btn-primary" type="button" onClick={adoptCurrentVersion}>{t('useCurrent')}</button></>}
    </div>}
    <div className="fac-actions">
      {!preview && <button className="elv-btn elv-btn-primary" type="submit" disabled={otherDirty}>{t('previewAction')}</button>}
      {preview && <button className="elv-btn elv-btn-primary" type="button" disabled={busy || error === 'conflict' || error === 'noAccess'} onClick={confirm}>
        {t(error === 'saveError' ? 'retry' : draft.kind === 'objection' ? 'confirmObjection' : draft.kind === 'response' ? 'confirmResponse' : draft.kind === 'invitation' ? 'confirmInvite' : 'confirm')}
      </button>}
      {preview && !pending && <button className="elv-btn" type="button" onClick={() => setPreview(false)}>{t('edit')}</button>}
      <button className="elv-btn" type="button" disabled={busy} onClick={cancel}>{t('cancel')}</button>
    </div>
  </form>
}
