import { useAdminText } from '../../i18n/useAdminText'
// frontend/src/pages/admin/AdminDashboard.tsx
// HU-047 + HU-063 + ES-180 (HU-P29) + ES-310 — Resumen de la plataforma: cifras con palabra, avisos con estado propio, actividad de 30 días. Cartografía.
import { useNavigate } from 'react-router-dom'
import '../../cartografia/pages.css'
import { Card } from '../../cartografia'
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
    <div className="pg ao pg-wide">
      <header className="pg-head">
        <h1 className="pg-title">{tr('Panel')}</h1>
        <p className="pg-lead">{tr('Resumen de la plataforma')}</p>
      </header>

      {metrics.state === 'loading' && <p role="status" aria-busy="true" className="ao-status">{tr('Cargando métricas...')}</p>}
      {metrics.state === 'error' && <LoadError message={tr('No se pudieron cargar las métricas.')} onRetry={metrics.retry} />}
      {metrics.state === 'ok' && metrics.data && <SummaryCards metrics={metrics.data} />}

      <div className="ao-two">
        <Card as="section" className="pg-card">
          <CardTitle id="admin-alerts-title">{tr('Avisos')}</CardTitle>
          {alerts.state === 'loading' && <p role="status" aria-busy="true" className="ao-status">{tr('Cargando...')}</p>}
          {alerts.state === 'error' && <LoadError message={tr('No pudimos cargar los avisos.')} onRetry={alerts.retry} />}
          {alerts.state === 'ok' && sections && (
            <ul className="cg-items" aria-labelledby="admin-alerts-title">
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
            <ul className="cg-items">
              {guides.items.map((p) => (
                <li key={p.id} className="cg-item cg-hint">
                  {p.therapistName ?? tr('Sin datos')} · v{p.version} · {f.day(p.createdAt, true)}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card as="section" className="pg-card">
          <CardTitle id="admin-top-title">{tr('Profesionales con más personas')}</CardTitle>
          {metrics.state === 'ok' && metrics.data ? <TopProfessionals metrics={metrics.data} /> : <p className="ao-status">{metrics.state === 'loading' ? tr('Cargando...') : tr('Sin datos')}</p>}
        </Card>
      </div>

      <Card as="section" className="pg-card">
        <CardTitle>{tr('Actividad, últimos 30 días')}</CardTitle>
        {metrics.state === 'ok' && metrics.data ? <ActivityChart metrics={metrics.data} /> : <p className="ao-status">{metrics.state === 'loading' ? tr('Cargando...') : tr('Sin datos')}</p>}
      </Card>
    </div>
  )
}
