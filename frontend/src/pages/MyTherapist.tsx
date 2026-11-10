// frontend/src/pages/MyTherapist.tsx
// HU-071 — Vista «Mi profesional» para el usuario (ES-169 PR1: vocabulario «profesional», sin emojis, textos por claves ES/EN, error con reintento).
// La ruta sigue siendo /app/my-therapist (decisión de Mauricio): cambia solo el texto de pantalla.

import './myProfessionalCopy.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { MatchingModal } from '../components/MatchingModal'
import { TherapistSharingCard } from '../components/TherapistSharingCard'
import '../styles/therapist.css'

const API      = import.meta.env.VITE_BACKEND_URL || ''
const getToken = () => localStorage.getItem('elevation_token') ?? ''

interface TherapistProfile {
  specialties: string | null
  approach:    string | null
  languages:   string | null
  bio:         string | null
}

interface Therapist {
  id:      number
  name:    string
  email:   string
  profile: TherapistProfile | null
}

interface UpcomingSession {
  id:          number
  scheduledAt: string
  duration:    number
  meetingUrl:  string | null
  status:      string
}

interface PastSession {
  id:               number
  scheduledAt:      string
  patientMoodAfter: number | null
  status:           string
}

interface MyTherapistData {
  therapist:        Therapist | null
  upcomingSessions: UpcomingSession[]
  pastSessions:     PastSession[]
}

