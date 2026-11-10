// HU-046 + HU-049 + HU-062 + HU-065 + HU-067 + HU-082 + ES-177 — Panel profesional + i18n
// ES-177 (B1): Resumen, Próximas sesiones, Personas y Avisos son bloques con su propio estado (PanelSections.tsx); validación académica y guía para la IA: B2.

import { useState } from 'react'
import { useLanguage } from '../../i18n/useLanguage'
import { useSection } from './useSection'
import { AlertsBlock, PeopleBlock, SummaryBlock, UpcomingBlock, type AlertsData, type UpcomingSession } from './PanelSections'
import { cardStyle } from './panelStyles'
import type { PanelPerson } from './panelFormat'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''

interface PromptData {
  hasPrompt: boolean
  content: string | null
  active: {
    id: number
    version: number
    approved_by: string
    approved_at: string
  } | null
  pending: {
    id: number
    version: number
    proposed_by: string
    createdAt: string
  } | null
  rejected: {
    id: number
    version: number
    rejected_by: string
    rejection_note: string | null
    rejected_at: string
  } | null
}

interface ValidationDoc {
  id: number
  documentType: 'titulo' | 'certificado' | 'colegiado' | 'otro'
  documentName: string
  status: 'pending' | 'approved' | 'rejected'
  reviewNote: string | null
  submittedAt: string
  reviewedAt: string | null
}

