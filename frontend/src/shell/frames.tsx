// ES-153: los marcos por rol. Cada uno muestra solo las rutas de su rol; la ruta activa lleva aria-current="page" (lo pone NavLink).
// ES-359 (PR5): profesional, administración y junta usan la misma estructura que persona: barra lateral con grupos en escritorio y SU cajón en ≤ 900 px.
import { useContext, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Frame, NavLinks, SideNav } from './Frame'
import { AccountMenu } from './AccountMenu'
import type { DrawerGroup } from './NavDrawer'
import { groupsFor, visibleGroups, ADMIN_GROUPS, type NavGroup } from './navGroups'
import { useCgTheme } from '../cartografia/themeState'
import { useShellCopy } from './useShellCopy'
import { PROFESSIONAL_LABEL, type ShellCopy } from './copy'
import { ADMIN_MENU, BOARD_MENU, PERSON_MENU, PERSON_NAV, PROFESSIONAL_MENU, PUBLIC_NAV, visibleFor, type NavItem } from './nav'
import type { Role } from './access'
import { PersonLayoutContext } from './personLayoutState'

const readName = (fallback: string) => { try { return localStorage.getItem('elevation_name') || fallback } catch { return fallback } }
const readRole = (fallback: Role): Role => {
  try {
    const value = localStorage.getItem('elevation_role')
    return value === 'user' || value === 'admin' || value === 'superadmin' || value === 'therapist' || value === 'board' ? value : fallback
  } catch { return fallback }
}

/** Cajón móvil de un rol: sus grupos con el título ya traducido y, al final, «Menú de usuario» con lo de cuenta (ES-359). */
const drawerGroups = (groups: NavGroup[], menu: NavItem[], c: ShellCopy, fallback: NavItem[]): DrawerGroup[] => [
  ...(groups.length ? groups.map(g => ({ title: g.title ? c[g.title] : null, items: g.items })) : [{ title: null, items: fallback }]),
  { title: c.userMenu, items: menu },
]

/** Público: marca, «Cómo funciona», «Privacidad», «Entrar» y «Crear cuenta». */
export function PublicFrame({ children, migrated = false }: { children: ReactNode; migrated?: boolean }) {
  const { c } = useShellCopy()
  return (
    <Frame
      nav={<nav className="cg-nav cg-nav--grid" aria-label={c.how}>{PUBLIC_NAV.map(item => <NavLink key={item.label} to={item.to}>{c[item.label]}</NavLink>)}<NavLink className="cg-btn" to="/login?mode=register">{c.signUp}</NavLink></nav>}
      theme={migrated ? 'system' : 'light'}
    >{children}</Frame>
  )
}

/** Persona: Mapa, Conversación, Evidencias, Diario, Siguiente paso + menú de cuenta (ES-359: Preferencias y «Cerrar sesión» dentro). */
export function PersonChrome({ children, migrated = false, footer = true }: { children: ReactNode; migrated?: boolean; footer?: boolean }) {
  const { c } = useShellCopy(); const [theme] = useCgTheme()
  // `migrated`: la pantalla ya usa Cartografía (ES-160): sin el ámbito de tokens antiguos y con el tema elegido (Auto = el del sistema).
  // ES-153 (paso 3): las pantallas heredadas siguen con lienzo claro fijo y el selector de tema queda con aria-disabled.
  const groups = groupsFor(readRole('user'))
  const navItems = visibleFor(PERSON_NAV, readRole('user')) // ES-359: sin enlaces a pantallas que el rol no puede usar
  return <Frame brandTo="/app/dashboard" nav={<NavLinks items={navItems} label={c.main} className="cg-nav cg-nav--grid3" />} preferences={null} account={<AccountMenu name={readName('Elevation')} roleLabel={c.rolePerson} items={PERSON_MENU} legacyTheme={!migrated} />} mainClassName={migrated ? '' : 'elv-theme'} theme={migrated ? theme : 'light'} sidebar={<SideNav groups={groups} label={c.main} />} sidebarWide footer={footer} mobileOrder
    drawer={{ groups: drawerGroups(groups, PERSON_MENU, c, PERSON_NAV), name: readName('Elevation'), roleLabel: c.rolePerson, legacyTheme: !migrated }}>{children}</Frame>
}

/** Persona: dentro de PersonLayout (ES-153, todo /app/* menos la sala) el marco ya está puesto y esto solo deja pasar el contenido; fuera, dibuja el marco. */
export function PersonFrame({ children, migrated = false }: { children: ReactNode; migrated?: boolean }) {
  const inLayout = useContext(PersonLayoutContext)
  return inLayout ? <>{children}</> : <PersonChrome migrated={migrated}>{children}</PersonChrome>
}

