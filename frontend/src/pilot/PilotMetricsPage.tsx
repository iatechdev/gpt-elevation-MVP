import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { createFixtureRepository, scenario } from './fixtures'
import { previewEnabled } from './model'
import type { Metrics } from './model'
import { PreviewShell } from './PreviewShell'
import { usePilotToken } from './hooks'
export function PilotMetricsPage() {
  const token = usePilotToken()
  return <PreviewShell admin>{previewEnabled(import.meta.env.VITE_ENABLE_PILOT_FEEDBACK_PREVIEW) && <MetricsSession key={token} token={token} />}</PreviewShell>
}
function MetricsSession({ token }: { token: string }) {
  const { lang } = useLanguage(); const c = copy[lang]
  const repository = useMemo(() => createFixtureRepository(scenario(import.meta.env.VITE_PILOT_FEEDBACK_SCENARIO)), [])
  const [data, setData] = useState<Metrics | null>(null); const [error, setError] = useState(false); const [loading, setLoading] = useState(true)
  const load = useCallback(async (active = () => true) => {
    try { const result = await repository.metrics(); if (active() && localStorage.getItem('elevation_token') === token) { setData(result); setError(false); setLoading(false) } }
    catch { if (active()) { setData(null); setError(true); setLoading(false) } }
  }, [repository, token])
  useEffect(() => {
    let active = true
    void repository.metrics().then(result => { if (active && localStorage.getItem('elevation_token') === token) { setData(result); setError(false); setLoading(false) } }).catch(() => { if (active) { setData(null); setError(true); setLoading(false) } })
    return () => { active = false }
  }, [repository, token])
  return <><h1>{c.metricsTitle}</h1><p>{c.cohort}</p><h2>{c.targets}</h2><p>{c.targetWarning}</p><div className="pilot-grid">{(['activation', 'experiment', 'listening', 'utility'] as const).map(key => <article className="elv-card pilot-card" key={key}><h3>{c[key]}</h3><p>{['activation', 'listening'].includes(key) ? '5/6' : '4/6'} · {['activation', 'listening'].includes(key) ? c.day7 : c.day30}</p><p className="pilot-note">{c.proposed}</p></article>)}</div><h2>{c.observed}</h2>
    <p role="status" aria-live="polite">{loading ? c.loading : error ? c.loadError : null}</p>
    {data && <div className="pilot-grid">{data.metrics.map(m => <article className="elv-card pilot-card" key={m.key}><h3>{c[m.key]}</h3><p>{c[m.status]}</p>{m.status === 'suppressed' && <p>{c.protected}</p>}{m.status === 'ready' && m.counts && <dl>{(['eligible', 'responded', 'missing', 'positive'] as const).map(key => <div key={key}><dt>{c[key]}</dt><dd>{m.counts![key]}</dd></div>)}</dl>}</article>)}</div>}
    <button className="elv-btn" onClick={() => { setLoading(true); setData(null); void load() }}>{c.refresh}</button>
  </>
}
