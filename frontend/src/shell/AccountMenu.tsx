// ES-359 (PR 1): menú de cuenta, UN componente para los cuatro roles (persona, profesional, administración, junta). Sustituye al antiguo menú de usuario (el nombre como botón)
// y a «Salir»: botón con etiqueta visible «Menú de usuario» y un panel (no modal) con nombre y rol, los enlaces de cuenta, «Preferencias» (idioma y tema) y «Cerrar sesión».
// Teclado: Enter/Espacio abre; Escape cierra y devuelve el foco al botón; un clic fuera o salir del panel con Tab lo cierra.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { LangSwitch, ThemeSwitch } from './Frame'
import type { NavItem } from './nav'
import { useShellCopy } from './useShellCopy'
import { useSignOut } from './useSignOut'

export type AccountMenuProps = {
  /** Nombre de la persona (se muestra dentro del panel). */
  name: string
  /** Rol en palabras (Persona, Profesional, Administración…): no solo color. */
  roleLabel: string
  /** Enlaces de cuenta del rol (p. ej. Mis datos, Tu opinión, Manifiesto ético). */
  items: NavItem[]
  /** Pantalla heredada (solo tema claro): el selector de tema queda con aria-disabled y su razón. */
  legacyTheme?: boolean
}

export function AccountMenu({ name, roleLabel, items, legacyTheme = false }: AccountMenuProps) {
  const { c } = useShellCopy(); const { leave, leaving } = useSignOut()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null); const root = useRef<HTMLDivElement>(null); const id = useId()
  const close = (focus: boolean) => { setOpen(false); if (focus) button.current?.focus() }
  useEffect(() => {
    if (!open) return
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(true) } }
  return (
    <div className="cg-usermenu" ref={root} onKeyDown={onKeyDown} onBlur={event => { if (open && !event.currentTarget.contains(event.relatedTarget as Node | null) && event.relatedTarget) setOpen(false) }}>
      <button ref={button} type="button" className="cg-usermenu__button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        <span className="cg-usermenu__label">{c.userMenu}</span><span aria-hidden="true"> ▾</span>
      </button>
      <div className="cg-usermenu__list" id={id} role="group" aria-label={c.userMenu} hidden={!open} onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false) }}>
        <p className="cg-usermenu__id"><strong className="cg-usermenu__name">{name}</strong><span className="cg-usermenu__role">{roleLabel}</span></p>
        {items.length > 0 && <ul className="cg-usermenu__links">{items.map(item => <li key={item.to}><NavLink to={item.to}>{c[item.label]}</NavLink></li>)}</ul>}
        <div className="cg-usermenu__prefs" role="group" aria-label={c.preferences}>
          <p className="cg-tag">{c.preferences}</p>
          <div className="cg-usermenu__pref"><span>{c.language}</span><LangSwitch /></div>
          <div className="cg-usermenu__pref"><span>{c.theme}</span><ThemeSwitch legacy={legacyTheme} /></div>
        </div>
        <button type="button" className="cg-usermenu__out" onClick={() => void leave()} disabled={leaving} aria-busy={leaving}>{leaving ? c.signingOut : c.signOut}</button>
      </div>
    </div>
  )
}
