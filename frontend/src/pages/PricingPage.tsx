import { useLanguage } from '../i18n/useLanguage'
import { useLandingContent } from '../content/useLandingContent'
import { LandingSurface } from '../components/landing/LandingSurface'
import { LandingHeader } from '../components/landing/LandingHeader'
import { LandingPlans } from '../components/landing/LandingPlans'

export function PricingPage() {
  const { lang, setLang } = useLanguage()
  const { text } = useLandingContent(lang)
  return <LandingSurface>
    <LandingHeader text={text} lang={lang} setLang={setLang} homeSections />
    <main id="contenido" tabIndex={-1}><LandingPlans text={text} fullPage /></main>
    <footer className="landing-pricing-footer"><p>{text('landing.pricing.notice')}</p></footer>
  </LandingSurface>
}
