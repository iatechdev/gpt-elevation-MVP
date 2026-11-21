// ES-110: decisiones PURAS de «Actualizar mi hoja de vida» (sin React, sin red): qué filas se ofrecen, a qué pantalla se entra y qué se dice cuando guardar falla.
// Viven aparte para poder probarlas en CI (E398-4): la pantalla solo las llama.
import type { DeclaredSkill } from '../participantContext.ts'
import { skillKey, type SkillDiff, type RemainingSkill } from './resumeDiff.ts'

/** «Siguen en tu hoja de vida»: solo lo que se puede vincular. Lo ya vinculado a la versión nueva o escrito a mano no ofrece nada que decidir. */
export const pendingLinks = (diff: SkillDiff): RemainingSkill[] => diff.remain.filter(item => !item.linked && !item.handwritten)

/** A qué pantalla entra la persona: sin contexto guardado → formulario (no hay con qué comparar); con el tope de versiones → lista para elegir cuál borrar; si no → subir. */
export const entryOf = (context: { version: number; context: unknown | null }, versions: { count: number; max: number }): 'onboarding' | 'limit' | 'upload' =>
  context.version === 0 || !context.context ? 'onboarding' : versions.count >= versions.max ? 'limit' : 'upload'

/** La respuesta de guardar puede perderse: lo guardado es «lo elegido» si tiene los mismos nombres (sin acentos ni mayúsculas) y versiones, en el mismo orden. */
export const sameSkills = (a: DeclaredSkill[], b: DeclaredSkill[]) => a.length === b.length && a.every((skill, index) => skillKey(skill.name) === skillKey(b[index].name) && skill.resumeVersion === b[index].resumeVersion)

export type SaveFailure = { status: number; code?: string }
export type SaveOutcome = 'expired' | 'saved' | 'conflict' | 'schema' | 'error'
/** Qué decir tras un fallo al guardar. `fresh` = lo que se releyó del servidor (null si no se pudo releer). 0, 5xx y 409 son «¿se guardó y se perdió la respuesta?»: si lo releído ya es lo elegido, está guardado. */
export function outcomeAfterFailure(failure: SaveFailure, fresh: DeclaredSkill[] | null, applied: DeclaredSkill[]): SaveOutcome {
  if (failure.status === 401 || failure.status === 403) return 'expired'
  const uncertain = failure.status === 0 || failure.status >= 500 || failure.status === 409
  if (uncertain && fresh && sameSkills(fresh, applied)) return 'saved'
  if (failure.status === 409) return 'conflict'
  if (failure.status === 400 && failure.code === 'schema_outdated') return 'schema'
  return 'error'
}
