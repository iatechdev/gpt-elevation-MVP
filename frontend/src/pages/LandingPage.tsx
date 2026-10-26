import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { LandingSurface } from '../components/landing/LandingSurface'
import { LandingButton, LandingLabel, LandingSection } from '../components/landing/LandingPrimitives'
import { LandingHeader } from '../components/landing/LandingHeader'
import { useLandingContent } from '../content/useLandingContent'
import { useState, useEffect } from 'react'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''
const UNSPLASH_URL = 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop&q=60'

type LandingContent = Record<string, string> | null

export function LandingPage() {
  const { t, lang, setLang } = useLanguage()
  const navigate = useNavigate()
  const landing = useLandingContent(lang)
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
    <LandingSurface>
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Cabecera, idioma y salto al contenido (ES-62) */}
        <LandingHeader text={landing.text} lang={lang} setLang={setLang} />

        <main id="contenido" tabIndex={-1}>
        {/* Hero */}
        <LandingSection style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', minHeight: '90vh', alignItems: 'center' }}>
          <div style={{ paddingBlock: 'var(--landing-space)', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
            <LandingLabel style={{ color: 'var(--color-secondary)', width: 'fit-content' }}>
              {getText('hero_badge')}
            </LandingLabel>
            <h1 style={{ color: 'var(--color-base-content)', margin: 0, fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              {getText('hero_title')}
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--landing-muted)', lineHeight: 1.75, margin: 0, maxWidth: 460 }}>
              {getText('hero_subtitle')}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <LandingButton onClick={() => navigate('/login')}
                style={{ padding: '0.85rem 2rem', borderRadius: '0.85rem', border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-content)', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {getText('cta_primary')}
              </LandingButton>
              <LandingButton onClick={() => document.getElementById('proceso')?.scrollIntoView({ behavior: 'smooth' })}
                style={{ padding: '0.85rem 2rem', borderRadius: '0.85rem', border: '0.5px solid var(--color-base-300)', background: 'transparent', color: 'var(--color-primary)', fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                {getText('cta_secondary')}
              </LandingButton>
            </div>
          </div>
          <div style={{ minHeight: 400, overflow: 'hidden' }}>
            <img src={UNSPLASH_URL} alt="Calma interior"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
          </div>
        </LandingSection>

        {/* Proceso */}
        <LandingSection id="proceso" style={{ padding: 'var(--landing-space) var(--landing-gutter)', background: 'var(--color-base-200)', backdropFilter: 'blur(8px)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--landing-muted)', textAlign: 'center', marginBottom: '3rem', textTransform: 'uppercase' }}>
              {lang === 'es' ? 'EL PROCESO' : 'THE PROCESS'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
              {[
                { n: 1, title: getText('step1_title'), desc: getText('step1_desc') },
                { n: 2, title: getText('step2_title'), desc: getText('step2_desc') },
                { n: 3, title: getText('step3_title'), desc: getText('step3_desc') },
              ].map(s => (
                <div key={s.n} style={{ padding: '2rem', borderRadius: '1rem', border: '0.5px solid var(--color-base-300)', background: 'var(--color-base-200)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-primary-content)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500 }}>{s.n}</div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--color-base-content)', margin: 0, fontFamily: 'inherit' }}>{s.title}</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--landing-muted)', lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </LandingSection>

        {/* Beneficios */}
        <LandingSection style={{ padding: 'var(--landing-space) var(--landing-gutter)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
            {[
              { icon: '🔒', title: lang === 'es' ? 'Privado y seguro'    : 'Private & secure',  desc: lang === 'es' ? 'Conversaciones encriptadas AES-256.' : 'AES-256 encrypted conversations.' },
              { icon: '⏰', title: lang === 'es' ? 'Disponible 24/7'     : 'Available 24/7',    desc: lang === 'es' ? 'Siempre que lo necesitás.'           : 'Whenever you need it.' },
              { icon: '🧬', title: lang === 'es' ? 'Basado en evidencia' : 'Evidence-based',    desc: lang === 'es' ? 'TCC, DBT y mindfulness.'              : 'CBT, DBT and mindfulness.' },
            ].map((b, i) => (
              <div key={i} style={{ padding: '2rem', borderRadius: '1rem', background: 'var(--color-base-200)', border: '0.5px solid var(--color-base-300)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: 28 }}>{b.icon}</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--color-base-content)', margin: 0 }}>{b.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--landing-muted)', lineHeight: 1.7, margin: 0 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </LandingSection>

        {/* CTA Final */}
        <LandingSection style={{ padding: 'var(--landing-space) var(--landing-gutter)', background: 'var(--color-primary)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
            <h2 style={{ fontFamily: 'inherit', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 400, color: 'var(--color-primary-content)', margin: 0, lineHeight: 1.3 }}>
              {getText('cta_final_title')}
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-primary-content)', margin: 0 }}>
              {getText('cta_final_subtitle')}
            </p>
            <LandingButton onClick={() => navigate('/login')}
              style={{ padding: '0.9rem 2.5rem', borderRadius: '0.85rem', border: 'none', background: 'var(--color-primary-content)', color: 'var(--color-primary)', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              {getText('cta_primary')}
            </LandingButton>
          </div>
        </LandingSection>

        </main>

        {/* Footer */}
        <footer style={{ padding: '2.5rem 2rem', background: 'var(--color-base-100)', borderTop: '0.5px solid var(--color-base-300)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontFamily: 'inherit', fontWeight: 300, letterSpacing: '0.2em', fontSize: '0.95rem', color: 'var(--color-base-content)' }}>ELEVATION</span>
          <p style={{ fontSize: '0.75rem', color: 'var(--landing-muted)', margin: 0, textAlign: 'center' }}>{getText('disclaimer')}</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--landing-muted)' }}>© {new Date().getFullYear()}</span>
        </footer>

      </div>
    </LandingSurface>
  )
}
