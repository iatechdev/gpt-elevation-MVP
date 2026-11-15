// ES-177 (B2): guía para la IA del profesional. Versión activa, propuesta en revisión («mientras tanto sigue activa la versión anterior»), rechazada con nota; diálogo nativo (foco atrapado, Esc),
// recordatorio no clínico, contador «n / mínimo 50», el texto se conserva si falla y los errores salen por código en ES/EN (nunca el texto en inglés del servidor).
// ES-309 (PR 1): en Cartografía (Banner, Button, Dialog, TextAreaField, tokens --cg-*); sin estilos en línea. El diálogo nativo pasa al Dialog compartido (mismo foco, Tab, Esc y retorno del foco). Ni la lógica ni los textos cambian.
import { useEffect, useRef, useState } from 'react'
import { Banner, Button, Dialog, TextAreaField } from '../../cartografia'
import { PanelBlock } from './PanelSections'
import type { SectionState } from './useSection'
import { enterAgain } from './sessionEnter'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''
const MIN_GUIDE_CHARS = 50

export interface PromptData {
  hasPrompt: boolean
  content: string | null
  active: { id: number; version: number; approved_by: string; approved_at: string } | null
  pending: { id: number; version: number; proposed_by: string; createdAt: string } | null
  rejected: { id: number; version: number; rejected_by: string; rejection_note: string | null; rejected_at: string } | null
}
type T = (key: string, params?: Record<string, string | number>) => string
type Reason = { code?: string; es?: string; en?: string }

const ERROR_BY_CODE: Record<string, string> = { pending_exists: 'therapist_prompt_pending_exists', prompt_rules_unavailable: 'panel_gp_rules', rate_limited: 'panel_gp_rate' }