export function MyTherapist() {
  const { lang, t } = useLanguage()
  const navigate = useNavigate()

  const [data, setData]       = useState<MyTherapistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed]   = useState(false)
  const [showMatching, setShowMatching] = useState(false)
  const [reloadKey, setReloadKey] = useState(0) // ES-100: se incrementa al desvincularse (o al reintentar) para volver a pedir los datos

  useEffect(() => {
    let alive = true
    const fetchData = async () => {
      try {
        const res = await fetch(`${API}/api/sessions/user/my-therapist`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        const json = await res.json()
        if (alive) { setData(json); setFailed(false) }
      } catch {
        if (alive) setFailed(true)
      } finally {
        if (alive) setLoading(false)
      }
    }
    void fetchData()
    return () => { alive = false }
  }, [reloadKey])
  const retry = () => { setLoading(true); setFailed(false); setReloadKey(k => k + 1) }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
      weekday: 'long', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    })

  const formatDateShort = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
    })

  // Videollamada habilitada 15 min antes
  const isJoinable = (scheduledAt: string) => {
    const diff = new Date(scheduledAt).getTime() - Date.now()
    return diff <= 15 * 60 * 1000 && diff >= -60 * 60 * 1000
  }
  // Ánimo al terminar en palabras (las mismas que ya usa el producto), sin emojis.
  const moodText = (value: number) => t('mp_mood').replace('{word}', t(`room_t_mood_${value}`)).replace('{n}', String(value))

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: '1rem',
    border: '0.5px solid #E7E5E4',
    boxShadow: '0 2px 12px rgba(26,28,27,0.06)',
    padding: '1.25rem 1.5rem',
  }

  const sectionLabel: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#57534E',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    margin: '0 0 0.75rem',
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="th-a11y" style={{ minHeight: '100vh', background: '#F9F9F7', fontFamily: 'Inter, sans-serif' }}>

      {/* HEADER */}
      <header style={{
        position: 'fixed', top: 0, width: '100%', zIndex: 50,
        background: 'rgba(249,249,247,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(231,229,228,0.5)',
        height: 60, display: 'flex', alignItems: 'center',
      }}>
        <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate('/app/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#57534E', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <span aria-hidden="true">←</span> {t('mp_back')}
          </button>
          <span style={{ fontSize: 10, letterSpacing: '0.3em', color: '#6B6560', textTransform: 'uppercase' }}>
            ELEVATION
          </span>
          <div style={{ width: 60 }} />
        </div>
      </header>

      {/* BODY */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '80px 1.5rem 3rem' }}>

        <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, fontSize: '1.8rem', color: '#1C1917', margin: '0 0 1.5rem' }}>
          {t('mp_title')}
        </h1>

        {loading && (
          <p role="status" style={{ color: '#57534E', fontSize: '0.875rem' }}>
            {t('mp_loading')}
          </p>
        )}

        {/* Un solo error con reintento para perfil y sesiones: vienen de UNA petición del servidor (/user/my-therapist). «Compartir» tiene el suyo propio. */}
        {!loading && failed && (
          <div role="alert" style={{ ...cardStyle, borderColor: '#FCA5A5' }}>
            <p style={{ color: '#B91C1C', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>{t('mp_load_error')}</p>
            <button
              onClick={retry}
              style={{ padding: '0.5rem 1.1rem', background: '#4A6741', color: '#fff', border: 'none', borderRadius: '0.85rem', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              {t('mp_retry')}
            </button>
          </div>
        )}

        {!loading && !failed && !data?.therapist && (
          /* Sin profesional asignado */
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.2rem', color: '#1C1917', margin: '0 0 0.5rem' }}>
              {t('mp_none_title')}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#57534E', margin: '0 0 1.5rem' }}>
              {t('mp_none_desc')}
            </p>
            <button
              onClick={() => navigate('/app/dashboard')}
              style={{ padding: '0.65rem 1.5rem', background: '#4A6741', color: '#fff', border: 'none', borderRadius: '0.85rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              {t('mp_find')}
            </button>
          </div>
        )}

        {!loading && !failed && data?.therapist && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* ── PERFIL DEL PROFESIONAL ── */}
            <section style={cardStyle} aria-labelledby="mp-profile">
              <h2 id="mp-profile" style={sectionLabel}>
                {t('mp_profile')}
              </h2>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                {/* Avatar */}
                <div aria-hidden="true" style={{
                  width: 56, height: 56, borderRadius: '50%', background: '#EAF0E6', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', fontWeight: 600, color: '#4A6741',
                }}>
                  {data.therapist.name.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#1C1917' }}>
                    {data.therapist.name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#57534E', marginTop: '0.15rem' }}>
                    {data.therapist.email}
                  </div>

                  {data.therapist.profile && (
                    <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {data.therapist.profile.specialties && (
                        <div style={{ fontSize: '0.82rem', color: '#1C1917' }}>
                          <span style={{ color: '#57534E' }}>{t('mp_specialties')}: </span>
                          {data.therapist.profile.specialties}
                        </div>
                      )}
                      {data.therapist.profile.languages && (
                        <div style={{ fontSize: '0.82rem', color: '#1C1917' }}>
                          <span style={{ color: '#57534E' }}>{t('mp_languages')}: </span>
                          {data.therapist.profile.languages}
                        </div>
                      )}
                      {data.therapist.profile.approach && (
                        <div style={{ fontSize: '0.82rem', color: '#1C1917' }}>
                          <span style={{ color: '#57534E' }}>{t('mp_approach')}: </span>
                          {data.therapist.profile.approach}
                        </div>
                      )}
                      {data.therapist.profile.bio && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#44403C', lineHeight: 1.6, fontStyle: 'italic', fontFamily: 'Noto Serif, serif' }}>
                          "{data.therapist.profile.bio}"
                        </div>
                      )}
                    </div>
                  )}

                  {!data.therapist.profile && (
                    <p style={{ fontSize: '0.82rem', color: '#6B6560', marginTop: '0.5rem', fontStyle: 'italic' }}>
                      {t('mp_profile_empty')}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* ── COMPARTIR CON MI PROFESIONAL (ES-100 / ES-96): tiene su propio estado de error ── */}
            <TherapistSharingCard
              therapistName={data.therapist.name}
              onUnlinked={() => setReloadKey(k => k + 1)}
            />

            {/* ── PRÓXIMAS SESIONES ── */}
            <section style={cardStyle} aria-labelledby="mp-upcoming">
              <h2 id="mp-upcoming" style={sectionLabel}>
                {t('mp_upcoming')}
              </h2>

              {data.upcomingSessions.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: '#57534E', margin: 0 }}>
                  {t('mp_upcoming_empty')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {data.upcomingSessions.map(s => {
                    const joinable = isJoinable(s.scheduledAt)
                    return (
                      <div key={s.id} style={{
                        padding: '0.85rem 1rem',
                        background: '#F5F3EF',
                        borderRadius: '0.65rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
                      }}>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1C1917', textTransform: 'capitalize' }}>
                            {formatDateTime(s.scheduledAt)}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#57534E', marginTop: '0.15rem' }}>
                            {t('mp_minutes').replace('{n}', String(s.duration))}
                          </div>
                        </div>
                        <button
                          disabled={!joinable}
                          onClick={() => s.meetingUrl && window.open(s.meetingUrl, '_blank')}
                          title={joinable ? '' : t('mp_join_wait')}
                          style={{
                            padding: '0.45rem 0.9rem',
                            background: joinable ? '#4A6741' : '#E7E5E4',
                            color: joinable ? '#fff' : '#6B6560',
                            border: 'none', borderRadius: '0.65rem',
                            fontSize: '0.78rem', fontWeight: 500,
                            cursor: joinable ? 'pointer' : 'not-allowed',
                            fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                          }}
                        >
                          {t('mp_join')}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── SESIONES ANTERIORES ── */}
            {data.pastSessions.length > 0 && (
              <section style={cardStyle} aria-labelledby="mp-past">
                <h2 id="mp-past" style={sectionLabel}>
                  {t('mp_past')}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.pastSessions.map(s => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.65rem 0', borderBottom: '0.5px solid #F5F3EF',
                    }}>
                      <div style={{ fontSize: '0.82rem', color: '#1C1917' }}>
                        {formatDateShort(s.scheduledAt)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.72rem', background: '#EAF0E6', color: '#4A6741', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                          {t('mp_completed')}
                        </span>
                        {s.patientMoodAfter != null && s.patientMoodAfter >= 1 && s.patientMoodAfter <= 5 && (
                          <span style={{ fontSize: '0.82rem', color: '#44403C' }}>
                            {moodText(s.patientMoodAfter)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── CAMBIAR DE PROFESIONAL ── */}
            <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
              <button
                onClick={() => setShowMatching(true)}
                style={{ background: 'none', border: 'none', color: '#57534E', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Inter, sans-serif' }}
              >
                {t('mp_change')}
              </button>

              {showMatching && (
                <MatchingModal
                  onClose={() => setShowMatching(false)}
                  onSuccess={() => { setShowMatching(false); window.location.reload() }}
                />
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
