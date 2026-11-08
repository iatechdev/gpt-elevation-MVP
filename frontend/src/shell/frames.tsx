// ES-153: los marcos por rol. Cada uno muestra solo las rutas de su rol; la ruta activa lleva aria-current="page" (lo pone NavLink).
import { type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Frame, NavLinks, SignOutButton, UserMenu } from './Frame'
import { useShellCopy } from './useShellCopy'
import { PROFESSIONAL_LABEL } from './copy'
import { ADMIN_BOARD_GROUP, ADMIN_NAV, BOARD_NAV, PERSON_MENU, PERSON_NAV, PROFESSIONAL_MENU, PROFESSIONAL_NAV, PUBLIC_NAV, visibleFor } from './nav'
import type { Role } from './access'

const readName = (fallback: string) => { try { return localStorage.getItem('elevation_name') || fallback } catch { return fallback } }
const readRole = (fallback: Role): Role => {
  try {
    const value = localStorage.getItem('elevation_role')
    return value === 'user' || value === 'admin' || value === 'superadmin' || value === 'therapist' || value === 'board' ? value : fallback
  } catch { return fallback }
}

/** Público: marca, «Cómo funciona», «Privacidad», «Entrar» y «Crear cuenta». */
export function PublicFrame({ children }: { children: ReactNode }) {
  const { c } = useShellCopy()
  return (
    <Frame
      nav={<nav className="cg-nav" aria-label={c.how}>{PUBLIC_NAV.map(item => <NavLink key={item.label} to={item.to}>{c[item.label]}</NavLink>)}<NavLink className="cg-btn" to="/login?mode=register">{c.signUp}</NavLink></nav>}
    >{children}</Frame>
  )
}

/** Persona: Mapa, Conversación, Evidencias, Diario, Siguiente paso + menú de usuario. */
export function PersonFrame({ children }: { children: ReactNode }) {
  const { c } = useShellCopy()
  return <Frame brandTo="/app/dashboard" nav={<NavLinks items={PERSON_NAV} label={c.main} />} account={<UserMenu name={readName('Elevation')} items={PERSON_MENU} />} mainClassName="elv-theme">{children}</Frame>
}

/** Profesional: Panel y Personas en facilitación + menú (Revisiones profesionales, Salir); marca «Profesional». */
export function ProfessionalFrame({ children }: { children: ReactNode }) {
  const { c, lang } = useShellCopy()
  return (
    <Frame
      brand={<>Elevation<i>.</i> <span className="cg-brand__role">{PROFESSIONAL_LABEL[lang]}</span></>} brandTo="/therapist/dashboard"
      nav={<NavLinks items={PROFESSIONAL_NAV} label={c.main} />} account={<UserMenu name={readName(PROFESSIONAL_LABEL[lang])} items={PROFESSIONAL_MENU} />} mainClassName="elv-theme"
    >{children}</Frame>
  )
}

/** Administración: barra lateral (en móvil, una fila que se ajusta) y grupo «Junta» solo para superadministración. */
export function AdminFrame({ children, pilotPreview = false }: { children: ReactNode; pilotPreview?: boolean }) {
  const { c } = useShellCopy(); const role = readRole('admin')
  const group = visibleFor(ADMIN_BOARD_GROUP, role)
  return (
    <Frame
      brandTo="/admin/dashboard"
      account={<><span className="cg-role">{role === 'superadmin' ? c.superRole : c.adminRole}</span><span className="cg-name cg-who">{readName(c.adminRole)}</span><SignOutButton /></>}
      sidebar={(
        <div className="cg-side">
          <NavLinks items={visibleFor(ADMIN_NAV, role)} label={c.admin} className="cg-sidenav" />
          {group.length > 0 && <>
            <p className="cg-tag cg-side__group">{c.boardGroup}</p>
            <NavLinks items={group} label={c.boardGroup} className="cg-sidenav" />
          </>}
        </div>
      )}
      mainClassName={`elv-theme${pilotPreview ? ' pilot-admin-layout' : ''}`}
    >{children}</Frame>
  )
}

/** Junta: solo el manifiesto, sin barra lateral. */
export function BoardFrame({ children }: { children: ReactNode }) {
  const { c } = useShellCopy()
  return (
    <Frame
      brandTo="/board/manifest" nav={<NavLinks items={BOARD_NAV} label={c.boardRole} />}
      account={<><span className="cg-role">{c.boardRole}</span><span className="cg-name cg-who">{readName(c.boardRole)}</span><SignOutButton /></>} mainClassName="elv-theme"
    >{children}</Frame>
  )
}

/** Sala de sesión (persona y profesional): sin encabezado ni pie, pantalla completa. */
export function BareFrame({ children }: { children: ReactNode }) {
  return <Frame header={false} footer={false} mainClassName="elv-theme cg-main--bare">{children}</Frame>
}
