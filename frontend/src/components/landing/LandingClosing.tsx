import { Link } from 'react-router-dom'

/** `manifestLabel`: texto del enlace al manifiesto ético público (ES-207); sin él no se muestra enlace alguno. */
type Props = { text: (key: string) => string; manifestLabel?: string }

export function LandingFooter({ text, manifestLabel }: Props) {
  return <footer className="elv-footer landing-footer">
    <div className="landing-footer-inner">
      <span className="landing-footer-brand">{text('landing.footer.brand')}<span aria-hidden="true">·</span></span>
      <p className="landing-footer-notice">{text('landing.footer.notice')}</p>
      {/* D-08 / ES-90: unapproved links stay hidden. /privacy is preserved. ES-207: el manifiesto ético público está aprobado. */}
      {manifestLabel && <p className="landing-footer-meta"><Link className="elv-link" to="/manifiesto">{manifestLabel}</Link></p>}
      <p className="landing-footer-meta">{text('landing.footer.copyright').replaceAll('{year}', String(new Date().getFullYear()))}</p>
    </div>
  </footer>
}
