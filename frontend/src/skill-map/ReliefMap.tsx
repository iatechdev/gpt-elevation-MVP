// ES-160: relieve del mapa. El canvas pinta una curva por nivel registrado (autoevaluación de la persona); lo que no tiene evidencia vigente queda plano, nunca como déficit.
// Cada capacidad es un botón sobre el canvas (teclado y táctil) con su nombre y su nivel; la lista por territorios (TerritoryList) lleva la misma información.
// ES-300: (E258-2) los botones no se solapan (separate(): rectángulo marca+rótulo, medido con la caja real; si no caben los rótulos, solo la marca) y
// (E258-4) el canvas se pinta DESPUÉS del primer contenido (en reposo del navegador): los botones y la lista no esperan al relieve.
import './register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useEffect, useMemo, useRef, useState } from 'react'
import { ReliefCanvas } from '../cartografia'
import type { ReliefPoint } from '../cartografia'
import type { Skill } from './model'
import { placeSkills } from './reliefPlace'
import { separate, type Slot } from './reliefSeparate'
import type { Territory } from './territories'

type T = (key: string) => string
type Lang = 'es' | 'en'
const fmt = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
/** Tamaño de la marca (objetivo táctil ≥ 24 px, WCAG 2.2 AA 2.5.8) y alto de la fila con rótulo. */
const MARK = 28
const ROW = 44
const NARROW = 640
const DEFER_MS = 200

/** Caja estimada antes de medirla (mismas proporciones que el CSS: 16:10 en ancho, 4:5 en móvil): así la primera pintura ya casi coincide con la medida. */
const guessBox = () => {
  const width = typeof window === 'undefined' ? 800 : Math.min(window.innerWidth - 32, 820)
  return { w: Math.max(width, 280), h: Math.max(width, 280) * (width < NARROW ? 1.25 : 0.625) }
}

export function ReliefMap({ skills, territories, selected, onSelect, lang, t }: {
  skills: readonly Skill[]; territories: readonly Territory[]; selected: string | null; onSelect: (key: string) => void; lang: Lang; t: T
}) {
  const placed = useMemo(() => placeSkills(skills, territories), [skills, territories])
  const points: ReliefPoint[] = useMemo(() => placed.map(item => ({ x: item.x, y: item.y, level: item.level ?? 0 })), [placed])
  const withLevel = placed.filter(item => item.level !== null).length
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState(guessBox)
  const [paint, setPaint] = useState(false)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({})

  useEffect(() => {
    const element = boxRef.current
    if (!element) return
    const read = () => setBox(previous => (Math.abs(previous.w - element.clientWidth) < 1 && Math.abs(previous.h - element.clientHeight) < 1) || element.clientWidth === 0 ? previous : { w: element.clientWidth, h: element.clientHeight })
    read()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read)
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [])
  // E258-4: el canvas espera a que el navegador esté en reposo (con un tope de 200 ms) para que el contenido útil no compita con su pintado.
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void })
    if (idle.requestIdleCallback) { const id = idle.requestIdleCallback(() => setPaint(true), { timeout: DEFER_MS }); return () => idle.cancelIdleCallback?.(id) }
    const id = window.setTimeout(() => setPaint(true), 0)
    return () => window.clearTimeout(id)
  }, [])

  // El tamaño real de cada rótulo se mide (no se estima): separate() trabaja con los rectángulos que de verdad se pintan. Un solo ResizeObserver para todos los botones.
  const observer = useRef<ResizeObserver | null>(null)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const watcher = new ResizeObserver(entries => setSizes(previous => {
      const next = { ...previous }; let changed = false
      for (const entry of entries) {
        const element = entry.target as HTMLElement, key = element.dataset.skill
        if (!key) continue
        const size = { w: Math.ceil(element.offsetWidth), h: Math.ceil(element.offsetHeight) }
        if (!previous[key] || Math.abs(previous[key].w - size.w) >= 2 || Math.abs(previous[key].h - size.h) >= 2) { next[key] = size; changed = true }
      }
      return changed ? next : previous
    }))
    observer.current = watcher
    buttons.current.forEach(element => watcher.observe(element))
    return () => { watcher.disconnect(); observer.current = null }
  }, [])

  const names = useMemo(() => placed.map(item => item.skill.labels[lang] ?? t('skill_map.translation_missing')), [placed, lang, t])
  const layout = useMemo(() => {
    const slots = (labels: boolean): Slot[] => placed.map((item, i) => labels
      ? { x: item.x * box.w, y: item.y * box.h, w: sizes[item.skill.skillKey]?.w ?? 40 + names[i].length * 8, h: Math.max(ROW, sizes[item.skill.skillKey]?.h ?? ROW), side: item.x > 0.55 ? 'right' : 'left' }
      : { x: item.x * box.w, y: item.y * box.h, w: MARK, h: MARK, side: 'left', centered: true })
    let labels = box.w >= NARROW
    let out = separate(slots(labels), { width: box.w, height: box.h })
    if (labels && out.crowded) { labels = false; out = separate(slots(false), { width: box.w, height: box.h }) } // no caben los rótulos: solo la marca (el nombre sigue en aria-label y en la lista)
    return { labels, positions: out.positions }
  }, [placed, names, box, sizes])

  return <div className="skill-map-relief">
    <div className="skill-map-relief-box" ref={boxRef}>
      <ReliefCanvas points={points} loading={!paint} label={fmt(t('skill_map.relief_alt'), { n: withLevel, total: placed.length })} />
      {placed.map(({ skill, x, level }, i) => {
        const status = level === null ? t('skill_map.no_evidence') : fmt(t('skill_map.radar_level_of'), { n: level, max: 4 })
        const at = layout.positions[i]
        return <button key={skill.skillKey} data-skill={skill.skillKey} ref={element => { if (element) { buttons.current.set(skill.skillKey, element); observer.current?.observe(element) } else buttons.current.delete(skill.skillKey) }} type="button" className={`skill-map-place${layout.labels ? '' : ' is-mark'}${layout.labels && x > 0.55 ? ' is-right' : ''}${level === null ? ' is-flat' : ''}`}
          style={{ left: `${(at.x / box.w) * 100}%`, top: `${(at.y / box.h) * 100}%` }} aria-pressed={selected === skill.skillKey} aria-label={`${names[i]}: ${status}`} onClick={() => onSelect(skill.skillKey)}>
          <span className="skill-map-place-mark" aria-hidden="true" />
          <span className="skill-map-place-name">{names[i]}</span>
        </button>
      })}
    </div>
    <ul className="skill-map-legend" aria-label={t('skill_map.legend')}>
      <li><span className="skill-map-dot dot-level" aria-hidden="true" />{t('skill_map.status_evidence')}</li>
      <li><span className="skill-map-dot dot-none" aria-hidden="true" />{t('skill_map.no_evidence')}</li>
    </ul>
  </div>
}
