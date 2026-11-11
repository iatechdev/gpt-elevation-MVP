// ES-178 (F2): resumen con IA de la ficha. «Generado con IA · fecha · a partir de n registros de ánimo y valoraciones. No incluye tus notas.» (nunca «y n notas»: desde ES-79/102 las notas no se envían al proveedor),
// aviso de lectura automática (no es un diagnóstico), y errores por código: `ai_budget_exhausted` y `ai_budget_not_configured` NO se reintentan (con la fecha de reinicio cuando existe); el resto, con «Reintentar».
import { useRef, useState, type CSSProperties } from 'react'
import { cardStyle } from './panelStyles'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''
type T = (key: string, params?: Record<string, string | number>) => string
interface Summary { summary: string; generatedAt: string; basedOn: { sessions: number } }
type Problem = { key: string; params?: Record<string, string | number>; retry: boolean }

const primary: CSSProperties = { minHeight: 44, minWidth: 44, padding: '0.5rem 1.1rem', background: '#0F766E', border: 'none', borderRadius: '0.85rem', color: '#fff', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

export function AiSummaryBlock({ personId, t, locale }: { personId: string; t: T; locale: string }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })

  async function generate() {
    if (busy) return
    setBusy(true); setProblem(null)
    try {
      const res = await fetch(`${API}/api/therapist/pacientes/${personId}/resumen-ia`, { headers: { Authorization: `Bearer ${getToken()}` } })
      const body = await res.json().catch(() => ({})) as Partial<Summary> & { code?: string; resetsAt?: string }
      if (res.ok && typeof body.summary === 'string' && body.generatedAt) { setSummary(body as Summary); return }
      if (body.code === 'ai_budget_exhausted') setProblem({ key: body.resetsAt ? 'fu_ai_budget' : 'fu_ai_budget_nodate', params: body.resetsAt ? { date: day(body.resetsAt) } : undefined, retry: false })
      else if (body.code === 'ai_budget_not_configured') setProblem({ key: 'fu_ai_unavailable', retry: false })
      else if (res.status === 403) setProblem({ key: 'fu_err_access', retry: false })
      else setProblem({ key: 'fu_ai_error', retry: true })
    } catch { setProblem({ key: 'fu_ai_error', retry: true }) } finally { setBusy(false); window.setTimeout(() => (document.getElementById('fu-ai-retry') ?? button.current)?.focus(), 0) }
  }

  const noData = summary !== null && summary.basedOn.sessions === 0
  return (
    <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.75rem' }} aria-labelledby="fu-ai-title" aria-busy={busy}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 id="fu-ai-title" style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: 0 }}>{t('fu_ai')}</h2>
        <button ref={button} type="button" style={{ ...primary, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={() => void generate()}>
          {busy ? t('fu_ai_generating') : summary ? t('fu_ai_regenerate') : t('fu_ai_generate')}
        </button>
      </div>
      {summary && (
        <div>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#1C1917', lineHeight: 1.7, overflowWrap: 'anywhere' }}>{noData ? t('fu_ai_nodata') : summary.summary}</p>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#44403C' }}>{noData ? '' : t('fu_ai_label', { date: day(summary.generatedAt), n: summary.basedOn.sessions })}</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#44403C' }}>{t('fu_ai_hint')}</p>
        </div>
      )}
      <div role="alert" style={{ color: '#B91C1C', fontSize: '0.85rem' }}>
        {problem && <>
          <p style={{ margin: 0 }}>{t(problem.key, problem.params)}</p>
          {problem.retry && <button id="fu-ai-retry" type="button" style={{ ...primary, background: 'transparent', border: '0.5px solid #0F766E', color: '#0F766E', marginTop: '0.5rem' }} disabled={busy} onClick={() => void generate()}>{t('fu_ai_retry')}</button>}
        </>}
      </div>
    </section>
  )
}
