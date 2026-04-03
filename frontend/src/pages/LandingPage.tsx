import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { BreathingBackground } from '../components/BreathingBackground.tsx'
import { useState, useEffect } from 'react'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''
const UNSPLASH_URL = 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop&q=60'

type LandingContent = Record<string, string> | null

export function LandingPage() {
  const { t, lang, setLang } = useLanguage()
  const navigate = useNavigate()
  const [content, setContent] = useState<LandingContent>(null)

  useEffect(() => {
    fetch(`${BACKEND}/api/landing-content?lang=${lang}`)
      .then(r => r.json())
      .then((data: Record<string, string>) => setContent(data))
      .catch(() => setContent(null))
  }, [lang])

  // Fallback al i18n si la API falla o no tiene el key
  const getText = (key: string) => content?.[key] ?? t(key)

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: 'Inter, sans-serif', position: 'relative', overflowX: 'hidden' }}>

      <BreathingBackground />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Topbar */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 2rem', background: 'rgba(249,249,247,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(231,229,228,0.4)', position: 'sticky', top: 0, zIndex: 10 }}>
          <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, letterSpacing: '0.25em', fontSize: '1.1rem', color: '#1C1917' }}>ELEVATION</span>
          <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#78716C', cursor: 'pointer' }} onClick={() => navigate('/precios')}>
              {getText('nav_prices')}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['es', 'en'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, border: '0.5px solid #D6D2C4', background: lang === l ? '#6B7D5C' : 'transparent', color: lang === l ? '#FAF8F4' : '#7A7A7A', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={() => navigate('/login')}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem', borderRadius: '0.75rem', border: 'none', background: '#6B7D5C', color: '#FAF8F4', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {getText('cta_primary')}
            </button>
          </nav>
        </header>

        {/* Hero */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', minHeight: '90vh', alignItems: 'center' }}>
          <div style={{ padding: '4rem 2rem 4rem 3rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 560 }}>
            <span style={{ display: 'inline-block', fontSize: 11, letterSpacing: '0.08em', padding: '4px 14px', borderRadius: 12, background: '#EAF0E6', color: '#3B6D11', width: 'fit-content' }}>
              {getText('hero_badge')}
            </span>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: '#1C1917', lineHeight: 1.25, margin: 0 }}>
              {getText('hero_title')}
            </h1>
            <p style={{ fontSize: '1rem', color: '#78716C', lineHeight: 1.75, margin: 0, maxWidth: 460 }}>
              {getText('hero_subtitle')}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <button onClick={() => navigate('/login')}
                style={{ padding: '0.85rem 2rem', borderRadius: '0.85rem', border: 'none', background: '#6B7D5C', color: '#FAF8F4', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {getText('cta_primary')}
              </button>
              <button onClick={() => document.getElementById('proceso')?.scrollIntoView({ behavior: 'smooth' })}
                style={{ padding: '0.85rem 2rem', borderRadius: '0.85rem', border: '0.5px solid #A8B5A2', background: 'transparent', color: '#6B7D5C', fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {getText('cta_secondary')}
              </button>
            </div>
          </div>
          <div style={{ minHeight: 400, overflow: 'hidden' }}>
            <img src={UNSPLASH_URL} alt="Calma interior"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
          </div>
        </section>

        {/* Proceso */}
        <section id="proceso" style={{ padding: '5rem 2rem', background: 'rgba(250,248,244,0.9)', backdropFilter: 'blur(8px)' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.15em', color: '#A8A29E', textAlign: 'center', marginBottom: '3rem', textTransform: 'uppercase' }}>
              {lang === 'es' ? 'EL PROCESO' : 'THE PROCESS'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
              {[
                { n: 1, title: getText('step1_title'), desc: getText('step1_desc') },
                { n: 2, title: getText('step2_title'), desc: getText('step2_desc') },
                { n: 3, title: getText('step3_title'), desc: getText('step3_desc') },
              ].map(s => (
                <div key={s.n} style={{ padding: '2rem', borderRadius: '1rem', border: '0.5px solid #D6D2C4', background: 'rgba(244,241,236,0.6)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6B7D5C', color: '#FAF8F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500 }}>{s.n}</div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 500, color: '#1C1917', margin: 0, fontFamily: 'Playfair Display, serif' }}>{s.title}</h3>
                  <p style={{ fontSize: '0.9rem', color: '#78716C', lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Beneficios */}
        <section style={{ padding: '5rem 2rem' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
            {[
              { icon: '🔒', title: lang === 'es' ? 'Privado y seguro'    : 'Private & secure',  desc: lang === 'es' ? 'Conversaciones encriptadas AES-256.' : 'AES-256 encrypted conversations.' },
              { icon: '⏰', title: lang === 'es' ? 'Disponible 24/7'     : 'Available 24/7',    desc: lang === 'es' ? 'Siempre que lo necesitás.'           : 'Whenever you need it.' },
              { icon: '🧬', title: lang === 'es' ? 'Basado en evidencia' : 'Evidence-based',    desc: lang === 'es' ? 'TCC, DBT y mindfulness.'              : 'CBT, DBT and mindfulness.' },
            ].map((b, i) => (
              <div key={i} style={{ padding: '2rem', borderRadius: '1rem', background: 'rgba(250,248,244,0.8)', border: '0.5px solid #D6D2C4', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: 28 }}>{b.icon}</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 500, color: '#1C1917', margin: 0 }}>{b.title}</h3>
                <p style={{ fontSize: '0.875rem', color: '#78716C', lineHeight: 1.7, margin: 0 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Final */}
        <section style={{ padding: '5rem 2rem', background: '#6B7D5C' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 400, color: '#FAF8F4', margin: 0, lineHeight: 1.3 }}>
              {getText('cta_final_title')}
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'rgba(250,248,244,0.7)', margin: 0 }}>
              {getText('cta_final_subtitle')}
            </p>
            <button onClick={() => navigate('/login')}
              style={{ padding: '0.9rem 2.5rem', borderRadius: '0.85rem', border: 'none', background: '#FAF8F4', color: '#6B7D5C', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {getText('cta_primary')}
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ padding: '2.5rem 2rem', background: '#f9f9f7', borderTop: '0.5px solid #E7E5E4', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, letterSpacing: '0.2em', fontSize: '0.95rem', color: '#1C1917' }}>ELEVATION</span>
          <p style={{ fontSize: '0.75rem', color: '#A8A29E', margin: 0, textAlign: 'center' }}>{getText('disclaimer')}</p>
          <span style={{ fontSize: '0.75rem', color: '#A8A29E' }}>© {new Date().getFullYear()}</span>
        </footer>

      </div>
    </div>
  )
}