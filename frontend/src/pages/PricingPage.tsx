// frontend/src/pages/PricingPage.tsx
// HU-074 — Página de precios dinámica, bilingüe, consume /api/pricing

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { BreathingBackground } from '../components/BreathingBackground.tsx'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

interface PricingPlan {
  id: number
  name_es: string
  name_en: string
  description_es: string
  description_en: string
  price: number
  currency: string
  period: string
  features_es: string[]
  features_en: string[]
  isHighlighted: boolean
  order: number
}

export function PricingPage() {
  const { t, lang, setLang } = useLanguage()
  const navigate = useNavigate()

  const [plans, setPlans]     = useState<PricingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    fetch(`${API}/api/pricing`)
      .then(r => r.json())
      .then(data => {
        setPlans(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  const getName = (plan: PricingPlan) =>
    lang === 'en' ? plan.name_en : plan.name_es

  const getDescription = (plan: PricingPlan) =>
    lang === 'en' ? plan.description_en : plan.description_es

  const getFeatures = (plan: PricingPlan) =>
    lang === 'en' ? (plan.features_en ?? []) : (plan.features_es ?? [])

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return lang === 'es' ? 'Gratis' : 'Free'
    return new Intl.NumberFormat(lang === 'es' ? 'es-CO' : 'en-US', {
      style: 'currency', currency,
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    }).format(price)
  }

  const formatPeriod = (period: string) => {
    const map: Record<string, Record<string, string>> = {
      month:   { es: '/ mes',         en: '/ month'   },
      year:    { es: '/ año',         en: '/ year'    },
      forever: { es: 'para siempre',  en: 'forever'   },
    }
    return map[period]?.[lang] ?? period
  }

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

        {/* Hero */}
        <section style={{ padding: '5rem 2rem 3rem', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 400, color: '#1C1917', margin: '0 0 1rem', lineHeight: 1.3 }}>
            {lang === 'es' ? 'Elige tu camino' : 'Choose your path'}
          </h1>
          <p style={{ fontSize: '1rem', color: '#78716C', margin: 0, lineHeight: 1.7 }}>
            {lang === 'es' ? 'Sin compromisos. Cancelá cuando quieras.' : 'No commitments. Cancel anytime.'}
          </p>
        </section>

        {/* Planes */}
        <section style={{ padding: '2rem', maxWidth: 860, margin: '0 auto' }}>

          {loading && (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#78716C', fontSize: '0.9rem' }}>
              {lang === 'es' ? 'Cargando planes...' : 'Loading plans...'}
            </div>
          )}

          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#78716C', fontSize: '0.9rem' }}>
              {lang === 'es' ? 'No se pudieron cargar los planes.' : 'Could not load plans.'}
            </div>
          )}

          {!loading && !error && plans.length === 0 && (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#78716C', fontSize: '0.9rem' }}>
              {lang === 'es' ? 'Planes próximamente.' : 'Plans coming soon.'}
            </div>
          )}

          {!loading && !error && plans.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
              {plans.map(plan => (
                <div key={plan.id} style={{
                  padding: '2.5rem 2rem', borderRadius: '1.25rem',
                  border: plan.isHighlighted ? '1.5px solid #6B7D5C' : '0.5px solid #D6D2C4',
                  background: plan.isHighlighted ? 'rgba(107,125,92,0.04)' : '#FAF8F4',
                  display: 'flex', flexDirection: 'column', gap: '1.5rem',
                  position: 'relative',
                }}>
                  {plan.isHighlighted && (
                    <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#6B7D5C', color: '#FAF8F4', fontSize: 10, padding: '3px 14px', borderRadius: 12, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                      {lang === 'es' ? 'MÁS POPULAR' : 'MOST POPULAR'}
                    </span>
                  )}

                  {/* Nombre y precio */}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#7A7A7A', letterSpacing: '0.08em', margin: '0 0 0.5rem' }}>
                      {getName(plan).toUpperCase()}
                    </p>
                    {getDescription(plan) && (
                      <p style={{ fontSize: 12, color: '#A8A29E', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                        {getDescription(plan)}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                      <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '2.5rem', fontWeight: 400, color: '#1C1917' }}>
                        {formatPrice(plan.price, plan.currency)}
                      </span>
                      {plan.price > 0 && (
                        <span style={{ fontSize: 13, color: '#7A7A7A' }}>
                          {formatPeriod(plan.period)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {getFeatures(plan).map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                        <span style={{ color: '#6B7D5C', fontSize: 14, marginTop: 1, flexShrink: 0 }}>✓</span>
                        <span style={{ fontSize: 13, color: '#4A4A4A', lineHeight: 1.5 }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button onClick={() => navigate('/login')}
                    style={{
                      padding: '0.85rem', borderRadius: '0.85rem',
                      border: plan.isHighlighted ? 'none' : '0.5px solid #A8B5A2',
                      background: plan.isHighlighted ? '#6B7D5C' : 'transparent',
                      color: plan.isHighlighted ? '#FAF8F4' : '#6B7D5C',
                      fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif', width: '100%',
                    }}>
                    {lang === 'es' ? 'Comenzar' : 'Get started'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#A8A29E', marginTop: '2rem' }}>
            {lang === 'es'
              ? 'Sin tarjeta de crédito para planes gratuitos. Cancelá cuando quieras.'
              : 'No credit card required for free plans. Cancel anytime.'}
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