/** Profesional: grupo «Principal» (Panel, Personas en facilitación, Revisiones profesionales) en la barra lateral y, en móvil, su cajón; menú de cuenta con Mis datos y el Manifiesto. `migrated` (ES-309): tema claro/oscuro del sistema y sin elv-theme. */
export function ProfessionalFrame({ children, migrated = false }: { children: ReactNode; migrated?: boolean }) {
  const { c, lang } = useShellCopy(); const groups = groupsFor('therapist'); const label = PROFESSIONAL_LABEL[lang]
  return (
    <Frame
      brand={<>Elevation<i>.</i> <span className="cg-brand__role">{label}</span></>} brandLabel={`${c.brandLabel}. ${label}`} brandTo="/therapist/dashboard"
      preferences={null} account={<AccountMenu name={readName(label)} roleLabel={label} items={PROFESSIONAL_MENU} legacyTheme={!migrated} />} mainClassName={migrated ? '' : 'elv-theme'} theme={migrated ? 'system' : 'light'}
      sidebar={<SideNav groups={groups} label={c.main} />} sidebarWide
      drawer={{ groups: drawerGroups(groups, PROFESSIONAL_MENU, c, []), name: readName(label), roleLabel: label, legacyTheme: !migrated }}
    >{children}</Frame>
  )
}

/** Administración y superadministración: grupos Resumen, Personas, Contenido y Junta en la barra lateral y, en móvil, su cajón (QA-400-03: ya no el de persona). */
export function AdminFrame({ children, pilotPreview = false, migrated = false }: { children: ReactNode; pilotPreview?: boolean; migrated?: boolean }) {
  const { c } = useShellCopy(); const role = readRole('admin'); const groups = visibleGroups(ADMIN_GROUPS, role)
  const roleLabel = role === 'superadmin' ? c.superRole : c.adminRole
  return (
    <Frame
      brandTo="/admin/dashboard"
      preferences={null} account={<AccountMenu name={readName(c.adminRole)} roleLabel={roleLabel} items={ADMIN_MENU} legacyTheme={!migrated} />}
      sidebar={<SideNav groups={groups} label={c.admin} />} sidebarWide
      drawer={{ groups: drawerGroups(groups, ADMIN_MENU, c, []), name: readName(c.adminRole), roleLabel, legacyTheme: !migrated }}
      // `migrated` (ES-310): la pantalla ya usa Cartografía: sin el ámbito de tokens antiguos y con tema claro/oscuro del sistema. `pilotPreview` se conserva tal cual (ES-183).
      mainClassName={`${migrated ? '' : 'elv-theme'}${pilotPreview ? ' pilot-admin-layout' : ''}`.trim()} theme={migrated ? 'system' : 'light'}
    >{children}</Frame>
  )
}

/** Junta: solo el manifiesto (página pública /manifiesto, ES-207); misma estructura (barra lateral y cajón) con un solo enlace. `migrated`: «Mis datos» ya usa Cartografía. */
export function BoardFrame({ children, migrated = false }: { children: ReactNode; migrated?: boolean }) {
  const { c } = useShellCopy(); const groups = groupsFor('board')
  return (
    <Frame
      brandTo="/manifiesto" preferences={null} account={<AccountMenu name={readName(c.boardRole)} roleLabel={c.boardRole} items={BOARD_MENU} legacyTheme={!migrated} />}
      sidebar={<SideNav groups={groups} label={c.boardRole} />} sidebarWide
      drawer={{ groups: drawerGroups(groups, BOARD_MENU, c, []), name: readName(c.boardRole), roleLabel: c.boardRole, legacyTheme: !migrated }}
      mainClassName={migrated ? '' : 'elv-theme'} theme={migrated ? 'system' : 'light'}
    >{children}</Frame>
  )
}

/** ES-359 (PR5): «Mis datos» y «Revisiones profesionales» valen para cualquier sesión válida y viven bajo /app (PersonLayout); aquí se dibujan en el marco del ROL de la sesión
 *  (profesional, administración o junta) en vez del de persona. Persona y superadministración (zona de persona) siguen con el marco de persona. El rol del navegador solo elige el marco: el servidor decide el acceso. */
export function MemberChrome({ children, migrated = false, footer = true }: { children: ReactNode; migrated?: boolean; footer?: boolean }) {
  const role = readRole('user')
  if (role === 'therapist') return <ProfessionalFrame migrated={migrated}>{children}</ProfessionalFrame>
  if (role === 'admin') return <AdminFrame migrated={migrated}>{children}</AdminFrame>
  if (role === 'board') return <BoardFrame migrated={migrated}>{children}</BoardFrame>
  return <PersonChrome migrated={migrated} footer={footer}>{children}</PersonChrome>
}

/** Sala de sesión (persona y profesional): sin encabezado ni pie, pantalla completa. */
export function BareFrame({ children }: { children: ReactNode }) {
  return <Frame header={false} footer={false} mainClassName="elv-theme cg-main--bare">{children}</Frame>
}
