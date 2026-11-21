// ES-110 (PR 2): «Actualizar mi hoja de vida». Sube una versión nueva (mismo análisis y mismo consentimiento de ES-109), calcula EN EL CLIENTE lo que cambia frente al contexto
// (resumeDiff.ts, PR #391) y la persona decide cada gesto. Nada se guarda hasta pulsar «Guardar» (PUT del contexto con expectedVersion). La evidencia confirmada no se toca.
import '../register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import '../../evidence/register.ts'
import './register.ts'
import '../participantContext.css'
import '../onboardingCartografia.css'
import './resume.css'
import './resumeUpdate.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage'
import { Banner, Button, Card, CheckField, Dialog } from '../../cartografia'
import { Notice, PersonScreen } from '../../space/PersonScreen'
import { ContextError, contextRequest, type ContextSnapshot, type DeclaredSkill } from '../participantContext'
import { deleteResume, listResumes, type ResumeMeta } from './resumeApi'
import { fill } from './resumeCopy'
import { applyChoices, defaultChoices, diffSkills, skillKey, type Choices } from './resumeDiff'
import { entryOf, outcomeAfterFailure, pendingLinks } from './resumeUpdateLogic'
import { ResumeStarter } from './ResumeStarter'

const HISTORY_PATH = '/app/context/resumes'
const SKILLS_PATH = '/app/evidence/resume-skills'
const DOT = ' · '
type Phase = 'loading' | 'loadError' | 'expired' | 'upload' | 'limit' | 'changes' | 'saving' | 'saved'
type Found = { resume: ResumeMeta; suggested: DeclaredSkill[] }

const toggle = (list: string[], name: string, on: boolean) => { const rest = list.filter(item => skillKey(item) !== skillKey(name)); return on ? [...rest, name] : rest }

