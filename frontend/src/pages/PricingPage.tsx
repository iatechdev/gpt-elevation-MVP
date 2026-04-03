import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { BreathingBackground } from '../components/BreathingBackground.tsx'

export function PricingPage() {
  const { t, lang, setLang } = useLanguage()
  const navigate = useNavigate()

  const plans = {
    es: [
      {
        name: 'Free',
        price: '$0',
        period: '/ mes',
        features: [
          '10 conversaciones por mes',
          'Check-in emocional diario',
          'Historial 7 días',
          'Soporte básico',
        ],
        cta: 'Empezar gratis',
        highlighted: false,
      },
      {
        name: 'Pro',
        price: '$9.99',
        period: '/ mes',
        features: [
          'Conversaciones ilimitadas',
          'Check-in + Check-out emocional',
          'Historial completo',
          'Estadísticas emocionales',
          'Soporte prioritario',
        ],
        cta: 'Comenzar prueba gratuita',
        highlighted: true,
      },
    ],
    en: [
      {
        name: 'Free',
        price: '$0',
        period: '/ month',
        features: [
          '10 conversations per month',
          'Daily emotional check-in',
          '7-day history',
          'Basic support',
        ],
        cta: 'Start for free',
        highlighted: false,
      },
      {
        name: 'Pro',
        price: '$9.99',
        period: '/ month',
        features: [
          'Unlimited conversations',
          'Emotional check-in + check-out',
          'Full history',
          'Emotional statistics',
          'Priority support',
        ],
        cta: 'Start free trial',
        highlighted: true,
      },
    ],
  }

  const currentPlans = plans[lang] ?? plans.es

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: 'Inter, sans-serif', position: 'relative', overflowX: 'hidden' }}>

      <BreathingBackground />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Topbar */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 2rem', background: 'rgba(249,249,247,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(231,229,228,0.4)', position: 'sticky', top: 0, zIndex: 10 }}>
          <span onClick={() => navigate('/')}
            style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, letterSpacing: '0.25em', fontSize: '1.1rem', color: '#1C1917', cursor: 'pointer' }}>
            ELEVATION
          </span>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
              {t('cta_primary')}
            </button>
          </div>
        </header>

        {/* Hero precios */}
        <section style={{ padding: '5rem 2rem 3rem', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 400, color: '#1C1917', margin: '0 0 1rem', lineHeight: 1.3 }}>
            {lang === 'es' ? 'Elige tu camino' : 'Choose your path'}
          </h1>
          <p style={{ fontSize: '1rem', color: '#78716C', margin: 0, lineHeight: 1.7 }}>
            {lang === 'es' ? 'Sin compromisos. Cancelá cuando quieras.' : 'No commitments. Cancel anytime.'}
          </p>
        </section>

        {/* Cards de planes */}
        <section style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            {currentPlans.map((plan, i) => (
              <div key={i} style={{
                padding: '2.5rem 2rem',
                borderRadius: '1.25rem',
                border: plan.highlighted ? '1.5px solid #6B7D5C' : '0.5px solid #D6D2C4',
                background: plan.highlighted ? 'rgba(107,125,92,0.04)' : '#FAF8F4',
                display: 'flex', flexDirection: 'column', gap: '1.5rem',
                position: 'relative',
              }}>
                {plan.highlighted && (
                  <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#6B7D5C', color: '#FAF8F4', fontSize: 10, padding: '3px 14px', borderRadius: 12, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                    {lang === 'es' ? 'MÁS POPULAR' : 'MOST POPULAR'}
                  </span>
                )}

                {/* Nombre y precio */}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#7A7A7A', letterSpacing: '0.08em', margin: '0 0 0.5rem' }}>
                    {plan.name.toUpperCase()}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                    <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '2.5rem', fontWeight: 400, color: '#1C1917' }}>{plan.price}</span>
                    <span style={{ fontSize: 13, color: '#7A7A7A' }}>{plan.period}</span>
                  </div>
                </div>

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {plan.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <span style={{ color: '#6B7D5C', fontSize: 14, marginTop: 1, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 13, color: '#4A4A4A', lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button onClick={() => navigate('/login')}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '0.85rem',
                    border: plan.highlighted ? 'none' : '0.5px solid #A8B5A2',
                    background: plan.highlighted ? '#6B7D5C' : 'transparent',
                    color: plan.highlighted ? '#FAF8F4' : '#6B7D5C',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    width: '100%',
                  }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Nota */}
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#A8A29E', marginTop: '2rem' }}>
            {lang === 'es'
              ? 'Sin tarjeta de crédito para el plan Free. Cancelá Pro cuando quieras.'
              : 'No credit card required for Free plan. Cancel Pro anytime.'}
          </p>
        </section>

        {/* Footer */}
        <footer style={{ padding: '2.5rem 2rem', marginTop: '4rem', borderTop: '0.5px solid #E7E5E4', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, letterSpacing: '0.2em', fontSize: '0.95rem', color: '#1C1917', cursor: 'pointer' }}
            onClick={() => navigate('/')}>ELEVATION</span>
          <p style={{ fontSize: '0.75rem', color: '#A8A29E', margin: 0 }}>{t('disclaimer')}</p>
          <span style={{ fontSize: '0.75rem', color: '#A8A29E' }}>© {new Date().getFullYear()}</span>
        </footer>

      </div>
    </div>
  )
}