// ES-177 (B2): validación académica del profesional. Estado en palabras (sin emojis), aviso de datos personales, etiquetas visibles (sin `display:none`) y errores de la subida por código en ES/EN.
// ES-309 (PR 1): en Cartografía (Banner, Chip, SelectField, Button, tokens --cg-*); sin estilos en línea. Ni la lógica ni los textos cambian.
import { useEffect, useRef, useState } from 'react'
import { Banner, Button, Chip, SelectField, type ChipTone } from '../../cartografia'
import { PanelBlock } from './PanelSections'
import type { SectionState } from './useSection'
import { enterAgain } from './sessionEnter'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''

export interface ValidationDoc {
  id: number
  documentType: 'titulo' | 'certificado' | 'colegiado' | 'otro'
  documentName: string
  status: 'pending' | 'approved' | 'rejected'
  reviewNote: string | null
  submittedAt: string
  reviewedAt: string | null
}
type T = (key: string, params?: Record<string, string | number>) => string

const UPLOAD_ERRORS = ['unsupported_file_type', 'file_too_large', 'file_content_mismatch', 'empty_file', 'no_file', 'invalid_upload', 'storage_unavailable']
const STATUS_KEY = { approved: 'panel_val_approved', pending: 'panel_val_pending', rejected: 'panel_val_rejected' } as const
// El estado va en un chip con su palabra («Aprobada» / «En revisión» / «Rechazada»): nunca solo color y sin emojis.
const STATUS_TONE: Record<ValidationDoc['status'], ChipTone> = { approved: 'ok', pending: 'wait', rejected: 'bad' }

export function ValidationBlock({ state, t, locale }: { state: SectionState<ValidationDoc[]>; t: T; locale: string }) {
  const docs = state.data ?? []
  const approved = docs.some(d => d.status === 'approved')
  const summary = docs.length === 0 ? t('panel_val_none') : approved ? t('panel_val_approved') : docs.some(d => d.status === 'pending') ? t('panel_val_pending') : t('panel_val_rejected')
  const [docType, setDocType] = useState<ValidationDoc['documentType']>('titulo')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; failed: boolean; enter?: boolean } | null>(null)
  const usedToken = useRef('') // ES-285
  const enterButton = useRef<HTMLButtonElement>(null)
  // E243-1: al aparecer el aviso el botón de subir queda desactivado y el foco caía a body: pasa a «Entrar» (sin quitárselo a quien ya se movió a otro control).
  useEffect(() => {
    if (!message?.enter) return
    const active = document.activeElement
    if (active === null || active === document.body || enterButton.current?.closest('form')?.contains(active)) enterButton.current?.focus()
  }, [message])
  const input = useRef<HTMLInputElement>(null)

  async function upload() {
    if (busy) return
    if (!file) { setMessage({ text: t('panel_val_pick'), failed: true }); input.current?.focus(); return }
    setBusy(true); setMessage(null)
    try {
      const form = new FormData(); form.append('document', file); form.append('documentType', docType)
      const token = getToken(); usedToken.current = token
      const res = await fetch(`${API}/api/therapist/validation/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
      if (res.status === 401) { setMessage({ text: t('session_expired_file'), failed: true, enter: true }); return } // ES-285: sesión vencida → aviso con «Entrar»
      if (res.status === 403) { setMessage({ text: t('panel_action_forbidden'), failed: true }); return }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { code?: string }
        setMessage({ text: t(UPLOAD_ERRORS.includes(String(body.code)) ? `panel_up_${body.code}` : 'panel_up_error'), failed: true })
        return
      }
      setFile(null); if (input.current) input.current.value = ''
      setMessage({ text: t('panel_val_uploaded'), failed: false }); state.reload({ silent: true })
    } catch { setMessage({ text: t('panel_up_error'), failed: true }) } finally { setBusy(false) }
  }

  return (
    <PanelBlock id="panel-validation" title={t('panel_validation')} state={state} t={t}>
      <p className="tp-strong">{summary}</p>
      {docs.length > 0 && (
        <ul className="cg-items tp-docs">
          {docs.map(d => (
            <li key={d.id} className="cg-item">
              <p className="tp-name">{d.documentName} — <Chip tone={STATUS_TONE[d.status]}>{t(STATUS_KEY[d.status])}</Chip></p>
              <p className="tp-facts">{t(`panel_doc_${d.documentType}`)} · {new Date(d.submittedAt).toLocaleDateString(locale)}</p>
              {d.reviewNote && <p className="tp-facts">{t('panel_val_note')}: {d.reviewNote}</p>}
            </li>
          ))}
        </ul>
      )}
      {!approved && (
        <form className="tp-form" onSubmit={event => { event.preventDefault(); void upload() }}>
          <Banner title={t('panel_val_privacy')} />
          <SelectField label={t('panel_val_type')} value={docType} onChange={event => setDocType(event.target.value as ValidationDoc['documentType'])}>
            {(['titulo', 'certificado', 'colegiado', 'otro'] as const).map(type => <option key={type} value={type}>{t(`panel_doc_${type}`)}</option>)}
          </SelectField>
          <div className="cg-field">
            <label className="cg-label" htmlFor="panel-val-file">{t('panel_val_file')}</label>
            <input id="panel-val-file" ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="cg-input" onChange={event => { setFile(event.target.files?.[0] ?? null); setMessage(null) }} />
          </div>
          <div className="cg-row"><Button type="submit" disabled={busy}>{busy ? t('panel_val_uploading') : t('panel_val_upload')}</Button></div>
          <p role={message?.failed ? 'alert' : 'status'} className={message ? `tp-live ${message.failed ? 'tp-live--bad' : 'tp-live--ok'}` : 'tp-live'}>{message?.text ?? ''}</p>
          {message?.enter && <div><button ref={enterButton} type="button" className="cg-btn cg-btn--ghost" onClick={event => { if (!enterAgain(usedToken.current)) { const submit = event.currentTarget.closest('form')?.querySelector<HTMLButtonElement>('button[type="submit"]'); setMessage({ text: t('session_renewed'), failed: true }); window.setTimeout(() => submit?.focus(), 0) } }} /* O247-B: el botón desaparece; el foco va a «Subir documento» */>{t('session_enter')}</button></div>}
        </form>
      )}
    </PanelBlock>
  )
}
