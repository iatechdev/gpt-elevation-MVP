import { Link } from 'react-router-dom'
import type { LocalizedText } from './model'
import { anyLevel, CENTER, improvement, MAX_LABELS, MAX_LEVEL, RADIUS, radarItems, strongest, wedge, wrapName, type RadarItem } from './radar'
import type { Skill } from './model'

type T = (key: string) => string
type Lang = 'es' | 'en'
const fmt = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
const name = (skill: Skill, lang: Lang, t: T) => skill.labels[lang] ?? t('skill_map.translation_missing')
const criterion = (value: LocalizedText | undefined, lang: Lang, t: T) => value?.[lang] ?? t('skill_map.translation_missing')
const evidenceText = (count: number, t: T) => fmt(t(count === 1 ? 'skill_map.radar_evid_one' : 'skill_map.radar_evid'), { n: count })
const levelText = (level: number | null, t: T) => level === null ? t('skill_map.radar_none') : fmt(t('skill_map.radar_level_of'), { n: level, max: MAX_LEVEL })

function Swatch({ level }: { level: number | null }) {
  return <span className={`radar-swatch ${level === null ? 'is-none' : `h${level}`}`} aria-hidden="true">{level ?? ''}</span>
}

/** Radar con mapa de calor. Cada cuña es un botón (Tab/Enter/Espacio) que abre el detalle; la lista de texto es su alternativa accesible. */
export function RadarChart({ items, selected, onSelect, lang, t }: { items: RadarItem[]; selected: string | null; onSelect: (key: string) => void; lang: Lang; t: T }) {
  const labels = items.length <= MAX_LABELS
  const withLevel = items.filter(item => item.level !== null).map(item => `${name(item.skill, lang, t)} ${item.level}`).join(', ') || '—'
  const without = items.filter(item => item.level === null).map(item => name(item.skill, lang, t)).join(', ') || '—'
  return <svg className="radar-svg" viewBox="0 0 560 520" role="group" aria-label={fmt(t('skill_map.radar_alt'), { n: items.length, with: withLevel, without })}>
    {[1, 2, 3, 4].map(n => <g key={n}>
      <circle className="radar-ring" cx={CENTER.x} cy={CENTER.y} r={RADIUS * n / MAX_LEVEL} />
      <text className="radar-ring-label" x={CENTER.x + 4} y={CENTER.y - RADIUS * n / MAX_LEVEL - 3} aria-hidden="true">{n}</text>
    </g>)}
    {items.map((item, i) => { const g = wedge(i, items.length, item.level); return <line key={item.skill.skillKey} className="radar-spoke" x1={CENTER.x} y1={CENTER.y} x2={g.spoke.x} y2={g.spoke.y} /> })}
    {items.map((item, i) => {
      const g = wedge(i, items.length, item.level), title = name(item.skill, lang, t), active = selected === item.skill.skillKey
      const lines = wrapName(title)
      const say = `${title}: ${levelText(item.level, t)}${item.needsReview ? ` · ${t('skill_map.contradictory')}` : ''}`
      return <g key={item.skill.skillKey}>
        <g role="button" tabIndex={0} aria-label={say} aria-pressed={active} className={`radar-wedge${active ? ' is-selected' : ''}`}
          onClick={() => onSelect(item.skill.skillKey)}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item.skill.skillKey) } }}>
          <title>{say}</title>
          <path className={item.level === null ? 'radar-none' : `radar-fill h${item.level}`} d={g.path} />
          {item.level !== null && <text className={`radar-num${item.level === MAX_LEVEL ? ' on-dark' : ''}`} x={g.number.x} y={g.number.y + 5} textAnchor="middle" aria-hidden="true">{item.level}</text>}
        </g>
        {labels && <g aria-hidden="true">
          {lines.map((line, k) => <text key={k} className="radar-label" x={g.label.x} y={g.label.y + g.label.dy + (k - (lines.length - 1) / 2) * 14} textAnchor={g.label.anchor}>{line}</text>)}
          <text className="radar-label-sub" x={g.label.x} y={g.label.y + g.label.dy + ((lines.length + 1) / 2) * 14 - 2} textAnchor={g.label.anchor}>{item.level === null ? t('skill_map.radar_none') : `${t('skill_map.level')} ${item.level}`}</text>
        </g>}
      </g>
    })}
  </svg>
}

export function RadarLegend({ t }: { t: T }) {
  return <ul className="radar-legend" aria-label={t('skill_map.legend')}>
    {[1, 2, 3, 4].map(n => <li key={n}><Swatch level={n} />{t('skill_map.level')} {n}</li>)}
    <li><Swatch level={null} />{t('skill_map.radar_none')}</li>
  </ul>
}

/** Pantalla completa del radar: gráfico, puntos fuertes, un punto a mejorar (con criterio real del catálogo) y lista de texto. */
export function RadarBoard({ skills, selected, onSelect, onRegister, lang, t }: {
  skills: readonly Skill[]; selected: string | null; onSelect: (key: string) => void; onRegister: (key: string) => void; lang: Lang; t: T
}) {
  const items = radarItems(skills)
  const top = strongest(items), next = improvement(items), some = anyLevel(items)
  return <div className="radar-board">
    <section className="elv-card skill-map-card radar-card" aria-labelledby="radar-title">
      <h2 id="radar-title">{t('skill_map.radar_title')}</h2>
      <RadarChart items={items} selected={selected} onSelect={onSelect} lang={lang} t={t} />
      <RadarLegend t={t} />
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
    <section className="elv-card skill-map-card radar-card radar-list-card" aria-labelledby="radar-list-title">
      <h2 id="radar-list-title">{t('skill_map.radar_list_title')}</h2>
      <ul className="radar-list">
        {items.map(item => <li key={item.skill.skillKey}>
          <button type="button" className={`radar-row${selected === item.skill.skillKey ? ' is-selected' : ''}`} aria-pressed={selected === item.skill.skillKey} onClick={() => onSelect(item.skill.skillKey)}>
            <strong>{name(item.skill, lang, t)}</strong>
            <span className={`radar-steps${item.level === null ? ' is-none' : ''}`} aria-hidden="true">
              {[1, 2, 3, 4].map(n => <i key={n} className={item.level !== null && n <= item.level ? `h${item.level}` : ''} />)}
            </span>
            <span className="radar-row-text">{levelText(item.level, t)}{item.level !== null && ` · ${evidenceText(item.evidence, t)}`}{item.needsReview && ` · ${t('skill_map.contradictory')}`}{item.stale && ` · ${t('skill_map.stale')}`}</span>
          </button>
        </li>)}
      </ul>
      <p className="skill-map-note">{t('skill_map.radar_note')}</p>
    </section>
  </div>
}
