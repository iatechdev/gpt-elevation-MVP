// ES-153: qué enlaces lleva cada marco. Cada ruta existe hoy en App.tsx; `label` es una clave de ShellCopy.
import type { ShellCopy } from './copy'
import type { Role } from './access'

export type NavKey = Exclude<keyof ShellCopy, 'skip' | 'language' | 'brandLabel' | 'main' | 'userMenu' | 'admin'>
export type NavItem = { to: string; label: NavKey; roles?: readonly Role[] }

export const PUBLIC_NAV: NavItem[] = [
  { to: '/#como-funciona', label: 'how' },
  { to: '/#privacidad', label: 'privacy' },
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
  { to: '/pricing', label: 'plan' },
  { to: '/app/context/resumes', label: 'resumes' },
  { to: '/app/professional-reviews', label: 'reviews' },
  { to: '/app/data', label: 'data' },
  { to: '/app/feedback', label: 'feedback' },
]

export const PROFESSIONAL_NAV: NavItem[] = [
  { to: '/therapist/dashboard', label: 'proPanel' },
  { to: '/facilitation', label: 'proFacilitation' },
]
export const PROFESSIONAL_MENU: NavItem[] = [{ to: '/app/professional-reviews', label: 'reviews' }]

export const ADMIN_NAV: NavItem[] = [
  { to: '/admin/dashboard', label: 'adPanel' },
  { to: '/admin/prompts', label: 'adGuides' },
  { to: '/admin/content', label: 'adContent' },
  { to: '/admin/users', label: 'adUsers', roles: ['superadmin'] },
  { to: '/admin/metrics', label: 'adMetrics' },
  { to: '/admin/route-catalog', label: 'adRoutes' },
  { to: '/admin/skill-catalog', label: 'adSkills' },
  { to: '/admin/pilot-metrics', label: 'adPilot' },
]
export const ADMIN_BOARD_GROUP: NavItem[] = [{ to: '/admin/manifest', label: 'adManifest', roles: ['superadmin'] }]
export const BOARD_NAV: NavItem[] = [{ to: '/board/manifest', label: 'adManifest' }]

export const visibleFor = (items: NavItem[], role: Role) => items.filter(item => !item.roles || item.roles.includes(role))
