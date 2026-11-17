// ES-178 (F2): resumen con IA de la ficha. «Generado con IA · fecha · a partir de n registros de ánimo y valoraciones. No incluye tus notas.» (nunca «y n notas»: desde ES-79/102 las notas no se envían al proveedor),
// ES-309 (PR 2): en Cartografía (cg-card, Button, tokens --cg-*); sin estilos en línea. Ni la lógica ni los textos cambian.
// aviso de lectura automática (no es un diagnóstico), y errores por código: `ai_budget_exhausted` y `ai_budget_not_configured` NO se reintentan (con la fecha de reinicio cuando existe); el resto, con «Reintentar».
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../cartografia'
import { invalidateStoredSession } from '../../access/session'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''
type T = (key: string, params?: Record<string, string | number>) => string
interface Summary { summary: string; generatedAt: string; basedOn: { sessions: number } }
type Problem = { key: string; params?: Record<string, string | number>; retry: boolean }


export function AiSummaryBlock({ personId, t, locale }: { personId: string; t: T; locale: string }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
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
    if (stillHere) document.getElementById(problem?.retry ? 'fu-ai-retry' : 'fu-ai-button')?.focus()
    else if (!problem && summary) setAnnounce(t('fu_ai_done'))
  }, [busy, problem]) // eslint-disable-line react-hooks/exhaustive-deps -- solo al terminar una generación

  async function generate() {
    if (busy || limited) return
    focusAfter.current = true
    setBusy(true); setProblem(null); setAnnounce('')
    try {
      const token = getToken()
      const res = await fetch(`${API}/api/therapist/pacientes/${personId}/resumen-ia`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 401) { invalidateStoredSession(token); return } // ES-265
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
    <section ref={section} className="cg-card pf-block" aria-labelledby="fu-ai-title" aria-busy={busy}>
      <div className="pf-aihead">
        <h2 id="fu-ai-title">{t('fu_ai')}</h2>
        <Button id="fu-ai-button" aria-disabled={busy || limited} aria-describedby={limited ? 'fu-ai-problem' : undefined} onClick={() => void generate()}>
          {busy ? t('fu_ai_generating') : summary ? t('fu_ai_regenerate') : t('fu_ai_generate')}
        </Button>
      </div>
      <div role="status" className="cg-sr">{announce}</div>
      {summary && (
        <div>
          <p className="pf-summary">{noData ? t('fu_ai_nodata') : summary.summary}</p>
          <p className="pf-small">{noData ? '' : t('fu_ai_label', { date: day(summary.generatedAt), n: summary.basedOn.sessions })}</p>
          <p className="pf-small">{t('fu_ai_hint')}</p>
        </div>
      )}
      <div role="alert" className="pf-alert">
        {problem && <>
          <p id="fu-ai-problem">{t(problem.key, problem.params)}</p>
          {problem.retry && <Button id="fu-ai-retry" variant="ghost" aria-disabled={busy} onClick={() => void generate()}>{t('fu_ai_retry')}</Button>}
        </>}
      </div>
    </section>
  )
}
