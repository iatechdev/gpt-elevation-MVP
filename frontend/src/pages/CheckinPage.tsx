import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { BreathingBackground } from '../components/BreathingBackground.tsx'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''

const MOODS = [
  { emoji: '😞', label_key: 'emo_1', value: 0 },
  { emoji: '😔', label_key: 'emo_2', value: 1 },
  { emoji: '😐', label_key: 'emo_3', value: 2 },
  { emoji: '🙂', label_key: 'emo_4', value: 3 },
  { emoji: '😊', label_key: 'emo_5', value: 4 },
]

type Mood = { emoji: string; label_key: string; value: number } | null

export function CheckinPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [mood, setMood] = useState<Mood>(null)
  const [loading, setLoading] = useState(false)

  const handleCheckin = async () => {
    if (!mood) return
    setLoading(true)

    localStorage.setItem('elevation_checkin_date', new Date().toDateString())
    localStorage.setItem('elevation_checkin_mood', String(mood.value))

    // HU-021 — persistir en BD
    try {
      await fetch(`${BACKEND}/api/mood/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('elevation_token')}`,
        },
        body: JSON.stringify({ mood: mood.value }),
      })
    } catch { /* continúa aunque falle el API */ }

    setLoading(false)
    navigate('/app/chat')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '4rem 1.5rem', background: '#f9f9f7', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <BreathingBackground />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', minHeight: 'calc(100vh - 8rem)', gap: '2rem' }}>

        <div style={{ textAlign: 'center', width: '100%' }}>
          <span style={{ display: 'block', fontSize: 10, letterSpacing: '0.2em', color: '#A8A29E', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
            {t('checkin_label')}
          </span>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '2.2rem', color: '#1C1917', marginBottom: '0.5rem' }}>
            {t('checkin_title')}
          </h1>
          <p style={{ color: '#78716C', fontSize: '1rem', margin: 0 }}>
            {t('checkin_subtitle')}
          </p>
        </div>

        <div style={{ overflowX: 'auto', padding: '2rem 0', width: '100%' }}>
          <div style={{ display: 'flex', gap: '1rem', width: 'max-content', margin: '0 auto', padding: '0 1rem' }}>
            {MOODS.map(m => (
              <button key={m.value} onClick={() => setMood(m)}
                style={{
                  width: 120, height: 160,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                  borderRadius: '1rem', cursor: 'pointer', transition: 'all 0.3s',
                  border: mood?.value === m.value ? '2px solid #0d9488' : '1px solid #E7E5E4',
                  background: mood?.value === m.value ? '#F0FDFA' : 'white',
                  fontFamily: 'Inter, sans-serif',
                }}>
                <span style={{ fontSize: '2rem' }}>{m.emoji}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: mood?.value === m.value ? '#0d9488' : '#78716C' }}>
                  {t(m.label_key)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: 380 }}>
          <button onClick={handleCheckin} disabled={!mood || loading}
            style={{
              width: '100%', padding: '1rem',
              color: mood && !loading ? 'white' : '#A8A29E',
              fontWeight: 500, borderRadius: '1.25rem', border: 'none',
              fontSize: '1rem', cursor: mood && !loading ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s',
              background: mood && !loading ? 'linear-gradient(135deg,#00685f,#008378)' : '#E7E5E4',
              fontFamily: 'Inter, sans-serif',
            }}>
            {loading ? '...' : t('btn_continue')}
          </button>
        </div>

      </div>
    </div>
  )
}