// ES-180 (HU-P29) — Piezas compartidas de /admin/dashboard y /admin/metrics: cifras con palabra y «Sin datos», gráfica de 30 días con tabla alternativa
// y avisos con estado propio. Sin emojis ni estrellas (decisión 28); cero = línea mínima, nunca barra (decisión 27).
import { useState } from 'react'
import { useAdminText } from '../../i18n/useAdminText'
import { colors, radius, spacing, typography, cardStyle, labelStyle } from '../../styles/tokens'
import type { Metrics } from './adminOverviewData'
import { linkButton, useFormat } from './adminOverviewData'

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const tr = useAdminText()
  return (
    <div role="alert" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, color: colors.danger, fontSize: '0.875rem', fontFamily: typography.fontBody }}>
      <span>{message}</span>
      <button type="button" onClick={onRetry} style={linkButton}>{tr('Reintentar')}</button>
    </div>
  )
}

export function StatCard({ label, value }: { label: string; value: string | null }) {
  const tr = useAdminText()
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: value == null ? '1.1rem' : '1.6rem', fontWeight: 600, color: value == null ? colors.textMuted : colors.text }}>{value ?? tr('Sin datos')}</div>
      <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: spacing.xs }}>{label}</div>
    </div>
  )
}

export function SummaryCards({ metrics }: { metrics: Metrics }) {
  const tr = useAdminText()
  const f = useFormat()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: spacing.lg, marginBottom: spacing.xxl }}>
      <StatCard label={tr('Personas usuarias')} value={f.number(metrics.totalUsers)} />
      <StatCard label={tr('Personas activas')} value={f.number(metrics.activeUsers)} />
      <StatCard label={tr('Profesionales')} value={f.number(metrics.totalTherapists)} />
      <StatCard label={tr('Registros de ánimo')} value={f.number(metrics.totalSessions)} />
      <StatCard label={tr('Activas esta semana')} value={f.number(metrics.activeThisWeek)} />
      <StatCard label={tr('Ánimo promedio')} value={f.outOfFive(metrics.avgMood, tr('de'))} />
      <StatCard label={tr('Valoración promedio')} value={f.outOfFive(metrics.avgRating, tr('de'))} />
    </div>
  )
}

// Gráfica de 30 columnas SIEMPRE (también los días en 0). 0 = línea de 1 px. Texto alternativo con total y máximo; «Ver como tabla» alterna a <table>.
export function ActivityChart({ metrics, height = 80, showSummary = false }: { metrics: Metrics; height?: number; showSummary?: boolean }) {
  const tr = useAdminText()
  const f = useFormat()
  const [asTable, setAsTable] = useState(false)
  const { days30, total30, max30, range } = metrics
  const peak = days30.find((d) => d.count === max30 && max30 > 0)
  const alt = total30 === 0
    ? `${tr('Sin registros entre')} ${f.day(range.start)} ${tr('y')} ${f.day(range.end, true)}.`
    : `${tr('Total')} ${f.number(total30)} ${tr('registros')}; ${tr('máximo')} ${f.number(max30)} ${tr('el')} ${peak ? f.day(peak.date) : ''}.`
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
        <span style={{ fontSize: '0.78rem', color: colors.textMuted }}>{f.day(range.start)} – {f.day(range.end, true)}</span>
        <button type="button" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)} style={linkButton}>
          {asTable ? tr('Ver como gráfica') : tr('Ver como tabla')}
        </button>
      </div>
      {asTable ? (
        <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }} tabIndex={0} role="region" aria-label={tr('Registros por día')}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{alt}</caption>
            <thead><tr>
              <th scope="col" style={{ ...th }}>{tr('Fecha')}</th>
              <th scope="col" style={{ ...th, textAlign: 'right' }}>{tr('Registros')}</th>
            </tr></thead>
            <tbody>{days30.map((d) => (
              <tr key={d.date}>
                <th scope="row" style={{ ...td, fontWeight: 400, textAlign: 'left' }}>{f.day(d.date, true)}</th>
                <td style={{ ...td, textAlign: 'right' }}>{f.number(d.count)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div role="img" aria-label={alt} style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, minWidth: 30 * 9 }}>
            {days30.map((d) => (
              <div key={d.date} title={`${f.day(d.date, true)}: ${f.number(d.count)}`}
                style={{ flex: 1, height: d.count === 0 ? 1 : `${Math.max((d.count / Math.max(max30, 1)) * 100, 4)}%`, background: d.count === 0 ? colors.border : colors.primary, borderRadius: d.count === 0 ? 0 : `${radius.sm} ${radius.sm} 0 0`, opacity: 0.85 }} />
            ))}
          </div>
        </div>
      )}
      <p style={{ margin: `${spacing.sm} 0 0`, fontSize: '0.78rem', color: colors.textMuted }}>{alt}</p>
      {showSummary && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xl, marginTop: spacing.lg, paddingTop: spacing.lg, borderTop: `0.5px solid ${colors.border}` }}>
          <Figure value={f.number(total30)} label={tr('registros en 30 días')} />
          <Figure value={f.number(metrics.dailyAverage30, 1)} label={tr('promedio diario')} />
          <Figure value={f.number(max30)} label={tr('máximo en un día')} />
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', ...labelStyle, borderBottom: `0.5px solid ${colors.border}`, position: 'sticky', top: 0, background: colors.bg }
const td: React.CSSProperties = { padding: `${spacing.sm} ${spacing.md}`, fontSize: '0.875rem', color: colors.text }

