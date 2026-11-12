// HU-046 + HU-050 + HU-067 + HU-082 — Patient history + clinical notes + AI summary + schedule + i18n
// HU-076 — Design system tokens

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { colors, spacing, typography } from '../../styles/tokens'
import { useLanguage } from '../../i18n/useLanguage'
import { AiSummaryBlock } from './AiSummaryBlock'
import { ScheduleSession } from './ScheduleSession'
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

          <ScheduleSession personId={String(id)} personName={patient.name} t={t} locale={locale} />
        </div>
      </div>

      {/* CIFRAS (ES-178 F1) */}
      <div style={{ marginBottom: spacing.xxl }}>
        <FiguresBlock moodLogs={moodLogs} ratings={ratings} notesCount={notes.length} t={t} locale={locale} />
      </div>

      {/* RESUMEN CON IA (ES-178 F2) */}
      <div style={{ marginBottom: spacing.lg }}>
        <AiSummaryBlock personId={String(id)} t={t} locale={locale} />
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

    </div>
  )
}