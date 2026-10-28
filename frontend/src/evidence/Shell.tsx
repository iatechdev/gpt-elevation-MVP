import type { ReactNode, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import './evidence.css'
export function EvidenceShell({ title, children, onLeave }: { title: string; children: ReactNode; onLeave?: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const { t, lang, setLang } = useLanguage()
  return <div className="evidence-scope">
    <a href="#evidence-main" className="evidence-skip elv-link">{t('evidence.skip')}</a>
    <header><span>{t('logo')}</span><div className="elv-join" role="group" aria-label={t('evidence.language')}>
      {(['es', 'en'] as const).map(value => <button type="button" className="elv-btn elv-btn-ghost elv-join-item" key={value} aria-pressed={lang === value} onClick={() => setLang(value)}>{value.toUpperCase()}</button>)}
    </div></header>
    <main id="evidence-main" tabIndex={-1}>
      <nav><Link className="elv-link" to="/app/dashboard" onClick={onLeave}>{t('evidence.back')}</Link><Link className="elv-link" to="/app/evidence" onClick={onLeave}>{t('evidence.list')}</Link></nav>
      <h1>{title}</h1>{children}
    </main>
  </div>
}
