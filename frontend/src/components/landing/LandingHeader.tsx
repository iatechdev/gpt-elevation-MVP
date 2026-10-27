import { Link } from 'react-router-dom'
import type { Lang } from '../../i18n/context'

// Cabecera de la landing (ES-62). La navegación de fase 2 (Cómo funciona, Skill Map, Para psicólogos, Planes)
// no se muestra hasta que existan esas secciones: ningún enlace apunta a una ruta inexistente.
export function LandingHeader({ text, lang, setLang }: {
  text: (key: string) => string
  lang: Lang
  setLang: (l: Lang) => void
}) {
  return (
    <>
      <a className="landing-skip" href="#contenido">{text('landing.nav.skip')}</a>
      <header className="landing-header">
        <div className="landing-header-inner elv-navbar">
          <Link to="/" className="landing-logo" aria-label={text('landing.header.home')}>
            elevation<i className="landing-logo-dot" aria-hidden="true" />
          </Link>
          <div className="landing-tools">
            <div className="elv-join" role="group" aria-label={text('landing.header.language')}>
              {(['es', 'en'] as const).map(code => (
                <button key={code} type="button" lang={code} aria-pressed={lang === code}
                  className="elv-btn elv-join-item landing-lang" onClick={() => setLang(code)}>
                  {text(`landing.header.${code}`)}
                </button>
              ))}
            </div>
            <Link to="/login" className="elv-btn elv-btn-outline landing-login">{text('landing.header.login')}</Link>
          </div>
        </div>
      </header>
    </>
  )
}
