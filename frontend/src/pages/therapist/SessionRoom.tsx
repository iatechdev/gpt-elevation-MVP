// frontend/src/pages/therapist/SessionRoom.tsx
// HU-067 + ES-179 — Sala de sesión del profesional: pantalla previa («Iniciar sesión», decisión 16), conectando, en sesión, error al iniciar, ya cerrada y cierre.
// El inicio se registra en el servidor (idempotente): recargar en plena sesión recupera la MISMA sala y el temporizador sale de `startedAt` del servidor.
// Pantalla oscura propia de la sala (sin tema claro): «tema oscuro propio de la sala» está declarado en ES-179. El video y los permisos de cámara/micrófono son del servicio externo.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage'
import { LiveNotes, type LiveNotesHandle } from './LiveNotes'
import { CloseSession, type CloseResult } from './CloseSession'
import { elapsedSeconds, formatElapsed, milestone } from './roomFormat'
import '../../styles/therapist.css'
import '../../styles/session-room.css'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''

interface RoomSession { id: number; patientId: number; patientName: string; scheduledAt: string; duration: number | null; status: string; startedAt?: string | null }
type Phase = 'loading' | 'missing' | 'previa' | 'connecting' | 'start_error' | 'room' | 'closed' | 'done'

export function SessionRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const locale = lang === 'es' ? 'es-CO' : 'en-US'
  const [phase, setPhase] = useState<Phase>('loading')
  const [session, setSession] = useState<RoomSession | null>(null)
  const [meetingUrl, setMeetingUrl] = useState('')
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [startFailure, setStartFailure] = useState<'room' | 'other'>('other')
  const [now, setNow] = useState(() => Date.now())
  const [skipped, setSkipped] = useState<CloseResult['skipped']>(null)
  const notes = useRef<LiveNotesHandle>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const back = () => navigate('/therapist/dashboard')

  const start = useCallback(async () => {
    setPhase('connecting')
    try {
      const res = await fetch(`${API}/api/sessions/therapist/${id}/start`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } })
      const body = await res.json().catch(() => ({})) as { meetingUrl?: string; startedAt?: string; code?: string }
      if (res.ok && body.meetingUrl) { setMeetingUrl(body.meetingUrl); setStartedAt(body.startedAt ?? null); setPhase('room'); return }
      if (body.code === 'session_not_startable') { setPhase('closed'); return }
      setStartFailure(body.code === 'room_unavailable' ? 'room' : 'other'); setPhase('start_error')
    } catch { setStartFailure('other'); setPhase('start_error') }
  }, [id])

  // Al abrir: ¿qué sesión es y en qué estado está? (sin iniciar nada: iniciar es una decisión explícita)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`${API}/api/sessions/therapist`, { headers: { Authorization: `Bearer ${getToken()}` } })
        if (!res.ok) throw new Error(String(res.status))
        const rows = await res.json() as RoomSession[]
        const found = rows.find(row => String(row.id) === id)
        if (cancelled) return
        if (!found) { setPhase('missing'); return }
        setSession(found)
        if (found.status === 'in_progress') void start() // recarga en plena sesión: se recupera la misma sala (el inicio es idempotente)
        else if (found.status === 'scheduled') setPhase('previa')
        else setPhase('closed')
      } catch { if (!cancelled) setPhase('missing') }
    })()
    return () => { cancelled = true }
  }, [id, start])

  useEffect(() => { title.current?.focus() }, [phase])
  useEffect(() => {
    if (phase !== 'room') return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [phase])

  const seconds = elapsedSeconds(startedAt, now)
  const hito = milestone(seconds, session?.duration ?? null)
  const when = session ? new Date(session.scheduledAt).toLocaleString(locale, { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

  if (phase === 'loading') return <div className="sr-screen sr-center" role="status">{t('sr_loading')}</div>
  if (phase === 'missing') return (
    <div className="sr-screen sr-center"><h1 ref={title} tabIndex={-1} className="sr-title">{t('sr_missing')}</h1><button type="button" className="sr-btn sr-btn-primary" onClick={back}>{t('room_t_back')}</button></div>
  )
  if (phase === 'closed') return (
    <div className="sr-screen sr-center"><h1 ref={title} tabIndex={-1} className="sr-title">{t('sr_closed')}</h1><button type="button" className="sr-btn sr-btn-primary" onClick={back}>{t('room_t_back')}</button></div>
  )
  if (phase === 'done') return (
    <div className="sr-screen sr-center">
      <h1 ref={title} tabIndex={-1} className="sr-title">{t('sr_done')}</h1>
      {skipped && <p role="status" className="sr-hint sr-wide">{t(`sr_skipped_${skipped}`)}</p>}
      <button type="button" className="sr-btn sr-btn-primary" onClick={back}>{t('room_t_back')}</button>
    </div>
  )
  if (phase === 'previa' || phase === 'connecting' || phase === 'start_error') return (
    <div className="sr-screen sr-center">
      <h1 ref={title} tabIndex={-1} className="sr-title">{t('sr_with', { name: session?.patientName ?? '' })}</h1>
      <p className="sr-hint">{when}{session?.duration ? ` · ${t('sr_minutes', { n: session.duration })}` : ''}</p>
      <p className="sr-body sr-wide">{t('sr_previa_start')}</p>
      <p className="sr-body sr-wide">{t('sr_previa_permissions')}</p>
      <div role="status" aria-busy={phase === 'connecting'} className="sr-hint">{phase === 'connecting' ? t('sr_connecting') : ''}</div>
      {phase === 'start_error' && <div role="alert" className="sr-problem-dark sr-wide"><p>{t(startFailure === 'room' ? 'sr_start_not_recorded' : 'sr_start_error')}</p></div>}
      <div className="sr-actions">
        <button type="button" className="sr-btn sr-btn-primary" disabled={phase === 'connecting'} onClick={() => void start()}>{phase === 'start_error' ? t('sr_retry') : t('sr_start')}</button>
        <button type="button" className="sr-btn" disabled={phase === 'connecting'} onClick={back}>{t('room_t_back')}</button>
      </div>
    </div>
  )

  return (
    <div className="sr-screen sr-room th-a11y">
      <div className="sr-video">
        <iframe src={meetingUrl} allow="camera; microphone; fullscreen; display-capture; autoplay" title={t('room_iframe_title')} className="sr-iframe" />
        <div className="sr-bar">
          <div>
            <span className="sr-timer" role="timer" aria-label={t('sr_timer_label')}>{t('sr_timer_label')} {formatElapsed(seconds)}</span>
            <span role="status" className="sr-visually-hidden">{hito ? t(`sr_milestone_${hito}`) : ''}</span>
          </div>
          <CloseSession sessionId={String(id)} t={t} flushNotes={() => notes.current?.flush() ?? Promise.resolve(true)} onClosed={result => { setSkipped(result.skipped); setPhase('done') }} onAlreadyClosed={() => setPhase('closed')} />
        </div>
      </div>
      <aside className="sr-side" aria-label={t('sr_notes')}>
        <LiveNotes ref={notes} sessionId={String(id)} t={t} locale={locale} />
      </aside>
    </div>
  )
}
