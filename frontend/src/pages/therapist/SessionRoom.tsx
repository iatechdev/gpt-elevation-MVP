// frontend/src/pages/therapist/SessionRoom.tsx
// HU-067 — Sala de videollamada para el terapeuta

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
const getToken = () => localStorage.getItem('elevation_token') || ''

const MOOD_OPTIONS = [
  { value: 1, emoji: '😞', label: 'Muy mal' },
  { value: 2, emoji: '😕', label: 'No tan bien' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 4, emoji: '🙂', label: 'Bien' },
  { value: 5, emoji: '😊', label: 'Muy bien' },
]

export function SessionRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

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
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'No se pudo iniciar la sesión.')
          return
        }
        setMeetingUrl(data.meetingUrl)
        // Arrancar timer
        timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
      } catch {
        setError('Error de conexión al iniciar la sesión.')
      } finally {
        setLoading(false)
      }
    }
    startSession()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    }
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
        await fetch(`${API}/api/sessions/therapist/${id}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ content: value }),
        })
        setNoteMsg('✓ Guardado')
        setTimeout(() => setNoteMsg(''), 2000)
      } catch {
        setNoteMsg('Error guardando')
      } finally {
        setNoteSaving(false)
      }
    }, 2000)
  }, [id])

  const handleEndSession = async () => {
    setEndError('')
    if (!mood) { setEndError('Seleccioná el estado emocional del paciente.'); return }
    if (clinicalNote.trim().length < 10) { setEndError('La nota clínica debe tener al menos 10 caracteres.'); return }
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
      const data = await res.json()
      if (!res.ok) { setEndError(data.error || 'Error al finalizar.'); return }
      if (timerRef.current) clearInterval(timerRef.current)
      navigate('/therapist/dashboard')
    } catch {
      setEndError('Error de conexión.')
    } finally {
      setEnding(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: '#78716C' }}>
      Iniciando videollamada...
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', gap: '1rem' }}>
      <div style={{ color: '#DC2626', fontSize: '0.95rem' }}>{error}</div>
      <button onClick={() => navigate('/therapist/dashboard')} style={{ padding: '0.5rem 1.25rem', background: '#6B7D5C', color: '#fff', border: 'none', borderRadius: '0.65rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
        Volver al dashboard
      </button>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, sans-serif', background: '#1C1917', overflow: 'hidden' }}>

      {/* VIDEO — columna principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* iframe Daily.co */}
        <iframe
          src={meetingUrl ?? ''}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          style={{ flex: 1, border: 'none', background: '#000' }}
          title="Videollamada Elevation"
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
            Finalizar sesión
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
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          📝 Notas en vivo
        </div>
        <textarea
          value={noteText}
          onChange={e => handleNoteChange(e.target.value)}
          placeholder="Escribí tus notas aquí... Se guardan automáticamente."
          style={{
            flex: 1, resize: 'none',
            background: '#1C1917', color: '#E7E5E4',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '0.65rem', padding: '0.75rem',
            fontSize: '0.82rem', lineHeight: 1.6,
            fontFamily: 'Inter, sans-serif', outline: 'none',
          }}
        />
        <div style={{ fontSize: '0.7rem', color: noteSaving ? '#FCD34D' : '#6B7D5C', minHeight: '1rem' }}>
          {noteSaving ? 'Guardando...' : noteMsg}
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {showCheckout && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(28,25,23,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: '1rem',
            padding: '2rem', width: '100%', maxWidth: 480,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            fontFamily: 'Inter, sans-serif',
          }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: '0 0 0.5rem' }}>
              ¿Cómo fue la sesión?
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#78716C', margin: '0 0 1.5rem' }}>
              Registrá el estado del paciente y tu nota clínica antes de cerrar.
            </p>

            {/* Mood selector */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#78716C', marginBottom: '0.65rem' }}>
                Estado emocional del paciente al finalizar
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
                {MOOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMood(opt.value)}
                    style={{
                      flex: 1, padding: '0.6rem 0.25rem',
                      background: mood === opt.value ? '#EAF0E6' : '#F5F3EF',
                      border: mood === opt.value ? '1.5px solid #6B7D5C' : '1.5px solid transparent',
                      borderRadius: '0.65rem', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                    }}
                  >
                    <span style={{ fontSize: '1.4rem' }}>{opt.emoji}</span>
                    <span style={{ fontSize: '0.65rem', color: '#78716C' }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Nota clínica */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#78716C', marginBottom: '0.5rem' }}>
                Nota clínica
              </div>
              <textarea
                value={clinicalNote}
                onChange={e => setClinicalNote(e.target.value)}
                placeholder="Observaciones de la sesión, estado del paciente, próximos pasos..."
                rows={5}
                style={{
                  width: '100%', padding: '0.75rem',
                  border: '0.5px solid #E7E5E4', borderRadius: '0.65rem',
                  fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
                  color: '#1C1917', boxSizing: 'border-box',
                  outline: 'none', resize: 'vertical', lineHeight: 1.6,
                }}
              />
              <div style={{ fontSize: '0.7rem', color: '#A8A29E', marginTop: '0.25rem' }}>
                {clinicalNote.length} caracteres (mínimo 10)
              </div>
            </div>

            {endError && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
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
                  color: '#78716C', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleEndSession}
                disabled={ending}
                style={{
                  flex: 2, padding: '0.7rem',
                  background: ending ? '#A8B5A2' : '#6B7D5C',
                  border: 'none', borderRadius: '0.85rem',
                  fontSize: '0.875rem', fontWeight: 500,
                  color: '#fff', cursor: ending ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {ending ? 'Guardando...' : 'Guardar y finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}