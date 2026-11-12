import './register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { trackView, type Assessment, type LocalizedText, type Skill } from './model'
import { hasLevel, skillStatus, type SkillStatus } from './status'
import { SelfAssessPanel } from './SelfAssessPanel'
import { resolveTerritories, type Territory } from './territories'

type T = (key: string) => string
type Lang = 'es' | 'en'
const statusKey = (status: SkillStatus) => status === 'evidence' ? 'skill_map.status_evidence' : status === 'needs_review' ? 'skill_map.contradictory'
  : status === 'stale' ? 'skill_map.stale' : 'skill_map.no_evidence'
const label = (value: LocalizedText, lang: Lang, t: T) => value[lang] ?? t('skill_map.translation_missing')
/** Misma información como tarjetas por territorio: es la vista de móvil y tableta, y la alternativa accesible del mapa. */
export function TerritoryList({ skills, territories, selected, onSelect, lang, t }: {
  skills: readonly Skill[]; territories: readonly Territory[]; selected: string | null
  onSelect: (key: string) => void; lang: Lang; t: T
}) {
  const { groups, unassigned, links } = resolveTerritories(skills, territories)
  const byId = new Map(territories.map(territory => [territory.id, territory]))
  const row = (skill: Skill, here?: string) => {
    const status = skillStatus(skill), others = links(skill).filter(id => id !== here).map(id => byId.get(id)?.labels[lang]).filter(Boolean)
    return <li key={skill.skillKey}>
      <button type="button" className="skill-map-pick" aria-pressed={selected === skill.skillKey} onClick={() => onSelect(skill.skillKey)}>
        <span className={`skill-map-dot ${hasLevel(status) ? 'dot-level' : 'dot-none'}`} aria-hidden="true" />
        <span className="skill-map-pick-text">
          <span className="skill-map-pick-name">{label(skill.labels, lang, t)}</span>
          <span className="skill-map-pick-status">{t(statusKey(status))}</span>
          {others.length > 0 && <span className="skill-map-pick-also">{t('skill_map.also_in')}: {others.join(' · ')}</span>}
        </span>
      </button>
    </li>
  }
  return <div className="skill-map-territory-list">
    {groups.map(({ territory, skills: inside }) => <section key={territory.id} className={`skill-map-territory-card tone-${territory.id}`} aria-labelledby={`terr-${territory.id}`}>
      <h2 id={`terr-${territory.id}`}>{territory.labels[lang]}</h2>
      {inside.length > 0 && <ul>{inside.map(skill => row(skill, territory.id))}</ul>}
    </section>)}
    {unassigned.length > 0 && <section className="skill-map-territory-card tone-none" aria-labelledby="terr-none">
      <h2 id="terr-none">{t('skill_map.unassigned')}</h2>
      <p className="skill-map-roles">{t('skill_map.unassigned_help')}</p>
      <ul>{unassigned.map(skill => row(skill))}</ul>
    </section>}
  </div>
}