export function ResumeUpdatePage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('loading')
  const [snapshot, setSnapshot] = useState<ContextSnapshot | null>(null)
  const [versions, setVersions] = useState<{ items: ResumeMeta[]; max: number }>({ items: [], max: 5 })
  const [found, setFound] = useState<Found | null>(null)
  const [choices, setChoices] = useState<Choices>({ add: [], link: [], remove: [] })
  const [notice, setNotice] = useState('')
  const [conflict, setConflict] = useState(false)
  const [skipped, setSkipped] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([contextRequest(undefined, undefined, controller.signal), listResumes(controller.signal)]).then(([context, list]) => {
      if (controller.signal.aborted) return
      if (!list) { setPhase('loadError'); return }
      // Sin contexto guardado no hay con qué comparar: se empieza desde cero en el formulario (donde vive «Empieza desde tu hoja de vida»).
      const entry = entryOf(context, { count: list.resumes.length, max: list.maxVersions })
      if (entry === 'onboarding') { navigate('/app/onboarding', { replace: true }); return }
      setSnapshot(context); setVersions({ items: list.resumes, max: list.maxVersions }); setPhase(entry)
    }).catch((error: unknown) => { if (!controller.signal.aborted) setPhase(error instanceof ContextError && [401, 403].includes(error.status) ? 'expired' : 'loadError') })
    return () => controller.abort()
  }, [attempt, navigate])
  useEffect(() => { if (phase !== 'loading') heading.current?.focus() }, [phase])

  const diff = useMemo(() => (snapshot?.context && found ? diffSkills(snapshot.context.declaredSkills, found.suggested, found.resume.version) : null), [snapshot, found])
  const receive = (result: { resume: ResumeMeta; suggestions: { declaredSkills: DeclaredSkill[] } }) => {
    const suggested = result.suggestions.declaredSkills
    setFound({ resume: result.resume, suggested }); setChoices(defaultChoices(diffSkills(snapshot?.context?.declaredSkills ?? [], suggested, result.resume.version))); setNotice(''); setConflict(false); setPhase('changes')
  }
  const reread = async () => { // «Recargar contexto»: se vuelve a leer SOLO el contexto; el análisis ya hecho y las elecciones se conservan (no se paga otro análisis)
    try { const fresh = await contextRequest(); setSnapshot(fresh); setConflict(false); setNotice('') } catch { setNotice('context_load_error') }
  }
  async function save() {
    if (!snapshot?.context || !diff || phase !== 'changes') return
    const applied = applyChoices(snapshot.context.declaredSkills, diff, choices)
    setPhase('saving'); setNotice('')
    try {
      const data = await contextRequest({ schemaVersion: 2, expectedVersion: snapshot.version, action: 'save_draft', context: { ...snapshot.context, declaredSkills: applied.skills } })
      setSnapshot(data); setSkipped(applied.skipped); setPhase('saved'); return
    } catch (error) {
      const failure = error instanceof ContextError ? { status: error.status, code: error.code } : { status: 0 }
      let fresh: ContextSnapshot | null = null
      if (failure.status === 0 || failure.status >= 500 || failure.status === 409) { try { fresh = await contextRequest() } catch { /* sin releer: se dice que no se pudo guardar */ } } // ¿se guardó y se perdió la respuesta?
      const outcome = outcomeAfterFailure(failure, fresh?.context?.declaredSkills ?? null, applied.skills)
      if (outcome === 'expired') { setPhase('expired'); return }
      if (outcome === 'saved' && fresh) { setSnapshot(fresh); setSkipped(applied.skipped); setPhase('saved'); return }
      setPhase('changes')
      if (outcome === 'conflict') { setConflict(true); setNotice('context_conflict') }
      else if (outcome === 'schema') { setConflict(true); setNotice('resume_schema_outdated') }
      else setNotice('context_save_error')
    }
  }

  const changesScreen = phase === 'changes' || phase === 'saving' || phase === 'saved'
  const busy = phase === 'saving'
  const title = t(changesScreen ? 'resume_changes_title' : 'resume_update')
  const version = found?.resume.version ?? 0
  const links = diff ? pendingLinks(diff) : []
  const overflowText = (n: number) => (n === 1 ? t('resume_overflow_one') : fill(t('resume_overflow'), { n }))
  const count = (key: string, n: number) => `${t(key)}${DOT}${n}`
  return (
    <PersonScreen title={title} lead={changesScreen ? undefined : t('resume_update_help')} titleRef={heading}>
      <div className="cv-update">
        <Notice error text={notice ? t(notice) : ''}>{conflict && <Button variant="ghost" onClick={() => void reread()}>{t('context_reload')}</Button>}</Notice>

        {phase === 'loading' && <div className="cg-screen-loading" role="status" aria-busy="true"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><span className="cg-sr">{t('resume_hist_loading')}</span></div>}
        {phase === 'loadError' && <Banner kind="error" title={t('context_load_error')}><div className="pg-actions"><Button variant="ghost" onClick={() => { setPhase('loading'); setAttempt(value => value + 1) }}>{t('context_retry')}</Button></div></Banner>}
        {phase === 'expired' && <Banner kind="error" title={t('context_expired')}><div className="pg-actions"><Link className="cg-linkbtn" to="/login">{t('context_signin')}</Link></div></Banner>}

        {phase === 'upload' && <div className="participant-context-scope cg-onboarding">
          <ResumeStarter t={t} mode="update" disabled={false} historyPath={HISTORY_PATH} onResult={receive} onManual={() => navigate('/app/onboarding')} />
        </div>}

        {phase === 'limit' && <LimitList items={versions.items} max={versions.max} onChanged={() => { setPhase('loading'); setAttempt(value => value + 1) }} />}

        {changesScreen && diff && snapshot?.context && <>
          {phase === 'saved' && <>
            <Banner title={t('context_saved')}><div className="pg-actions"><Link className="cg-linkbtn" to={SKILLS_PATH}>{t('evidence.rs_title')}</Link><Link className="cg-linkbtn" to={HISTORY_PATH}>{t('resume_manage')}</Link></div></Banner>
            {skipped > 0 && <p className="cg-hint" role="status">{overflowText(skipped)}</p>}
            <p className="cg-hint" role="status">{t('resume_confirmed_same')}</p>
          </>}
          {phase !== 'saved' && diff.unchanged && <Card as="section" className="pg-card"><h2>{t('resume_no_change')}</h2><p>{t('resume_confirmed_same')}</p>
            <div className="pg-actions"><Link className="cg-btn" to={HISTORY_PATH}>{t('resume_manage')}</Link></div></Card>}
          {phase !== 'saved' && !diff.unchanged && <>
            {diff.overflow > 0 && <p className="cg-hint" role="status">{overflowText(diff.overflow)}</p>}
            {diff.added.length > 0 && <Card as="section" className="pg-card cv-group"><h2 id="cv-new">{count('resume_new_skills', diff.added.length)}</h2>
              <div role="group" aria-labelledby="cv-new">{diff.added.map(skill => <CheckField key={skill.name} disabled={busy} checked={choices.add.some(name => skillKey(name) === skillKey(skill.name))}
                onChange={event => setChoices(previous => ({ ...previous, add: toggle(previous.add, skill.name, event.target.checked) }))}
                label={<span className="cv-name"><strong>{skill.name}</strong><span className="cv-sk">{t('evidence.rs_declared_short')}</span></span>} />)}</div></Card>}
            {links.length > 0 && <Card as="section" className="pg-card cv-group"><h2 id="cv-still">{count('resume_still_skills', links.length)}</h2>
              {links.map(item => <div className="cv-row" key={item.current.name}>
                <div className="cv-row__top"><strong>{item.current.name}</strong><span className="cg-hint">{fill(t('resume_version'), { n: item.current.resumeVersion ?? 0 })}</span></div>
                <CheckField disabled={busy} checked={choices.link.some(name => skillKey(name) === skillKey(item.current.name))}
                  onChange={event => setChoices(previous => ({ ...previous, link: toggle(previous.link, item.current.name, event.target.checked) }))}
                  label={fill(t('resume_link_version'), { n: version })} /></div>)}</Card>}
            {diff.gone.length > 0 && <Card as="section" className="pg-card cv-group"><h2 id="cv-gone">{count('resume_gone_skills', diff.gone.length)}</h2>
              {diff.gone.map((skill, index) => { const quit = choices.remove.some(name => skillKey(name) === skillKey(skill.name)); return <div className="cv-row" key={skill.name}>
                <div className="cv-row__top"><strong>{skill.name}</strong>
                  <div className="cv-seg" role="radiogroup" aria-label={skill.name}>
                    <label><input type="radio" name={`gone-${index}`} disabled={busy} checked={!quit} onChange={() => setChoices(previous => ({ ...previous, remove: toggle(previous.remove, skill.name, false) }))} /><span>{t('resume_keep')}</span></label>
                    <label><input type="radio" name={`gone-${index}`} disabled={busy} checked={quit} onChange={() => setChoices(previous => ({ ...previous, remove: toggle(previous.remove, skill.name, true) }))} /><span>{t('resume_quit')}</span></label>
                  </div></div></div> })}</Card>}
            <div className="pg-sticky">
              <p role="status" aria-live="polite">{busy ? t('context_saving') : t('resume_confirmed_same')}</p>
              <div className="pg-actions cv-sticky-actions">
                <Link className="cg-btn cg-btn--ghost" to={HISTORY_PATH} aria-disabled={busy} onClick={event => { if (busy) event.preventDefault() }}>{t('resume_back')}</Link>
                <Button disabled={busy || conflict} aria-busy={busy} onClick={() => void save()}>{busy ? t('context_saving') : t('btn_save')}</Button>
              </div>
            </div>
          </>}
        </>}
      </div>
    </PersonScreen>
  )
}

