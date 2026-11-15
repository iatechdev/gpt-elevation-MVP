// ES-153 (paso 1, P1 de Codex): al montar el marco de persona, los enlaces del encabezado y «Salir» ya no pasan por el `onLeave` de cada pantalla.
// Las pantallas con texto sin guardar (evidencia, notas de un ejercicio, Brújula, contexto, experimentos, diario, encuesta del piloto) registran aquí cómo preguntar
// antes de salir; el marco consulta este registro ANTES de cambiar de ruta o cerrar la sesión. `true` = bloquea (la persona se queda con su texto).
// `ownLinks`: el diario y la encuesta del piloto ya interceptan los clics de enlace por su cuenta (space/hooks.ts, pilot/hooks.ts); para un enlace del marco
// no se les vuelve a preguntar (evita la pregunta doble), pero sí para «Salir», que es un botón.
type Guard = (to: string) => boolean
type Entry = { guard: Guard; ownLinks: boolean }
const guards = new Set<Entry>()

export function registerLeaveGuard(guard: Guard, options: { ownLinks?: boolean } = {}) {
  const entry = { guard, ownLinks: options.ownLinks === true }
  guards.add(entry)
  return () => { guards.delete(entry) }
}

/** ¿Algún borrador sin guardar impide salir hacia `to`? `kind`: un enlace del marco o una acción (cerrar sesión). Cada guardia pregunta a la persona (o abre su propio diálogo). */
export function leaveBlocked(to = '', kind: 'link' | 'action' = 'link'): boolean {
  for (const entry of [...guards]) if ((kind === 'action' || !entry.ownLinks) && entry.guard(to)) return true
  return false
}
