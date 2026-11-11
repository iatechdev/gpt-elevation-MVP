// HU-046 + HU-050 + HU-067 + HU-082 — Patient history + clinical notes + AI summary + schedule + i18n
// HU-076 — Design system tokens

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  colors, radius, shadow, spacing, typography,
  labelStyle,
  btnPrimaryStyle, btnSecondaryStyle,
} from '../../styles/tokens'
import { useLanguage } from '../../i18n/useLanguage'
import { localizeServerError } from '../../i18n/serverError'
import { FollowupNotes, type FollowupNote } from './FollowupNotes'
import { FiguresBlock, MoodHistoryBlock, RatingsBlock } from './FollowupHistory'
import type { MoodRow, RatingRow } from './followupFormat'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''

interface Patient {
  id: number
  name: string
  email: string
  createdAt: string
}

interface AISummary {
  summary: string
  generatedAt: string
  basedOn: { sessions: number; notes: number }
}

const minDateTime = () => {
  const d = new Date(Date.now() + 5 * 60 * 1000)
  return d.toISOString().slice(0, 16)
}

// ── Estilos locales usando tokens ─────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background:   colors.bgMuted,
  borderRadius: radius.lg,
  border:       `0.5px solid ${colors.borderLight}`,
  boxShadow:    shadow.card,
  padding:      `${spacing.lg} ${spacing.xl}`,
}

const inputStyle: React.CSSProperties = {
  width:        '100%',
  padding:      `${spacing.md} ${spacing.md}`,
  border:       `0.5px solid ${colors.borderLight}`,
  borderRadius: radius.md,
  fontSize:     13,
  fontFamily:   typography.fontBody,
  color:        colors.text,
  outline:      'none',
  boxSizing:    'border-box' as const,
  background:   colors.bgCard,
}

