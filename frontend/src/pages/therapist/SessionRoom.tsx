// frontend/src/pages/therapist/SessionRoom.tsx
// HU-067 — Sala de videollamada para el terapeuta

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage'
import { localizeServerError } from '../../i18n/serverError'
import '../../styles/therapist.css'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''

// ES-100: las etiquetas salen de i18n (room_t_mood_<valor>)
const MOOD_OPTIONS = [
  { value: 1, emoji: '😞' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😊' },
]

export function SessionRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()

  const [meetingUrl, setMeetingUrl]   = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  // Timer
  const [elapsed, setElapsed]         = useState(0)
  const timerRef                      = useRef<ReturnType<typeof setInterval> | null>(null)

  // Live notes
  const [noteText, setNoteText]       = useState('')
  const [noteSaving, setNoteSaving]   = useState(false)
  const [noteMsg, setNoteMsg]         = useState('')
  const autoSaveRef                   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Checkout modal
  const [showCheckout, setShowCheckout]   = useState(false)
  const [mood, setMood]                   = useState<number | null>(null)
  const [clinicalNote, setClinicalNote]   = useState('')
  const [ending, setEnding]               = useState(false)
  const [endError, setEndError]           = useState('')

  // Iniciar sesión al montar
  useEffect(() => {
    const startSession = async () => {
      try {
        const res = await fetch(`${API}/api/sessions/therapist/${id}/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(localizeServerError(data.error, lang, t('room_t_start_error')))
          return
        }
        setMeetingUrl(data.meetingUrl)
        // Arrancar timer
        timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
      } catch {
        setError(t('room_connection_error'))
      } finally {
        setLoading(false)
      }
    }
    startSession()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la sesión se inicia una sola vez por sala; el idioma solo afecta al texto del error
  }, [id])

  // Formato del timer
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Auto-save nota cada 2s después de que el terapeuta deja de escribir
  const handleNoteChange = useCallback((value: string) => {
    setNoteText(value)
    setNoteMsg('')
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    if (!value.trim()) return
    autoSaveRef.current = setTimeout(async () => {
      setNoteSaving(true)
      try {
        const res = await fetch(`${API}/api/sessions/therapist/${id}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ content: value }),
        })
        if (!res.ok) throw new Error()
        setNoteMsg(t('room_t_saved'))
        setTimeout(() => setNoteMsg(''), 2000)
      } catch {
        setNoteMsg(t('room_t_save_error'))
      } finally {
        setNoteSaving(false)
      }
    }, 2000)
  }, [id, t])

  const handleEndSession = async () => {
    setEndError('')
    if (!mood) { setEndError(t('room_t_pick_mood')); return }
    if (clinicalNote.trim().length < 10) { setEndError(t('room_t_note_min')); return }
    setEnding(true)
    try {
      const res = await fetch(`${API}/api/sessions/therapist/${id}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ therapistNote: clinicalNote, patientMoodAfter: mood }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setEndError(localizeServerError(data.error, lang, t('room_t_end_error'))); return }
      if (timerRef.current) clearInterval(timerRef.current)
      navigate('/therapist/dashboard')
    } catch {
      setEndError(t('room_connection_error'))
    } finally {
      setEnding(false)
    }
  }

  if (loading) return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: '#57534E' }}>
      {t('room_t_starting')}
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', gap: '1rem', padding: '1rem', textAlign: 'center' }}>
      <div role="alert" style={{ color: '#B91C1C', fontSize: '0.95rem' }}>{error}</div>
      <button onClick={() => navigate('/therapist/dashboard')} style={{ minHeight: 44, padding: '0.5rem 1.25rem', background: '#4A6741', color: '#fff', border: 'none', borderRadius: '0.65rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
        {t('room_t_back')}
      </button>
    </div>
  )

  return (
    <div className="th-a11y" style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, sans-serif', background: '#1C1917', overflow: 'hidden' }}>

      {/* VIDEO — columna principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* iframe Daily.co */}
        <iframe
          src={meetingUrl ?? ''}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          style={{ flex: 1, border: 'none', background: '#000' }}
          title={t('room_iframe_title')}
        />

        {/* Barra inferior con timer + botón finalizar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0.75rem 1.5rem',
          background: 'linear-gradient(to top, rgba(28,25,23,0.85), transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: '#E7E5E4', fontVariantNumeric: 'tabular-nums', fontSize: '1rem', fontWeight: 500 }}>
            ⏱ {formatTime(elapsed)}
          </span>
          <button
            onClick={() => setShowCheckout(true)}
            style={{
              padding: '0.55rem 1.25rem',
              background: '#DC2626', color: '#fff',
              border: 'none', borderRadius: '0.65rem',
              fontSize: '0.875rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            {t('room_t_finish')}
          </button>
        </div>
      </div>

      {/* SIDEBAR — notas en vivo */}
      <div style={{
        width: 300, background: '#292524',
        display: 'flex', flexDirection: 'column',
        padding: '1.25rem', gap: '0.75rem',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
      }}>
        <label htmlFor="live-notes" style={{ fontSize: '0.72rem', fontWeight: 600, color: '#D6D3D1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {t('room_t_live_notes')}
        </label>
        <textarea
          id="live-notes"
          value={noteText}
          onChange={e => handleNoteChange(e.target.value)}
          placeholder={t('room_t_live_placeholder')}
          style={{
            flex: 1, resize: 'none',
            background: '#1C1917', color: '#E7E5E4',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '0.65rem', padding: '0.75rem',
            fontSize: '0.82rem', lineHeight: 1.6,
            fontFamily: 'Inter, sans-serif', outline: 'none',
          }}
        />
        <div role="status" aria-live="polite" style={{ fontSize: '0.75rem', color: noteSaving ? '#FCD34D' : '#A3B899', minHeight: '1rem' }}>
          {noteSaving ? t('room_t_saving') : noteMsg}
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {showCheckout && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(28,25,23,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem',
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="checkout-title" style={{
            background: '#fff', borderRadius: '1rem',
            padding: '2rem', width: '100%', maxWidth: 480,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            fontFamily: 'Inter, sans-serif',
          }}>
            <h2 id="checkout-title" style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: '0 0 0.5rem' }}>
              {t('room_t_how_was')}
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#57534E', margin: '0 0 1.5rem' }}>
              {t('room_t_how_hint')}
            </p>

            {/* Mood selector */}
            <div role="group" aria-labelledby="checkout-mood-label" style={{ marginBottom: '1.5rem' }}>
              <div id="checkout-mood-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#57534E', marginBottom: '0.65rem' }}>
                {t('room_t_mood_label')}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
                {MOOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    aria-pressed={mood === opt.value}
                    onClick={() => setMood(opt.value)}
                    style={{
                      flex: 1, padding: '0.6rem 0.25rem',
                      background: mood === opt.value ? '#EAF0E6' : '#F5F3EF',
                      border: mood === opt.value ? '1.5px solid #4A6741' : '1.5px solid transparent',
                      borderRadius: '0.65rem', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                    }}
                  >
                    <span style={{ fontSize: '1.4rem' }} aria-hidden="true">{opt.emoji}</span>
                    <span style={{ fontSize: '0.68rem', color: '#57534E' }}>{t(`room_t_mood_${opt.value}`)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Nota clínica */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="clinical-note" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#57534E', marginBottom: '0.5rem' }}>
                {t('therapist_note_label')}
              </label>
              <textarea
                id="clinical-note"
                value={clinicalNote}
                onChange={e => setClinicalNote(e.target.value)}
                placeholder={t('room_t_note_placeholder')}
                rows={5}
                style={{
                  width: '100%', padding: '0.75rem',
                  border: '0.5px solid #E7E5E4', borderRadius: '0.65rem',
                  fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
                  color: '#1C1917', boxSizing: 'border-box',
                  outline: 'none', resize: 'vertical', lineHeight: 1.6,
                }}
              />
              <div style={{ fontSize: '0.72rem', color: '#57534E', marginTop: '0.25rem' }}>
                {clinicalNote.length} {t('room_t_note_counter')}
              </div>
            </div>

            {endError && (
              <div role="alert" style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {endError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => { setShowCheckout(false); setEndError('') }}
                style={{
                  flex: 1, padding: '0.7rem',
                  background: 'transparent', border: '0.5px solid #E7E5E4',
                  borderRadius: '0.85rem', fontSize: '0.875rem',
                  color: '#57534E', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}
              >
                {t('room_t_cancel')}
              </button>
              <button
                onClick={handleEndSession}
                disabled={ending}
                style={{
                  flex: 2, padding: '0.7rem',
                  background: ending ? '#A8B5A2' : '#4A6741',
                  border: 'none', borderRadius: '0.85rem',
                  fontSize: '0.875rem', fontWeight: 500,
                  color: '#fff', cursor: ending ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {ending ? t('room_t_saving') : t('room_t_save_finish')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}