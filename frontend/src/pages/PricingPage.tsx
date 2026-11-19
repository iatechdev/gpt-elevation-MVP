import { useLanguage } from '../i18n/useLanguage'
import { useLandingContent } from '../content/useLandingContent'
import { PublicFrame } from '../shell/frames'
import { LandingPlans } from '../components/landing/LandingPlans'

/** ES-328: /pricing en el marco público de Cartografía (marca, idioma, tema, pie), como la portada. El selector de idioma es el del marco (arregla B-T0-1). */
export function PricingPage() {
  const { lang } = useLanguage()
  const { text } = useLandingContent(lang)
  return <PublicFrame migrated>
    <LandingPlans text={text} fullPage />
    <p className="pp-notice">{text('landing.pricing.notice')}</p>
  </PublicFrame>
}
