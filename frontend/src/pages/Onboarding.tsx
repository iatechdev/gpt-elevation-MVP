// frontend/src/pages/Onboarding.tsx
// HU-072 — Onboarding de 6 pasos para usuario nuevo

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'

const API      = import.meta.env.VITE_BACKEND_URL || ''
const getToken = () => localStorage.getItem('elevation_token') ?? ''

const TOPICS = [
  { key: 'anxiety',          es: 'Ansiedad',         en: 'Anxiety' },
  { key: 'relationships',    es: 'Relaciones',        en: 'Relationships' },
  { key: 'self-knowledge',   es: 'Autoconocimiento',  en: 'Self-knowledge' },
  { key: 'habits',           es: 'Hábitos',           en: 'Habits' },
  { key: 'other',            es: 'Otro',              en: 'Other' },
]

export function Onboarding() {
  const { lang } = useLanguage()
  const navigate  = useNavigate()

  const [step,       setStep]       = useState(1)
  const [topic,      setTopic]      = useState('')
  const [accepted,   setAccepted]   = useState(false)
  const [wantsMatch, setWantsMatch] = useState<boolean | null>(null)
  const [saving,     setSaving]     = useState(false)

  const TOTAL = 6

  const handleComplete = async () => {
    setSaving(true)
    try {
      await fetch(`${API}/api/user/onboarding-complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ motivation: topic }),
      })
      localStorage.setItem('elevation_onboarding', 'done')
    } catch { /* silent */ }
    finally { setSaving(false) }
    navigate('/app/dashboard')
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh', background: '#F9F9F7', fontFamily: 'Inter, sans-serif',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem',
  }
  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: '1.25rem', border: '0.5px solid #E7E5E4',
    boxShadow: '0 4px 24px rgba(26,28,27,0.08)', padding: '2.5rem 2rem', width: '100%', maxWidth: 480,
  }
  const chipStyle = (selected: boolean): React.CSSProperties => ({
    padding: '0.55rem 1rem', borderRadius: '999px',
    border: `1px solid ${selected ? '#6B7D5C' : '#E7E5E4'}`,
    background: selected ? '#EAF0E6' : '#fff', color: selected ? '#4A6741' : '#78716C',
    fontSize: '0.875rem', fontWeight: selected ? 600 : 400,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
  })
  const btnPrimary: React.CSSProperties = {
    width: '100%', padding: '0.85rem', background: '#6B7D5C', color: '#fff',
    border: 'none', borderRadius: '0.85rem', fontSize: '0.9rem', fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginTop: '1.5rem',
  }
  const btnSecondary: React.CSSProperties = {
    background: 'none', border: 'none', color: '#A8A29E', fontSize: '0.82rem',
    cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginTop: '0.75rem',
  }

  const Stepper = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2rem' }}>
      {Array.from({ length: TOTAL }, (_, i) => (
        <div key={i} style={{ width: i + 1 === step ? 20 : 8, height: 8, borderRadius: 999, background: i + 1 <= step ? '#6B7D5C' : '#E7E5E4', transition: 'all 0.2s' }} />
      ))}
      <span style={{ fontSize: '0.72rem', color: '#A8A29E', marginLeft: '0.5rem' }}>{step}/{TOTAL}</span>
    </div>
  )
  const Title = ({ text }: { text: string }) => (
    <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.5rem', color: '#1C1917', margin: '0 0 0.5rem' }}>{text}</h1>
  )
  const Subtitle = ({ text }: { text: string }) => (
    <p style={{ fontSize: '0.875rem', color: '#78716C', margin: '0 0 1.5rem', lineHeight: 1.6 }}>{text}</p>
  )

  if (step === 1) return (
    <div style={containerStyle}><div style={cardStyle}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.3em', color: '#A8A29E', textTransform: 'uppercase' }}>ELEVATION</span>
      </div>
      <Stepper />
      <Title text={lang === 'es' ? '¡Bienvenido/a a Elevation!' : 'Welcome to Elevation!'} />
      <Subtitle text={lang === 'es' ? 'Un espacio donde la inteligencia artificial, los terapeutas humanos y vos trabajan juntos para construir tu bienestar.' : 'A space where AI, human therapists and you work together to build your wellbeing.'} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1rem' }}>
        {[
          { icon: '🤖', text: lang === 'es' ? 'IA empática disponible 24/7' : 'Empathetic AI available 24/7' },
          { icon: '🧑‍⚕️', text: lang === 'es' ? 'Terapeutas humanos certificados' : 'Certified human therapists' },
          { icon: '📈', text: lang === 'es' ? 'Seguimiento de tu progreso emocional' : 'Emotional progress tracking' },
        ].map(item => (
          <div key={item.icon} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#F5F3EF', borderRadius: '0.65rem' }}>
            <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
            <span style={{ fontSize: '0.875rem', color: '#1C1917' }}>{item.text}</span>
          </div>
        ))}
      </div>
      <button style={btnPrimary} onClick={() => setStep(2)}>{lang === 'es' ? 'Empezar →' : 'Get started →'}</button>
    </div></div>
  )

  if (step === 2) return (
    <div style={containerStyle}><div style={cardStyle}>
      <Stepper />
      <Title text={lang === 'es' ? '¿Qué te trajo hasta acá?' : 'What brought you here?'} />
      <Subtitle text={lang === 'es' ? 'Elegí el tema principal que querés trabajar. Esto personaliza tu experiencia.' : 'Choose the main topic you want to work on. This personalizes your experience.'} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {TOPICS.map(t => (
          <button key={t.key} onClick={() => setTopic(t.key)} style={chipStyle(topic === t.key)}>
            {lang === 'es' ? t.es : t.en}
          </button>
        ))}
      </div>
      <button style={{ ...btnPrimary, opacity: topic ? 1 : 0.5 }} disabled={!topic} onClick={() => setStep(3)}>
        {lang === 'es' ? 'Continuar →' : 'Continue →'}
      </button>
      <div style={{ textAlign: 'center' }}>
        <button style={btnSecondary} onClick={() => setStep(1)}>← {lang === 'es' ? 'Volver' : 'Back'}</button>
      </div>
    </div></div>
  )

  if (step === 3) return (
    <div style={containerStyle}><div style={cardStyle}>
      <Stepper />
      <Title text={lang === 'es' ? 'Así funciona Elevation' : 'How Elevation works'} />
      <Subtitle text={lang === 'es' ? 'Cada día tiene tres momentos clave:' : 'Each day has three key moments:'} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '0.5rem' }}>
        {[
          { s: '1', icon: '😊', title: lang === 'es' ? 'Check-in' : 'Check-in', desc: lang === 'es' ? 'Registrás cómo llegás al día' : 'You log how you arrive to the day' },
          { s: '2', icon: '💬', title: lang === 'es' ? 'Conversación' : 'Conversation', desc: lang === 'es' ? 'Hablás con la IA de Elevation' : 'You talk with Elevation AI' },
          { s: '3', icon: '🌙', title: lang === 'es' ? 'Check-out' : 'Check-out', desc: lang === 'es' ? 'Cerrás el día registrando cómo te vas' : 'You close the day logging how you leave' },
        ].map(item => (
          <div key={item.s} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.85rem', background: '#F5F3EF', borderRadius: '0.65rem' }}>
            <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1C1917' }}>{item.title}</div>
              <div style={{ fontSize: '0.8rem', color: '#78716C', marginTop: '0.1rem' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <button style={btnPrimary} onClick={() => setStep(4)}>{lang === 'es' ? 'Entendido →' : 'Got it →'}</button>
      <div style={{ textAlign: 'center' }}>
        <button style={btnSecondary} onClick={() => setStep(2)}>← {lang === 'es' ? 'Volver' : 'Back'}</button>
      </div>
    </div></div>
  )

  if (step === 4) return (
    <div style={containerStyle}><div style={cardStyle}>
      <Stepper />
      <Title text={lang === 'es' ? 'Tu privacidad, primero' : 'Your privacy, first'} />
      <Subtitle text={lang === 'es' ? 'Elevation toma tu privacidad muy en serio:' : 'Elevation takes your privacy very seriously:'} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
        {[
          lang === 'es' ? '🔒 Tus conversaciones están encriptadas con AES-256' : '🔒 Your conversations are AES-256 encrypted',
          lang === 'es' ? '🚫 Nunca vendemos tus datos a terceros' : '🚫 We never sell your data to third parties',
          lang === 'es' ? '👁 Solo vos y tu terapeuta ven tu información' : '👁 Only you and your therapist see your info',
          lang === 'es' ? '🗑 Podés eliminar tu cuenta y datos en cualquier momento' : '🗑 You can delete your account and data anytime',
        ].map((item, i) => (
          <div key={i} style={{ fontSize: '0.875rem', color: '#44403C', padding: '0.6rem 0.85rem', background: '#F5F3EF', borderRadius: '0.65rem' }}>{item}</div>
        ))}
      </div>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
        <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
          style={{ marginTop: '2px', accentColor: '#6B7D5C', width: 16, height: 16, flexShrink: 0 }} />
        <span style={{ fontSize: '0.82rem', color: '#78716C', lineHeight: 1.5 }}>
          {lang === 'es' ? 'Entiendo la política de privacidad y acepto los términos de uso de Elevation.' : 'I understand the privacy policy and accept Elevation\'s terms of use.'}
        </span>
      </label>
      <button style={{ ...btnPrimary, opacity: accepted ? 1 : 0.4 }} disabled={!accepted} onClick={() => setStep(5)}>
        {lang === 'es' ? 'Aceptar y continuar →' : 'Accept and continue →'}
      </button>
      <div style={{ textAlign: 'center' }}>
        <button style={btnSecondary} onClick={() => setStep(3)}>← {lang === 'es' ? 'Volver' : 'Back'}</button>
      </div>
    </div></div>
  )

  if (step === 5) return (
    <div style={containerStyle}><div style={cardStyle}>
      <Stepper />
      <Title text={lang === 'es' ? '¿Querés trabajar con un terapeuta?' : 'Do you want to work with a therapist?'} />
      <Subtitle text={lang === 'es' ? 'Podés explorar Elevation solo con la IA, o conectarte con un terapeuta certificado.' : 'You can explore Elevation with AI only, or connect with a certified therapist.'} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button onClick={() => { setWantsMatch(true); setStep(6) }}
          style={{ padding: '1rem', border: `1.5px solid ${wantsMatch === true ? '#6B7D5C' : '#E7E5E4'}`, background: wantsMatch === true ? '#EAF0E6' : '#fff', borderRadius: '0.85rem', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1C1917' }}>🧑‍⚕️ {lang === 'es' ? 'Sí, quiero encontrar mi terapeuta' : 'Yes, I want to find my therapist'}</div>
          <div style={{ fontSize: '0.78rem', color: '#78716C', marginTop: '0.25rem' }}>{lang === 'es' ? 'Te ayudamos a encontrar el ideal para vos' : 'We\'ll help you find the right one for you'}</div>
        </button>
        <button onClick={() => { setWantsMatch(false); setStep(6) }}
          style={{ padding: '1rem', border: `1.5px solid ${wantsMatch === false ? '#6B7D5C' : '#E7E5E4'}`, background: wantsMatch === false ? '#EAF0E6' : '#fff', borderRadius: '0.85rem', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1C1917' }}>🤖 {lang === 'es' ? 'Por ahora solo quiero explorar' : 'For now I just want to explore'}</div>
          <div style={{ fontSize: '0.78rem', color: '#78716C', marginTop: '0.25rem' }}>{lang === 'es' ? 'Podés conectarte con un terapeuta más adelante' : 'You can connect with a therapist later'}</div>
        </button>
      </div>
      <div style={{ textAlign: 'center' }}>
        <button style={btnSecondary} onClick={() => setStep(4)}>← {lang === 'es' ? 'Volver' : 'Back'}</button>
      </div>
    </div></div>
  )

  return (
    <div style={containerStyle}><div style={{ ...cardStyle, textAlign: 'center' }}>
      <Stepper />
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌿</div>
      <Title text={lang === 'es' ? '¡Todo listo!' : 'All set!'} />
      <Subtitle text={lang === 'es'
        ? wantsMatch ? 'Podés buscar tu terapeuta desde el dashboard cuando quieras. Empecemos con tu primer check-in.' : 'Tu espacio de bienestar está listo. Empecemos con tu primer check-in del día.'
        : wantsMatch ? 'You can find your therapist from the dashboard anytime. Let\'s start with your first check-in.' : 'Your wellness space is ready. Let\'s start with your first check-in of the day.'} />
      <div style={{ background: '#F5F3EF', borderRadius: '0.85rem', padding: '1rem', marginBottom: '0.5rem' }}>
        <p style={{ fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '0.95rem', color: '#1C1917', lineHeight: 1.7, margin: 0 }}>
          {lang === 'es' ? '"El bienestar es un camino, no un destino. Cada día cuenta."' : '"Wellbeing is a journey, not a destination. Every day counts."'}
        </p>
      </div>
      <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleComplete}>
        {saving ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? '✓ Empezar mi primer check-in' : '✓ Start my first check-in')}
      </button>
    </div></div>
  )
}