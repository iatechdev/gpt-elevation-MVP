// ES-153: qué enlaces lleva cada marco. Cada ruta existe hoy en App.tsx; `label` es una clave de ShellCopy.
import type { ShellCopy } from './copy'
import type { Role } from './access'

export type NavKey = Exclude<keyof ShellCopy, 'skip' | 'language' | 'brandLabel' | 'main' | 'userMenu' | 'admin' | 'preferences' | 'theme' | 'themeSystem' | 'themeLight' | 'themeDark' | 'themeLegacy' | 'rolePerson' | 'menu' | 'close'>
export type NavItem = { to: string; label: NavKey; roles?: readonly Role[] }

export const PUBLIC_NAV: NavItem[] = [
  { to: '/#como-funciona', label: 'how' },
  { to: '/#privacidad', label: 'privacy' },
  { to: '/manifiesto', label: 'adManifest' }, // ES-207 — manifiesto ético público
  { to: '/login', label: 'signIn' },
]

export const PERSON_NAV: NavItem[] = [
  { to: '/app/skill-map', label: 'map' },
  { to: '/app/chat', label: 'chat' },
  { to: '/app/evidence', label: 'evidence' },
  { to: '/app/diary', label: 'diary' },
  { to: '/app/next-step', label: 'next' },
]

export const PERSON_MENU: NavItem[] = [
  { to: '/app/checkin', label: 'today' },
  { to: '/app/bridge', label: 'bridge' },
  { to: '/app/my-therapist', label: 'myProfessional' },
  { to: '/app/space/tools', label: 'tools' },
  { to: '/app/progress', label: 'progress' },
  { to: '/app/plan', label: 'plan' }, // ES-174: «Mi plan» lleva a la pantalla propia (antes a /pricing, que sigue público)
  { to: '/app/context/resumes', label: 'resumes' },
  { to: '/app/professional-reviews', label: 'reviews' },
  { to: '/app/data', label: 'data' },
  { to: '/app/feedback', label: 'feedback' },
  { to: '/manifiesto', label: 'adManifest' }, // ES-207
]

export const PROFESSIONAL_NAV: NavItem[] = [
  { to: '/therapist/dashboard', label: 'proPanel' },
  { to: '/facilitation', label: 'proFacilitation' },
]
/** ES-359: «Mis datos» (descargar mis datos y pedir eliminar la cuenta) está en el menú de cuenta de los CUATRO roles (decisión de Infra: ≤ 2 acciones para todos; la ruta /app/data se dibuja en el marco de persona hasta PR5). */
export const ACCOUNT_DATA: NavItem = { to: '/app/data', label: 'data' }
export const PROFESSIONAL_MENU: NavItem[] = [{ to: '/app/professional-reviews', label: 'reviews' }, ACCOUNT_DATA, { to: '/manifiesto', label: 'adManifest' }]
export const ADMIN_MENU: NavItem[] = [ACCOUNT_DATA]
export const BOARD_MENU: NavItem[] = [ACCOUNT_DATA]

export const ADMIN_NAV: NavItem[] = [
  { to: '/admin/dashboard', label: 'adPanel' },
  { to: '/admin/prompts', label: 'adGuides' },
  { to: '/admin/content', label: 'adContent' },
  { to: '/admin/users', label: 'adUsers' },
  { to: '/admin/metrics', label: 'adMetrics' },
  { to: '/admin/route-catalog', label: 'adRoutes' },
  { to: '/admin/skill-catalog', label: 'adSkills' },
  { to: '/admin/pilot-metrics', label: 'adPilot' },
]
// ES-207: la edición del manifiesto es de administración y superadministración; la junta ética lo lee en la página pública.
export const ADMIN_BOARD_GROUP: NavItem[] = [{ to: '/admin/manifest', label: 'adManifest' }]
export const BOARD_NAV: NavItem[] = [{ to: '/manifiesto', label: 'adManifest' }]

export const visibleFor = (items: NavItem[], role: Role) => items.filter(item => !item.roles || item.roles.includes(role))

/** ES-359 (PR3): un grupo del cajón móvil. `title` ya viene en el idioma activo (sin título = grupo suelto, se anuncia con el nombre «Principal»). */
export type NavGroup = { title?: string; items: NavItem[] }