export function GuideBlock({ state, t, locale, lang }: { state: SectionState<PromptData>; t: T; locale: string; lang: 'es' | 'en' }) {
  const data = state.data
  const [showActive, setShowActive] = useState(false)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ key: string; reasons: Reason[]; check?: boolean; enter?: boolean } | null>(null)
  const enterButton = useRef<HTMLButtonElement>(null)
  const usedToken = useRef('') // ES-285: token con que se envió, para no cerrar un inicio de sesión más nuevo
  const [sent, setSent] = useState(false)
  const [touched, setTouched] = useState(false) // E218-2: lo escrito se conserva al cerrar (Esc, Cancelar) y reabrir; solo se descarta al enviar con éxito
  const before = useRef<{ pending: number | null; rejected: number | null }>({ pending: null, rejected: null })
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })

  // E243-1: al aparecer el aviso de sesión vencida el botón «Enviar» queda desactivado y el foco caía a body: pasa a «Entrar» (sin quitárselo a quien ya se movió a otro control).
  useEffect(() => {
    if (!error?.enter) return
    const active = document.activeElement
    if (active === null || active === document.body || document.querySelector('dialog.cg-dialog[open]')?.contains(active)) enterButton.current?.focus()
  }, [error])
  const close = () => { setOpen(false); setError(null) } // el Dialog devuelve el foco al botón que lo abrió
  const start = () => { if (!touched) setText(data?.content ?? ''); setError(null); setSent(false); setOpen(true) }
  const done = () => { setSent(true); setTouched(false); setText(''); close(); state.reload({ silent: true }) }

  // E218-3: si la respuesta se pierde (corte de red o 5xx) el servidor pudo guardar. Se relee la guía: una propuesta pendiente nueva = enviada; un rechazo nuevo = ya está registrado
  // (se muestra en el bloque); si no se puede saber, «Sin confirmar» con «Comprobar» (nunca se reenvía a ciegas).
  async function reconcile() {
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/therapist/prompt`, { headers: { Authorization: `Bearer ${getToken()}` } })
      if (res.status === 401) { setError({ key: 'session_expired_guide', reasons: [], enter: true }); return }
      if (!res.ok) throw new Error(String(res.status))
      const fresh = await res.json() as PromptData
      if (fresh.pending && fresh.pending.id !== before.current.pending) { done(); return }
      if (fresh.rejected && fresh.rejected.id !== before.current.rejected && !fresh.pending) { setTouched(false); close(); state.reload({ silent: true }); return }
      setError({ key: 'panel_gp_unsure', reasons: [], check: true })
    } catch { setError({ key: 'panel_gp_unsure', reasons: [], check: true }) } finally { setBusy(false) }
  }

  async function send() {
    if (busy) return
    if (text.trim().length < MIN_GUIDE_CHARS) { setError({ key: 'panel_gp_short', reasons: [] }); return }
    setBusy(true); setError(null)
    before.current = { pending: data?.pending?.id ?? null, rejected: data?.rejected?.id ?? null }
    let lost = false
    try {
      const token = getToken(); usedToken.current = token
      const res = await fetch(`${API}/api/therapist/prompt/propose`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: text }) })
      const body = await res.json().catch(() => ({})) as { code?: string; reasons?: Reason[] }
      if (res.ok) { done(); return }
      if (res.status === 401) setError({ key: 'session_expired_guide', reasons: [], enter: true }) // ES-285: sesión vencida con la propuesta escrita → aviso con «Entrar»
      else if (res.status === 403) setError({ key: 'panel_action_forbidden', reasons: [] })
      else if (res.status >= 500 && !ERROR_BY_CODE[String(body.code)]) lost = true // 503 «reglas no disponibles» es una respuesta conocida, no una pérdida
      else if (body.code === 'prompt_rejected' || body.code === 'prompt_review_failed') setError({ key: 'panel_gp_prompt_rejected', reasons: Array.isArray(body.reasons) ? body.reasons : [] })
      else setError({ key: ERROR_BY_CODE[String(body.code)] ?? (res.status === 400 ? 'panel_gp_short' : 'panel_gp_error'), reasons: [] })
    } catch { lost = true } finally { setBusy(false) }
    if (lost) await reconcile()
  }

  const pending = data?.pending ?? null
  // E218-1: un rechazo más nuevo que la versión activa se muestra aunque haya guía activa (y mientras no haya una propuesta pendiente).
  const rejected = data?.rejected && !pending && (!data.active || data.rejected.version > data.active.version) ? data.rejected : null
  return (
    <PanelBlock id="panel-guide" title={t('panel_guide')} state={state} t={t}>
      <p className="tp-strong">
        {data?.active ? t('panel_guide_active', { v: data.active.version, date: date(data.active.approved_at) }) : t('panel_guide_none')}
      </p>
      {pending && (
        <p className="tp-facts">
          <strong>{t('panel_guide_pending', { v: pending.version })}</strong>{data?.active && <> {t('panel_guide_prev')}</>}
        </p>
      )}
      {rejected && (
        <div className="cg-banner cg-banner--error">
          <strong className="cg-banner__title">{t('panel_guide_rejected', { v: rejected.version })}</strong>
          {rejected.rejection_note && <p className="tp-facts">{t('panel_val_note')}: {rejected.rejection_note}</p>}
          <p className="tp-facts">{t('panel_guide_retry')}</p>
        </div>
      )}
      {sent && <p role="status" className="tp-live tp-live--ok">{t('panel_guide_sent')}</p>}
      <div className="cg-row">
        {data?.active && data.content && <Button variant="ghost" aria-expanded={showActive} onClick={() => setShowActive(v => !v)}>{showActive ? t('panel_guide_hide') : t('panel_guide_view')}</Button>}
        {!pending && <Button onClick={start}>{data?.hasPrompt ? t('panel_guide_propose') : t('panel_guide_create')}</Button>}
      </div>
      {showActive && data?.content && <p className="tp-quote">{data.content}</p>}

      <Dialog
        open={open}
        onClose={close}
        title={data?.hasPrompt ? t('panel_guide_propose') : t('panel_guide_create')}
        actions={<>
          <Button variant="ghost" onClick={close} disabled={busy}>{t('panel_guide_cancel')}</Button>
          <Button type="submit" form="panel-guide-form" disabled={busy}>{busy ? t('panel_guide_sending') : t('panel_guide_send')}</Button>
        </>}
      >
        <form id="panel-guide-form" className="tp-dlg-form" onSubmit={event => { event.preventDefault(); void send() }}>
          <Banner title={t('panel_guide_reminder')} />
          <TextAreaField id="panel-guide-text" label={t('panel_guide_field')} value={text} rows={8} aria-describedby="panel-guide-counter panel-guide-error" onChange={event => { setText(event.target.value); setTouched(true) }} />
          <p id="panel-guide-counter" className="tp-counter">{t('panel_guide_counter', { n: text.trim().length, min: MIN_GUIDE_CHARS })}</p>
          <div id="panel-guide-error" role="alert" className="tp-dlg-error">
            {error && <>
              <p>{t(error.key)}</p>
              {error.enter && <button ref={enterButton} type="button" className="cg-btn cg-btn--ghost" onClick={() => { if (!enterAgain(usedToken.current)) { setError({ key: 'session_renewed', reasons: [] }); window.setTimeout(() => document.getElementById('panel-guide-text')?.focus(), 0) } }} /* O247-B: el botón desaparece; el foco va al cuadro donde se vuelve a enviar */>{t('session_enter')}</button>}
              {error.check && <Button variant="ghost" disabled={busy} onClick={() => void reconcile()}>{t('panel_gp_check')}</Button>}
              {error.reasons.length > 0 && <ul className="tp-reasons">{error.reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>{reason[lang] ?? reason.code}</li>)}</ul>}
            </>}
          </div>
        </form>
      </Dialog>
    </PanelBlock>
  )
}
