import { useEffect, useState } from 'react'
import { landingText, loadLandingContent, type LandingLanguage, type LandingValues } from './landingContent'

export function useLandingContent(lang: LandingLanguage) {
  const [loaded, setLoaded] = useState<{ lang: LandingLanguage; values: LandingValues } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void loadLandingContent(lang, controller.signal).then(values => {
      if (!controller.signal.aborted) setLoaded({ lang, values })
    })
    return () => controller.abort()
  }, [lang])
  // Never show the previous language while its replacement is loading.
  const values = loaded?.lang === lang ? loaded.values : null
  return { text: (key: string) => landingText(key, lang, values) }
}
