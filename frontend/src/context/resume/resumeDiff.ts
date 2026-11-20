// ES-110 («Actualizar mi hoja de vida»): diferencia PURA entre las habilidades declaradas del contexto y las que sugiere el análisis de una versión NUEVA de la hoja de vida.
// Sin red, sin DOM, sin IA, sin servidor: el texto de la hoja no se persiste, así que la diferencia se calcula aquí (decisión 1 aprobada en ES-110, comentario de Infra del 20-nov-2026).
// Tres grupos: «Nuevas» (están en la hoja nueva y no en el contexto), «Siguen» (en ambos; se puede VINCULAR a la versión nueva) y «Ya no aparecen» (en el contexto, vinculadas a una
// hoja de vida, y la versión nueva no las trae). Reglas: por defecto lo que ya no aparece SE MANTIENE (quitarlo es un gesto explícito); lo escrito a mano nunca «desaparece»;
// nada de esto toca evidencia (lo confirmado no cambia) ni se guarda: devuelve un contexto nuevo que la persona guarda con su `expectedVersion`.
import type { DeclaredSkill } from '../participantContext'

export const MAX_DECLARED_SKILLS = 40 // el mismo tope del contexto (resumeLogic.MAX_SKILLS y el servidor)

/** Clave de comparación: sin acentos, sin mayúsculas, con espacios normalizados (la misma idea que `fold` del servidor en ES-110). */
export const skillKey = (name: string): string => String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export type RemainingSkill = {
  /** La habilidad del contexto (conserva su nombre y su cita). */
  current: DeclaredSkill
  /** La que trae la hoja nueva (su cita literal). */
  suggested: DeclaredSkill
  /** true si el contexto ya la tiene vinculada a la versión nueva: no hay nada que vincular. */
  linked: boolean
  /** true si la habilidad del contexto está escrita a mano (sin hoja de vida): vincularla sería declararla «de la hoja», así que no se ofrece por defecto. */
  handwritten: boolean
}
export type SkillDiff = {
  version: number
  added: DeclaredSkill[]
  remain: RemainingSkill[]
  gone: DeclaredSkill[]
  /** Cuántas nuevas NO caben por el tope de 40 habilidades (se dicen, no se pierden en silencio). */
  overflow: number
  /** true si no hay nada que decidir: ni nuevas, ni por vincular, ni que ya no aparezcan. */
  unchanged: boolean
}
export type Choices = { add: string[]; link: string[]; remove: string[] }

const uniqueByKey = (skills: DeclaredSkill[]): DeclaredSkill[] => {
  const seen = new Set<string>(); const out: DeclaredSkill[] = []
  for (const skill of skills) { const key = skillKey(skill.name); if (!key || seen.has(key)) continue; seen.add(key); out.push(skill) }
  return out
}

/** Diferencia entre el contexto actual y lo sugerido por la versión `version`. No modifica ninguno de los argumentos. */
export function diffSkills(current: DeclaredSkill[], suggested: DeclaredSkill[], version: number): SkillDiff {
  const mine = uniqueByKey(current), theirs = uniqueByKey(suggested)
  const mineByKey = new Map(mine.map(skill => [skillKey(skill.name), skill]))
  const theirsByKey = new Map(theirs.map(skill => [skillKey(skill.name), skill]))
  const added = theirs.filter(skill => !mineByKey.has(skillKey(skill.name)))
  const remain: RemainingSkill[] = mine.filter(skill => theirsByKey.has(skillKey(skill.name))).map(skill => ({
    current: skill, suggested: theirsByKey.get(skillKey(skill.name))!, linked: skill.resumeVersion === version, handwritten: skill.resumeVersion === null,
  }))
  // «Ya no aparece»: solo lo que el contexto tomó de una hoja de vida. Lo escrito a mano (resumeVersion null) no viene de un documento: no puede «dejar de aparecer».
  const gone = mine.filter(skill => skill.resumeVersion !== null && !theirsByKey.has(skillKey(skill.name)))
  const room = Math.max(0, MAX_DECLARED_SKILLS - mine.length)
  const overflow = Math.max(0, added.length - room)
  const unchanged = added.length === 0 && gone.length === 0 && remain.every(item => item.linked || item.handwritten)
  return { version, added, remain, gone, overflow, unchanged }
}

/** Elecciones por defecto (decisiones aprobadas): se añaden las nuevas que caben, se vinculan las que siguen (salvo las escritas a mano) y NO se quita nada. */
export function defaultChoices(diff: SkillDiff): Choices {
  return {
    add: diff.added.map(skill => skill.name),
    link: diff.remain.filter(item => !item.linked && !item.handwritten).map(item => item.current.name),
    remove: [],
  }
}

/**
 * Aplica las elecciones y devuelve las habilidades del contexto NUEVAS (sin tocar `current`).
 * - Solo se actúa sobre nombres que el `diff` ofrece: «añadir» solo de `added`, «vincular» solo de `remain`, «quitar» solo de `gone` (un nombre inventado o de otro grupo se ignora).
 * - Vincular fija `resumeVersion` = versión nueva y toma la cita de la hoja nueva (cuando trae una); no cambia el nombre que la persona ya tiene.
 * - Añadir respeta el tope de 40 y el orden de la hoja; lo que no cabe se cuenta en `skipped` (nunca se descarta algo ya guardado para hacer sitio).
 * - Aplicar dos veces las mismas elecciones sobre el resultado no cambia nada (idempotente).
 */
export function applyChoices(current: DeclaredSkill[], diff: SkillDiff, choices: Choices): { skills: DeclaredSkill[]; skipped: number } {
  const wanted = (names: string[]) => new Set(names.map(skillKey))
  const toRemove = wanted(choices.remove), toLink = wanted(choices.link), toAdd = wanted(choices.add)
  const goneKeys = new Set(diff.gone.map(skill => skillKey(skill.name)))
  const remainByKey = new Map(diff.remain.map(item => [skillKey(item.current.name), item]))
  const out: DeclaredSkill[] = []
  const seen = new Set<string>()
  for (const skill of current) {
    const key = skillKey(skill.name)
    if (!key || seen.has(key)) continue // un duplicado del contexto se colapsa (el servidor lo rechazaría igual)
    seen.add(key)
    if (toRemove.has(key) && goneKeys.has(key)) continue
    const item = remainByKey.get(key)
    if (item && toLink.has(key)) { out.push({ ...skill, resumeVersion: diff.version, support: item.suggested.support ?? skill.support }); continue }
    out.push({ ...skill })
  }
  let skipped = 0
  for (const skill of diff.added) {
    const key = skillKey(skill.name)
    if (!toAdd.has(key) || seen.has(key)) continue
    if (out.length >= MAX_DECLARED_SKILLS) { skipped += 1; continue }
    seen.add(key); out.push({ ...skill, resumeVersion: diff.version })
  }
  return { skills: out, skipped }
}
