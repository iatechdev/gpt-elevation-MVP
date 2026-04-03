// HU-046 + HU-050 — Patient emotional history + clinical notes + AI summary

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
const getToken = () => localStorage.getItem('elevation_token') || ''

interface Patient {
  id: number
  name: string
  email: string
  createdAt: string
}

interface MoodLog {
  id: number
  date: string
  checkin_mood: number | null
  checkout_mood: number | null
}

interface SessionRating {
  id: number
  date: string
  rating: number
}

interface ClinicalNote {
  id: number
  content: string
  type: 'session_note' | 'observation' | 'goal'
  sessionDate: string
  createdAt: string
}

interface AISummary {
  summary: string
  generatedAt: string
  basedOn: { sessions: number; notes: number }
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😊',
}

const MOOD_LABEL: Record<number, string> = {
  1: 'Very low', 2: 'Low', 3: 'Neutral', 4: 'Good', 5: 'Great',
}

const NOTE_TYPE_LABEL: Record<string, string> = {
  session_note: 'Session note',
  observation:  'Observation',
  goal:         'Goal',
}

const NOTE_TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  session_note: { bg: '#EAF0E6', color: '#4A6741' },
  observation:  { bg: '#E0F2FE', color: '#0369A1' },
  goal:         { bg: '#FEF3C7', color: '#92400E' },
}

