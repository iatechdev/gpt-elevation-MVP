type Props = { text: (key: string) => string }

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
