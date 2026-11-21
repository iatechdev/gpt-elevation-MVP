// ES-359 (PR2): modelo de navegación por GRUPOS y por rol (diseño aprobado en ES-359, comentario 12752). Lo reutilizan la barra lateral de escritorio (SideNav),
// el cajón móvil (PR3) y los marcos de profesional y administración (PR5). Cada ruta existe en App.tsx; `label` es una clave de ShellCopy. Un grupo sin enlaces visibles para el rol no se dibuja.
import type { GroupKey, NavItem } from './nav.ts'
import { visibleFor } from './nav.ts'
import type { Role } from './access.ts'

export type NavGroup = { title: GroupKey | null; items: NavItem[] }

/** Persona: «Mi panel» sin título; luego cuatro grupos. «Mi progreso» aparece solo aquí (en el chat va dentro del grupo «Conversación» de esa ruta, PR4). */
export const PERSON_GROUPS: NavGroup[] = [
  { title: null, items: [{ to: '/app/dashboard', label: 'panel' }] },
  { title: 'grpSupport', items: [
    { to: '/app/checkin', label: 'today' }, { to: '/app/chat', label: 'chat' }, { to: '/app/diary', label: 'diary' },
    { to: '/app/bridge', label: 'bridge' }, { to: '/app/space/tools', label: 'tools' }, { to: '/app/exercises', label: 'exercises' }, // «Ejercicios opcionales»: antes sin enlace entrante
  ] },
  { title: 'grpCareer', items: [
    { to: '/app/skill-map', label: 'map' }, { to: '/app/evidence', label: 'evidence' }, { to: '/app/next-step', label: 'next' },
    { to: '/app/compass', label: 'compass' }, { to: '/app/route-catalog', label: 'routeCatalog' }, { to: '/app/context/resumes', label: 'resumes' }, // Brújula y Catálogo de rutas: antes sin enlace entrante
  ] },
  { title: 'grpFollow', items: [{ to: '/app/progress', label: 'progress' }, { to: '/app/plan', label: 'plan' }] },
  { title: 'grpPro', items: [{ to: '/app/my-therapist', label: 'myProfessional' }, { to: '/app/professional-reviews', label: 'reviews' }] },
]

/** Grupos que ve un rol (persona y superadministración entran a /app; el resto se añade en PR5). */
export const groupsFor = (role: Role): NavGroup[] => {
  const groups = role === 'user' || role === 'superadmin' ? PERSON_GROUPS : []
  return groups.map(group => ({ ...group, items: visibleFor(group.items, role) })).filter(group => group.items.length > 0)
}