// Tope de 5 versiones: se ve la lista con «Borrar» para ELEGIR cuál borrar (nada se borra solo). Misma confirmación de ES-109 («Se elimina de verdad, sin copias…»).
function LimitList({ items, max, onChanged }: { items: ResumeMeta[]; max: number; onChanged: () => void }) {
  const { t, lang } = useLanguage()
  const [target, setTarget] = useState<ResumeMeta | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'en' ? 'en' : 'es', { day: 'numeric', month: 'short', year: 'numeric' })
  const close = useCallback(() => { if (!busy) setTarget(null) }, [busy])
  async function confirm() {
    if (!target) return
    setBusy(true); setError(false)
    const result = await deleteResume(target.id)
    setBusy(false)
    if (result === 'rejected') { setError(true); return }
    setTarget(null); onChanged() // 'deleted' y 'uncertain': se relee la lista real (la pantalla dice lo que hay, no lo que se supone)
  }
  return <>
    <Banner kind="error" title={t('resume_err_resume_limit')} />
    <Card as="section" className="pg-card"><h2>{`${t('resume_hist_versions')}${DOT}${fill(t('resume_hist_count'), { n: items.length, max })}`}</h2>
      <ul className="cg-items">{items.map(item => <li key={item.id} className="cv-row"><div className="cv-row__top"><strong>{fill(t('resume_version'), { n: item.version })}</strong><span className="cg-hint">{date(item.createdAt)}</span>
        <Button variant="ghost" disabled={busy} aria-label={`${t('resume_delete')}: ${fill(t('resume_version'), { n: item.version })}`} onClick={() => { setTarget(item); setError(false) }}>{t('resume_delete')}</Button></div></li>)}</ul>
    </Card>
    <Dialog open={target !== null} onClose={close} title={target ? fill(t('resume_delete_title'), { n: target.version, date: date(target.createdAt) }) : ''}
      actions={<><Button variant="ghost" disabled={busy} onClick={close}>{t('resume_cancel_btn')}</Button><Button variant="danger" disabled={busy} onClick={() => void confirm()}>{t('resume_delete_yes')}</Button></>}>
      <div className="pg-dialog"><p>{t('resume_delete_body')}</p><Notice error text={error ? t('resume_delete_error') : ''} /></div>
    </Dialog>
  </>
}