export function TherapistDashboard() {
  const { t, lang } = useLanguage()
  const locale = lang === 'es' ? 'es-CO' : 'en-US'

  const people = useSection<PanelPerson[]>('/api/therapist/pacientes')
  const upcoming = useSection<UpcomingSession[]>('/api/sessions/therapist/upcoming')
  const alerts = useSection<AlertsData>('/api/therapist/alerts')
  const promptSection = useSection<PromptData>('/api/therapist/prompt')
  const validationSection = useSection<ValidationDoc[]>('/api/therapist/validation/status')
  const promptData = promptSection.data
  const promptLoading = promptSection.status === 'loading'
  const validations = validationSection.data ?? []

  const [showPromptSection, setShowPromptSection] = useState(false)
  const [showProposeModal, setShowProposeModal]   = useState(false)
  const [newPromptContent, setNewPromptContent]   = useState('')
  const [proposing, setProposing]                 = useState(false)
  const [proposeError, setProposeError]           = useState('')
  const [proposeSuccess, setProposeSuccess]       = useState('')

  const [showValidationSection, setShowValidationSection] = useState(false)
  const [uploadingDoc, setUploadingDoc]                   = useState(false)
  const [uploadMsg, setUploadMsg]                         = useState('')
  const [selectedDocType, setSelectedDocType]             = useState<string>('titulo')

  const handleProposePrompt = async () => {
    setProposeError('')
    setProposeSuccess('')
    if (newPromptContent.trim().length < 50) {
      setProposeError(t('board_error_min'))
      return
    }
    setProposing(true)
    try {
      const res = await fetch(`${API}/api/therapist/prompt/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: newPromptContent }),
      })
      const data = await res.json()
      if (!res.ok) { setProposeError(data.code === 'pending_exists' ? t('therapist_prompt_pending_exists') : (data.error || t('error_connection'))); return }
      setProposeSuccess(t('therapist_prompt_pending'))
      setNewPromptContent('')
      promptSection.reload({ silent: true })
      setTimeout(() => { setShowProposeModal(false); setProposeSuccess('') }, 2500)
    } catch {
      setProposeError(t('error_connection'))
    } finally {
      setProposing(false)
    }
  }

  const handleUploadDoc = async (file: File) => {
    setUploadingDoc(true)
    setUploadMsg('')
    try {
      const formData = new FormData()
      formData.append('document', file)
      formData.append('documentType', selectedDocType)
      const res = await fetch(`${API}/api/therapist/validation/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) return setUploadMsg(data.error ?? t('error_connection'))
      setUploadMsg(`✓ ${t('therapist_prompt_pending')}`)
      validationSection.reload({ silent: true })
    } catch {
      setUploadMsg(t('error_connection'))
    } finally {
      setUploadingDoc(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      <header>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, fontSize: '1.8rem', color: '#1C1917', margin: 0 }}>
          {t('panel_title')}
        </h1>
      </header>

      <SummaryBlock state={people} t={t} locale={locale} />
      <UpcomingBlock state={upcoming} t={t} locale={locale} />

      <div className="th-two-col">
        <PeopleBlock state={people} upcoming={upcoming.data ?? []} t={t} locale={locale} />
        <div className="th-sticky">
          <AlertsBlock state={alerts} t={t} />
        </div>
      </div>

      {/* VALIDACIÓN ACADÉMICA */}
      <div style={{ ...cardStyle, marginBottom: '2rem' }}>
        {validationSection.status === 'error' ? (
          <div role="alert" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: '#B91C1C' }}>{t('panel_section_error')}</span>
            <button type="button" onClick={() => validationSection.reload()} style={{ padding: '0.45rem 0.85rem', background: 'transparent', border: '0.5px solid #4A6741', borderRadius: '0.65rem', fontSize: '0.82rem', color: '#4A6741', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{t('panel_retry')}</button>
          </div>
        ) : <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#57534E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🎓 {t('therapist_patient_history')}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#1C1917', marginTop: '0.2rem' }}>
              {validations.length === 0
                ? t('therapist_no_alerts')
                : validations.some(v => v.status === 'approved')
                  ? `✅ ${t('admin_approve')}`
                  : validations.some(v => v.status === 'pending')
                    ? `⏳ ${t('admin_pending')}`
                    : `❌ ${t('therapist_re_propose')}`}
            </div>
          </div>
          <button
            onClick={() => setShowValidationSection(!showValidationSection)}
            style={{ padding: '0.45rem 0.85rem', background: 'transparent', border: '0.5px solid #E7E5E4', borderRadius: '0.65rem', fontSize: '0.78rem', color: '#57534E', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            {showValidationSection ? t('admin_hide_content') : t('admin_view_active_content')}
          </button>
        </div>

        {showValidationSection && (
          <div style={{ marginTop: '1.25rem' }}>
            {validations.length > 0 && (
              <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {validations.map(v => (
                  <div key={v.id} style={{
                    padding: '0.75rem 1rem', borderRadius: '0.65rem',
                    background: v.status === 'approved' ? '#EAF0E6' : v.status === 'rejected' ? '#FEE2E2' : '#FEF9C3',
                    border: `0.5px solid ${v.status === 'approved' ? '#A8B5A2' : v.status === 'rejected' ? '#FCA5A5' : '#FDE68A'}`,
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#1C1917' }}>{v.documentName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#57534E', marginTop: '0.15rem' }}>
                        {v.documentType} · {new Date(v.submittedAt).toLocaleDateString(locale)}
                      </div>
                      {v.reviewNote && (
                        <div style={{ fontSize: '0.72rem', color: '#57534E', marginTop: '0.25rem', fontStyle: 'italic' }}>
                          {v.reviewNote}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap',
                      padding: '0.15rem 0.6rem', borderRadius: 999,
                      background: v.status === 'approved' ? '#4A6741' : v.status === 'rejected' ? '#DC2626' : '#92400E',
                      color: '#fff',
                    }}>
                      {v.status === 'approved'
                        ? t('admin_approve')
                        : v.status === 'rejected'
                          ? t('admin_reject')
                          : t('admin_pending')}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!validations.some(v => v.status === 'approved') && (
              <div style={{ padding: '1rem', background: '#F5F3EF', borderRadius: '0.65rem' }}>
                <p style={{ fontSize: '0.82rem', color: '#57534E', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                  {t('therapist_dashboard_subtitle')}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#57534E', display: 'block', marginBottom: 4 }}>
                      {t('admin_col_role')}
                    </label>
                    <select
                      value={selectedDocType}
                      onChange={e => setSelectedDocType(e.target.value)}
                      style={{ padding: '0.5rem 0.75rem', borderRadius: '0.65rem', border: '0.5px solid #D6D2C4', fontSize: '0.82rem', fontFamily: 'Inter, sans-serif', color: '#1C1917', outline: 'none' }}>
                      <option value="titulo">Título profesional</option>
                      <option value="certificado">Certificado</option>
                      <option value="colegiado">Número de colegiado</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <label style={{
                    padding: '0.5rem 1rem',
                    background: uploadingDoc ? '#A8B5A2' : '#4A6741',
                    color: '#fff', borderRadius: '0.65rem', fontSize: '0.82rem', fontWeight: 500,
                    cursor: uploadingDoc ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
                  }}>
                    {uploadingDoc ? t('therapist_generating') : `📎 ${t('therapist_save_note_btn')}`}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      style={{ display: 'none' }}
                      disabled={uploadingDoc}
                      onChange={e => { if (e.target.files?.[0]) handleUploadDoc(e.target.files[0]) }}
                    />
                  </label>
                </div>
                {uploadMsg && (
                  <p style={{ fontSize: '0.78rem', color: uploadMsg.startsWith('✓') ? '#4A6741' : '#DC2626', margin: '0.75rem 0 0' }}>
                    {uploadMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        </>}
      </div>

      {/* MY THERAPEUTIC PROMPT */}
      {!promptLoading && (
        <div style={{ ...cardStyle, marginBottom: '2rem' }}>
        {promptSection.status === 'error' ? (
          <div role="alert" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: '#B91C1C' }}>{t('panel_section_error')}</span>
            <button type="button" onClick={() => promptSection.reload()} style={{ padding: '0.45rem 0.85rem', background: 'transparent', border: '0.5px solid #4A6741', borderRadius: '0.65rem', fontSize: '0.82rem', color: '#4A6741', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{t('panel_retry')}</button>
          </div>
        ) : <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#57534E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('therapist_prompt')}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#1C1917', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {promptData?.active
                  ? `v${promptData.active.version} — ${formatDate(promptData.active.approved_at)}`
                  : t('therapist_no_prompt')}
                {promptData?.pending && (
                  <span style={{ fontSize: '0.72rem', background: '#FEF3C7', color: '#92400E', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                    {t('therapist_prompt_pending')}
                  </span>
                )}
                {promptData?.rejected && !promptData?.active && !promptData?.pending && (
                  <span style={{ fontSize: '0.72rem', background: '#FEE2E2', color: '#B91C1C', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                    {t('therapist_prompt_rejected')}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {promptData?.active && (
                <button
                  onClick={() => setShowPromptSection(!showPromptSection)}
                  style={{ padding: '0.45rem 0.85rem', background: 'transparent', border: '0.5px solid #E7E5E4', borderRadius: '0.65rem', fontSize: '0.78rem', color: '#57534E', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {showPromptSection ? t('admin_hide_content') : t('therapist_view_current')}
                </button>
              )}
              {!promptData?.pending && (
                <button
                  onClick={() => { setShowProposeModal(true); setNewPromptContent(promptData?.content ?? '') }}
                  style={{ padding: '0.45rem 0.85rem', background: '#4A6741', border: 'none', borderRadius: '0.65rem', fontSize: '0.78rem', color: '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                  {promptData?.hasPrompt ? t('therapist_propose_prompt') : t('therapist_create_prompt')}
                </button>
              )}
            </div>
          </div>

          {promptData?.rejected && !promptData?.active && !promptData?.pending && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: '#FEE2E2', border: '0.5px solid #FCA5A5', borderRadius: '0.65rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#B91C1C', marginBottom: '0.25rem' }}>
                {t('therapist_prompt_rejected')} v{promptData.rejected.version} — {promptData.rejected.rejected_by}
              </div>
              {promptData.rejected.rejection_note && (
                <div style={{ fontSize: '0.75rem', color: '#B91C1C', fontStyle: 'italic', marginBottom: '0.35rem' }}>
                  "{promptData.rejected.rejection_note}"
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: '#4A6741', fontWeight: 500 }}>
                {t('therapist_re_propose')}
              </div>
            </div>
          )}

          {showPromptSection && promptData?.content && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#F5F3EF', borderRadius: '0.65rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#1C1917', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                {promptData.content}
              </p>
            </div>
          )}
        </>}
        </div>
      )}

      {/* PROPOSE PROMPT MODAL */}
      {showProposeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: 560, boxShadow: '0 8px 32px rgba(26,28,27,0.12)', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: 0 }}>
                {promptData?.hasPrompt ? t('therapist_propose_prompt') : t('therapist_create_prompt')}
              </h2>
              <button
                onClick={() => { setShowProposeModal(false); setProposeError(''); setProposeSuccess('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#57534E' }}
              >✕</button>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#57534E', marginBottom: '1rem', lineHeight: 1.5 }}>
              {t('admin_prompt_info_body')}
            </p>

            {proposeError   && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.875rem', marginBottom: '1rem' }}>{proposeError}</div>}
            {proposeSuccess && <div style={{ background: '#EAF0E6', color: '#4A6741', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.875rem', marginBottom: '1rem' }}>{proposeSuccess}</div>}

            <textarea
              value={newPromptContent}
              onChange={e => setNewPromptContent(e.target.value)}
              placeholder="You are a therapeutic companion specialized in mindfulness and emotional regulation..."
              rows={8}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '0.65rem',
                border: '0.5px solid #E7E5E4', fontSize: '0.875rem',
                fontFamily: 'Inter, sans-serif', color: '#1C1917',
                boxSizing: 'border-box', outline: 'none', resize: 'vertical', lineHeight: 1.6,
              }}
            />
            <div style={{ fontSize: '0.72rem', color: '#A8B5A2', marginTop: '0.35rem', marginBottom: '1.25rem' }}>
              {newPromptContent.length} {t('admin_char_count')} {newPromptContent.length < 50 ? '(min 50)' : '✓'}
            </div>

            <button
              onClick={handleProposePrompt}
              disabled={proposing}
              style={{
                width: '100%', padding: '0.75rem',
                background: proposing ? '#A8B5A2' : '#4A6741',
                color: '#fff', border: 'none', borderRadius: '0.85rem',
                fontSize: '0.9rem', fontWeight: 500,
                cursor: proposing ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              {proposing ? t('admin_sending') : t('admin_send_approval')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}