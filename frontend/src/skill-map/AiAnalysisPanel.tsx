import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { evidenceApi } from '../evidence/api'
import type { Evidence } from '../evidence/model'
import { AiProposalError, buildConfirmBody, choicesFor, confirmProposals, defaultChoice, finalLevel, MAX_SKILLS, newRequestId, requestProposals, type AiFailure, type Choice, type Proposed } from './aiProposalApi'
import type { LocalizedText, Skill } from './model'
import { radarItems } from './radar'

type T = (key: string) => string
type Lang = 'es' | 'en'
type Step = 'loading' | 'noev' | 'pick' | 'analyzing' | 'review' | 'done'
const fmt = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
const errorKey: Record<AiFailure, string> = {
  expired: 'skill_map.expired', budget: 'skill_map.ai_e_budget', unavailable: 'skill_map.ai_e_unavailable', provider: 'skill_map.ai_e_provider', invalid_output: 'skill_map.ai_e_invalid_output',
  no_evidence: 'skill_map.ai_e_no_evidence', proposal_expired: 'skill_map.ai_e_proposal_expired', changed: 'skill_map.ai_e_changed', invalid: 'skill_map.ai_e_invalid', uncertain: 'skill_map.ai_e_uncertain', error: 'skill_map.ai_e_generic',
}
const retryable = new Set<AiFailure>(['provider', 'invalid_output', 'uncertain', 'error'])
const fresh = new Set<AiFailure>(['proposal_expired', 'changed'])

