import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { createFixtureRepository, scenario } from './fixtures'
import { previewEnabled } from './model'
import type { Metrics } from './model'
import { usePilotToken } from './hooks'
import { Banner, Button, Card, Chip } from '../cartografia'
import type { ChipTone } from '../cartografia'
import '../cartografia/pages.css'
import './pilotMetrics.css'

const metrics = ['activation', 'experiment', 'listening', 'utility'] as const
// Estado en palabra (siempre con chip): listo = ok con ✓, protegido = en espera; el resto, neutro.
const STATUS_TONE: Record<string, { tone: ChipTone; symbol?: string }> = { ready: { tone: 'ok', symbol: '✓' }, suppressed: { tone: 'wait' } }

// ES-183 (diseño 12119): dos modos.
//  · Por defecto (bandera apagada): metas «en definición» (sin cifras: decisión 31) y resultados «Sin datos». No pide NADA al servidor; «Actualizar» sigue deshabilitado hasta conectar GET /api/admin/pilot-metrics (ES-173).
//  · Vista preliminar (VITE_ENABLE_PILOT_FEEDBACK_PREVIEW): franja de revisión y datos sintéticos en memoria, con los cinco estados en palabra, «datos protegidos» y «Actualizar» con cargando y error.
export function PilotMetricsPage() {
  const token = usePilotToken()
  const preview = previewEnabled(import.meta.env.VITE_ENABLE_PILOT_FEEDBACK_PREVIEW)
  // ES-310 (ES-349): dentro del marco de Administración (cabecera, idioma, «Saltar al contenido» y un solo main los pone el marco); aquí solo el contenido.
  return <div className="pg pg-wide pm">{preview ? <MetricsSession key={token} token={token} /> : <NoData />}</div>
}

function Targets() {
  const { lang } = useLanguage(); const c = copy[lang]
  return <>
    <h2 className="pm-h2">{c.targets}</h2>
    <p>{c.targetWarning}</p>
    <div className="pm-grid">
      {metrics.map(key => <Card as="article" className="pm-pending" key={key}>
        <h3>{c[key]}</h3>
        <p>{c.targetPending}</p>
        <p className="cg-hint">{c.proposed}</p>
      </Card>)}
    </div>
  </>
}

function NoData() {
  const { lang } = useLanguage(); const c = copy[lang]
  return <>
    <header className="pg-head"><h1 className="pg-title">{c.metricsTitle}</h1></header>
    <Targets />
    <h2 className="pm-h2">{c.observedResults}</h2>
    <p>{c.metricsPending}</p>
    <div className="pm-grid">
      {metrics.map(key => <Card as="article" key={key}>
        <h3>{c[key]}</h3>
        <p>{c.noData}</p>
      </Card>)}
    </div>
    <div className="pg-actions"><Button variant="ghost" disabled aria-describedby="metrics-refresh-note">{c.refreshResults}</Button></div>
    <p className="cg-hint" id="metrics-refresh-note">{c.metricsRefreshPending}</p>
  </>
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
  return <>
    <header className="pg-head"><h1 className="pg-title">{c.metricsTitle}</h1><p className="pg-lead">{c.cohort}</p></header>
    <Banner kind="note" title={c.preview}><p>{c.local}</p></Banner>
    <Targets />
    <h2 className="pm-h2">{c.observed}</h2>
    <p role="status" aria-live="polite" className="cg-hint">{loading ? c.loading : null}</p>
    {error && <Banner kind="error" title={c.loadError}><div className="pg-actions"><Button variant="ghost" onClick={() => { setLoading(true); setError(false); void load() }}>{c.retry}</Button></div></Banner>}
    {data && <div className="pm-grid">{data.metrics.map(m => <Card as="article" key={m.key}><h3>{c[m.key]}</h3><p><Chip tone={(STATUS_TONE[m.status] ?? { tone: 'neutral' as ChipTone }).tone} symbol={STATUS_TONE[m.status]?.symbol}>{c[m.status]}</Chip></p>{m.status === 'suppressed' && <p className="cg-hint">{c.protected}</p>}{m.status === 'ready' && m.counts && <dl className="pm-dl">{(['eligible', 'responded', 'missing', 'positive'] as const).map(key => <div key={key}><dt>{c[key]}</dt><dd>{m.counts![key]}</dd></div>)}</dl>}</Card>)}</div>}
    <div className="pg-actions"><Button variant="ghost" disabled={loading} aria-busy={loading || undefined} onClick={() => { setLoading(true); setData(null); void load() }}>{c.refresh}</Button></div>
  </>
}
