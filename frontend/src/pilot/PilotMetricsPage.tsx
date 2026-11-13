import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { PreviewShell } from './PreviewShell'

const metrics = ['activation', 'experiment', 'listening', 'utility'] as const

export function PilotMetricsPage() {
  const { lang } = useLanguage()
  const c = copy[lang]

  return <PreviewShell admin preview={false}>
    <h1>{c.metricsTitle}</h1>
    <h2>{c.targets}</h2>
    <p>{c.targetWarning}</p>
    <div className="pilot-grid">
      {metrics.map(key => <article className="elv-card pilot-card" key={key}>
        <h3>{c[key]}</h3>
        <p>{key === 'activation' || key === 'listening' ? '5/6' : '4/6'} · {key === 'activation' || key === 'listening' ? c.day7 : c.day30}</p>
        <p className="pilot-note">{c.proposed}</p>
      </article>)}
    </div>
    <h2>{c.observedResults}</h2>
    <p>{c.metricsPending}</p>
    <div className="pilot-grid">
      {metrics.map(key => <article className="elv-card pilot-card" key={key}>
        <h3>{c[key]}</h3>
        <p>{c.noData}</p>
      </article>)}
    </div>
    <button className="elv-btn" disabled aria-describedby="metrics-refresh-note">{c.refreshResults}</button>
    <p id="metrics-refresh-note">{c.metricsRefreshPending}</p>
  </PreviewShell>
}
