import { useAdminText } from '../../i18n/useAdminText'
// frontend/src/pages/admin/AdminDashboard.tsx
// HU-047 + HU-063 + ES-180 (HU-P29) — Resumen de la plataforma: cifras con palabra, avisos con estado propio, actividad de 30 días.
import { useNavigate } from 'react-router-dom'
import { colors, spacing, typography, cardStyle, labelStyle } from '../../styles/tokens'
import { ActivityChart, AlertRow, CardTitle, LoadError, SummaryCards, TopProfessionals } from './adminOverview'
import type { AdminAlerts, Metrics } from './adminOverviewData'
import { useAdminResource, useFormat } from './adminOverviewData'

export function AdminDashboard() {
  const tr = useAdminText()
  const f = useFormat()
  const navigate = useNavigate()
  const metrics = useAdminResource<Metrics>('/api/admin/metrics')
  const alerts = useAdminResource<AdminAlerts>('/api/admin/usuarios/alerts')

  const sections = alerts.data?.sections
  const guides = sections?.guides
  const incomplete = sections?.professionalsIncomplete
  const manifest = sections?.manifest

  return (
    <div style={{ fontFamily: typography.fontBody }}>
      <div style={{ marginBottom: spacing.xxl }}>
        <h1 style={{ fontFamily: typography.fontDisplay, fontWeight: 300, fontSize: '1.8rem', color: colors.text, margin: 0 }}>{tr('Panel')}</h1>
        <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: `${spacing.xs} 0 0` }}>{tr('Resumen de la plataforma')}</p>
      </div>

      {metrics.state === 'loading' && <p role="status" aria-busy="true" style={{ color: colors.textMuted, fontSize: '0.875rem' }}>{tr('Cargando métricas...')}</p>}
      {metrics.state === 'error' && <LoadError message={tr('No se pudieron cargar las métricas.')} onRetry={metrics.retry} />}
      {metrics.state === 'ok' && metrics.data && <SummaryCards metrics={metrics.data} />}

      <div className="admin-overview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: spacing.xl, alignItems: 'start' }}>
        <section aria-labelledby="admin-alerts-title" style={cardStyle}>
          <div id="admin-alerts-title" style={{ ...labelStyle, marginBottom: spacing.lg }}>{tr('Avisos')}</div>
          {alerts.state === 'loading' && <p role="status" aria-busy="true" style={{ fontSize: '0.82rem', color: colors.textMuted, margin: 0 }}>{tr('Cargando...')}</p>}
          {alerts.state === 'error' && <LoadError message={tr('No pudimos cargar los avisos.')} onRetry={alerts.retry} />}
          {alerts.state === 'ok' && sections && (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, margin: 0, padding: 0 }}>
              <AlertRow
                title={tr('Guías de profesionales por revisar')}
                status={guides?.status === 'ok' ? 'ok' : 'error'}
                detail={guides?.status === 'ok' ? (guides.count === 0 ? tr('Sin avisos') : `${f.number(guides.count)}`) : ''}
                actionLabel={guides?.status === 'ok' && guides.count > 0 ? tr('Ver') : undefined}
                onAction={() => navigate('/admin/prompts')}
                onRetry={alerts.retry}
              />
              <AlertRow
                title={tr('Perfil incompleto')}
                status={incomplete?.status === 'ok' ? 'ok' : 'error'}
                detail={incomplete?.status === 'ok' ? (incomplete.count === 0 ? tr('Sin avisos') : `${f.number(incomplete.count)} ${tr('profesionales')}`) : ''}
                actionLabel={incomplete?.status === 'ok' && incomplete.count > 0 ? tr('Ver') : undefined}
                onAction={() => navigate('/admin/usuarios?role=therapist')}
                onRetry={alerts.retry}
              />
              <AlertRow
                title={tr('Manifiesto vigente')}
                status={manifest?.status === 'ok' ? 'ok' : 'error'}
                detail={manifest?.status === 'ok' ? (manifest.version ? `${manifest.version}${manifest.date ? ` · ${f.day(manifest.date, true)}` : ''}` : tr('Sin datos')) : ''}
                onRetry={alerts.retry}
              />
            </ul>
          )}
          {guides?.status === 'ok' && guides.items.length > 0 && (
            <ul style={{ margin: `${spacing.lg} 0 0`, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
              {guides.items.map((p) => (
                <li key={p.id} style={{ listStyle: 'none', fontSize: '0.78rem', color: colors.textMuted }}>
                  {p.therapistName ?? tr('Sin datos')} · v{p.version} · {f.day(p.createdAt, true)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="admin-top-title" style={cardStyle}>
          <h2 id="admin-top-title" style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.1rem', color: colors.text, margin: `0 0 ${spacing.lg}` }}>{tr('Profesionales con más personas')}</h2>
          {metrics.state === 'ok' && metrics.data ? <TopProfessionals metrics={metrics.data} /> : <p style={{ margin: 0, fontSize: '0.875rem', color: colors.textMuted }}>{metrics.state === 'loading' ? tr('Cargando...') : tr('Sin datos')}</p>}
        </section>
      </div>

      <section style={{ ...cardStyle, marginTop: spacing.xl }}>
        <CardTitle>{tr('Actividad, últimos 30 días')}</CardTitle>
        {metrics.state === 'ok' && metrics.data ? <ActivityChart metrics={metrics.data} /> : <p style={{ margin: 0, fontSize: '0.875rem', color: colors.textMuted }}>{metrics.state === 'loading' ? tr('Cargando...') : tr('Sin datos')}</p>}
      </section>
    </div>
  )
}
