import { Link } from 'react-router-dom'
import { useRef, useState } from 'react'
import type { Lang } from '../../i18n/context'

// ES-68/70 activate only the sections that now exist; other phase 2 anchors stay hidden.
export function LandingHeader({ text, lang, setLang, homeSections = false }: {
  text: (key: string) => string
  lang: Lang
  setLang: (l: Lang) => void
  homeSections?: boolean
}) {
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  return (
    <>
      <a className="landing-skip" href="#contenido">{text('landing.nav.skip')}</a>
      <header className="landing-header" onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          setOpen(false)
          menuButton.current?.focus()
        }
      }} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}>
        <div className="landing-header-inner elv-navbar">
          <Link to="/" className="landing-logo" aria-label={text('landing.header.home')}>
            elevation<i className="landing-logo-dot" aria-hidden="true" />
          </Link>
          <button ref={menuButton} type="button" className="elv-btn elv-btn-outline landing-menu-toggle"
            aria-expanded={open} aria-controls="landing-navigation" onClick={() => setOpen(value => !value)}
            aria-label={text(open ? 'landing.nav.close' : 'landing.nav.open')}>
            <span aria-hidden="true">{open ? '×' : '☰'}</span>
          </button>
          <nav id="landing-navigation" className="landing-tools landing-navigation" data-open={open}
            aria-label={text('landing.nav.label')}>
            <a className="elv-link landing-nav-how" href={`${homeSections ? '/' : ''}#como-funciona`} onClick={() => setOpen(false)}>{text('landing.nav.how')}</a>
            <a className="elv-link landing-nav-skillmap" href={`${homeSections ? '/' : ''}#skill-map`} onClick={() => setOpen(false)}>{text('landing.nav.skillmap')}</a>
            <a className="elv-link landing-nav-plans" href="#planes" onClick={() => setOpen(false)}>{text('landing.nav.plans')}</a>
            <div className="elv-join" role="group" aria-label={text('landing.header.language')}>
              {(['es', 'en'] as const).map(code => (
                <button key={code} type="button" lang={code} aria-pressed={lang === code}
                  className="elv-btn elv-join-item landing-lang" onClick={() => setLang(code)}>
                  {text(`landing.header.${code}`)}
                </button>
              ))}
            </div>
            <Link to="/login" className="elv-btn elv-btn-outline landing-login">{text('landing.header.login')}</Link>
          </nav>
        </div>
      </header>
    </>
  )
}
