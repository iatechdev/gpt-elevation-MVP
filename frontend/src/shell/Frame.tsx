// ES-153: piezas comunes de los marcos de página: «saltar al contenido», un solo <main> que recibe el foco al cambiar de ruta,
// selector de idioma, menú de usuario (teclado, Escape y retorno del foco) y pie con el aviso «no es terapia ni diagnóstico».
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { signOut } from '../access/signOut'
import { CartografiaRoot } from '../cartografia/theme'
import type { CgTheme } from '../cartografia/themeState'
import type { NavItem } from './nav'
import { useShellCopy } from './useShellCopy'
import './shell.css'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

export function LangSwitch() {
  const { lang, setLang } = useLanguage(); const { c } = useShellCopy()
  return (
    <div className="cg-lang" role="group" aria-label={c.language}>
      {(['es', 'en'] as const).map(code => (
        <button key={code} type="button" lang={code} className="cg-lang__btn" aria-pressed={lang === code} onClick={() => setLang(code)}>{code.toUpperCase()}</button>
      ))}
    </div>
  )
}

export function NavLinks({ items, label, className }: { items: NavItem[]; label: string; className?: string }) {
  const { c } = useShellCopy()
  return (
    <nav className={className ?? 'cg-nav'} aria-label={label}>
      {items.map(item => <NavLink key={item.to} to={item.to}>{c[item.label]}</NavLink>)}
    </nav>
  )
}

/** Menú de usuario como botón + lista de enlaces: Enter/Espacio abre, Escape cierra y devuelve el foco al botón, un clic fuera también cierra. */
export function UserMenu({ name, items, withSignOut = true }: { name: string; items: NavItem[]; withSignOut?: boolean }) {
  const { c } = useShellCopy(); const navigate = useNavigate()
  const [open, setOpen] = useState(false); const [leaving, setLeaving] = useState(false)
  const button = useRef<HTMLButtonElement>(null); const root = useRef<HTMLDivElement>(null); const id = useId()
  const close = (focus: boolean) => { setOpen(false); if (focus) button.current?.focus() }
  useEffect(() => {
    if (!open) return
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(true) } }
  const leave = async () => {
    if (leaving) return
    setLeaving(true)
    await signOut(BACKEND)
    navigate('/', { replace: true })
  }
  return (
    <div className="cg-usermenu" ref={root} onKeyDown={onKeyDown}>
      <button ref={button} type="button" className="cg-usermenu__button" aria-expanded={open} aria-controls={id} aria-label={`${c.userMenu}: ${name}`} onClick={() => setOpen(value => !value)}>
        <span className="cg-name cg-usermenu__who">{name}</span><span aria-hidden="true"> ▾</span>
      </button>
      <ul className="cg-usermenu__list" id={id} hidden={!open} onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false) }}>
        {items.map(item => <li key={item.to}><NavLink to={item.to}>{c[item.label]}</NavLink></li>)}
        {withSignOut && <li><button type="button" className="cg-usermenu__out" onClick={() => void leave()} disabled={leaving} aria-busy={leaving}>{leaving ? c.signingOut : c.signOut}</button></li>}
      </ul>
    </div>
  )
}

/** Salir sin menú (administración y junta): botón visible con texto. */
export function SignOutButton() {
  const { c } = useShellCopy(); const navigate = useNavigate(); const [leaving, setLeaving] = useState(false)
  const leave = async () => {
    if (leaving) return
    setLeaving(true)
    await signOut(BACKEND)
    navigate('/', { replace: true })
  }
  return <button type="button" className="cg-btn cg-btn--ghost cg-signout" onClick={() => void leave()} disabled={leaving} aria-busy={leaving}>{leaving ? c.signingOut : c.signOut}</button>
}

export function SiteFooter() {
  const { c } = useShellCopy()
  return <footer className="cg-footer"><span>{c.foot1}</span><span>{c.foot2}</span></footer>
}

export type FrameProps = {
  brand?: ReactNode; /** Nombre accesible del enlace de la marca: debe contener el texto visible (WCAG 2.5.3). */ brandLabel?: string; brandTo?: string; nav?: ReactNode; account?: ReactNode; sidebar?: ReactNode; footer?: boolean; header?: boolean; children: ReactNode
  /** Clase extra para el área principal; los contenidos antiguos conservan su ámbito de tokens (elv-theme) hasta migrar. */
  mainClassName?: string
  /** ES-160: tema del marco. Por defecto «light» (los contenidos antiguos son claros); una pantalla ya migrada a Cartografía pide «system» para seguir el modo claro/oscuro del sistema. */
  theme?: CgTheme
}

/** Marco genérico. El tema se fija en claro mientras las pantallas de contenido no migren a los tokens `--cg-*`. */
export function Frame({ brand, brandLabel, brandTo = '/', nav, account, sidebar, footer = true, header = true, mainClassName = '', theme = 'light', children }: FrameProps) {
  const { c } = useShellCopy(); const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null); const first = useRef(true)
  // Al cambiar de ruta el foco pasa al <main> (no en la primera carga, para no robar el foco de quien llega por teclado).
  useEffect(() => {
    if (first.current) { first.current = false; return }
    main.current?.focus({ preventScroll: false })
  }, [pathname])
  return (
    <CartografiaRoot theme={theme} className="cg-frame">
      <a className="cg-skip" href="#main" onClick={event => { event.preventDefault(); main.current?.focus(); main.current?.scrollIntoView() }}>{c.skip}</a>
      {header && (
        <header className="cg-header">
          <Link className="cg-brand" to={brandTo} aria-label={brandLabel ?? c.brandLabel}>{brand ?? <>Elevation<i>.</i></>}</Link>
          {nav}
          <div className="cg-header__end"><LangSwitch />{account}</div>
        </header>
      )}
      <div className={sidebar ? 'cg-body cg-body--side' : 'cg-body'}>
        {sidebar}
        <main id="main" ref={main} tabIndex={-1} className={`cg-main ${mainClassName}`.trim()}>{children}</main>
      </div>
      {footer && <SiteFooter />}
    </CartografiaRoot>
  )
}
