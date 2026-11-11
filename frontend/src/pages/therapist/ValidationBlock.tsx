// ES-177 (B2): validación académica del profesional. Estado en palabras (sin emojis), aviso de datos personales, etiquetas visibles (sin `display:none`) y errores de la subida por código en ES/EN.
import { useRef, useState, type CSSProperties } from 'react'
import { PanelBlock } from './PanelSections'
import type { SectionState } from './useSection'

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
const field: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', color: '#44403C' }
const control: CSSProperties = { minHeight: 44, padding: '0.5rem 0.75rem', borderRadius: '0.65rem', border: '0.5px solid #78716C', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', color: '#1C1917', background: '#fff' }
const primary: CSSProperties = { minHeight: 44, minWidth: 44, padding: '0.5rem 1.1rem', background: '#4A6741', border: 'none', borderRadius: '0.85rem', color: '#fff', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

export function ValidationBlock({ state, t, locale }: { state: SectionState<ValidationDoc[]>; t: T; locale: string }) {
  const docs = state.data ?? []
  const approved = docs.some(d => d.status === 'approved')
  const summary = docs.length === 0 ? t('panel_val_none') : approved ? t('panel_val_approved') : docs.some(d => d.status === 'pending') ? t('panel_val_pending') : t('panel_val_rejected')
  const [docType, setDocType] = useState<ValidationDoc['documentType']>('titulo')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function upload() {
    if (busy) return
    if (!file) { setMessage({ text: t('panel_val_pick'), failed: true }); input.current?.focus(); return }
    setBusy(true); setMessage(null)
    try {
      const form = new FormData(); form.append('document', file); form.append('documentType', docType)
      const res = await fetch(`${API}/api/therapist/validation/upload`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: form })
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
      <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, color: '#1C1917' }}>{summary}</p>
      {docs.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {docs.map(d => (
            <li key={d.id} style={{ padding: '0.75rem 1rem', borderRadius: '0.65rem', background: '#F5F3EF', border: '0.5px solid #D6D3D1' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#1C1917', overflowWrap: 'anywhere' }}>{d.documentName} — <strong>{t(STATUS_KEY[d.status])}</strong></div>
              <div style={{ fontSize: '0.78rem', color: '#44403C', marginTop: 2 }}>{t(`panel_doc_${d.documentType}`)} · {new Date(d.submittedAt).toLocaleDateString(locale)}</div>
              {d.reviewNote && <div style={{ fontSize: '0.78rem', color: '#44403C', marginTop: 4, overflowWrap: 'anywhere' }}>{t('panel_val_note')}: {d.reviewNote}</div>}
            </li>
          ))}
        </ul>
      )}
      {!approved && (
        <form style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 420 }} onSubmit={event => { event.preventDefault(); void upload() }}>
          <p className="th-notice" style={{ margin: 0 }}>{t('panel_val_privacy')}</p>
          <label style={field}>{t('panel_val_type')}
            <select style={control} value={docType} onChange={event => setDocType(event.target.value as ValidationDoc['documentType'])}>
              {(['titulo', 'certificado', 'colegiado', 'otro'] as const).map(type => <option key={type} value={type}>{t(`panel_doc_${type}`)}</option>)}
            </select>
          </label>
          <label style={field}>{t('panel_val_file')}
            <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={control} onChange={event => { setFile(event.target.files?.[0] ?? null); setMessage(null) }} />
          </label>
          <div><button type="submit" style={{ ...primary, opacity: busy ? 0.7 : 1 }} disabled={busy}>{busy ? t('panel_val_uploading') : t('panel_val_upload')}</button></div>
          <p role={message?.failed ? 'alert' : 'status'} style={{ margin: 0, fontSize: '0.85rem', color: message?.failed ? '#B91C1C' : '#2F4A29' }}>{message?.text ?? ''}</p>
        </form>
      )}
    </PanelBlock>
  )
}
