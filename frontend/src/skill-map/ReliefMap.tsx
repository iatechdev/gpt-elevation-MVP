// ES-160: relieve del mapa. El canvas pinta una curva por nivel registrado (autoevaluación de la persona); lo que no tiene evidencia vigente queda plano, nunca como déficit.
// Cada capacidad es un botón sobre el canvas (teclado y táctil) con su nombre y su nivel; la lista por territorios (TerritoryList) lleva la misma información.
import './register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useMemo } from 'react'
import { ReliefCanvas } from '../cartografia'
import type { ReliefPoint } from '../cartografia'
import type { Skill } from './model'
import { placeSkills } from './reliefPlace'
import type { Territory } from './territories'

type T = (key: string) => string
type Lang = 'es' | 'en'
const fmt = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))

export function ReliefMap({ skills, territories, selected, onSelect, lang, t }: {
  skills: readonly Skill[]; territories: readonly Territory[]; selected: string | null; onSelect: (key: string) => void; lang: Lang; t: T
}) {
  const placed = useMemo(() => placeSkills(skills, territories), [skills, territories])
  const points: ReliefPoint[] = useMemo(() => placed.map(item => ({ x: item.x, y: item.y, level: item.level ?? 0 })), [placed])
  const withLevel = placed.filter(item => item.level !== null).length
  return <div className="skill-map-relief">
    <div className="skill-map-relief-box">
      <ReliefCanvas points={points} label={fmt(t('skill_map.relief_alt'), { n: withLevel, total: placed.length })} />
      {placed.map(({ skill, x, y, level }) => {
        const name = skill.labels[lang] ?? t('skill_map.translation_missing')
        const status = level === null ? t('skill_map.no_evidence') : fmt(t('skill_map.radar_level_of'), { n: level, max: 4 })
        return <button key={skill.skillKey} type="button" className={`skill-map-place${x > 0.55 ? ' is-right' : ''}${level === null ? ' is-flat' : ''}`}
          style={{ left: `${x * 100}%`, top: `${y * 100}%` }} aria-pressed={selected === skill.skillKey} aria-label={`${name}: ${status}`} onClick={() => onSelect(skill.skillKey)}>
          <span className="skill-map-place-mark" aria-hidden="true" />
          <span className="skill-map-place-name">{name}</span>
        </button>
      })}
    </div>
    <ul className="skill-map-legend" aria-label={t('skill_map.legend')}>
      <li><span className="skill-map-dot dot-level" aria-hidden="true" />{t('skill_map.status_evidence')}</li>
      <li><span className="skill-map-dot dot-none" aria-hidden="true" />{t('skill_map.no_evidence')}</li>
    </ul>
  </div>
}
