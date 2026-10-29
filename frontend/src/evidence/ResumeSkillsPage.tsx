// ES-110: bandeja «Habilidades de tu hoja de vida» (maqueta aprobada). Ninguna marcada por defecto; sin nivel; cada evidencia guarda su origen.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { EvidenceShell } from './Shell'
import { BackedBadge, DeclaredBadge } from './ResumeOrigin'
import { formatDate, resumeSkillsApi, selectable, whyNot, SkillsError, type Declared } from './resumeSkills'
import { readEvidenceToken, useEvidenceToken } from './session'

const backend = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `rs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
type Phase = 'loading' | 'ready' | 'error'

export function ResumeSkillsPage() {
  const { t, lang } = useLanguage(); const l = (key: string) => t(`evidence.${key}`)
  const token = useEvidenceToken(); const navigate = useNavigate()
  const api = useMemo(() => resumeSkillsApi(backend, token), [token])
  const [phase, setPhase] = useState<Phase>('loading')
  const [status, setStatus] = useState(0)
  const [skills, setSkills] = useState<Declared[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const requestId = useRef(newId())
  const opener = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const load = useCallback((signal?: AbortSignal) => {
    void api.list(signal).then(list => { if (alive.current && !signal?.aborted) { setSkills(list); setPhase('ready') } })
      .catch((error: unknown) => { if (alive.current && !signal?.aborted) { setStatus(error instanceof SkillsError ? error.status : 503); setPhase('error') } })
  }, [api])
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort() }, [load])
  useEffect(() => { if (dialog) dialogRef.current?.focus() }, [dialog])

  const chosen = skills.filter(skill => picked.has(skill.name))
  const toggle = (skill: Declared) => { requestId.current = newId(); setSaveError(false); setPicked(previous => { const next = new Set(previous); if (next.has(skill.name)) next.delete(skill.name); else next.add(skill.name); return next }) }
  const closeDialog = () => { if (saving) return; setDialog(false); window.setTimeout(() => opener.current?.focus(), 0) }
  async function confirm() {
    if (saving || !chosen.length || token !== readEvidenceToken()) return
    setSaving(true); setSaveError(false)
    try {
      const result = await api.promote(chosen.map(skill => skill.name), requestId.current) // el mismo requestId si se reintenta: no duplica
      if (!alive.current) return
      navigate('/app/evidence', { state: { added: result.created.length } })
    } catch { if (alive.current) { setSaving(false); setSaveError(true) } }
  }
  const sourceDate = (skill: Declared) => formatDate(skill.resume.createdAt, lang)

  return <EvidenceShell title={l('rs_title')}>
    {!token || token !== readEvidenceToken() ? <div role="alert" className="evidence-error-box"><p>{l('expired')}</p><Link className="elv-link" to="/login">{l('signin')}</Link></div>
      : phase === 'loading' ? <div className="evidence-card" role="status" aria-busy="true"><div className="evidence-skeleton" /><div className="evidence-skeleton" /><div className="evidence-skeleton evidence-skeleton-short" /><span className="evidence-sr">{l('rs_loading')}</span></div>
        : phase === 'error' ? <div role="alert" className="evidence-error-box"><p>{status === 401 ? l('expired') : l('rs_load_error')} {status !== 401 && l('rs_intact')}</p>
          {status === 401 ? <Link className="elv-link" to="/login">{l('signin')}</Link> : <button className="elv-btn" onClick={() => { setPhase('loading'); load() }}>{l('retry')}</button>}</div>
          : !skills.length ? <section className="evidence-card"><div className="elv-card-body"><h2>{l('rs_empty')}</h2><p>{l('rs_empty_why')}</p><Link className="elv-btn" to="/app/context/resumes">{l('rs_see_resumes')}</Link></div></section>
            : <>
              <p>{l('rs_intro')}</p>
              <div className="evidence-legend"><DeclaredBadge /><BackedBadge /></div>
              <p className="evidence-help" role="status">{picked.size ? '' : l('rs_none_picked')}</p>
              <ul className="evidence-skills" aria-label={l('rs_title')}>
                {skills.map(skill => {
                  const off = whyNot(skill); const id = `skill-${skill.resume.version}-${skill.name}`.replace(/\s+/g, '-')
                  const label = skill.classified ? (lang === 'en' ? skill.classified.labels.en : skill.classified.labels.es) ?? skill.classified.labels.es ?? skill.classified.labels.en : null
                  return <li key={id}><label className={`evidence-skill${picked.has(skill.name) ? ' evidence-skill-on' : ''}${off ? ' evidence-skill-off' : ''}`} htmlFor={id}>
                    <input id={id} type="checkbox" className="elv-checkbox elv-checkbox-primary" checked={picked.has(skill.name)} disabled={!selectable(skill)} onChange={() => toggle(skill)} aria-describedby={`${id}-info`} />
                    <span><strong>{skill.name}</strong> <DeclaredBadge short />
                      <span id={`${id}-info`} className="evidence-skill-info">
                        <small>{label ? <>{l('rs_classified_as')} <b>{label}</b></> : l('rs_unclassified')}</small>
                        {skill.support && <q>{skill.support}</q>}
                        <small>{l('rs_source').replace('{v}', String(skill.resume.version)).replace('{date}', sourceDate(skill))}</small>
                        {off === 'added' && <small className="evidence-note">{l('rs_already')}</small>}
                        {off === 'no_support' && <small className="evidence-note">{l('rs_no_support')}</small>}
                      </span></span></label></li>
                })}
              </ul>
              <div className="evidence-sticky">
                <p role="status" aria-live="polite">{l('rs_count').replace('{n}', String(picked.size))}</p>
                <button ref={opener} type="button" className="elv-btn elv-btn-primary" disabled={!picked.size} onClick={() => setDialog(true)}>{picked.size ? l('rs_review_n').replace('{n}', String(picked.size)) : l('rs_add')}</button>
              </div>
              {dialog && <div className="evidence-scrim" onKeyDown={event => { if (event.key === 'Escape') closeDialog() }}>
                <div ref={dialogRef} tabIndex={-1} className="evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="rs-confirm-title">
                  <h2 id="rs-confirm-title">{l('rs_confirm_title').replace('{n}', String(chosen.length))}</h2>
                  <ul>{chosen.map(skill => <li key={skill.name}><strong>{skill.name}</strong></li>)}</ul>
                  <p>{l('rs_confirm_origin').replace('{v}', String(chosen[0]?.resume.version ?? ''))}</p>
                  <p><strong>{l('rs_level_none_bold')}</strong> {l('rs_level_none_why')}</p>
                  <p className="evidence-help">{l('rs_confirm_later')}</p>
                  {saveError && <p role="alert" className="evidence-error">{l('rs_save_error')}</p>}
                  <p role="status" aria-live="polite" className="evidence-help">{saving ? l('saving') : ''}</p>
                  <div className="evidence-actions">
                    <button type="button" className="elv-btn" disabled={saving} onClick={closeDialog}>{l('rs_back')}</button>
                    <button type="button" className="elv-btn elv-btn-primary" disabled={saving} onClick={() => void confirm()}>{l('rs_confirm_n').replace('{n}', String(chosen.length))}</button>
                  </div>
                </div></div>}
            </>}
  </EvidenceShell>
}
