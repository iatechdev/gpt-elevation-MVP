import { useAdminText } from '../../i18n/useAdminText'
// frontend/src/pages/admin/AdminMetrics.tsx
// HU-047 + HU-081 + ES-180 (HU-P29) — Métricas: 30 días completos, promedio diario, máximo en un día y tabla alternativa.
import { colors, spacing, typography, cardStyle } from '../../styles/tokens'
import { ActivityChart, CardTitle, LoadError, SummaryCards, TopProfessionals } from './adminOverview'
import type { Metrics } from './adminOverviewData'
import { useAdminResource } from './adminOverviewData'

export function AdminMetrics() {
  const tr = useAdminText()
  const { data, state, retry } = useAdminResource<Metrics>('/api/admin/metrics')

  return (
    <div style={{ fontFamily: typography.fontBody }}>
      <div style={{ marginBottom: spacing.xxl }}>
        <h1 style={{ fontFamily: typography.fontDisplay, fontWeight: 300, fontSize: '1.8rem', color: colors.text, margin: 0 }}>{tr('Métricas')}</h1>
        <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: `${spacing.xs} 0 0` }}>{tr('Indicadores de rendimiento de la plataforma')}</p>
      </div>

      {state === 'loading' && <p role="status" aria-busy="true" style={{ color: colors.textMuted, fontSize: 13 }}>{tr('Cargando métricas...')}</p>}
      {state === 'error' && <LoadError message={tr('No se pudieron cargar las métricas.')} onRetry={retry} />}
      {state === 'ok' && data && (
        <>
          <SummaryCards metrics={data} />
          <section style={{ ...cardStyle, marginBottom: spacing.xl }}>
            <CardTitle>{tr('Actividad, últimos 30 días')}</CardTitle>
            <ActivityChart metrics={data} height={120} showSummary />
          </section>
          <section style={cardStyle}>
            <CardTitle>{tr('Profesionales con más personas')}</CardTitle>
            <TopProfessionals metrics={data} />
          </section>
        </>
      )}
    </div>
  )
}