export function TherapistPatient() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const locale = lang === 'es' ? 'es-CO' : 'en-US'

  const [patient,  setPatient]  = useState<Patient | null>(null)
  const [moodLogs, setMoodLogs] = useState<MoodRow[]>([])
  const [ratings,  setRatings]  = useState<RatingRow[]>([])
  const [notes,    setNotes]    = useState<FollowupNote[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [notShared, setNotShared] = useState(false) // ES-96: la persona no autorizó compartir (403 consent_required)

  // AI Summary
  const [aiSummary,         setAiSummary]        = useState<AISummary | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [summaryError,      setSummaryError]      = useState('')

  // Note form
  const [showSchedule,    setShowSchedule]    = useState(false)
  const [schedDateTime,   setSchedDateTime]   = useState(minDateTime())
  const [schedDuration,   setSchedDuration]   = useState(50)
  const [schedulingError, setSchedulingError] = useState('')
  const [schedulingOk,    setSchedulingOk]    = useState('')
  const [scheduling,      setScheduling]      = useState(false)

  const handleSchedule = async () => {
    setSchedulingError('')
    setSchedulingOk('')
    if (!schedDateTime) { setSchedulingError(t('therapist_select_datetime')); return }
    if (new Date(schedDateTime) <= new Date()) {
      setSchedulingError(t('therapist_future_date_error')); return
    }
    setScheduling(true)
    try {
      const res = await fetch(`${API}/api/sessions/therapist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          patientId:   Number(id),
          scheduledAt: new Date(schedDateTime).toISOString(),
          duration:    schedDuration,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSchedulingError(data.error || t('error_connection')); return }
      setSchedulingOk(`✓ ${new Date(schedDateTime).toLocaleString(locale, { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`)
      setSchedDateTime(minDateTime())
      setSchedDuration(50)
      setTimeout(() => { setShowSchedule(false); setSchedulingOk('') }, 2500)
    } catch {
      setSchedulingError(t('error_connection'))
    } finally {
      setScheduling(false)
    }
  }

  // Error copy does not determine which history is fetched. Keep it current without refetching on language changes.
  const historyError = useRef(t('therapist_not_found'))
  useEffect(() => { historyError.current = t('therapist_not_found') }, [t])

  const fetchHistory = useCallback(async () => {
    const loadError = historyError.current
    setNotShared(false)
    setError('')
    try {
      const res = await fetch(`${API}/api/therapist/pacientes/${id}/historia`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}))
        if (body.code === 'consent_required') { setNotShared(true); return }
      }
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPatient(data.patient)
      setMoodLogs(data.moodLogs)
      setRatings(data.ratings)
      setNotes(data.notes)
    } catch {
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void fetchHistory() }, [fetchHistory])

  // Releer sin tocar la pantalla (tras guardar una nota o para comprobar una respuesta perdida): si falla, devuelve null y NO sustituye la ficha por un error.
  const refreshHistory = useCallback(async (): Promise<FollowupNote[] | null> => {
    try {
      const res = await fetch(`${API}/api/therapist/pacientes/${id}/historia`, { headers: { Authorization: `Bearer ${getToken()}` } })
      if (!res.ok) return null
      const data = await res.json()
      setPatient(data.patient); setMoodLogs(data.moodLogs); setRatings(data.ratings); setNotes(data.notes)
      return data.notes as FollowupNote[]
    } catch { return null }
  }, [id])

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true)
    setSummaryError('')
    try {
      const res = await fetch(`${API}/api/therapist/pacientes/${id}/resumen-ia`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSummaryError(localizeServerError(body.error, lang, t('therapist_summary_error')))
        return
      }
      setAiSummary(await res.json())
    } catch { setSummaryError(t('therapist_summary_error')) }
    finally { setGeneratingSummary(false) }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })

  if (loading) return (
    <p role="status" style={{ color: colors.textMuted, fontSize: 13, fontFamily: typography.fontBody }}>
      {t('therapist_loading_history')}
    </p>
  )
  if (notShared) return (
    <div style={{ fontFamily: typography.fontBody }}>
      <div className="th-notice" role="note">
        <span aria-hidden="true">ℹ️</span>
        <span>{t('therapist_not_shared')}</span>
      </div>
      <button
        onClick={() => navigate('/therapist/dashboard')}
        style={{
          marginTop: spacing.lg, background: 'none', border: 'none', cursor: 'pointer',
          color: colors.textMuted, fontSize: 13, fontFamily: typography.fontBody, padding: 0,
        }}
      >
        ← {t('room_t_back')}
      </button>
    </div>
  )
  if (error) return (
    <p style={{ color: colors.danger, fontSize: 13, fontFamily: typography.fontBody }}>
      {error}
    </p>
  )
  if (!patient) return null

  return (
    <div style={{ fontFamily: typography.fontBody }}>

      {/* BACK + HEADER */}
      <div style={{ marginBottom: spacing.xxl }}>
        <button
          onClick={() => navigate('/therapist/dashboard')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textMuted, fontSize: 13,
            fontFamily: typography.fontBody, marginBottom: spacing.lg,
            display: 'flex', alignItems: 'center', gap: spacing.xs, padding: 0,
          }}
        >
          {t('therapist_back')}
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.lg }}>
          <div>
            <h1 style={{
              fontFamily: typography.fontDisplay, fontWeight: 300,
              fontSize: '1.8rem', color: colors.text, margin: 0,
            }}>
              {patient.name}
            </h1>
            <p style={{ fontSize: 13, color: colors.textMuted, margin: `${spacing.xs} 0 0` }}>
              {patient.email} · {t('therapist_member_since')} {formatDate(patient.createdAt)}
            </p>
          </div>

          <button
            onClick={() => { setShowSchedule(true); setSchedulingError(''); setSchedulingOk('') }}
            style={{
              ...btnPrimaryStyle,
              padding: `${spacing.md} ${spacing.xl}`,
              borderRadius: radius.lg,
              fontSize: 13,
              display: 'flex', alignItems: 'center', gap: spacing.xs,
            }}
          >
            {t('therapist_schedule_session')}
          </button>
        </div>
      </div>

      {/* CIFRAS (ES-178 F1) */}
      <div style={{ marginBottom: spacing.xxl }}>
        <FiguresBlock moodLogs={moodLogs} ratings={ratings} notesCount={notes.length} t={t} locale={locale} />
      </div>

      {/* AI CLINICAL SUMMARY */}
      <div style={{ ...cardStyle, marginBottom: spacing.lg }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: aiSummary ? spacing.lg : 0,
        }}>
          <div style={{ ...labelStyle }}>{t('therapist_ai_summary')}</div>
          <button
            onClick={handleGenerateSummary}
            disabled={generatingSummary}
            style={{
              ...btnPrimaryStyle,
              background: generatingSummary ? colors.textSubtle : '#0F766E',
              cursor: generatingSummary ? 'not-allowed' : 'pointer',
              fontSize: 12,
              padding: `${spacing.sm} ${spacing.md}`,
            }}
          >
            {generatingSummary
              ? t('therapist_generating')
              : aiSummary ? t('therapist_regenerate') : t('therapist_generate_summary')}
          </button>
        </div>
        {aiSummary && (
          <div>
            <p style={{
              fontSize: 14, color: colors.text, lineHeight: 1.7,
              margin: `0 0 ${spacing.sm}`,
              fontFamily: 'Noto Serif, serif', fontStyle: 'italic',
            }}>
              "{aiSummary.summary}"
            </p>
            <div style={{ fontSize: 11, color: colors.textSubtle }}>
              {t('rec_generated_at')} {formatDate(aiSummary.generatedAt)} · {aiSummary.basedOn.sessions} {t('therapist_sessions_unit')}
            </div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: spacing.xs }}>
              {t('therapist_summary_hint')}
            </div>
          </div>
        )}
        {summaryError && (
          <p role="alert" style={{ color: colors.danger, fontSize: 12, margin: `${spacing.sm} 0 0` }}>{summaryError}</p>
        )}
      </div>

      {/* NOTAS DE SEGUIMIENTO (ES-178 F1) */}
      <div style={{ marginBottom: spacing.lg }}>
        <FollowupNotes personId={String(id)} notes={notes} reload={refreshHistory} t={t} locale={locale} />
      </div>

      {/* HISTORIAL EMOCIONAL Y VALORACIONES (ES-178 F1) */}
      <div className="th-pair">
        <MoodHistoryBlock moodLogs={moodLogs} t={t} locale={locale} />
        <RatingsBlock ratings={ratings} t={t} locale={locale} />
      </div>

      {/* MODAL AGENDAR SESIÓN */}
      {showSchedule && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(28,25,23,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: colors.bgCard,
            borderRadius: radius.xl,
            padding: spacing.xxl,
            width: '100%', maxWidth: 440,
            boxShadow: shadow.modal,
            fontFamily: typography.fontBody,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
              <h2 style={{
                fontFamily: typography.fontDisplay, fontWeight: 400,
                fontSize: '1.3rem', color: colors.text, margin: 0,
              }}>
                {t('therapist_schedule_title')}
              </h2>
              <button
                onClick={() => { setShowSchedule(false); setSchedulingError(''); setSchedulingOk('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: colors.textMuted }}
              >✕</button>
            </div>

            <p style={{ fontSize: 13, color: colors.textMuted, margin: `0 0 ${spacing.xl}`, lineHeight: 1.5 }}>
              {t('therapist_schedule_with')} <strong style={{ color: colors.text }}>{patient.name}</strong>
            </p>

            <div style={{ marginBottom: spacing.lg }}>
              <label style={{ ...labelStyle, display: 'block', marginBottom: spacing.xs }}>
                {t('therapist_datetime_label')}
              </label>
              <input
                type="datetime-local"
                value={schedDateTime}
                min={minDateTime()}
                onChange={e => setSchedDateTime(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: spacing.xl }}>
              <label style={{ ...labelStyle, display: 'block', marginBottom: spacing.sm }}>
                {t('therapist_duration_label')}
              </label>
              <div style={{ display: 'flex', gap: spacing.sm }}>
                {[30, 45, 50, 60, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => setSchedDuration(d)}
                    style={{
                      flex: 1, padding: `${spacing.sm} ${spacing.xs}`,
                      border: schedDuration === d
                        ? `1.5px solid ${colors.primary}`
                        : `0.5px solid ${colors.border}`,
                      borderRadius: radius.md,
                      background: schedDuration === d ? colors.primaryLight : colors.bgCard,
                      color: schedDuration === d ? colors.primaryDark : colors.textMuted,
                      fontSize: 13,
                      fontWeight: schedDuration === d ? 600 : 400,
                      cursor: 'pointer',
                      fontFamily: typography.fontBody,
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {schedulingError && (
              <div style={{
                background: colors.dangerLight, color: colors.danger,
                padding: `${spacing.md} ${spacing.lg}`,
                borderRadius: radius.md, fontSize: 13,
                marginBottom: spacing.lg,
              }}>
                {schedulingError}
              </div>
            )}
            {schedulingOk && (
              <div style={{
                background: colors.successLight, color: colors.success,
                padding: `${spacing.md} ${spacing.lg}`,
                borderRadius: radius.md, fontSize: 13,
                marginBottom: spacing.lg,
              }}>
                {schedulingOk}
              </div>
            )}

            <div style={{ display: 'flex', gap: spacing.md }}>
              <button
                onClick={() => { setShowSchedule(false); setSchedulingError(''); setSchedulingOk('') }}
                style={{ ...btnSecondaryStyle, flex: 1, padding: spacing.md, borderRadius: radius.lg }}
              >
                {t('btn_cancel')}
              </button>
              <button
                onClick={handleSchedule}
                disabled={scheduling}
                style={{
                  ...btnPrimaryStyle,
                  flex: 2, padding: spacing.md, borderRadius: radius.lg,
                  background: scheduling ? colors.textSubtle : colors.primary,
                  cursor: scheduling ? 'not-allowed' : 'pointer',
                }}
              >
                {scheduling ? t('therapist_scheduling') : t('therapist_schedule_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}