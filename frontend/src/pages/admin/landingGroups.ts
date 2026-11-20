// ES-350: agrupar y filtrar los textos públicos (lógica pura, con pruebas). El grupo sale de la etiqueta que ya existe (landingFieldLabel: «Navegación · Saltar al contenido»):
// lo anterior a « · » es el grupo; los tres textos de portada de nombre propio (sin « · ») no pertenecen a ningún grupo y van antes, siempre visibles según la búsqueda.
export type Field = { key: string; label: string }
export type Group = { id: string; name: string; keys: string[] }

const SEPARATOR = ' · '
/** Normaliza para buscar: minúsculas, sin acentos y sin espacios sobrantes (la búsqueda no distingue «Navegación» de «navegacion»). */
export const normalize = (text: string): string => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

/** Separa la lista en los textos sueltos (sin grupo) y los grupos, conservando el orden de aparición. */
export function groupFields(fields: Field[], labelOf: (field: Field) => string = field => field.label): { loose: string[]; groups: Group[] } {
  const loose: string[] = []; const byName = new Map<string, Group>()
  for (const field of fields) {
    const label = labelOf(field); const at = label.indexOf(SEPARATOR)
    if (at <= 0) { loose.push(field.key); continue }
    const name = label.slice(0, at)
    let group = byName.get(name)
    if (!group) { group = { id: `landing-group-${byName.size}`, name, keys: [] }; byName.set(name, group) }
    group.keys.push(field.key)
  }
  return { loose, groups: [...byName.values()] }
}

/** Claves cuyo nombre contiene la búsqueda (vacía = todas). */
export function matchingKeys(fields: Field[], query: string, labelOf: (field: Field) => string = field => field.label): Set<string> {
  const needle = normalize(query)
  return new Set(fields.filter(field => needle === '' || normalize(labelOf(field)).includes(needle)).map(field => field.key))
}

/** Texto del contador con el plural de cada idioma: 0 se dice «Sin resultados». */
export function countPhrase(n: number, lang: string, one: string, other: string): string {
  return new Intl.PluralRules(lang).select(n) === 'one' ? one : other.replace('{n}', String(n))
}
