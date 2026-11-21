// ES-110: bandeja «Habilidades de tu hoja de vida» (maqueta aprobada). Ninguna marcada por defecto; sin nivel; cada evidencia guarda su origen.
import './register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { Banner, Button, CheckField, Chip, Dialog, ItemList } from '../cartografia'
import { Notice, PersonScreen } from '../space/PersonScreen'
import { formatDate, resumeSkillsApi, selectable, whyNot, SkillsError, type Declared, type Orphaned } from './resumeSkills'
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
  const [orphaned, setOrphaned] = useState<Orphaned[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const requestId = useRef(newId())
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const load = useCallback((signal?: AbortSignal) => {
    void api.overview(signal).then(({ skills: list, orphaned: gone }) => { if (alive.current && !signal?.aborted) { setSkills(list); setOrphaned(gone); setPhase('ready') } })
      .catch((error: unknown) => { if (alive.current && !signal?.aborted) { setStatus(error instanceof SkillsError ? error.status : 503); setPhase('error') } })
  }, [api])
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort() }, [load])

  const chosen = skills.filter(skill => picked.has(skill.name))
  const toggle = (skill: Declared) => { requestId.current = newId(); setSaveError(false); setPicked(previous => { const next = new Set(previous); if (next.has(skill.name)) next.delete(skill.name); else next.add(skill.name); return next }) }
  const closeDialog = () => { if (saving) return; setDialog(false) } // ES-308: el <Dialog> de Cartografía devuelve el foco a quien lo abrió
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

  const ready = !!token && token === readEvidenceToken() && phase === 'ready' && skills.length > 0
  return <PersonScreen title={l('rs_title')} lead={l('rs_intro')}>
    {!token || token !== readEvidenceToken() ? <Banner kind="error" title={l('expired')}><div className="pg-actions"><Link className="cg-linkbtn" to="/login">{l('signin')}</Link></div></Banner>
      : phase === 'loading' ? <div className="cg-screen-loading" role="status" aria-busy="true"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><span className="cg-sr">{l('rs_loading')}</span></div>
        : phase === 'error' ? <Banner kind="error" title={`${status === 401 ? l('expired') : l('rs_load_error')} ${status !== 401 ? l('rs_intact') : ''}`.trim()}>
          <div className="pg-actions">{status === 401 ? <Link className="cg-linkbtn" to="/login">{l('signin')}</Link> : <Button variant="ghost" onClick={() => { setPhase('loading'); load() }}>{l('retry')}</Button>}</div></Banner>
          : !skills.length && !orphaned.length ? <section className="cg-card pg-card"><h2>{l('rs_empty')}</h2><p>{l('rs_empty_why')}</p><div className="pg-actions"><Link className="cg-btn" to="/app/context/resumes">{l('rs_see_resumes')}</Link></div></section>
            : <>
              {skills.length > 0 && <>
              <div className="pg-pick__chips"><Chip symbol="○">{l('rs_declared')}</Chip><Chip tone="ok" symbol="✓">{l('rs_backed')}</Chip></div>
              <p className="cg-hint" role="status">{picked.size ? '' : l('rs_none_picked')}</p>
              <ItemList label={l('rs_title')} items={skills.map(skill => {
                const off = whyNot(skill); const id = `skill-${skill.resume.version}-${skill.name}`.replace(/s+/g, '-')
                const label = skill.classified ? (lang === 'en' ? skill.classified.labels.en : skill.classified.labels.es) ?? skill.classified.labels.es ?? skill.classified.labels.en : null
                return { id, top: <CheckField className="pg-pick" id={id} checked={picked.has(skill.name)} disabled={!selectable(skill)} onChange={() => toggle(skill)} aria-describedby={`${id}-info`}
                  label={<><span><strong>{skill.name}</strong> <Chip symbol="○">{l('rs_declared_short')}</Chip></span>
                    <span id={`${id}-info`} className="pg-pick__info">
                      <small>{label ? <>{l('rs_classified_as')} <b>{label}</b></> : l('rs_unclassified')}</small>
                      {skill.support && <q>{skill.support}</q>}
                      <small>{l('rs_source').replace('{v}', String(skill.resume.version)).replace('{date}', sourceDate(skill))}</small>
                      {off === 'added' && <small>{l('rs_already')}</small>}
                      {off === 'no_support' && <small>{l('rs_no_support')}</small>}
                    </span></>} /> }
              })} />
              <div className="pg-sticky">
                <p role="status" aria-live="polite">{l('rs_count').replace('{n}', String(picked.size))}</p>
                <Button disabled={!picked.size} onClick={() => setDialog(true)}>{picked.size ? l('rs_review_n').replace('{n}', String(picked.size)) : l('rs_add')}</Button>
              </div>
              </>}
              {orphaned.length > 0 && <OrphanedList items={orphaned} />}
            </>}
    {ready && <Dialog open={dialog} onClose={closeDialog} title={l('rs_confirm_title').replace('{n}', String(chosen.length))}
      actions={<>
        <Button variant="ghost" disabled={saving} onClick={closeDialog}>{l('rs_back')}</Button>
        <Button disabled={saving} onClick={() => void confirm()}>{l('rs_confirm_n').replace('{n}', String(chosen.length))}</Button>
      </>}>
      <div className="pg-dialog">
        <ul>{chosen.map(skill => <li key={skill.name}><strong>{skill.name}</strong></li>)}</ul>
        <p>{l('rs_confirm_origin').replace('{v}', String(chosen[0]?.resume.version ?? ''))}</p>
        <p><strong>{l('rs_level_none_bold')}</strong> {l('rs_level_none_why')}</p>
        <p className="cg-hint">{l('rs_confirm_later')}</p>
        <Notice error text={saveError ? l('rs_save_error') : ''} />
        <p className="cg-hint" role="status" aria-live="polite">{saving ? l('saving') : ''}</p>
      </div>
    </Dialog>}
    <p><Link className="cg-linkbtn" to="/app/evidence">{l('list')}</Link></p>
  </PersonScreen>
}

// E398-2: las habilidades cuya versión de origen se borró siguen en el contexto pero no se pueden añadir (ya no hay hoja que las respalde). Se muestran con su origen, sin casilla y sin explicaciones falsas.
function OrphanedList({ items }: { items: Orphaned[] }) {
  const { t, lang } = useLanguage(); const l = (key: string) => t(`evidence.${key}`)
  return <ItemList label={l('rs_origin_deleted')} items={items.map(skill => {
    const named = skill.classified ? (lang === 'en' ? skill.classified.labels.en : skill.classified.labels.es) ?? skill.classified.labels.es ?? skill.classified.labels.en : null
    return { id: `orphan-${skill.name}`, top: <span className="pg-pick__info"><span><strong>{skill.name}</strong> <Chip symbol="○">{l('rs_declared_short')}</Chip></span>
      <small className="cg-hint"><strong>{l('rs_origin_deleted')}</strong></small>
      {named && <small>{l('rs_classified_as')} <b>{named}</b></small>}
      {skill.added && <small>{l('rs_already')}</small>}</span> }
  })} />
}
