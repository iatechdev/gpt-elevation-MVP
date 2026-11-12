// ES-300: el radar a la forma del prototipo (decisión del PO, ES-160 comentario 10961). Un eje por capacidad del catálogo, anillos 1–4 (el exterior es el 4), sin nivel = sin punto,
// solo se unen los vecinos con nivel y el relleno aparece solo cuando todas tienen nivel; cada eje es un botón con nombre y «Nivel n de 4»/«Sin nivel»; tabla alternativa con el mismo contenido.
import './register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import './radarPolygon.css'
import { Link } from 'react-router-dom'
import type { LocalizedText } from './model'
import { improvement, radarItems, strongest, anyLevel, MAX_LEVEL, type RadarItem } from './radar'
import { axisEnd, axisPlacement, POLY_CENTER, POLY_H, POLY_LEVELS, POLY_RADIUS, POLY_W, radarMode, radarShape, ringPath, segmentsPath } from './radarGeometry'
import type { Skill } from './model'

type T = (key: string) => string
type Lang = 'es' | 'en'
const fmt = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
const name = (skill: Skill, lang: Lang, t: T) => skill.labels[lang] ?? t('skill_map.translation_missing')
const criterion = (value: LocalizedText | undefined, lang: Lang, t: T) => value?.[lang] ?? t('skill_map.translation_missing')
const evidenceText = (count: number, t: T) => fmt(t(count === 1 ? 'skill_map.radar_evid_one' : 'skill_map.radar_evid'), { n: count })
const levelText = (level: number | null, t: T) => level === null ? t('skill_map.radar_none') : fmt(t('skill_map.radar_level_of'), { n: level, max: MAX_LEVEL })
/** «Nivel n de 4» o «Sin nivel»: lo que dice cada eje del gráfico y cada fila de la tabla. */
const axisStatus = (level: number | null, t: T) => level === null ? t('skill_map.radar_no_level') : fmt(t('skill_map.radar_level_of'), { n: level, max: MAX_LEVEL })

function Swatch({ level }: { level: number | null }) {
  return <span className={`radar-swatch ${level === null ? 'is-none' : `h${level}`}`} aria-hidden="true">{level ?? ''}</span>
}

/** Polígono del radar. Hasta 12 capacidades cada eje lleva nombre y nivel visibles; hasta 24, solo la marca (el nombre va en el aria-label y en la tabla); con más, el gráfico es una imagen y la tabla es la superficie interactiva. */
export function RadarPolygon({ items, selected, onSelect, lang, t }: { items: readonly RadarItem[]; selected: string | null; onSelect: (key: string) => void; lang: Lang; t: T }) {
  const total = items.length
  const mode = radarMode(total)
  const shape = radarShape(items.map(item => item.level))
  const alt = `${t('skill_map.radar_poly_alt')} ${fmt(t('skill_map.radar_with'), { with: total - shape.missing, n: total })}`
  return <div className={`radar-poly is-${mode}`}>
    <svg viewBox={`0 0 ${POLY_W} ${POLY_H}`} role="img" aria-label={alt}>
      {[1, 2, 3, 4].map(level => <path key={level} d={ringPath(total, level)} className={`radar-ring${level === POLY_LEVELS ? ' is-outer' : ''}`} />)}
      {items.map((item, i) => { const end = axisEnd(i, total); return <line key={item.skill.skillKey} x1={POLY_CENTER.x} y1={POLY_CENTER.y} x2={end.x} y2={end.y} className="radar-axis-line" /> })}
      {[1, 2, 3, 4].map(level => <text key={level} x={POLY_CENTER.x + 4} y={POLY_CENTER.y - (POLY_RADIUS * level) / POLY_LEVELS - 3} className="radar-ring-num" aria-hidden="true">{level}</text>)}
      {shape.fill && <path d={shape.fill} className="radar-fill" />}
      {shape.segments.length > 0 && <path d={segmentsPath(shape)} className="radar-line" />}
      {shape.dots.map(dot => <circle key={dot.index} cx={dot.x} cy={dot.y} r={5} className="radar-dot" />)}
    </svg>
    {mode !== 'image' && items.map((item, i) => {
      const place = axisPlacement(i, total), title = name(item.skill, lang, t), status = axisStatus(item.level, t)
      return <button key={item.skill.skillKey} type="button" className={`radar-axis h-${place.h} v-${place.v}`} style={{ left: `${place.left}%`, top: `${place.top}%` }}
        aria-pressed={selected === item.skill.skillKey} aria-label={`${title}: ${status}`} onClick={() => onSelect(item.skill.skillKey)}>
        <span className="radar-axis-mark" aria-hidden="true" />
        <b>{title}</b><span>{status}</span>
      </button>
    })}
  </div>
}