/** «Analizar mi evidencia con IA» (ES-30): la IA propone un nivel por capacidad a partir de evidencia CONFIRMADA; la persona acepta, baja o descarta. Nunca sube. */
export function AiAnalysisPanel({ skills, initialKeys, lang, t, backend, token, onSaved, onClose }: {
  skills: readonly Skill[]; initialKeys: readonly string[]; lang: Lang; t: T; backend: string; token: string
  onSaved: () => Promise<void> | void; onClose: () => void
}) {
  const [step, setStep] = useState<Step>('loading')
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [picked, setPicked] = useState<string[]>(() => initialKeys.slice(0, MAX_SKILLS))
  const [proposed, setProposed] = useState<Proposed | null>(null)
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [failure, setFailure] = useState<AiFailure | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedKeys, setSavedKeys] = useState<string[]>([])
  const requestId = useRef<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort() } }, [])
  useEffect(() => {
    const abort = new AbortController()
    evidenceApi(backend, token).list(abort.signal)
      .then(rows => { if (abort.signal.aborted) return; const ok = rows.filter(row => row.status === 'confirmed'); setEvidence(ok); setStep(ok.length ? 'pick' : 'noev') })
      .catch((error: unknown) => { if (!abort.signal.aborted) { setFailure(typeof error === 'object' && error !== null && 'status' in error && error.status === 401 ? 'expired' : 'error'); setStep('pick') } })
    return () => abort.abort()
  }, [backend, token])
  useEffect(() => { heading.current?.focus() }, [step])

  const items = useMemo(() => radarItems(skills), [skills])
  const name = (skill: Skill) => skill.labels[lang] ?? t('skill_map.translation_missing')
  const skillOf = (key: string) => skills.find(skill => skill.skillKey === key)
  const titleOf = (id: number) => evidence.find(row => row.id === id)?.payload.title ?? `#${id}`
  const localized = (value: LocalizedText | null | undefined) => value?.[lang] ?? ''
  const toggle = (key: string) => setPicked(current => current.includes(key) ? current.filter(k => k !== key) : current.length >= MAX_SKILLS ? current : [...current, key])

  async function analyze() {
    if (busy || picked.length < 1) return
    setBusy(true); setFailure(null); setStep('analyzing')
    const abort = new AbortController(); controller.current = abort
    try {
      const result = await requestProposals({ baseUrl: backend, token, skillKeys: picked, locale: lang, signal: abort.signal })
      if (!alive.current) return
      requestId.current = null
      setProposed(result); setChoices(Object.fromEntries(result.proposals.map(p => [p.skillKey, defaultChoice(p)]))); setStep('review')
    } catch (error) {
      if (!alive.current) return
      if (abort.signal.aborted) { setStep('pick'); return }
      const reason = error instanceof AiProposalError ? error.reason : 'error'
      setFailure(reason); setStep(reason === 'no_evidence' ? 'noev' : 'pick')
    } finally { if (alive.current) setBusy(false) }
  }
  const stop = () => controller.current?.abort()
  const choose = (key: string, choice: Choice) => { requestId.current = null; setFailure(null); setChoices(current => ({ ...current, [key]: choice })) }

  const accepted = proposed ? proposed.proposals.filter(p => finalLevel(p, choices[p.skillKey] ?? defaultChoice(p)) !== undefined) : []
  async function save() {
    if (busy || !proposed || accepted.length < 1) return
    if (Date.parse(proposed.expiresAt) <= Date.now()) { setFailure('proposal_expired'); return }
    requestId.current ??= newRequestId()
    setBusy(true); setFailure(null)
    try {
      const body = buildConfirmBody({ requestId: requestId.current, token: proposed.token, proposals: proposed.proposals, choices })
      await confirmProposals({ baseUrl: backend, token, body })
      requestId.current = null
      if (!alive.current) return
      setSavedKeys(body.accept); await onSaved(); if (alive.current) setStep('done')
    } catch (error) { if (alive.current) setFailure(error instanceof AiProposalError ? error.reason : 'error') }
    finally { if (alive.current) setBusy(false) }
  }
  const again = () => { setProposed(null); setChoices({}); setFailure(null); requestId.current = null; setStep('pick') }

  const problem = failure ? <div role="alert" className="ai-error"><p>{t(errorKey[failure])}{failure === 'expired' && <> <Link className="elv-link" to="/login">{t('skill_map.signin')}</Link></>}</p>
    {retryable.has(failure) && step === 'pick' && <button type="button" className="elv-btn" disabled={busy} onClick={() => void analyze()}>{t('skill_map.ai_retry')}</button>}
    {retryable.has(failure) && step === 'review' && <button type="button" className="elv-btn" disabled={busy} onClick={() => void save()}>{t('skill_map.ai_retry')}</button>}
    {fresh.has(failure) && step === 'review' && <button type="button" className="elv-btn" onClick={again}>{t('skill_map.ai_new_proposal')}</button>}</div> : null
  const stepper = (n: number) => <ol className="ai-steps" aria-label={t('skill_map.ai_steps')}>{(['ai_st1', 'ai_st2', 'ai_st3'] as const).map((key, i) => <li key={key} aria-current={i + 1 === n ? 'step' : undefined}>{i + 1} · {t(`skill_map.${key}`)}</li>)}</ol>
  const doneItems = items.filter(item => savedKeys.includes(item.skill.skillKey))

  return <section className="elv-card skill-map-card ai-panel" aria-labelledby="ai-title">
    <div className="elv-card-body">
      <h2 id="ai-title" ref={heading} tabIndex={-1}>{step === 'done' ? t('skill_map.ai_done_title') : step === 'noev' ? t('skill_map.ai_noev_title') : step === 'review' ? t('skill_map.ai_rev_title') : t('skill_map.ai_title')}</h2>
      {step === 'loading' && <p role="status">{t('skill_map.ai_loading')}</p>}
      {step === 'noev' && <div className="ai-noev" role="status"><p>{t('skill_map.ai_noev_text')}</p>
        {failure === 'no_evidence' && <p className="skill-map-note">{t(errorKey.no_evidence)}</p>}
        <div className="skill-map-self-actions"><Link className="elv-btn skill-map-primary" to="/app/evidence">{t('skill_map.guide_cta')}</Link><button type="button" className="elv-btn" onClick={onClose}>{t('skill_map.ai_close')}</button></div></div>}
      {step === 'pick' && <>
        {stepper(1)}
        <p className="skill-map-note">{t('skill_map.ai_pick_text')}</p>
        <fieldset className="skill-map-fieldset"><legend>{fmt(t('skill_map.ai_pick'), { max: MAX_SKILLS })}</legend>
          {skills.map(skill => <label key={skill.skillKey} className="skill-map-opt"><input type="checkbox" checked={picked.includes(skill.skillKey)} disabled={busy || (!picked.includes(skill.skillKey) && picked.length >= MAX_SKILLS)} onChange={() => toggle(skill.skillKey)} /><span><strong>{name(skill)}</strong></span></label>)}
        </fieldset>
        <p className="skill-map-note" role="status">{fmt(t('skill_map.ai_selected'), { n: picked.length, max: MAX_SKILLS })}</p>
        <p className="skill-map-note">{t('skill_map.ai_privacy')}</p>
        {problem}
        <div className="skill-map-self-actions"><button type="button" className="elv-btn" onClick={onClose}>{t('skill_map.reg_cancel')}</button>
          <button type="button" className="elv-btn skill-map-primary" disabled={busy || picked.length < 1} onClick={() => void analyze()}>{t('skill_map.ai_go')}</button></div></>}
      {step === 'analyzing' && <>{stepper(2)}<p role="status"><span className="ai-spin" aria-hidden="true" /> {t('skill_map.ai_analyzing')}</p>
        <div className="skill-map-self-actions"><button type="button" className="elv-btn" onClick={stop}>{t('skill_map.reg_cancel')}</button></div></>}
      {step === 'review' && proposed && <>
        {stepper(3)}
        <p className="skill-map-note">{t('skill_map.ai_rev_text')}</p>
        {proposed.proposals.length === 0 && <p role="status">{t('skill_map.ai_none')}</p>}
        {proposed.proposals.map(proposal => {
          const skill = skillOf(proposal.skillKey); if (!skill) return null
          const current = items.find(item => item.skill.skillKey === proposal.skillKey)?.level != null
          const warns = proposed.warnings.filter(w => w.skillKey === proposal.skillKey)
          const value = choices[proposal.skillKey] ?? defaultChoice(proposal)
          const groupName = `ai-choice-${proposal.skillKey}`
          return <article key={proposal.skillKey} className="ai-prop" aria-labelledby={`ai-h-${proposal.skillKey}`}>
            <div className="ai-prop-head"><h3 id={`ai-h-${proposal.skillKey}`}>{name(skill)}</h3><span className="ai-tag">{t('skill_map.ai_tag')}</span></div>
            {proposal.level === null ? <div className="ai-warn"><strong>{t('skill_map.ai_null_title')}</strong><br />{t(current ? 'skill_map.ai_null_text_current' : 'skill_map.ai_null_text')}</div> : <>
              <p className="ai-lv"><span className={`radar-swatch h${proposal.level}`} aria-hidden="true">{proposal.level}</span>{t('skill_map.ai_proposed')}: {t('skill_map.level')} {proposal.level}</p>
              <p><strong>{t('skill_map.ai_criterion')}: </strong>«{localized(skill.rubric.levels[String(proposal.level)]) || t('skill_map.translation_missing')}»</p>
              <p><strong>{t('skill_map.ai_why')}: </strong><span className="skill-map-free-text">{proposal.rationale}</span></p>
              <div className="ai-evid"><strong>{t('skill_map.ai_evid')}: </strong>{proposal.evidenceRefs.map(ref => titleOf(ref.evidenceId)).join(' · ')}
                {proposal.evidenceRefs.filter(ref => ref.quote).map(ref => <blockquote key={`${ref.evidenceId}-${ref.version}`} className="skill-map-free-text">{ref.quote}</blockquote>)}</div>
              {proposal.confidence && <p><strong>{t('skill_map.ai_conf')}: </strong>{t(`skill_map.${proposal.confidence}`)} — {localized(proposal.confidenceReason)} {t('skill_map.ai_conf_rule')}</p>}
              {warns.map(w => <div key={w.code} className="ai-warn">{w.code === 'level_capped' ? fmt(t('skill_map.ai_w_cap'), { n: proposal.level ?? '' }) : t('skill_map.ai_w_none')}</div>)}
            </>}
            <fieldset className="skill-map-fieldset"><legend>{t('skill_map.ai_do')}</legend>
              {choicesFor(proposal, current).map(choice => <label key={choice} className="skill-map-opt"><input type="radio" name={groupName} checked={value === choice} disabled={busy} onChange={() => choose(proposal.skillKey, choice)} />
                <span>{choice === 'accept' ? fmt(t('skill_map.ai_accept'), { n: proposal.level ?? '' }) : choice === 'skip' ? t('skill_map.ai_skip') : choice === 'null' ? t(proposal.level === null ? 'skill_map.ai_retire' : 'skill_map.ai_unassessed') : fmt(t('skill_map.ai_down'), { n: choice })}</span></label>)}
            </fieldset>
          </article>
        })}
        <p className="skill-map-note">{t('skill_map.ai_expires')}</p>
        <p className="skill-map-note" role="status">{fmt(t('skill_map.ai_save_n'), { n: accepted.length })}</p>
        {problem}
        <div className="skill-map-self-actions"><button type="button" className="elv-btn" disabled={busy} onClick={onClose}>{t('skill_map.reg_cancel')}</button>
          <button type="button" className="elv-btn skill-map-primary" disabled={busy || accepted.length < 1} onClick={() => void save()}>{busy ? t('skill_map.reg_saving') : t('skill_map.ai_save')}</button></div></>}
      {step === 'done' && <>
        <p role="status" className="ai-ok">{fmt(t('skill_map.ai_done_text'), { n: savedKeys.length })}</p>
        {doneItems.filter(item => item.needsReview).map(item => <div key={item.skill.skillKey} className="ai-warn">
          <strong>{name(item.skill)} · {t('skill_map.contradictory')}</strong><br />{t('skill_map.ai_review_help')}</div>)}
        <div className="skill-map-self-actions"><button type="button" className="elv-btn skill-map-primary" onClick={onClose}>{t('skill_map.ai_see_map')}</button><button type="button" className="elv-btn" onClick={again}>{t('skill_map.ai_again')}</button></div></>}
    </div>
  </section>
}
