import { trackView, type Assessment, type LocalizedText, type Skill } from './model'
import { CANVAS_W, CHIP_H, CHIP_W, edgePoint, layoutChips, territoryBoxes } from './layout'
import { hasLevel, skillStatus, type SkillStatus } from './status'
import { SelfAssessPanel } from './SelfAssessPanel'
import { resolveTerritories, type Territory } from './territories'

type T = (key: string) => string
type Lang = 'es' | 'en'
const statusKey = (status: SkillStatus) => status === 'evidence' ? 'skill_map.status_evidence' : status === 'needs_review' ? 'skill_map.contradictory'
  : status === 'stale' ? 'skill_map.stale' : 'skill_map.no_evidence'
const label = (value: LocalizedText, lang: Lang, t: T) => value[lang] ?? t('skill_map.translation_missing')
/** Dos líneas como máximo para el nombre dentro del recuadro; el nombre completo queda en <title> y en el detalle. */
function wrap(text: string, width = 22): string[] {
  const lines: string[] = []; let line = ''
  for (const word of text.split(/\s+/)) {
    if (line && `${line} ${word}`.length > width) { lines.push(line); line = word } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  if (lines.length > 2) { const rest = lines.slice(1).join(' '); return [lines[0], rest.length > width ? `${rest.slice(0, width - 1)}…` : rest] }
  return lines
}

/** Mapa visual (SVG): territorios como recuadros y capacidades unidas por líneas a cada uno de sus territorios. */
export function TerritoryMap({ skills, territories, selected, onSelect, lang, t }: {
  skills: readonly Skill[]; territories: readonly Territory[]; selected: string | null
  onSelect: (key: string) => void; lang: Lang; t: T
}) {
  const { groups, links } = resolveTerritories(skills, territories)
  const assigned = skills.filter(skill => links(skill).length > 0)
  const { positions, height } = layoutChips(assigned.map(skill => ({ key: skill.skillKey, links: links(skill) })))
  return <svg className="skill-map-svg" viewBox={`0 0 ${CANVAS_W} ${height}`} role="group" aria-label={t('skill_map.map_label')}>
    {groups.map(({ territory }) => {
      const box = territoryBoxes[territory.id]; if (!box) return null
      return <g key={territory.id} className={`skill-map-territory tone-${territory.id}`}>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={34} />
        <text className="skill-map-territory-name" x={box.x + box.w / 2} y={box.y + box.h / 2 - 4} textAnchor="middle">{territory.labels[lang]}</text>
        <text className="skill-map-territory-roles" x={box.x + box.w / 2} y={box.y + box.h / 2 + 18} textAnchor="middle">{territory.roles}</text>
      </g>
    })}
    {assigned.map(skill => links(skill).map(id => {
      const box = territoryBoxes[id], at = positions[skill.skillKey]; if (!box || !at) return null
      const end = edgePoint(box, at)
      return <line key={`${skill.skillKey}-${id}`} className={`skill-map-link ${hasLevel(skillStatus(skill)) ? 'is-level' : 'is-none'}`} x1={at.x} y1={at.y} x2={end.x} y2={end.y} />
    }))}
    {assigned.map(skill => {
      const at = positions[skill.skillKey]; if (!at) return null
      const status = skillStatus(skill), name = label(skill.labels, lang, t), on = selected === skill.skillKey, lines = wrap(name)
      return <g key={skill.skillKey} className={`skill-map-chip${on ? ' is-selected' : ''}`} role="button" tabIndex={0} aria-pressed={on}
        aria-label={`${name}: ${t(statusKey(status))}`} onClick={() => onSelect(skill.skillKey)}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(skill.skillKey) } }}>
        <title>{name}</title>
        <rect x={at.x - CHIP_W / 2} y={at.y - CHIP_H / 2} width={CHIP_W} height={CHIP_H} rx={6} />
        <circle className={hasLevel(status) ? 'dot-level' : 'dot-none'} cx={at.x - CHIP_W / 2 + 20} cy={at.y - 6} r={7} />
        {lines.map((line, index) => <text key={index} className="skill-map-chip-name" x={at.x - CHIP_W / 2 + 38} y={at.y - 8 + index * 16}>{line}</text>)}
        <text className="skill-map-chip-status" x={at.x - CHIP_W / 2 + 38} y={at.y + 24}>{t(statusKey(status))}</text>
      </g>
    })}
  </svg>
}

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
      <p className="skill-map-roles">{territory.roles}</p>
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
  const next = view.stale || assessment?.catalogOutdated ? 'next_stale' : view.needsReview ? 'contradictory' : view.level === null ? 'next_empty' : 'next_current'
  return <section className="skill-map-track" aria-label={t(`skill_map.${track}`)}>
    <h3>{t(`skill_map.${track}`)}</h3>
    {track === 'review' && !assessment ? <p>{t('skill_map.no_review')}</p> : <>
      <p className="skill-map-level" data-testid="skill-level">
        {view.level === null ? t('skill_map.no_evidence') : `${t('skill_map.level')} ${view.level}`}
      </p>
      {view.state !== 'no_evidence' && <span className="elv-badge elv-badge-outline">{t(`skill_map.${view.state}`)}</span>}
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
      {view.needsReview && <p className="skill-map-note">{t('skill_map.review_unavailable')}</p>}
    </>}
  </section>
}

/** Detalle de la capacidad elegida: las mismas pistas separadas y reglas de datos de siempre (nivel null sin evidencia, sin promedios). */
export function SkillDetail({ skill, catalogVersion, territories, lang, t, self }: {
  skill: Skill; catalogVersion: number; territories: readonly Territory[]; lang: Lang; t: T
  self?: { backend: string; token: string; onChanged: (kind: 'saved' | 'retired') => void }
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