function Figure({ value, label }: { value: string; label: string }) {
  return (<div><div style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.text }}>{value}</div><div style={{ fontSize: 12, color: colors.textMuted }}>{label}</div></div>)
}

export function TopProfessionals({ metrics }: { metrics: Metrics }) {
  const tr = useAdminText()
  const f = useFormat()
  if (metrics.topTherapists.length === 0) return <p style={{ color: colors.textMuted, fontSize: '0.875rem', margin: 0 }}>{tr('Aún no hay profesionales con personas')}</p>
  return (
    <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label={tr('Profesionales con más personas')}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th scope="col" style={th}>{tr('Profesional')}</th>
          <th scope="col" style={th}>{tr('Personas')}</th>
          <th scope="col" style={th}>{tr('Valoración')}</th>
        </tr></thead>
        <tbody>{metrics.topTherapists.map((p, i) => (
          <tr key={p.id} style={{ background: i % 2 === 0 ? 'transparent' : colors.bgMuted }}>
            <th scope="row" style={{ ...td, fontWeight: 400, textAlign: 'left' }}>{p.name}</th>
            <td style={td}>{f.number(p.patientCount)}</td>
            <td style={td}>{f.outOfFive(p.avgRating, tr('de')) ?? tr('Sin datos')}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.1rem', color: colors.text, margin: `0 0 ${spacing.lg}` }}>{children}</h2>
}

// Cada aviso con su estado: error propio con «Reintentar» (recarga todos los avisos), sin avisos, o con avisos y enlace.
export function AlertRow({ title, status, detail, actionLabel, onAction, onRetry }: {
  title: string; status: 'ok' | 'error'; detail: string; actionLabel?: string; onAction?: () => void; onRetry: () => void
}) {
  const tr = useAdminText()
  return (
    <li style={{ listStyle: 'none', padding: spacing.md, borderRadius: radius.md, background: colors.bgMuted, border: `0.5px solid ${colors.border}` }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: colors.text }}>{title}</div>
      {status === 'error' ? (
        <div role="alert" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, fontSize: '0.78rem', color: colors.danger }}>
          <span>{tr('No pudimos cargar este aviso.')}</span>
          <button type="button" onClick={onRetry} style={linkButton}>{tr('Reintentar')}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
          <span style={{ fontSize: '0.78rem', color: colors.textMuted }}>{detail}</span>
          {actionLabel && onAction && <button type="button" onClick={onAction} style={linkButton}>{actionLabel}</button>}
        </div>
      )}
    </li>
  )
}
