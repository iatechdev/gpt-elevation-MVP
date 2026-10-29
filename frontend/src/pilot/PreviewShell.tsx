import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { previewEnabled } from './model'
import './pilot.css'
export function PreviewShell({ children, admin = false }: { children?: ReactNode; admin?: boolean }) {
  const { lang, setLang } = useLanguage(); const c = copy[lang]
  return <section className="pilot-scope"><a className="pilot-skip" href="#pilot-main">{c.skip}</a><header><Link className="elv-link" to={admin ? '/admin/dashboard' : '/app/dashboard'}>{admin ? c.adminBack : c.back}</Link><div className="pilot-actions">{(['es', 'en'] as const).map(l => <button className="elv-btn" aria-pressed={l === lang} key={l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</div></header><main id="pilot-main" tabIndex={-1}>{previewEnabled(import.meta.env.VITE_ENABLE_PILOT_FEEDBACK_PREVIEW) ? <><aside className="elv-alert pilot-warning"><div><strong>{c.preview}</strong><p>{c.local}</p></div></aside>{children}</> : <p>{c.disabled}</p>}</main></section>
}
export function FeedbackPreviewLink() {
  const { lang } = useLanguage()
  return previewEnabled(import.meta.env.VITE_ENABLE_PILOT_FEEDBACK_PREVIEW) ? <div className="pilot-scope pilot-entry" style={{ gridColumn: '1 / -1' }}><Link className="elv-link" to="/app/feedback">{copy[lang].opinion}</Link></div> : null
}
