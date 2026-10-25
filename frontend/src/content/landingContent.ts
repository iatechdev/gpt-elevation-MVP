import catalog from '../../../shared/landing-content.json' with { type: 'json' }

export type LandingLanguage = 'es' | 'en'
export type LandingValues = Record<string, unknown>

export function landingText(key: string, lang: LandingLanguage, values?: LandingValues | null): string {
  const entry = catalog.find(entry => entry.key === key)
  if (!entry) throw new Error(`Unknown landing content key: ${key}`)
  const value = values?.[key]
  return typeof value === 'string' && value.trim() ? value : entry[lang]
}

// Network errors, non-object JSON, blank values and missing keys keep the correct language defaults.
export async function loadLandingContent(lang: LandingLanguage, signal?: AbortSignal): Promise<LandingValues> {
  try {
    const response = await fetch(`${import.meta.env?.VITE_BACKEND_URL || ''}/api/landing-content?lang=${lang}`, { signal })
    if (!response.ok) return {}
    const data: unknown = await response.json()
    return data && typeof data === 'object' && !Array.isArray(data) ? data as LandingValues : {}
  } catch {
    return {}
  }
}
