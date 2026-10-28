import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { LandingSurface } from '../components/landing/LandingSurface'
import { LandingButton, LandingSection } from '../components/landing/LandingPrimitives'
import { HeroDoors } from '../components/landing/HeroDoors'
import { LandingHeader } from '../components/landing/LandingHeader'
import { ExampleStrip } from '../components/landing/ExampleStrip'
import { LandingFeatures, LandingSkillMap } from '../components/landing/LandingOffering'
import { useLandingContent } from '../content/useLandingContent'
import { useState, useEffect } from 'react'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''

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
          {/* Hero + puertas (ES-63) */}
          <div className="landing-frame">
            <HeroDoors text={landing.text} />
            {/* Franja de ejemplo ilustrativo (ES-64): oculta hasta aprobar el texto */}
            <ExampleStrip text={landing.text} />
          </div>

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

        {/* ES-70 · S7 y S9; S8 se incorporará mediante ES-71. */}
        <LandingFeatures text={landing.text} />
        <LandingSkillMap text={landing.text} />

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
