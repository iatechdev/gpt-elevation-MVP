// ES-336 (F1): los textos legales se leen de la API (GET /api/legal/:docKey, solo lo PUBLICADO) y la SPA conserva SIEMPRE el texto empaquetado de legalCopy.ts como respaldo.
// Primero se pinta el texto del repo (nunca una página vacía); si la respuesta llega y es válida se sustituye, y ante error, 404, tiempo agotado o forma inválida se queda el del repo.
// El contenido remoto es TEXTO ESTRUCTURADO (nada de HTML): se valida aquí otra vez y se pinta con React (inline() de markup.tsx), nunca como HTML.
import { useEffect, useState } from 'react'
import { LEGAL, type LegalContent, type LegalDoc, type LegalSection, type Lang } from './legalCopy.ts'

// Se calcula al usarse (no al cargar el módulo): las pruebas unitarias importan este archivo sin entorno de Vite.
const apiBase = () => import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const TIMEOUT_MS = 6000
export type LegalRemote = { title: string; banner?: string; updated?: string; sections: LegalSection[] }

const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''
const list = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(text)

/** Valida la forma del contenido recibido; null si no es exactamente la esperada (entonces se conserva el texto del repo). */
export function parseRemote(value: unknown): LegalRemote | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (!text(raw.title) || !Array.isArray(raw.sections) || raw.sections.length === 0) return null
  if (raw.banner !== undefined && !text(raw.banner)) return null
  if (raw.updated !== undefined && !text(raw.updated)) return null
  const sections: LegalSection[] = []
  for (const item of raw.sections) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const section = item as Record<string, unknown>
    const clean: LegalSection = {}
    if (section.heading !== undefined) { if (!text(section.heading)) return null; clean.heading = section.heading }
    for (const kind of ['paragraphs', 'bullets', 'numbered'] as const) {
      if (section[kind] === undefined) continue
      if (!list(section[kind])) return null
      clean[kind] = section[kind] as string[]
    }
    if (!clean.heading && !clean.paragraphs && !clean.bullets && !clean.numbered) return null
    sections.push(clean)
  }
  return { title: raw.title, ...(raw.banner !== undefined ? { banner: raw.banner as string } : {}), ...(raw.updated !== undefined ? { updated: raw.updated as string } : {}), sections }
}

/** El contenido del repo con el texto del documento sustituido por el publicado; la parte de la página (enlaces, «Volver…») siempre es la del repo. */
export function mergeLegal(repo: LegalContent, remote: LegalRemote | null): LegalContent {
  if (!remote) return repo
  return { ...repo, title: remote.title, draft: remote.banner ?? repo.draft, ...(remote.updated !== undefined ? { updated: remote.updated } : { updated: undefined }), sections: remote.sections }
}

/** Respuesta de GET /api/legal/:docKey → contenido válido y del documento/idioma pedidos, o null. */
export function remoteFromResponse(body: unknown, doc: LegalDoc, lang: Lang): LegalRemote | null {
  if (!body || typeof body !== 'object') return null
  const raw = body as Record<string, unknown>
  if (raw.source !== 'db' || raw.docKey !== doc || raw.lang !== lang) return null
  return parseRemote(raw.content)
}

export function useLegalContent(doc: LegalDoc, lang: Lang): { content: LegalContent; source: 'repo' | 'db' } {
  const repo = LEGAL[lang][doc]
  const [remote, setRemote] = useState<{ doc: LegalDoc; lang: Lang; value: LegalRemote } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
    void (async () => {
      try {
        const res = await fetch(`${apiBase()}/api/legal/${doc}?lang=${lang}`, { signal: controller.signal, headers: { Accept: 'application/json' }, credentials: 'omit' })
        if (!res.ok) return
        const value = remoteFromResponse(await res.json(), doc, lang)
        if (value && !controller.signal.aborted) setRemote({ doc, lang, value })
      } catch { /* sin respuesta o inválida: se queda el texto del repo */ } finally { window.clearTimeout(timer) }
    })()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [doc, lang])
  const fromDb = remote && remote.doc === doc && remote.lang === lang ? remote.value : null
  return { content: mergeLegal(repo, fromDb), source: fromDb ? 'db' : 'repo' }
}
