// ES-359 (PR3): cajón de navegación móvil (≤ 900 px), reutilizable por el chat (PR4: su grupo «Conversación» entra por `extra`).
// <dialog> modal nativo: foco atrapado, el fondo queda inerte y Esc cierra; al cerrar el foco vuelve al botón que lo abrió (`opener`); un clic en el velo cierra; el fondo no se desplaza.
// Contenido: cabecera fija (título «Menú», nombre y rol, «Cerrar»), `extra`, grupos del rol, Preferencias (idioma y tema) y pie fijo «Cerrar sesión». Sin textos nuevos.
import { useEffect, useId, useRef, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from 'react'
import { NavLink } from 'react-router-dom'
import { LangSwitch, ThemeSwitch } from './Frame'
import { leaveBlocked } from './leaveGuard'
import type { NavItem } from './nav'
import { useShellCopy } from './useShellCopy'
import { useSignOut } from './useSignOut'

/** Un grupo del cajón: `title` ya viene traducido por quien llama (sin título = grupo suelto, se anuncia como «Principal»). */
export type DrawerGroup = { title: string | null; items: NavItem[] }

export type NavDrawerProps = {
  open: boolean; onClose: () => void
  /** Botón que lo abrió: recibe el foco al cerrar. */
  opener: RefObject<HTMLElement | null>
  groups: DrawerGroup[]
  /** Contenido propio de la pantalla (p. ej. el grupo «Conversación» del chat), arriba de los grupos del rol. */
  extra?: ReactNode | ((close: () => void) => ReactNode)
  name: string; roleLabel: string
  /** Pantalla heredada (solo tema claro): el selector de tema queda con aria-disabled. */
  legacyTheme?: boolean
}

const LOCK = 'cg-scroll-lock'

export function NavDrawer({ open, onClose, opener, groups, extra, name, roleLabel, legacyTheme = false }: NavDrawerProps) {
  const { c } = useShellCopy(); const { leave, leaving } = useSignOut()
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId(); const prefsId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) { dialog.showModal(); document.documentElement.classList.add(LOCK) }
    if (!open && dialog.open) { dialog.close(); document.documentElement.classList.remove(LOCK); opener.current?.focus() }
    return () => { document.documentElement.classList.remove(LOCK) }
  }, [open, opener])
  // Velo: según el navegador, un clic en el fondo oscuro llega con el propio <dialog> o con <html> como destino; con el cajón abierto nada más es clicable fuera de él.
  useEffect(() => {
    if (!open) return
    const veil = (event: MouseEvent) => { if (event.target === document.documentElement || event.target === ref.current) onClose() }
    document.addEventListener('click', veil)
    return () => document.removeEventListener('click', veil)
  }, [open, onClose])
  // Un clic en un enlace pregunta antes si hay un borrador sin guardar (igual que el encabezado) y, si navega, cierra el cajón.
  const onClick = (event: ReactMouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) { onClose(); return } // velo
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!link) return
    const href = link.getAttribute('href') ?? ''
    if (!href.startsWith('#') && leaveBlocked(href)) { event.preventDefault(); return }
    onClose()
  }
  return (
    <dialog ref={ref} className="cg-drawer" aria-labelledby={titleId} onClick={onClick} onCancel={event => { event.preventDefault(); onClose() }}>
      {open && <div className="cg-drawer__panel">
        <div className="cg-drawer__head">
          <div><h2 className="cg-drawer__title" id={titleId}>{c.menu}</h2><p className="cg-drawer__who"><strong>{name}</strong> · {roleLabel}</p></div>
          <button type="button" className="cg-btn cg-btn--ghost" onClick={onClose}>{c.close}</button>
        </div>
        <div className="cg-drawer__body">
          {typeof extra === 'function' ? extra(onClose) : extra}
          {groups.map((group, index) => (
            <section key={group.title ?? `g${index}`}>
              {group.title && <h3 className="cg-drawer__h" id={`${titleId}-g${index}`}>{group.title}</h3>}
              <nav className="cg-drawer__list" {...(group.title ? { 'aria-labelledby': `${titleId}-g${index}` } : { 'aria-label': c.main })}>
                {group.items.map(item => <NavLink key={item.to} to={item.to}>{c[item.label]}</NavLink>)}
              </nav>
            </section>
          ))}
          <h3 className="cg-drawer__h" id={prefsId}>{c.preferences}</h3>
          <div className="cg-drawer__prefs" role="group" aria-labelledby={prefsId}>
            <div className="cg-usermenu__pref"><span>{c.language}</span><LangSwitch /></div>
            <div className="cg-usermenu__pref"><span>{c.theme}</span><ThemeSwitch legacy={legacyTheme} /></div>
          </div>
        </div>
        <div className="cg-drawer__foot"><button type="button" className="cg-btn cg-btn--danger" onClick={() => void leave()} disabled={leaving} aria-busy={leaving}>{leaving ? c.signingOut : c.signOut}</button></div>
      </div>}
    </dialog>
  )
}
