// ES-180 (HU-P29) + ES-310 — Piezas compartidas de /admin/dashboard y /admin/metrics: cifras con palabra y «Sin datos», gráfica de 30 días con tabla alternativa
// y avisos con estado propio. Sin emojis ni estrellas (decisión 28); cero = línea mínima, nunca barra (decisión 27). Estilo: Cartografía (tokens --cg-*), sin estilos en línea.
import { useState } from 'react'
import { Banner, Button, Figures, LinkButton } from '../../cartografia'
import { useAdminText } from '../../i18n/useAdminText'
import type { Metrics } from './adminOverviewData'
import { useFormat } from './adminOverviewData'
import './adminOverview.css'

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const tr = useAdminText()
  return (
    <Banner kind="error" title={message}>
      <div className="pg-actions"><Button variant="ghost" onClick={onRetry}>{tr('Reintentar')}</Button></div>
    </Banner>
  )
}

export function SummaryCards({ metrics }: { metrics: Metrics }) {
  const tr = useAdminText()
  const f = useFormat()
  const items = [
    { id: 'total', label: tr('Personas usuarias'), value: f.number(metrics.totalUsers) },
    { id: 'active', label: tr('Personas activas'), value: f.number(metrics.activeUsers) },
    { id: 'pros', label: tr('Profesionales'), value: f.number(metrics.totalTherapists) },
    { id: 'mood-logs', label: tr('Registros de ánimo'), value: f.number(metrics.totalSessions) },
    { id: 'week', label: tr('Activas esta semana'), value: f.number(metrics.activeThisWeek) },
    { id: 'mood', label: tr('Ánimo promedio'), value: f.outOfFive(metrics.avgMood, tr('de')) ?? tr('Sin datos') },
    { id: 'rating', label: tr('Valoración promedio'), value: f.outOfFive(metrics.avgRating, tr('de')) ?? tr('Sin datos') },
  ]
  return <Figures items={items} />
}

// Gráfica de 30 columnas SIEMPRE (también los días en 0). 0 = línea mínima (nunca barra). Texto alternativo con total y máximo; «Ver como tabla» alterna a <table>.
const CHART_W = 300
const CHART_H = 90
export function ActivityChart({ metrics, showSummary = false }: { metrics: Metrics; showSummary?: boolean }) {
  const tr = useAdminText()
  const f = useFormat()
  const [asTable, setAsTable] = useState(false)
  const { days30, total30, range } = metrics
  // Contrato: `max30` es `{ date, count }` o `null` (sin registros). El pico sale del objeto, no de un número.
  const maxCount = metrics.max30?.count ?? 0
  const alt = total30 === 0 || !metrics.max30
    ? `${tr('Sin registros entre')} ${f.day(range.start)} ${tr('y')} ${f.day(range.end, true)}.`
    : `${tr('Total')} ${f.number(total30)} ${tr('registros')}; ${tr('máximo')} ${f.number(maxCount)} ${tr('el')} ${f.day(metrics.max30.date)}.`
  const slot = CHART_W / Math.max(1, days30.length)
  return (
    <div>
      <div className="ao-chart-head">
        <p>{f.day(range.start)} – {f.day(range.end, true)}</p>
        <Button variant="ghost" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? tr('Ver como gráfica') : tr('Ver como tabla')}
        </Button>
      </div>
      {asTable ? (
        <div className="ao-tablewrap" tabIndex={0} role="region" aria-label={tr('Registros por día')}>
          <table className="cg-table">
            <caption className="ao-sr">{alt}</caption>
            <thead><tr>
              <th scope="col">{tr('Fecha')}</th>
              <th scope="col" className="ao-th-num">{tr('Registros')}</th>
            </tr></thead>
            <tbody>{days30.map((d) => (
              <tr key={d.date}>
                <th scope="row">{f.day(d.date, true)}</th>
                <td className="ao-td-num">{f.number(d.count)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <svg className="ao-chart" role="img" aria-label={alt} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
          {days30.map((d, i) => {
            const zero = d.count === 0
            // Cero = línea de ~1 px (0,6 de 90 unidades sobre 9 rem); el resto, proporcional al máximo con un piso del 4 %.
            const h = zero ? 0.6 : Math.max((d.count / Math.max(maxCount, 1)) * CHART_H, CHART_H * 0.04)
            return <rect key={d.date} className={zero ? 'ao-zero' : undefined} data-count={d.count} x={i * slot + slot * 0.1} y={CHART_H - h} width={slot * 0.8} height={h}><title>{`${f.day(d.date, true)}: ${f.number(d.count)}`}</title></rect>
          })}
        </svg>
      )}
      <p className="cg-hint">{alt}</p>
      {showSummary && (
        <div className="ao-summary">
          <Figures items={[
            { id: 'total30', label: tr('registros en 30 días'), value: f.number(total30) },
            { id: 'avg30', label: tr('promedio diario'), value: f.number(metrics.dailyAverage30, 1) },
            { id: 'max30', label: tr('máximo en un día'), value: f.number(maxCount) },
          ]} />
        </div>
      )}
    </div>
  )
}

export function TopProfessionals({ metrics }: { metrics: Metrics }) {
  const tr = useAdminText()
  const f = useFormat()
  if (metrics.topTherapists.length === 0) return <p className="ao-status">{tr('Aún no hay profesionales con personas')}</p>
  return (
    <div className="ao-people" tabIndex={0} role="region" aria-label={tr('Profesionales con más personas')}>
      <table className="cg-table">
        <thead><tr>
          <th scope="col">{tr('Profesional')}</th>
          <th scope="col">{tr('Personas')}</th>
          <th scope="col">{tr('Valoración')}</th>
        </tr></thead>
        <tbody>{metrics.topTherapists.map((p) => (
          <tr key={p.id}>
            <th scope="row">{p.name}</th>
            <td>{f.number(p.patientCount)}</td>
            <td>{f.outOfFive(p.avgRating, tr('de')) ?? tr('Sin datos')}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

export function CardTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id}>{children}</h2>
}

// Cada aviso con su estado: error propio con «Reintentar» (recarga todos los avisos), sin avisos, o con avisos y enlace.
export function AlertRow({ title, status, detail, actionLabel, onAction, onRetry }: {
  title: string; status: 'ok' | 'error'; detail: string; actionLabel?: string; onAction?: () => void; onRetry: () => void
}) {
  const tr = useAdminText()
  return (
    <li className="cg-item">
      <div className="ao-row">
        <div>
          <strong>{title}</strong>
          {status === 'ok' && <p className="ao-detail">{detail}</p>}
        </div>
        {status === 'ok' && actionLabel && onAction && <Button variant="ghost" onClick={onAction}>{actionLabel}</Button>}
        {status === 'error' && (
          <Banner kind="error" title={tr('No pudimos cargar este aviso.')}>
            <div className="pg-actions"><LinkButton onClick={onRetry}>{tr('Reintentar')}</LinkButton></div>
          </Banner>
        )}
      </div>
    </li>
  )
}
