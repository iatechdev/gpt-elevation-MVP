// HU-046 + HU-049 + HU-062 + HU-065 + HU-067 — Therapist dashboard

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
const getToken = () => localStorage.getItem('elevation_token') || ''

interface Patient {
  id: number
  name: string
  email: string
  active: boolean
  createdAt: string
  totalSessions: number
  sessionsThisWeek: number
  avgRating: number | null
  moodTrend: 'up' | 'down' | 'neutral'
  trend: 'improving' | 'stable' | 'declining' | null
  lastMood: {
    checkin_mood: number | null
    checkout_mood: number | null
    date: string
  } | null
}

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

interface InactivePatient {
  userId: number
  name: string
  daysSinceLastSession: number | null
}

interface NotableProgress {
  userId: number
  name: string
  improvementPercent: number
}

interface AlertsData {
  inactivePatients: InactivePatient[]
  notableProgress: NotableProgress[]
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

// HU-067 — upcoming session shape
interface UpcomingSession {
  id: number
  patientId: number
  scheduledAt: string
  duration: number
  status: string
  patientName: string
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😊',
}

const TREND_BADGE: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  improving: { label: 'Improving', bg: '#EAF0E6', color: '#4A6741', icon: '📈' },
  stable:    { label: 'Stable',    bg: '#E0F2FE', color: '#0369A1', icon: '📊' },
  declining: { label: 'Declining', bg: '#FEE2E2', color: '#DC2626', icon: '📉' },
}

