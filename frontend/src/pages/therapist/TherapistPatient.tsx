// HU-046 + HU-050 + HU-067 + HU-082 — Patient history + clinical notes + AI summary + schedule + i18n
// HU-076 — Design system tokens
// ES-309 (PR 2): en Cartografía (cg-card, Figures, Banner, tokens --cg-*); sin estilos en línea. Ni los textos, ni la lógica, ni el servidor cambian.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../../cartografia/pages.css'
import './panel.css'
import './patient.css'
import { Banner, LinkButton } from '../../cartografia'
import { useLanguage } from '../../i18n/useLanguage'
import { invalidateStoredSession } from '../../access/session'
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
      const token = getToken()
      const res = await fetch(`${API}/api/therapist/pacientes/${id}/historia`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) { invalidateStoredSession(token); return } // ES-265: sesión vencida → /login
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
      const token = getToken()
      const res = await fetch(`${API}/api/therapist/pacientes/${id}/historia`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 401) { invalidateStoredSession(token); return null } // ES-265
      if (!res.ok) return null
      const data = await res.json()
      setPatient(data.patient); setMoodLogs(data.moodLogs); setRatings(data.ratings); setNotes(data.notes)
      return data.notes as FollowupNote[]
    } catch { return null }
  }, [id])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })

  // El estado de carga ocupa el mismo alto mínimo que la ficha (.pf): el pie no salta al llegar los datos (CLS <= 0,1 a 390 px con CPU×4).
  if (loading) return <div className="pf" aria-busy="true"><p role="status" className="tp-muted">{t('therapist_loading_history')}</p></div>
  if (notShared) return (
    <div className="pf">
      <Banner title={t('therapist_not_shared')} />
      <p className="pf-back"><LinkButton onClick={() => navigate('/therapist/dashboard')}>← {t('room_t_back')}</LinkButton></p>
    </div>
  )
  if (error) return <div className="pf"><Banner kind="error" title={error} /></div>
  if (!patient) return null

  return (
    <div className="pf">

      {/* VOLVER + CABECERA */}
      <div className="pf-head">
        <div>
          <p className="pf-back"><LinkButton onClick={() => navigate('/therapist/dashboard')}>{t('therapist_back')}</LinkButton></p>
          <h1 className="pg-title">{patient.name}</h1>
          <p className="tp-facts">{patient.email} · {t('therapist_member_since')} {formatDate(patient.createdAt)}</p>
        </div>
        <ScheduleSession personId={String(id)} personName={patient.name} t={t} locale={locale} />
      </div>

      {/* CIFRAS (ES-178 F1) */}
      <FiguresBlock moodLogs={moodLogs} ratings={ratings} notesCount={notes.length} t={t} locale={locale} />

      {/* RESUMEN CON IA (ES-178 F2) */}
      <AiSummaryBlock personId={String(id)} t={t} locale={locale} />

      {/* NOTAS DE SEGUIMIENTO (ES-178 F1) */}
      <FollowupNotes personId={String(id)} notes={notes} reload={refreshHistory} t={t} locale={locale} />

      {/* HISTORIAL EMOCIONAL Y VALORACIONES (ES-178 F1) */}
      <div className="pf-pair">
        <MoodHistoryBlock moodLogs={moodLogs} t={t} locale={locale} />
        <RatingsBlock ratings={ratings} t={t} locale={locale} />
      </div>

    </div>
  )
}
