import { trackView, type Skill } from './model'

export type SkillStatus = 'evidence' | 'needs_review' | 'stale' | 'none'

/** Estado visible de una habilidad en el mapa. Nunca promedia ni elige entre autoevaluación y revisión:
 *  «con evidencia» solo significa que alguna pista tiene un nivel vigente; el nivel se lee en el detalle. */
export function skillStatus(skill: Skill): SkillStatus {
  const views = [trackView(skill.self), trackView(skill.review)]
  if (views.some(view => view.needsReview)) return 'needs_review'
  if (views.some(view => view.level !== null)) return 'evidence'
  if (views.some(view => view.stale)) return 'stale'
  return 'none'
}
/** Relleno = hay un nivel vigente; hueco punteado = no lo hay. El texto siempre acompaña a la forma y al color. */
export const hasLevel = (status: SkillStatus) => status === 'evidence' || status === 'needs_review'
/** La guía del mapa solo se muestra si hay capacidades y NINGUNA tiene un nivel vigente; en cuanto una lo tiene, se oculta. */
export const noLevelAnywhere = (skills: readonly Skill[]) => skills.length > 0 && skills.every(skill => !hasLevel(skillStatus(skill)))
