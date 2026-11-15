// ES-160: dónde va cada capacidad en el relieve y qué nivel pinta (funciones puras).
import { CANVAS_W, layoutChips } from './layout.ts'
import { trackView, type Skill } from './model.ts'
import { resolveTerritories, type Territory } from './territories.ts'

/** Nivel vigente de la AUTOEVALUACIÓN de la persona (la revisión humana se ve solo en el detalle, por separado). null = sin evidencia vigente. */
export const reliefLevel = (skill: Skill): number | null => trackView(skill.self).level

export type Placed = { skill: Skill; x: number; y: number; level: number | null }
/** Posición 0–1 de cada capacidad: con territorio, la que calcula el diseño determinista del mapa; sin territorio, una fila al pie, en orden del catálogo. */
export function placeSkills(skills: readonly Skill[], territories: readonly Territory[]): Placed[] {
  const { links, unassigned } = resolveTerritories(skills, territories)
  const assigned = skills.filter(skill => links(skill).length > 0)
  const { positions, height } = layoutChips(assigned.map(skill => ({ key: skill.skillKey, links: links(skill) })))
  const out: Placed[] = assigned.map(skill => {
    const at = positions[skill.skillKey]
    return { skill, x: Math.min(0.94, Math.max(0.06, at.x / CANVAS_W)), y: Math.min(0.92, Math.max(0.08, at.y / height)), level: reliefLevel(skill) }
  })
  unassigned.forEach((skill, i) => out.push({ skill, x: (i + 1) / (unassigned.length + 1), y: 0.94, level: reliefLevel(skill) }))
  return out
}
