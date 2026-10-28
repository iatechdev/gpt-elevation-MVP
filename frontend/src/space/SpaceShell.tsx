import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { SpaceNav, SpaceSkip } from './SpaceNav'
export function SpaceShell({ children }: { children: ReactNode }) {
  const { lang, setLang } = useLanguage(); const c = copy[lang]
  return <div className="space-scope space-page"><SpaceSkip /><header><Link className="elv-link" to="/app/dashboard">{c.home}</Link><div>{(['es', 'en'] as const).map(l => <button className="elv-btn" key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</div></header><SpaceNav /><main id="space-main" tabIndex={-1}>{children}</main></div>
}