/** Tabla alternativa «Ver los niveles como tabla»: el mismo contenido que el gráfico; el nombre de cada fila abre el mismo detalle. Con más de 24 capacidades es la superficie principal y se abre sola. */
export function RadarTable({ items, selected, onSelect, lang, t }: { items: readonly RadarItem[]; selected: string | null; onSelect: (key: string) => void; lang: Lang; t: T }) {
  return <details className="radar-table" open={radarMode(items.length) === 'image' || undefined}>
    <summary>{t('skill_map.radar_table')}</summary>
    <table>
      <thead><tr><th scope="col">{t('skill_map.radar_col_skill')}</th><th scope="col">{t('skill_map.radar_col_level')}</th></tr></thead>
      <tbody>
        {items.map(item => <tr key={item.skill.skillKey}>
          <th scope="row"><button type="button" className="radar-table-skill" aria-pressed={selected === item.skill.skillKey} onClick={() => onSelect(item.skill.skillKey)}>{name(item.skill, lang, t)}</button></th>
          <td>{axisStatus(item.level, t)}{item.needsReview && ` · ${t('skill_map.contradictory')}`}{item.stale && ` · ${t('skill_map.stale')}`}</td>
        </tr>)}
      </tbody>
    </table>
  </details>
}

/** Pantalla completa del radar: gráfico, tabla alternativa, puntos fuertes y un punto a mejorar (con criterio real del catálogo). */
export function RadarBoard({ skills, selected, onSelect, onRegister, onAnalyze, lang, t }: {
  skills: readonly Skill[]; selected: string | null; onSelect: (key: string) => void; onRegister: (key: string) => void; onAnalyze?: () => void; lang: Lang; t: T
}) {
  const items = radarItems(skills)
  const top = strongest(items), next = improvement(items), some = anyLevel(items)
  const missing = items.filter(item => item.level === null).length
  return <div className="radar-board">
    <section className="elv-card skill-map-card radar-card" aria-labelledby="radar-title">
      <h2 id="radar-title">{t('skill_map.radar_title')}</h2>
      <RadarPolygon items={items} selected={selected} onSelect={onSelect} lang={lang} t={t} />
      <p className="skill-map-note">{t('skill_map.radar_poly_intro')}</p>
      {missing > 0 && <p className="skill-map-note" role="status">{fmt(t(missing === 1 ? 'skill_map.radar_gap_one' : 'skill_map.radar_gap'), { n: missing })}</p>}
      {radarMode(items.length) === 'image' && <p className="skill-map-note">{fmt(t('skill_map.radar_many'), { n: items.length })}</p>}
      <RadarTable items={items} selected={selected} onSelect={onSelect} lang={lang} t={t} />
      {onAnalyze && <button type="button" className="elv-btn radar-analyze" onClick={onAnalyze}>{t('skill_map.ai_open')}</button>}
    </section>
    <div className="radar-side">
      {!some ? <section className="elv-card skill-map-card radar-card radar-empty" role="status" aria-labelledby="radar-empty-title">
        <h2 id="radar-empty-title">{t('skill_map.radar_empty_title')}</h2><p>{t('skill_map.radar_empty_text')}</p>
        <Link className="elv-btn skill-map-primary" to="/app/evidence">{t('skill_map.guide_cta')}</Link>
      </section> : <>
        <section className="elv-card skill-map-card radar-card" aria-labelledby="radar-strong-title">
          <h2 id="radar-strong-title">{t(top.length < 3 ? 'skill_map.radar_strong_few' : 'skill_map.radar_strong')}</h2>
          <ol className="radar-points">
            {top.map(item => <li key={item.skill.skillKey}>
              <h3>{name(item.skill, lang, t)}</h3>
              <p className="radar-lv"><Swatch level={item.level} />{levelText(item.level, t)} · {evidenceText(item.evidence, t)}</p>
              <p className="radar-criterion">{criterion(item.skill.rubric.levels[String(item.level)], lang, t)}</p>
            </li>)}
          </ol>
          {top.length < 3 && <p className="skill-map-note">{fmt(t('skill_map.radar_only_n'), { n: top.length })}</p>}
        </section>
        <section className="elv-card skill-map-card radar-card" aria-labelledby="radar-improve-title">
          <h2 id="radar-improve-title">{t('skill_map.radar_improve')}</h2>
          {next ? <div className="radar-improve">
            <h3>{name(next.item.skill, lang, t)}</h3>
            <p>{fmt(t('skill_map.radar_to_level'), { n: next.next })} «{criterion(next.item.skill.rubric.levels[String(next.next)], lang, t)}»</p>
            <button type="button" className="elv-btn skill-map-primary" onClick={() => onRegister(next.item.skill.skillKey)}>{t('skill_map.reg_btn')}</button>
          </div> : <p>{t('skill_map.radar_top')}</p>}
        </section>
      </>}
    </div>
  </div>
}
