import type { Lang } from './context'

// Idioma inicial: elección guardada; si no hay, el del navegador (EN solo si empieza por "en"); por defecto ES.
export function resolveInitialLang(saved: string | null | undefined, browser: string | null | undefined): Lang {
  if (saved === 'en' || saved === 'es') return saved
  return (browser ?? '').toLowerCase().startsWith('en') ? 'en' : 'es'
}