export function TherapistDashboard() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // Prompt state
  const [promptData, setPromptData]               = useState<PromptData | null>(null)
  const [promptLoading, setPromptLoading]         = useState(true)
  const [showPromptSection, setShowPromptSection] = useState(false)
  const [showProposeModal, setShowProposeModal]   = useState(false)
  const [newPromptContent, setNewPromptContent]   = useState('')
  const [proposing, setProposing]                 = useState(false)
  const [proposeError, setProposeError]           = useState('')
  const [proposeSuccess, setProposeSuccess]       = useState('')

  // Alerts state
  const [alerts, setAlerts]               = useState<AlertsData | null>(null)
  const [alertsLoading, setAlertsLoading] = useState(true)

  // Validation state
  const [validations, setValidations]                     = useState<ValidationDoc[]>([])
  const [showValidationSection, setShowValidationSection] = useState(false)
  const [uploadingDoc, setUploadingDoc]                   = useState(false)
  const [uploadMsg, setUploadMsg]                         = useState('')
  const [selectedDocType, setSelectedDocType]             = useState<string>('titulo')

  // HU-067 — upcoming sessions
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([])

  // Fetch patients
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await fetch(`${API}/api/therapist/pacientes`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        setPatients(await res.json())
      } catch {
        setError('Could not load your patients.')
      } finally {
        setLoading(false)
      }
    }
    fetchPatients()
  }, [])

  // HU-067 — fetch upcoming sessions
  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const res = await fetch(`${API}/api/sessions/therapist/upcoming`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        setUpcomingSessions(await res.json())
      } catch {
        // non-blocking
      }
    }
    fetchUpcoming()
  }, [])

  // Fetch prompt
  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        const res = await fetch(`${API}/api/therapist/prompt`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        setPromptData(await res.json())
      } catch {
        // non-blocking
      } finally {
        setPromptLoading(false)
      }
    }
    fetchPrompt()
  }, [])

  // Fetch alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`${API}/api/therapist/alerts`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        setAlerts(await res.json())
      } catch {
        // non-blocking
      } finally {
        setAlertsLoading(false)
      }
    }
    fetchAlerts()
  }, [])

  // Fetch validations
  useEffect(() => {
    const fetchValidations = async () => {
      try {
        const res = await fetch(`${API}/api/therapist/validation/status`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        setValidations(await res.json())
      } catch {
        // non-blocking
      }
    }
    fetchValidations()
  }, [])

  // HU-067 — helper: dado un patientId, retorna la sesión scheduled más próxima (si existe)
  const getNextSessionForPatient = (patientId: number): UpcomingSession | null =>
    upcomingSessions.find(s => s.patientId === patientId) ?? null

  const handleProposePrompt = async () => {
    setProposeError('')
    setProposeSuccess('')
    if (newPromptContent.trim().length < 50) {
      setProposeError('Prompt must be at least 50 characters.')
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
      if (!res.ok) { setProposeError(data.error || 'Error submitting prompt.'); return }
      setProposeSuccess('Prompt submitted for review. A superadmin will approve it shortly.')
      setNewPromptContent('')
      const refreshRes = await fetch(`${API}/api/therapist/prompt`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (refreshRes.ok) setPromptData(await refreshRes.json())
      setTimeout(() => { setShowProposeModal(false); setProposeSuccess('') }, 2500)
    } catch {
      setProposeError('Connection error.')
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
      if (!res.ok) return setUploadMsg(data.error ?? 'Error subiendo documento.')
      setUploadMsg('✓ Documento subido. La Junta lo revisará pronto.')
      const r2 = await fetch(`${API}/api/therapist/validation/status`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (r2.ok) setValidations(await r2.json())
    } catch {
      setUploadMsg('Error de conexión.')
    } finally {
      setUploadingDoc(false)
    }
  }

  const activeThisWeek = patients.filter(p => p.sessionsThisWeek > 0).length
  const avgMoodAll = (() => {
    const moods = patients.map(p => p.lastMood?.checkin_mood).filter((m): m is number => m != null)
    return moods.length > 0
      ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10
      : null
  })()
  const avgRatingAll = (() => {
    const ratings = patients.map(p => p.avgRating).filter((r): r is number => r != null)
    return ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null
  })()

  const cardStyle = {
    background: '#fff',
    borderRadius: '1rem',
    border: '0.5px solid #E7E5E4',
    boxShadow: '0 2px 12px rgba(26,28,27,0.06)',
    padding: '1.25rem 1.5rem',
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })

  const formatSessionTime = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    })

  const totalAlerts = (alerts?.inactivePatients.length ?? 0) + (alerts?.notableProgress.length ?? 0)

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* HEADER */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, fontSize: '1.8rem', color: '#1C1917', margin: 0 }}>
          My Patients
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#78716C', margin: '0.25rem 0 0' }}>
          {patients.length} patient{patients.length !== 1 ? 's' : ''} assigned
        </p>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total patients',     value: patients.length },
          { label: 'Active this week',   value: activeThisWeek },
          { label: 'Avg mood',           value: avgMoodAll ?? '—' },
          { label: 'Avg session rating', value: avgRatingAll ? `${avgRatingAll} ★` : '—' },
        ].map(card => (
          <div key={card.label} style={cardStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 600, color: '#1C1917' }}>{card.value}</div>
            <div style={{ fontSize: '0.78rem', color: '#78716C', marginTop: '0.25rem' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* HU-067 — PRÓXIMAS SESIONES */}
      {upcomingSessions.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
            🎥 Próximas sesiones
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {upcomingSessions.map(session => {
              const isNow = (() => {
                const diff = new Date(session.scheduledAt).getTime() - Date.now()
                return diff <= 15 * 60 * 1000 && diff >= -session.duration * 60 * 1000
              })()
              return (
                <div key={session.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '1rem', flexWrap: 'wrap',
                  padding: '0.75rem 1rem',
                  background: isNow ? '#EAF0E6' : '#F5F3EF',
                  borderRadius: '0.65rem',
                  border: isNow ? '1px solid #A8B5A2' : '1px solid transparent',
                }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#1C1917', fontSize: '0.9rem' }}>
                      {session.patientName}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#78716C', marginTop: '0.15rem' }}>
                      {formatSessionTime(session.scheduledAt)} · {session.duration} min
                      {isNow && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#4A6741', background: '#C6D4BF', padding: '0.1rem 0.45rem', borderRadius: 999 }}>
                          AHORA
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/therapist/session/${session.id}`)}
                    style={{
                      padding: '0.5rem 1.1rem',
                      background: isNow ? '#6B7D5C' : 'transparent',
                      border: isNow ? 'none' : '0.5px solid #6B7D5C',
                      borderRadius: '0.65rem',
                      color: isNow ? '#fff' : '#6B7D5C',
                      fontSize: '0.82rem', fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isNow ? '▶ Iniciar sesión' : 'Ver sesión'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VALIDACIÓN ACADÉMICA */}
      <div style={{ ...cardStyle, marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🎓 Validación académica
            </div>
            <div style={{ fontSize: '0.82rem', color: '#1C1917', marginTop: '0.2rem' }}>
              {validations.length === 0
                ? 'Sin documentos enviados aún'
                : validations.some(v => v.status === 'approved')
                  ? '✅ Validación aprobada'
                  : validations.some(v => v.status === 'pending')
                    ? '⏳ Documentos en revisión'
                    : '❌ Documentos rechazados — podés volver a postular'}
            </div>
          </div>
          <button
            onClick={() => setShowValidationSection(!showValidationSection)}
            style={{ padding: '0.45rem 0.85rem', background: 'transparent', border: '0.5px solid #E7E5E4', borderRadius: '0.65rem', fontSize: '0.78rem', color: '#78716C', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            {showValidationSection ? 'Ocultar' : 'Ver documentos'}
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
                      <div style={{ fontSize: '0.72rem', color: '#78716C', marginTop: '0.15rem' }}>
                        {v.documentType} · {new Date(v.submittedAt).toLocaleDateString('es-CO')}
                      </div>
                      {v.reviewNote && (
                        <div style={{ fontSize: '0.72rem', color: '#78716C', marginTop: '0.25rem', fontStyle: 'italic' }}>
                          Nota: {v.reviewNote}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap',
                      padding: '0.15rem 0.6rem', borderRadius: 999,
                      background: v.status === 'approved' ? '#6B7D5C' : v.status === 'rejected' ? '#DC2626' : '#92400E',
                      color: '#fff',
                    }}>
                      {v.status === 'approved' ? 'Aprobado' : v.status === 'rejected' ? 'Rechazado' : 'En revisión'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!validations.some(v => v.status === 'approved') && (
              <div style={{ padding: '1rem', background: '#F5F3EF', borderRadius: '0.65rem' }}>
                <p style={{ fontSize: '0.82rem', color: '#78716C', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                  Subí tu título o certificado para que la Junta de Elevation lo revise y te active como terapeuta. Solo PDF, JPG o PNG. Máximo 10 MB.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', display: 'block', marginBottom: 4 }}>
                      Tipo de documento
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
                    background: uploadingDoc ? '#A8B5A2' : '#6B7D5C',
                    color: '#fff', borderRadius: '0.65rem', fontSize: '0.82rem', fontWeight: 500,
                    cursor: uploadingDoc ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
                  }}>
                    {uploadingDoc ? 'Subiendo...' : '📎 Seleccionar archivo'}
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
      </div>

      {/* MY THERAPEUTIC PROMPT */}
      {!promptLoading && (
        <div style={{ ...cardStyle, marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                My Therapeutic Prompt
              </div>
              <div style={{ fontSize: '0.82rem', color: '#1C1917', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {promptData?.active
                  ? `Active v${promptData.active.version} — Approved ${formatDate(promptData.active.approved_at)}`
                  : 'No active prompt yet'}
                {promptData?.pending && (
                  <span style={{ fontSize: '0.72rem', background: '#FEF3C7', color: '#92400E', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                    v{promptData.pending.version} pending review
                  </span>
                )}
                {promptData?.rejected && !promptData?.active && !promptData?.pending && (
                  <span style={{ fontSize: '0.72rem', background: '#FEE2E2', color: '#DC2626', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                    v{promptData.rejected.version} rechazado
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {promptData?.active && (
                <button
                  onClick={() => setShowPromptSection(!showPromptSection)}
                  style={{ padding: '0.45rem 0.85rem', background: 'transparent', border: '0.5px solid #E7E5E4', borderRadius: '0.65rem', fontSize: '0.78rem', color: '#78716C', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {showPromptSection ? 'Hide' : 'View current'}
                </button>
              )}
              {!promptData?.pending && (
                <button
                  onClick={() => { setShowProposeModal(true); setNewPromptContent(promptData?.content ?? '') }}
                  style={{ padding: '0.45rem 0.85rem', background: '#6B7D5C', border: 'none', borderRadius: '0.65rem', fontSize: '0.78rem', color: '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                  {promptData?.hasPrompt ? 'Propose new version' : 'Create prompt'}
                </button>
              )}
            </div>
          </div>

          {promptData?.rejected && !promptData?.active && !promptData?.pending && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: '#FEE2E2', border: '0.5px solid #FCA5A5', borderRadius: '0.65rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#DC2626', marginBottom: '0.25rem' }}>
                Tu prompt v{promptData.rejected.version} fue rechazado por {promptData.rejected.rejected_by}
              </div>
              {promptData.rejected.rejection_note && (
                <div style={{ fontSize: '0.75rem', color: '#DC2626', fontStyle: 'italic', marginBottom: '0.35rem' }}>
                  "{promptData.rejected.rejection_note}"
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: '#4A6741', fontWeight: 500 }}>
                Podés crear una nueva versión corregida con el botón "Create prompt".
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
        </div>
      )}

      {/* LOADING / ERROR */}
      {loading && <p style={{ color: '#78716C', fontSize: '0.875rem' }}>Loading patients...</p>}
      {error   && <p style={{ color: '#DC2626', fontSize: '0.875rem' }}>{error}</p>}

      {/* TWO COLUMN LAYOUT: patients + alerts */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>

          {/* COLUMNA IZQUIERDA — PATIENT LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {patients.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: '#78716C', fontSize: '0.875rem' }}>
                No patients assigned yet.
              </div>
            ) : (
              patients.map(p => {
                const lastMoodValue = p.lastMood?.checkout_mood ?? p.lastMood?.checkin_mood ?? null
                const daysSince = p.lastMood
                  ? Math.floor((Date.now() - new Date(p.lastMood.date).getTime()) / (1000 * 60 * 60 * 24))
                  : null
                const trendBadge    = p.trend ? TREND_BADGE[p.trend] : null
                // HU-067 — sesión próxima para este paciente
                const nextSession   = getNextSessionForPatient(p.id)

                return (
                  <div key={p.id} style={{
                    ...cardStyle,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '1rem', flexWrap: 'wrap', opacity: p.active ? 1 : 0.5,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: '50%', background: '#EAF0E6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.1rem', fontWeight: 600, color: '#6B7D5C', flexShrink: 0,
                      }}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, color: '#1C1917', fontSize: '0.95rem' }}>{p.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          {lastMoodValue != null && <span style={{ fontSize: '0.85rem' }}>{MOOD_EMOJI[lastMoodValue] ?? '—'}</span>}
                          {daysSince != null && (
                            <span style={{ fontSize: '0.75rem', color: '#78716C' }}>
                              {daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince} days ago`}
                            </span>
                          )}
                          {trendBadge && (
                            <span style={{
                              fontSize: '0.72rem', fontWeight: 600,
                              background: trendBadge.bg, color: trendBadge.color,
                              padding: '0.15rem 0.55rem', borderRadius: '999px',
                              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            }}>
                              {trendBadge.icon} {trendBadge.label}
                            </span>
                          )}
                          {/* HU-067 — badge sesión próxima */}
                          {nextSession && (
                            <span style={{
                              fontSize: '0.7rem', fontWeight: 600,
                              background: '#E0F2FE', color: '#0369A1',
                              padding: '0.15rem 0.55rem', borderRadius: '999px',
                            }}>
                              📅 {formatSessionTime(nextSession.scheduledAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem', color: '#78716C' }}>
                      <span>{p.totalSessions} session{p.totalSessions !== 1 ? 's' : ''}</span>
                      {p.avgRating != null && (
                        <span>{'★'.repeat(Math.round(p.avgRating))}{'☆'.repeat(5 - Math.round(p.avgRating))} {p.avgRating}</span>
                      )}
                    </div>

                    {/* HU-067 — botones acción */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {nextSession && (
                        <button
                          onClick={() => navigate(`/therapist/session/${nextSession.id}`)}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#6B7D5C', border: 'none',
                            borderRadius: '0.85rem',
                            color: '#fff', fontSize: '0.82rem', fontWeight: 500,
                            cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                          }}
                        >
                          ▶ Iniciar sesión
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/therapist/patient/${p.id}`)}
                        style={{
                          padding: '0.5rem 1.1rem',
                          background: 'transparent', border: '0.5px solid #6B7D5C',
                          borderRadius: '0.85rem',
                          color: '#6B7D5C', fontSize: '0.82rem', fontWeight: 500,
                          cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                        }}
                      >
                        View history
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* COLUMNA DERECHA — ALERTS PANEL */}
          <div style={{ ...cardStyle, position: 'sticky', top: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🔔 Alerts
              </div>
              {totalAlerts > 0 && (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#FEE2E2', color: '#DC2626', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                  {totalAlerts}
                </span>
              )}
            </div>

            {alertsLoading ? (
              <p style={{ fontSize: '0.82rem', color: '#78716C', margin: 0 }}>Loading alerts...</p>
            ) : totalAlerts === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👍</div>
                <p style={{ fontSize: '0.82rem', color: '#78716C', margin: 0 }}>All good — no alerts right now.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {alerts?.inactivePatients.map(p => (
                  <div key={p.userId} style={{ padding: '0.75rem', borderRadius: '0.65rem', background: '#FEF3C7', border: '0.5px solid #FCD34D' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#92400E', marginBottom: '0.2rem' }}>
                      ⚠️ {p.name} — no activity
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#92400E' }}>
                      {p.daysSinceLastSession === null
                        ? 'No sessions recorded yet'
                        : `No sessions in ${p.daysSinceLastSession} days`}
                    </div>
                  </div>
                ))}
                {alerts?.notableProgress.map(p => (
                  <div key={p.userId} style={{ padding: '0.75rem', borderRadius: '0.65rem', background: '#EAF0E6', border: '0.5px solid #A8B5A2' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#4A6741', marginBottom: '0.2rem' }}>
                      ✅ Notable progress
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#4A6741' }}>
                      {p.name} improved {p.improvementPercent}% this week
                    </div>
                  </div>
                ))}
                <div style={{ padding: '0.75rem', borderRadius: '0.65rem', background: '#E0F2FE', border: '0.5px solid #7DD3FC' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0369A1', marginBottom: '0.2rem' }}>
                    ℹ️ AI recommendations
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#0369A1' }}>
                    Approval flow available in Sprint 7
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* PROPOSE PROMPT MODAL */}
      {showProposeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: 560, boxShadow: '0 8px 32px rgba(26,28,27,0.12)', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: 0 }}>
                {promptData?.hasPrompt ? 'Propose new prompt version' : 'Create therapeutic prompt'}
              </h2>
              <button
                onClick={() => { setShowProposeModal(false); setProposeError(''); setProposeSuccess('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#78716C' }}
              >✕</button>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#78716C', marginBottom: '1rem', lineHeight: 1.5 }}>
              Define how Elevation AI should interact with your patients. This prompt will be reviewed by a superadmin before becoming active.
            </p>

            {proposeError   && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.875rem', marginBottom: '1rem' }}>{proposeError}</div>}
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
              {newPromptContent.length} characters {newPromptContent.length < 50 ? '(minimum 50)' : '✓'}
            </div>

            <button
              onClick={handleProposePrompt}
              disabled={proposing}
              style={{
                width: '100%', padding: '0.75rem',
                background: proposing ? '#A8B5A2' : '#6B7D5C',
                color: '#fff', border: 'none', borderRadius: '0.85rem',
                fontSize: '0.9rem', fontWeight: 500,
                cursor: proposing ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              {proposing ? 'Submitting...' : 'Submit for review'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}