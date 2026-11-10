// ES-177: cómo se nombra a una persona en el panel profesional, a partir de la respuesta REAL de /api/therapist/pacientes.
// Quien no autorizó compartir llega sin nombre (`name: null`) y con un ordinal estable por profesional: se muestra «Persona n», nunca un identificador interno.
export type PersonRef = { name: string | null; ordinal: number }
export const personLabel = (person: PersonRef, personWord: string) => person.name ?? `${personWord} ${person.ordinal}`
export const personInitial = (person: PersonRef) => (person.name ?? String(person.ordinal)).charAt(0).toUpperCase()