function AssessmentPanel({ assessment, track, lang, t }: { assessment: Assessment | null; track: 'self' | 'review'; lang: Lang; t: T }) {
  const view = trackView(assessment)
  const next = view.stale || assessment?.catalogOutdated ? 'next_stale' : view.needsReview ? 'next_review' : view.level === null ? 'next_empty' : 'next_current'
  return <section className="skill-map-track" aria-label={t(`skill_map.${track}`)}>
    <h3>{t(`skill_map.${track}`)}</h3>
    {track === 'review' && !assessment ? <p>{t('skill_map.no_review')}</p> : <>
      <p className="skill-map-level" data-testid="skill-level">
        {view.level === null ? t('skill_map.no_evidence') : `${t('skill_map.level')} ${view.level}`}
      </p>
      {view.state !== 'no_evidence' && <span className="elv-badge elv-badge-outline">{t(`skill_map.${view.state}`)}</span>}
      {view.needsReview && <p className="skill-map-note" data-testid="review-why">{t('skill_map.review_why')}</p>}
      {view.stale && <p className="skill-map-warning">{t('skill_map.stale_help')}</p>}
      {assessment?.catalogOutdated && <p className="skill-map-warning">{t('skill_map.catalog_outdated')} {view.level !== null && t('skill_map.previous_rubric')}</p>}
      {assessment && !view.stale && <>
        <p>{t('skill_map.evidence_count')}: {assessment.evidenceCount}</p>
        <p className="skill-map-note">{t('skill_map.evidence_detail_unavailable')}</p>
        {view.confidence && <>
          <p>{t('skill_map.confidence')}: {t(`skill_map.${view.confidence}`)}</p>
          <p>{assessment.confidenceReason[lang] ?? t('skill_map.translation_missing')}</p>
        </>}
        <h4>{t('skill_map.rationale')}</h4>
        <p className="skill-map-free-text">{assessment.rationale || t('skill_map.no_rationale')}</p>
      </>}
      <p className="skill-map-next"><strong>{t('skill_map.next')}: </strong>{t(`skill_map.${next}`)}</p>
    </>}
  </section>
}

/** Detalle de la capacidad elegida: las mismas pistas separadas y reglas de datos de siempre (nivel null sin evidencia, sin promedios). */
export function SkillDetail({ skill, catalogVersion, territories, lang, t, self, onAnalyze }: {
  skill: Skill; catalogVersion: number; territories: readonly Territory[]; lang: Lang; t: T
  self?: { backend: string; token: string; onChanged: (kind: 'saved' | 'retired') => void }
  onAnalyze?: (key: string) => void
}) {
  const status = skillStatus(skill)
  const { links } = resolveTerritories([skill], territories)
  const names = links(skill).map(id => territories.find(territory => territory.id === id)?.labels[lang]).filter(Boolean)
  return <article className="elv-card skill-map-card skill-map-detail" aria-labelledby="skill-detail-title">
    <div className="elv-card-body">
      <h2 id="skill-detail-title" className="elv-card-title">{label(skill.labels, lang, t)}</h2>
      <span className="elv-badge elv-badge-outline skill-map-type">{t(`skill_map.${skill.type}`)}</span>
      <p className="skill-map-state"><span className={`elv-badge elv-badge-outline${hasLevel(status) ? ' skill-map-validated' : ''}`}>{t(status === 'evidence' ? 'skill_map.state_validated' : status === 'needs_review' ? 'skill_map.contradictory' : status === 'stale' ? 'skill_map.stale' : 'skill_map.state_unassessed')}</span>
        {hasLevel(status) && <span className="skill-map-note">{t('skill_map.source')}: {t('skill_map.source_evidence')}</span>}</p>
      {names.length > 0 && <p className="skill-map-note">{t('skill_map.territories')}: {names.join(' · ')}</p>}
      <AssessmentPanel assessment={skill.self} track="self" lang={lang} t={t} />
      <AssessmentPanel assessment={skill.review} track="review" lang={lang} t={t} />
      {onAnalyze && <button type="button" className="elv-btn skill-map-ai-ask" onClick={() => onAnalyze(skill.skillKey)}>{t('skill_map.ai_open_skill')}</button>}
      {self && <SelfAssessPanel skill={skill} catalogVersion={catalogVersion} lang={lang} t={t} backend={self.backend} token={self.token} onChanged={self.onChanged} />}
      <details className="skill-map-rubric">
        <summary>{t('skill_map.rubric')} · {catalogVersion}</summary>
        <ol>
          {[1, 2, 3, 4].map(level => <li key={level}><strong>{t('skill_map.level')} {level}: </strong>{label(skill.rubric.levels[String(level)], lang, t)}</li>)}
        </ol>
        <p className="skill-map-free-text">{t('skill_map.source')}: {skill.rubric.source}</p>
        <p>{t('skill_map.verified')}: <time dateTime={skill.rubric.verifiedAt}>{skill.rubric.verifiedAt}</time></p>
      </details>
    </div>
  </article>
}
