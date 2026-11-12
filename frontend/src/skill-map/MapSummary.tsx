// ES-160: resumen del mapa para las vistas Relieve y Lista: «tus puntos más fuertes» y «un punto donde puedes mejorar» (con el criterio real del catálogo).
// Solo aparece cuando hay niveles; nunca se rellena con capacidades sin nivel ni inventa mejoras.
import './register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { improvement, radarItems, strongest, MAX_LEVEL } from './radar'
import type { Skill } from './model'

type T = (key: string) => string
type Lang = 'es' | 'en'
const fmt = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))

/** Cuatro marcas y el texto «nivel n de 4»: el nivel nunca va solo en la forma ni en el color. */
export function LevelTicks({ level, t }: { level: number; t: T }) {
  return <span className="skill-map-ticks">
    <span aria-hidden="true">{[1, 2, 3, 4].map(n => <i key={n} className={n <= level ? 'is-on' : ''} />)}</span>
    <span>{fmt(t('skill_map.radar_level_of'), { n: level, max: MAX_LEVEL })}</span>
  </span>
}

export function MapSummary({ skills, lang, t, onRegister }: { skills: readonly Skill[]; lang: Lang; t: T; onRegister: (key: string) => void }) {
  const items = radarItems(skills)
  const top = strongest(items), next = improvement(items)
  if (top.length === 0) return null
  const name = (skill: Skill) => skill.labels[lang] ?? t('skill_map.translation_missing')
  return <div className="skill-map-summary">
    <section className="skill-map-card-cg" aria-labelledby="map-strong-title">
      <h2 id="map-strong-title">{t(top.length < 3 ? 'skill_map.radar_strong_few' : 'skill_map.radar_strong')}</h2>
      <ul>{top.map(item => <li key={item.skill.skillKey}><span className="skill-map-summary-name">{name(item.skill)}</span><LevelTicks level={item.level!} t={t} /></li>)}</ul>
      {top.length < 3 && <p className="skill-map-note">{fmt(t('skill_map.radar_only_n'), { n: top.length })}</p>}
    </section>
    <section className="skill-map-card-cg" aria-labelledby="map-improve-title">
      <h2 id="map-improve-title">{t('skill_map.radar_improve')}</h2>
      {next ? <>
        <p className="skill-map-summary-name">{name(next.item.skill)}</p>
        <p>{fmt(t('skill_map.radar_to_level'), { n: next.next })} «{next.item.skill.rubric.levels[String(next.next)]?.[lang] ?? t('skill_map.translation_missing')}»</p>
        <button type="button" className="elv-btn skill-map-primary" onClick={() => onRegister(next.item.skill.skillKey)}>{t('skill_map.reg_btn')}</button>
      </> : <p>{t('skill_map.radar_top')}</p>}
    </section>
  </div>
}
