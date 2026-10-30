import type { LocalizedText, Skill } from './model'

/** Territorios laborales del prototipo «Mapa de Competencias» (Figma). Los roles se muestran tal cual en ambos idiomas. */
export type Territory = { id: string; labels: Required<LocalizedText>; roles: string }
export const territories: readonly Territory[] = [
  { id: 'dir', labels: { es: 'Dirección & Liderazgo', en: 'Leadership & Management' }, roles: 'Director General · COO · Head of' },
  { id: 'con', labels: { es: 'Consultoría Estratégica', en: 'Strategy Consulting' }, roles: 'Strategy Consultant · Change Manager' },
  { id: 'com', labels: { es: 'Comunicación Ejecutiva', en: 'Executive Communication' }, roles: 'Chief of Staff · PR Director · Portavoz' },
  { id: 'ing', labels: { es: 'Ingeniería & Sistemas', en: 'Engineering & Systems' }, roles: 'Solutions Architect · Tech Lead · CTO' },
  { id: 'inn', labels: { es: 'Innovación & Producto', en: 'Innovation & Product' }, roles: 'Product Manager · CPO · Innovation Lead' },
]

export type TerritoryGroup = { territory: Territory; skills: Skill[] }

/** Reparte las habilidades por territorio según `skill.territories` (lo define el catálogo del backoffice; una habilidad puede estar en varios).
 *  Ids desconocidos se ignoran; sin ninguno válido → «sin territorio asignado». Conserva el orden del catálogo. */
export function resolveTerritories(skills: readonly Skill[], all: readonly Territory[] = territories) {
  const known = new Set(all.map(t => t.id))
  const links = (skill: Skill) => [...new Set(skill.territories ?? [])].filter(id => known.has(id))
  const groups: TerritoryGroup[] = all.map(territory => ({ territory, skills: skills.filter(skill => links(skill).includes(territory.id)) }))
  return { groups, unassigned: skills.filter(skill => links(skill).length === 0), links }
}
