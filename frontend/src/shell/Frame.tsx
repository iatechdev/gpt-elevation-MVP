// ES-153: piezas comunes de los marcos de página: «saltar al contenido», un solo <main> que recibe el foco al cambiar de ruta,
// selector de idioma, piezas de preferencias (idioma y tema; el menú de cuenta vive en AccountMenu.tsx) y pie con el aviso «no es terapia ni diagnóstico».
import { useEffect, useId, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { CartografiaRoot } from '../cartografia/theme'
import { useCgTheme, type CgTheme } from '../cartografia/themeState'
import type { NavItem } from './nav'
import { useShellCopy } from './useShellCopy'
import { useNarrowHeader } from './narrowHeader'
import { leaveBlocked } from './leaveGuard'
import './shell.css'

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

/** ES-153 (paso 3): tema Auto / Claro / Oscuro. Mismo patrón que el idioma (botones con aria-pressed). En una pantalla heredada (solo tema claro) los botones quedan
 *  con aria-disabled —no disabled— para que sigan en el orden de Tab y el lector de pantalla lea la razón (aria-describedby); el clic no hace nada. */
export function ThemeSwitch({ legacy = false }: { legacy?: boolean }) {
  const { c } = useShellCopy(); const [theme, setTheme] = useCgTheme(); const note = useId()
  const options: { id: CgTheme; label: string }[] = [{ id: 'system', label: c.themeSystem }, { id: 'light', label: c.themeLight }, { id: 'dark', label: c.themeDark }]
  return (
    <>
      <div className="cg-seg" role="group" aria-label={c.theme} aria-describedby={legacy ? note : undefined}>
        {options.map(option => (
          <button key={option.id} type="button" className="cg-seg__btn" aria-pressed={theme === option.id} aria-disabled={legacy || undefined} onClick={() => { if (!legacy) setTheme(option.id) }}>{option.label}</button>
        ))}
      </div>
      {legacy && <span id={note} className="cg-sr">{c.themeLegacy}</span>}
    </>
  )
}

/** ES-153 (paso 3): idioma y tema juntos en el marco de persona. */
export function PreferencesBar({ legacy = false }: { legacy?: boolean }) {
  const { c } = useShellCopy()
  return <div className="cg-prefs" role="group" aria-label={c.preferences}><LangSwitch /><ThemeSwitch legacy={legacy} /></div>
}

export function NavLinks({ items, label, className }: { items: NavItem[]; label: string; className?: string }) {
  const { c } = useShellCopy()
  return (
    <nav className={className ?? 'cg-nav'} aria-label={label}>
      {items.map(item => <NavLink key={item.to} to={item.to}>{c[item.label]}</NavLink>)}
    </nav>
  )
}

export function SiteFooter() {
  const { c } = useShellCopy()
  return <footer className="cg-footer"><span>{c.foot1}</span><span>{c.foot2}</span></footer>
}

/** ES-153: un clic en un enlace del encabezado (marca, navegación, menú de usuario) pregunta antes si hay un borrador sin guardar; si bloquea, la persona se queda con su texto. */
function guardLeave(event: ReactMouseEvent<HTMLElement>) {
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null
  const href = link?.getAttribute('href') ?? ''
  if (!link || href.startsWith('#') || event.defaultPrevented) return
  if (leaveBlocked(href)) { event.preventDefault(); event.stopPropagation() }
}

export type FrameProps = {
  brand?: ReactNode; /** Nombre accesible del enlace de la marca: debe contener el texto visible (WCAG 2.5.3). */ brandLabel?: string; brandTo?: string; nav?: ReactNode; account?: ReactNode; /** Idioma por defecto; el marco de persona pone idioma + tema (PreferencesBar). */ preferences?: ReactNode; sidebar?: ReactNode; footer?: boolean; header?: boolean; children: ReactNode
  /** Clase extra para el área principal; los contenidos antiguos conservan su ámbito de tokens (elv-theme) hasta migrar. */
  mainClassName?: string
  /** ES-160: tema del marco. Por defecto «light» (los contenidos antiguos son claros); una pantalla ya migrada a Cartografía pide «system» para seguir el modo claro/oscuro del sistema. */
  theme?: CgTheme
  /** ES-321: en la disposición móvil (≤ 900 px) el DOM sigue el orden visual (marca → menú → preferencias → navegación) para que Tab no suba; en escritorio, el de siempre. */
  mobileOrder?: boolean
}

/** Marco genérico. El tema se fija en claro mientras las pantallas de contenido no migren a los tokens `--cg-*`. */
export function Frame({ brand, brandLabel, brandTo = '/', nav, account, preferences, sidebar, footer = true, header = true, mainClassName = '', theme = 'light', mobileOrder = false, children }: FrameProps) {
  const { c } = useShellCopy(); const { pathname } = useLocation(); const narrow = useNarrowHeader() && mobileOrder
  const main = useRef<HTMLElement>(null); const first = useRef(true)
  // ES-359: `preferences={null}` = sin preferencias en el encabezado (viven dentro del menú de cuenta); sin la propiedad, el idioma suelto (pantallas públicas).
  const prefs = preferences === undefined ? <LangSwitch /> : preferences
  // Al cambiar de ruta el foco pasa al <main> (no en la primera carga, para no robar el foco de quien llega por teclado).
  useEffect(() => {
    if (first.current) { first.current = false; return }
    main.current?.focus({ preventScroll: false })
  }, [pathname])
  return (
    <CartografiaRoot theme={theme} className="cg-frame">
      <a className="cg-skip" href="#main" onClick={event => { event.preventDefault(); main.current?.focus(); main.current?.scrollIntoView() }}>{c.skip}</a>
      {header && (
        <header className="cg-header" onClickCapture={guardLeave}>
          <Link className="cg-brand" to={brandTo} aria-label={brandLabel ?? c.brandLabel}>{brand ?? <>Elevation<i>.</i></>}</Link>
          {narrow ? <div className="cg-header__end">{account}{prefs}</div> : <>{nav}<div className="cg-header__end">{prefs}{account}</div></>}
          {narrow && nav}
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
