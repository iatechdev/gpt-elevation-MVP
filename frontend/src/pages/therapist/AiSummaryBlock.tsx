// ES-178 (F2): resumen con IA de la ficha. «Generado con IA · fecha · a partir de n registros de ánimo y valoraciones. No incluye tus notas.» (nunca «y n notas»: desde ES-79/102 las notas no se envían al proveedor),
// aviso de lectura automática (no es un diagnóstico), y errores por código: `ai_budget_exhausted` y `ai_budget_not_configured` NO se reintentan (con la fecha de reinicio cuando existe); el resto, con «Reintentar».
import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
  const section = useRef<HTMLElement>(null)
  const [announce, setAnnounce] = useState('') // E227-2: si el foco ya no está aquí, el resultado se anuncia sin moverlo
  const focusAfter = useRef(false) // E227-1: el foco se mueve DESPUÉS del pintado (efecto), no con un temporizador previo a él
  const limited = problem !== null && !problem.retry && problem.key !== 'fu_err_access' // límite de IA o IA no disponible: «Generar» no sirve hasta que cambie
  // E227 (a): la fecha de reinicio del límite se dice con la zona EXPLÍCITA (el servidor reinicia a las 00:00 UTC; en hora local confundía: en Bogotá decía «30 nov» cuando reinicia el 1 dic).
  const resetText = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC', timeZoneName: 'short' })
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })

  useEffect(() => {
    if (!focusAfter.current || busy) return
    focusAfter.current = false
    // E227-2: el foco solo se devuelve si sigue en este bloque (o en <body>, donde cae al deshabilitar algo); si la persona ya trabaja en otro control, no se le quita.
    const active = document.activeElement
    const stillHere = active === null || active === document.body || (section.current?.contains(active) ?? false)
    if (stillHere) (problem?.retry ? document.getElementById('fu-ai-retry') : button.current)?.focus()
    else if (!problem && summary) setAnnounce(t('fu_ai_done'))
  }, [busy, problem]) // eslint-disable-line react-hooks/exhaustive-deps -- solo al terminar una generación

  async function generate() {
    if (busy || limited) return
    focusAfter.current = true
    setBusy(true); setProblem(null); setAnnounce('')
    try {
      const res = await fetch(`${API}/api/therapist/pacientes/${personId}/resumen-ia`, { headers: { Authorization: `Bearer ${getToken()}` } })
      const body = await res.json().catch(() => ({})) as Partial<Summary> & { code?: string; resetsAt?: string }
      if (res.ok && typeof body.summary === 'string' && body.generatedAt) { setSummary(body as Summary); return }
      if (body.code === 'ai_budget_exhausted') setProblem({ key: body.resetsAt ? 'fu_ai_budget' : 'fu_ai_budget_nodate', params: body.resetsAt ? { date: resetText(body.resetsAt) } : undefined, retry: false })
      else if (body.code === 'ai_budget_not_configured') setProblem({ key: 'fu_ai_unavailable', retry: false })
      else if (res.status === 403) setProblem({ key: 'fu_err_access', retry: false })
      else setProblem({ key: 'fu_ai_error', retry: true })
    } catch { setProblem({ key: 'fu_ai_error', retry: true }) } finally { setBusy(false) }
  }

  const noData = summary !== null && summary.basedOn.sessions === 0
  return (
    <section ref={section} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.75rem' }} aria-labelledby="fu-ai-title" aria-busy={busy}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 id="fu-ai-title" style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: 0 }}>{t('fu_ai')}</h2>
        <button ref={button} id="fu-ai-button" type="button" style={{ ...primary, opacity: busy || limited ? 0.7 : 1 }} aria-disabled={busy || limited} aria-describedby={limited ? 'fu-ai-problem' : undefined} onClick={() => void generate()}>
          {busy ? t('fu_ai_generating') : summary ? t('fu_ai_regenerate') : t('fu_ai_generate')}
        </button>
      </div>
      <div role="status" className="sr-only">{announce}</div>
      {summary && (
        <div>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#1C1917', lineHeight: 1.7, overflowWrap: 'anywhere' }}>{noData ? t('fu_ai_nodata') : summary.summary}</p>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#44403C' }}>{noData ? '' : t('fu_ai_label', { date: day(summary.generatedAt), n: summary.basedOn.sessions })}</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#44403C' }}>{t('fu_ai_hint')}</p>
        </div>
      )}
      <div role="alert" style={{ color: '#B91C1C', fontSize: '0.85rem' }}>
        {problem && <>
          <p id="fu-ai-problem" style={{ margin: 0 }}>{t(problem.key, problem.params)}</p>
          {problem.retry && <button id="fu-ai-retry" type="button" style={{ ...primary, background: 'transparent', border: '0.5px solid #0F766E', color: '#0F766E', marginTop: '0.5rem' }} aria-disabled={busy} onClick={() => void generate()}>{t('fu_ai_retry')}</button>}
        </>}
      </div>
    </section>
  )
}