export function TherapistPatient() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [patient,  setPatient]  = useState<Patient | null>(null)
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([])
  const [ratings,  setRatings]  = useState<SessionRating[]>([])
  const [notes,    setNotes]    = useState<ClinicalNote[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // AI Summary
  const [aiSummary,        setAiSummary]        = useState<AISummary | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)

  // Note form
  const [showNoteForm,  setShowNoteForm]  = useState(false)
  const [noteContent,   setNoteContent]   = useState('')
  const [noteType,      setNoteType]      = useState<'session_note' | 'observation' | 'goal'>('session_note')
  const [noteDate,      setNoteDate]      = useState(new Date().toISOString().split('T')[0])
  const [savingNote,    setSavingNote]    = useState(false)
  const [noteError,     setNoteError]     = useState('')

  // Edit note
  const [editingNote,   setEditingNote]   = useState<ClinicalNote | null>(null)
  const [editContent,   setEditContent]   = useState('')
  const [savingEdit,    setSavingEdit]    = useState(false)

  // Filter
  const [filterType, setFilterType] = useState('all')

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/api/therapist/pacientes/${id}/historia`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPatient(data.patient)
      setMoodLogs(data.moodLogs)
      setRatings(data.ratings)
      setNotes(data.notes)
    } catch {
      setError('Could not load patient history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHistory() }, [id])

  const handleSaveNote = async () => {
    setNoteError('')
    if (!noteContent.trim()) { setNoteError('Note content is required.'); return }
    setSavingNote(true)
    try {
      const res = await fetch(`${API}/api/therapist/pacientes/${id}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: noteContent, type: noteType, sessionDate: noteDate }),
      })
      if (!res.ok) { const d = await res.json(); setNoteError(d.error || 'Error saving note.'); return }
      setNoteContent(''); setShowNoteForm(false)
      await fetchHistory()
    } catch { setNoteError('Connection error.') }
    finally { setSavingNote(false) }
  }

  const handleEditNote = async () => {
    if (!editingNote || !editContent.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`${API}/api/therapist/notas/${editingNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: editContent }),
      })
      if (!res.ok) return
      setEditingNote(null); setEditContent('')
      await fetchHistory()
    } catch { /* silent */ }
    finally { setSavingEdit(false) }
  }

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true)
    try {
      const res = await fetch(`${API}/api/therapist/pacientes/${id}/resumen-ia`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAiSummary(data)
    } catch { /* silent */ }
    finally { setGeneratingSummary(false) }
  }

  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, r) => a + r.rating, 0) / ratings.length) * 10) / 10
    : null

  const avgMood = (() => {
    const all = moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter((v): v is number => v != null)
    return all.length > 0 ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10 : null
  })()

  const filteredNotes = filterType === 'all' ? notes : notes.filter(n => n.type === filterType)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })

  const cardStyle = {
    background: '#fff',
    borderRadius: '1rem',
    border: '0.5px solid #E7E5E4',
    boxShadow: '0 2px 12px rgba(26,28,27,0.06)',
    padding: '1.25rem 1.5rem',
  }

  const selStyle = {
    padding: '0.4rem 0.75rem', borderRadius: '0.65rem',
    border: '0.5px solid #E7E5E4', background: '#fff',
    fontSize: '0.82rem', color: '#1C1917',
    fontFamily: 'Inter, sans-serif', cursor: 'pointer',
  } as React.CSSProperties

  if (loading) return <p style={{ color: '#78716C', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>Loading...</p>
  if (error)   return <p style={{ color: '#DC2626', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>{error}</p>
  if (!patient) return null

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* BACK + HEADER */}
      <div style={{ marginBottom: '2rem' }}>
        <button onClick={() => navigate('/therapist/dashboard')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#78716C', fontSize: '0.82rem', padding: 0,
          fontFamily: 'Inter, sans-serif', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.35rem',
        }}>
          ← Back to patients
        </button>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, fontSize: '1.8rem', color: '#1C1917', margin: 0 }}>
          {patient.name}
        </h1>
        <p style={{ fontSize: '0.82rem', color: '#78716C', margin: '0.25rem 0 0' }}>
          {patient.email} · Member since {formatDate(patient.createdAt)}
        </p>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total sessions', value: moodLogs.length },
          { label: 'Avg mood',       value: avgMood ?? '—' },
          { label: 'Avg rating',     value: avgRating ? `${avgRating} ★` : '—' },
          { label: 'Clinical notes', value: notes.length },
        ].map(card => (
          <div key={card.label} style={cardStyle}>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1C1917' }}>{card.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#78716C', marginTop: '0.2rem' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* ==========================================
          HU-050 — AI SUMMARY
      ========================================== */}
      <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: aiSummary ? '1rem' : 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            AI Clinical Summary
          </div>
          <button
            onClick={handleGenerateSummary}
            disabled={generatingSummary}
            style={{
              padding: '0.45rem 0.85rem', borderRadius: '0.65rem', border: 'none',
              background: generatingSummary ? '#A8B5A2' : '#0d9488',
              color: '#fff', fontSize: '0.78rem', fontWeight: 500,
              cursor: generatingSummary ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            {generatingSummary ? 'Generating...' : aiSummary ? 'Regenerate' : 'Generate summary'}
          </button>
        </div>
        {aiSummary && (
          <div>
            <p style={{ fontSize: '0.875rem', color: '#1C1917', lineHeight: 1.7, margin: '0 0 0.5rem', fontFamily: 'Noto Serif, serif', fontStyle: 'italic' }}>
              "{aiSummary.summary}"
            </p>
            <div style={{ fontSize: '0.72rem', color: '#A8B5A2' }}>
              Generated {formatDate(aiSummary.generatedAt)} · Based on {aiSummary.basedOn.sessions} sessions and {aiSummary.basedOn.notes} notes
            </div>
          </div>
        )}
      </div>

      {/* ==========================================
          HU-050 — CLINICAL NOTES
      ========================================== */}
      <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: 0 }}>
            Clinical Notes
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select style={selStyle} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All types</option>
              <option value="session_note">Session notes</option>
              <option value="observation">Observations</option>
              <option value="goal">Goals</option>
            </select>
            <button
              onClick={() => { setShowNoteForm(!showNoteForm); setNoteError('') }}
              style={{
                padding: '0.45rem 0.85rem', background: '#6B7D5C', border: 'none',
                borderRadius: '0.65rem', color: '#fff', fontSize: '0.78rem',
                fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              + New note
            </button>
          </div>
        </div>

        {/* New note form */}
        {showNoteForm && (
          <div style={{ background: '#F5F3EF', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <select style={selStyle} value={noteType} onChange={e => setNoteType(e.target.value as typeof noteType)}>
                <option value="session_note">Session note</option>
                <option value="observation">Observation</option>
                <option value="goal">Goal</option>
              </select>
              <input
                type="date" value={noteDate}
                onChange={e => setNoteDate(e.target.value)}
                style={{ ...selStyle, cursor: 'text' }}
              />
            </div>
            <textarea
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="Write your clinical note here..."
              rows={4}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '0.65rem',
                border: '0.5px solid #E7E5E4', fontSize: '0.875rem',
                fontFamily: 'Inter, sans-serif', color: '#1C1917',
                boxSizing: 'border-box', outline: 'none', resize: 'vertical',
              }}
            />
            {noteError && <p style={{ color: '#DC2626', fontSize: '0.78rem', margin: '0.35rem 0 0' }}>{noteError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowNoteForm(false); setNoteError('') }}
                style={{ ...selStyle, background: 'transparent' }}>Cancel</button>
              <button onClick={handleSaveNote} disabled={savingNote}
                style={{
                  padding: '0.45rem 0.85rem', background: savingNote ? '#A8B5A2' : '#6B7D5C',
                  border: 'none', borderRadius: '0.65rem', color: '#fff',
                  fontSize: '0.78rem', fontWeight: 500,
                  cursor: savingNote ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
                }}>
                {savingNote ? 'Saving...' : 'Save note'}
              </button>
            </div>
          </div>
        )}

        {/* Notes list */}
        {filteredNotes.length === 0 ? (
          <p style={{ color: '#78716C', fontSize: '0.875rem' }}>No notes yet. Add your first clinical note.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {filteredNotes.map(note => (
              <div key={note.id} style={{ padding: '0.85rem 1rem', background: '#F5F3EF', borderRadius: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      background: NOTE_TYPE_COLOR[note.type]?.bg ?? '#EAF0E6',
                      color: NOTE_TYPE_COLOR[note.type]?.color ?? '#4A6741',
                    }}>
                      {NOTE_TYPE_LABEL[note.type] ?? note.type}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#78716C' }}>{formatDate(note.sessionDate)}</span>
                  </div>
                  <button
                    onClick={() => { setEditingNote(note); setEditContent(note.content) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#A8B5A2', fontFamily: 'Inter, sans-serif' }}
                  >
                    Edit
                  </button>
                </div>

                {editingNote?.id === note.id ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={3}
                      style={{
                        width: '100%', padding: '0.65rem', borderRadius: '0.5rem',
                        border: '0.5px solid #E7E5E4', fontSize: '0.875rem',
                        fontFamily: 'Inter, sans-serif', color: '#1C1917',
                        boxSizing: 'border-box', outline: 'none', resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setEditingNote(null); setEditContent('') }}
                        style={{ ...selStyle, background: 'transparent', padding: '0.3rem 0.65rem' }}>Cancel</button>
                      <button onClick={handleEditNote} disabled={savingEdit}
                        style={{
                          padding: '0.3rem 0.65rem', background: savingEdit ? '#A8B5A2' : '#6B7D5C',
                          border: 'none', borderRadius: '0.5rem', color: '#fff',
                          fontSize: '0.75rem', cursor: savingEdit ? 'not-allowed' : 'pointer',
                          fontFamily: 'Inter, sans-serif',
                        }}>
                        {savingEdit ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.875rem', color: '#1C1917', margin: 0, lineHeight: 1.6 }}>{note.content}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MOOD + RATINGS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

        {/* MOOD HISTORY */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: '0 0 1.25rem' }}>
            Emotional history
          </h2>
          {moodLogs.length === 0 ? (
            <p style={{ color: '#78716C', fontSize: '0.875rem' }}>No mood logs yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {moodLogs.map(log => (
                <div key={log.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem', background: '#F5F3EF', borderRadius: '0.65rem',
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#78716C' }}>{formatDate(log.date)}</span>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {log.checkin_mood != null && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem' }}>{MOOD_EMOJI[log.checkin_mood]}</div>
                        <div style={{ fontSize: '0.62rem', color: '#A8B5A2' }}>Check-in</div>
                      </div>
                    )}
                    {log.checkout_mood != null && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem' }}>{MOOD_EMOJI[log.checkout_mood]}</div>
                        <div style={{ fontSize: '0.62rem', color: '#A8B5A2' }}>Check-out</div>
                      </div>
                    )}
                    {log.checkin_mood != null && log.checkout_mood != null && (
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 600,
                        color: log.checkout_mood >= log.checkin_mood ? '#22C55E' : '#EF4444',
                      }}>
                        {log.checkout_mood >= log.checkin_mood ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SESSION RATINGS */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: '0 0 1.25rem' }}>
            Session ratings
          </h2>
          {ratings.length === 0 ? (
            <p style={{ color: '#78716C', fontSize: '0.875rem' }}>No ratings yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {ratings.map(r => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem', background: '#F5F3EF', borderRadius: '0.65rem',
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#78716C' }}>{formatDate(r.date)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#78716C' }}>
                      {MOOD_LABEL[r.rating] ?? r.rating}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}