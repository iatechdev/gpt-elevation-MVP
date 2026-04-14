// HU-046 + HU-050 + HU-067 + HU-082 — Patient history + clinical notes + AI summary + schedule + i18n
// HU-076 — Design system tokens

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  colors, radius, shadow, spacing, typography,
  labelStyle,
  btnPrimaryStyle, btnSecondaryStyle,
} from '../../styles/tokens'
import { useLanguage } from '../../i18n/useLanguage'

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

const NOTE_TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  session_note: { bg: colors.primaryLight,  color: colors.primaryDark },
  observation:  { bg: colors.infoLight,     color: colors.info },
  goal:         { bg: colors.warningLight,  color: colors.warning },
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

const rowStyle: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  padding:        `${spacing.md} ${spacing.lg}`,
  background:     colors.bgMuted,
  borderRadius:   radius.md,
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

const selStyle: React.CSSProperties = {
  padding:      `${spacing.sm} ${spacing.md}`,
  borderRadius: radius.md,
  border:       `0.5px solid ${colors.border}`,
  background:   colors.bgCard,
  fontSize:     13,
  color:        colors.text,
  fontFamily:   typography.fontBody,
  cursor:       'pointer',
}

export function TherapistPatient() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()

  const NOTE_TYPE_LABEL: Record<string, string> = {
    session_note: t('therapist_note_type_session'),
    observation:  t('therapist_note_type_obs'),
    goal:         t('therapist_note_type_goal'),
  }

  const MOOD_LABEL: Record<number, string> = {
    1: t('emo_1'), 2: t('emo_2'), 3: t('emo_3'), 4: t('emo_4'), 5: t('emo_5'),
  }

  const [patient,  setPatient]  = useState<Patient | null>(null)
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([])
  const [ratings,  setRatings]  = useState<SessionRating[]>([])
  const [notes,    setNotes]    = useState<ClinicalNote[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // AI Summary
  const [aiSummary,         setAiSummary]        = useState<AISummary | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)

  // Note form
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteContent,  setNoteContent]  = useState('')
  const [noteType,     setNoteType]     = useState<'session_note' | 'observation' | 'goal'>('session_note')
  const [noteDate,     setNoteDate]     = useState(new Date().toISOString().split('T')[0])
  const [savingNote,   setSavingNote]   = useState(false)
  const [noteError,    setNoteError]    = useState('')

  // Edit note
  const [editingNote, setEditingNote] = useState<ClinicalNote | null>(null)
  const [editContent, setEditContent] = useState('')
  const [savingEdit,  setSavingEdit]  = useState(false)

  // Filter
  const [filterType, setFilterType] = useState('all')

  // Schedule session
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
      setSchedulingOk(`✓ ${new Date(schedDateTime).toLocaleString('es-CO', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`)
      setSchedDateTime(minDateTime())
      setSchedDuration(50)
      setTimeout(() => { setShowSchedule(false); setSchedulingOk('') }, 2500)
    } catch {
      setSchedulingError(t('error_connection'))
    } finally {
      setScheduling(false)
    }
  }

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
      setError(t('therapist_not_found'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHistory() }, [id])

  const handleSaveNote = async () => {
    setNoteError('')
    if (!noteContent.trim()) { setNoteError(t('therapist_note_placeholder')); return }
    setSavingNote(true)
    try {
      const res = await fetch(`${API}/api/therapist/pacientes/${id}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: noteContent, type: noteType, sessionDate: noteDate }),
      })
      if (!res.ok) { const d = await res.json(); setNoteError(d.error || t('error_connection')); return }
      setNoteContent(''); setShowNoteForm(false)
      await fetchHistory()
    } catch { setNoteError(t('error_connection')) }
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
      setAiSummary(await res.json())
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
    new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

  if (loading) return (
    <p style={{ color: colors.textMuted, fontSize: 13, fontFamily: typography.fontBody }}>
      {t('therapist_loading_history')}
    </p>
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

      {/* SUMMARY CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: spacing.lg,
        marginBottom: spacing.xxl,
      }}>
        {[
          { label: t('therapist_total_sessions'), value: moodLogs.length },
          { label: t('therapist_avg_mood_label'), value: avgMood ?? '—' },
          { label: t('therapist_avg_rating_label'), value: avgRating ? `${avgRating} ★` : '—' },
          { label: t('therapist_notes_count'),    value: notes.length },
        ].map(c => (
          <div key={c.label} style={cardStyle}>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: colors.text }}>{c.value}</div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: spacing.xs }}>{c.label}</div>
          </div>
        ))}
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
              background: generatingSummary ? colors.textSubtle : '#0d9488',
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
              {t('rec_generated_at')} {formatDate(aiSummary.generatedAt)} · {aiSummary.basedOn.sessions} {t('therapist_sessions')} · {aiSummary.basedOn.notes} {t('therapist_notes_count')}
            </div>
          </div>
        )}
      </div>

      {/* CLINICAL NOTES */}
      <div style={{ ...cardStyle, marginBottom: spacing.lg }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.lg, flexWrap: 'wrap', gap: spacing.md,
        }}>
          <h2 style={{
            fontFamily: typography.fontDisplay, fontWeight: 400,
            fontSize: '1.1rem', color: colors.text, margin: 0,
          }}>
            {t('therapist_clinical_notes')}
          </h2>
          <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
            <select style={selStyle} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">{t('therapist_filter_all')}</option>
              <option value="session_note">{t('therapist_filter_session')}</option>
              <option value="observation">{t('therapist_filter_obs')}</option>
              <option value="goal">{t('therapist_filter_goal')}</option>
            </select>
            <button
              onClick={() => { setShowNoteForm(!showNoteForm); setNoteError('') }}
              style={{ ...btnPrimaryStyle, fontSize: 12, padding: `${spacing.sm} ${spacing.md}` }}
            >
              {t('therapist_new_note')}
            </button>
          </div>
        </div>

        {showNoteForm && (
          <div style={{
            background: colors.bg,
            borderRadius: radius.md,
            padding: spacing.lg,
            marginBottom: spacing.lg,
            border: `0.5px solid ${colors.border}`,
          }}>
            <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md, flexWrap: 'wrap' }}>
              <select style={selStyle} value={noteType} onChange={e => setNoteType(e.target.value as typeof noteType)}>
                <option value="session_note">{t('therapist_note_type_session')}</option>
                <option value="observation">{t('therapist_note_type_obs')}</option>
                <option value="goal">{t('therapist_note_type_goal')}</option>
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
              placeholder={t('therapist_note_placeholder')}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
            {noteError && (
              <p style={{ color: colors.danger, fontSize: 12, margin: `${spacing.xs} 0 0` }}>
                {noteError}
              </p>
            )}
            <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowNoteForm(false); setNoteError('') }}
                style={{ ...btnSecondaryStyle, fontSize: 12, padding: `${spacing.sm} ${spacing.md}` }}
              >
                {t('btn_cancel')}
              </button>
              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                style={{
                  ...btnPrimaryStyle,
                  fontSize: 12,
                  padding: `${spacing.sm} ${spacing.md}`,
                  background: savingNote ? colors.textSubtle : colors.primary,
                  cursor: savingNote ? 'not-allowed' : 'pointer',
                }}
              >
                {savingNote ? t('therapist_saving') : t('therapist_save_note_btn')}
              </button>
            </div>
          </div>
        )}

        {filteredNotes.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: 13 }}>
            {t('therapist_no_notes')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {filteredNotes.map(note => (
              <div key={note.id} style={{
                padding: `${spacing.md} ${spacing.lg}`,
                background: colors.bg,
                borderRadius: radius.md,
                border: `0.5px solid ${colors.border}`,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: spacing.sm,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      padding: `2px ${spacing.sm}`,
                      borderRadius: radius.full,
                      background: NOTE_TYPE_COLOR[note.type]?.bg ?? colors.primaryLight,
                      color:      NOTE_TYPE_COLOR[note.type]?.color ?? colors.primaryDark,
                    }}>
                      {NOTE_TYPE_LABEL[note.type] ?? note.type}
                    </span>
                    <span style={{ fontSize: 12, color: colors.textMuted }}>
                      {formatDate(note.sessionDate)}
                    </span>
                  </div>
                  <button
                    onClick={() => { setEditingNote(note); setEditContent(note.content) }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: colors.textSubtle,
                      fontFamily: typography.fontBody,
                    }}
                  >
                    {t('therapist_edit')}
                  </button>
                </div>

                {editingNote?.id === note.id ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                    />
                    <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setEditingNote(null); setEditContent('') }}
                        style={{ ...btnSecondaryStyle, fontSize: 12, padding: `${spacing.xs} ${spacing.md}` }}
                      >
                        {t('btn_cancel')}
                      </button>
                      <button
                        onClick={handleEditNote}
                        disabled={savingEdit}
                        style={{
                          ...btnPrimaryStyle,
                          fontSize: 12,
                          padding: `${spacing.xs} ${spacing.md}`,
                          background: savingEdit ? colors.textSubtle : colors.primary,
                          cursor: savingEdit ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {savingEdit ? t('therapist_saving') : t('btn_save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: colors.text, margin: 0, lineHeight: 1.6 }}>
                    {note.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MOOD + RATINGS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>

        <div style={cardStyle}>
          <h2 style={{
            fontFamily: typography.fontDisplay, fontWeight: 400,
            fontSize: '1.1rem', color: colors.text, margin: `0 0 ${spacing.lg}`,
          }}>
            {t('therapist_emotional_history')}
          </h2>
          {moodLogs.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: 13 }}>{t('therapist_no_moods')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              {moodLogs.map(log => (
                <div key={log.id} style={rowStyle}>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>
                    {formatDate(log.date)}
                  </span>
                  <div style={{ display: 'flex', gap: spacing.lg, alignItems: 'center' }}>
                    {log.checkin_mood != null && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem' }}>{MOOD_EMOJI[log.checkin_mood]}</div>
                        <div style={{ fontSize: 10, color: colors.textSubtle }}>{t('therapist_checkin')}</div>
                      </div>
                    )}
                    {log.checkout_mood != null && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem' }}>{MOOD_EMOJI[log.checkout_mood]}</div>
                        <div style={{ fontSize: 10, color: colors.textSubtle }}>{t('therapist_checkout')}</div>
                      </div>
                    )}
                    {log.checkin_mood != null && log.checkout_mood != null && (
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: log.checkout_mood >= log.checkin_mood ? colors.success : colors.danger,
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

        <div style={cardStyle}>
          <h2 style={{
            fontFamily: typography.fontDisplay, fontWeight: 400,
            fontSize: '1.1rem', color: colors.text, margin: `0 0 ${spacing.lg}`,
          }}>
            {t('therapist_session_ratings')}
          </h2>
          {ratings.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: 13 }}>{t('therapist_no_ratings')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              {ratings.map(r => (
                <div key={r.id} style={rowStyle}>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>
                    {formatDate(r.date)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <span style={{ fontSize: '0.9rem', color: colors.primary }}>
                      {'★'.repeat(r.rating)}
                      <span style={{ color: colors.border }}>{'★'.repeat(5 - r.rating)}</span>
                    </span>
                    <span style={{ fontSize: 12, color: colors.textMuted }}>
                      {MOOD_LABEL[r.rating] ?? r.rating}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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