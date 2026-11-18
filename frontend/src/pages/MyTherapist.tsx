// frontend/src/pages/MyTherapist.tsx
// HU-071 — Vista «Mi profesional» para el usuario (ES-169 PR1: vocabulario «profesional», sin emojis, textos por claves ES/EN, error con reintento).
// La ruta sigue siendo /app/my-therapist (decisión de Mauricio): cambia solo el texto de pantalla.
// ES-329 (Mi profesional): pantalla en «Cartografía» dentro del marco de persona (ES-153): sin cabecera ni «Volver» propios, tarjetas Card/Chip/Button, cero estilos en línea.
// Datos, endpoint y flujos NO cambian.

import './myProfessionalCopy.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import './progressCopy.ts' // ES-254: textos del emparejamiento (los mismos de /app/progress)
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { PersonScreen } from '../space/PersonScreen'
import { Button, Chip, LinkButton } from '../cartografia/controls'
import { Banner, ItemList } from '../cartografia/pieces'
import { ProgressMatching } from '../progress/ProgressMatching'
import { TherapistSharingCard } from '../components/TherapistSharingCard'

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
  const titleRef = useRef<HTMLHeadingElement>(null)
  const refocusTitle = useRef(false) // D4: tras desvincular la tarjeta desaparece al recargar; el foco pasa al título de la pantalla recargada
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
        if (alive && refocusTitle.current) { refocusTitle.current = false; requestAnimationFrame(() => titleRef.current?.focus()) }
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

  const therapist = data?.therapist
  const profile = therapist?.profile

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PersonScreen title={t('mp_title')} titleRef={titleRef}>
      {loading && <p role="status" className="cg-muted">{t('mp_loading')}</p>}

      {/* Un solo error con reintento para perfil y sesiones: vienen de UNA petición del servidor (/user/my-therapist). «Compartir» tiene el suyo propio. */}
      {!loading && failed && (
        <Banner kind="error" title={t('mp_load_error')}>
          <div className="pg-actions"><Button onClick={retry}>{t('mp_retry')}</Button></div>
        </Banner>
      )}

      {!loading && !failed && !therapist && (
        /* Sin profesional asignado */
        <section className="cg-card pg-card" aria-labelledby="mp-none">
          <h2 id="mp-none">{t('mp_none_title')}</h2>
          <p>{t('mp_none_desc')}</p>
          <div className="pg-actions"><Button onClick={() => navigate('/app/dashboard')}>{t('mp_find')}</Button></div>
        </section>
      )}

      {!loading && !failed && data && therapist && (
        <>
          {/* ── PERFIL DEL PROFESIONAL ── */}
          <section className="cg-card pg-card" aria-labelledby="mp-profile">
            <h2 id="mp-profile">{therapist.name}</h2>
            <p className="cg-hint">{therapist.email}</p>
            {profile ? (
              <dl className="pc-dl">
                {profile.bio && <><dt>{t('mp_profile')}</dt><dd>“{profile.bio}”</dd></>}
                {profile.specialties && <><dt>{t('mp_specialties')}</dt><dd>{profile.specialties}</dd></>}
                {profile.languages && <><dt>{t('mp_languages')}</dt><dd>{profile.languages}</dd></>}
                {profile.approach && <><dt>{t('mp_approach')}</dt><dd>{profile.approach}</dd></>}
              </dl>
            ) : (
              <p className="cg-muted">{t('mp_profile_empty')}</p>
            )}
          </section>

          {/* ── COMPARTIR CON MI PROFESIONAL (ES-100 / ES-96): tiene su propio estado de error ── */}
          <TherapistSharingCard
            therapistName={therapist.name}
            onUnlinked={() => { refocusTitle.current = true; setReloadKey(k => k + 1) }}
          />

          {/* ── PRÓXIMAS SESIONES ── */}
          <section className="cg-card pg-card" aria-labelledby="mp-upcoming">
            <h2 id="mp-upcoming">{t('mp_upcoming')}</h2>
            {data.upcomingSessions.length === 0 ? (
              <p>{t('mp_upcoming_empty')}</p>
            ) : (
              <ItemList items={data.upcomingSessions.map(s => {
                const joinable = isJoinable(s.scheduledAt)
                return {
                  id: String(s.id),
                  top: <strong>{formatDateTime(s.scheduledAt)} · {t('mp_minutes').replace('{n}', String(s.duration))}</strong>,
                  body: (
                    <div className="pg-actions">
                      <Button disabled={!joinable} aria-describedby={joinable ? undefined : `mp-wait-${s.id}`} onClick={() => s.meetingUrl && window.open(s.meetingUrl, '_blank')}>{t('mp_join')}</Button>
                      {!joinable && <span id={`mp-wait-${s.id}`} className="cg-hint">{t('mp_join_wait')}</span>}
                    </div>
                  ),
                }
              })} />
            )}
          </section>

          {/* ── SESIONES ANTERIORES ── */}
          {data.pastSessions.length > 0 && (
            <section className="cg-card pg-card" aria-labelledby="mp-past">
              <h2 id="mp-past">{t('mp_past')}</h2>
              <ItemList items={data.pastSessions.map(s => ({
                id: String(s.id),
                top: <div className="pc-line"><strong>{formatDateShort(s.scheduledAt)}</strong><Chip tone="ok" symbol="✓">{t('mp_completed')}</Chip></div>,
                body: s.patientMoodAfter != null && s.patientMoodAfter >= 1 && s.patientMoodAfter <= 5 ? <p className="cg-hint">{moodText(s.patientMoodAfter)}</p> : undefined,
              }))} />
            </section>
          )}

          {/* ── CAMBIAR DE PROFESIONAL (mismo emparejamiento y contrato con el servidor que /app/progress) ── */}
          <p><LinkButton onClick={() => setShowMatching(true)}>{t('mp_change')}</LinkButton></p>
          <ProgressMatching open={showMatching} onClose={() => { setShowMatching(false); setReloadKey(k => k + 1) }} />
        </>
      )}
    </PersonScreen>
  )
}
