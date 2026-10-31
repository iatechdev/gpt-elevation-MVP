import { Link } from 'react-router-dom'
import { LandingSection } from './LandingPrimitives'

type Props = { text: (key: string) => string }

export function LandingClosing({ text }: Props) {
  return <LandingSection className="landing-closing" aria-labelledby="landing-closing-title">
    <div className="landing-closing-inner">
      <p className="landing-closing-number" aria-hidden="true">{text('landing.closing.number')}</p>
      <h2 id="landing-closing-title">{text('landing.closing.title')}</h2>
      <Link to="/login?mode=register" className="elv-btn elv-btn-primary landing-closing-create">{text('landing.closing.create')}</Link>
      {/* D-04: no professional CTA until its actual signup flow is approved. */}
    </div>
  </LandingSection>
}

export function LandingFooter({ text }: Props) {
  return <footer className="elv-footer landing-footer">
    <div className="landing-footer-inner">
      <span className="landing-footer-brand">{text('landing.footer.brand')}<span aria-hidden="true">·</span></span>
      <p className="landing-footer-notice">{text('landing.footer.notice')}</p>
      {/* D-08 / ES-90: unapproved links stay hidden. /privacy is preserved. */}
      <p className="landing-footer-meta">{text('landing.footer.copyright').replaceAll('{year}', String(new Date().getFullYear()))}</p>
    </div>
  </footer>
}
