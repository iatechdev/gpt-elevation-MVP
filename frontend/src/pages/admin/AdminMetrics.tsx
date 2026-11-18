import { useAdminText } from '../../i18n/useAdminText'
// frontend/src/pages/admin/AdminMetrics.tsx
// HU-047 + HU-081 + ES-180 (HU-P29) + ES-310 — Métricas: 30 días completos, promedio diario, máximo en un día y tabla alternativa. Cartografía.
import '../../cartografia/pages.css'
import { Card } from '../../cartografia'
import { ActivityChart, CardTitle, LoadError, SummaryCards, TopProfessionals } from './adminOverview'
import type { Metrics } from './adminOverviewData'
import { useAdminResource } from './adminOverviewData'

export function AdminMetrics() {
  const tr = useAdminText()
  const { data, state, retry } = useAdminResource<Metrics>('/api/admin/metrics')

  return (
    <div className="pg ao pg-wide">
      <header className="pg-head">
        <h1 className="pg-title">{tr('Métricas')}</h1>
        <p className="pg-lead">{tr('Indicadores de rendimiento de la plataforma')}</p>
      </header>

      {state === 'loading' && <p role="status" aria-busy="true" className="ao-status">{tr('Cargando métricas...')}</p>}
      {state === 'error' && <LoadError message={tr('No se pudieron cargar las métricas.')} onRetry={retry} />}
      {state === 'ok' && data && (
        <>
          <SummaryCards metrics={data} />
          <Card as="section" className="pg-card">
            <CardTitle>{tr('Actividad, últimos 30 días')}</CardTitle>
            <ActivityChart metrics={data} showSummary />
          </Card>
          <Card as="section" className="pg-card">
            <CardTitle>{tr('Profesionales con más personas')}</CardTitle>
            <TopProfessionals metrics={data} />
          </Card>
        </>
      )}
    </div>
  )
}
