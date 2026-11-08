// ES-207: lectura pública del manifiesto ético activo (sin sesión). Texto plano en párrafos, nunca HTML.
// El servidor solo entrega versión, texto y fecha de publicación (GET /api/manifest/active); la edición vive en /admin/manifest.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { formatDate } from '../i18n/format'
import { Banner } from '../cartografia/pieces'
import { Button } from '../cartografia/controls'
import { BoardFrame, PublicFrame } from '../shell/frames'
import './manifesto.css'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

type Manifesto = { version: string; content: string; publishedAt: string | null }
type State = { status: 'loading' } | { status: 'empty' } | { status: 'error' } | { status: 'ready'; manifesto: Manifesto }

const hasSession = () => { try { return Boolean(localStorage.getItem('elevation_token')) && localStorage.getItem('elevation_role') === 'board' } catch { return false } }

/** Párrafos separados por líneas en blanco; los saltos simples dentro de un párrafo se conservan (CSS pre-line). */
const splitParagraphs = (content: string) => content.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)

function isManifesto(value: unknown): value is Manifesto {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.version === 'string' && typeof data.content === 'string' && (data.publishedAt == null || typeof data.publishedAt === 'string')
}

export function ManifestoPage() {
  const { lang, t } = useLanguage()
  const [state, setState] = useState<State>({ status: 'loading' })
  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ status: 'loading' })
    try {
      const res = await fetch(`${API}/api/manifest/active`, { signal })
      if (!res.ok) throw new Error('http')
      const data: unknown = await res.json()
      if (data && typeof data === 'object' && (data as { content?: unknown }).content === null) { setState({ status: 'empty' }); return }
      if (!isManifesto(data) || !data.content.trim()) throw new Error('shape')
      setState({ status: 'ready', manifesto: { version: data.version, content: data.content, publishedAt: data.publishedAt ?? null } })
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) return
      setState({ status: 'error' })
    }
  }, [])
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [load])

  const Frame = hasSession() ? BoardFrame : PublicFrame
  const date = state.status === 'ready' && state.manifesto.publishedAt ? formatDate(state.manifesto.publishedAt, lang, { dateStyle: 'long' }) : ''
  return (
    <Frame>
      <article className="manifesto" aria-labelledby="manifesto-title">
        <h1 id="manifesto-title" className="cg-h1 manifesto__title">{t('manifest_public_title')}</h1>
        {state.status === 'loading' && <p role="status" aria-live="polite" className="cg-muted">{t('manifest_public_loading')}</p>}
        {state.status === 'error' && (
          <Banner kind="error" title={t('manifest_public_error')}>
            <div className="cg-row"><Button onClick={() => void load()}>{t('manifest_public_retry')}</Button></div>
          </Banner>
        )}
        {state.status === 'empty' && <p className="manifesto__empty">{t('manifest_public_empty')}</p>}
        {state.status === 'ready' && (
          <>
            <p className="cg-tag manifesto__meta">{date ? t('manifest_public_version', { version: state.manifesto.version, date }) : state.manifesto.version}</p>
            <div className="manifesto__body">
              {splitParagraphs(state.manifesto.content).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          </>
        )}
        <p className="manifesto__back"><Link className="cg-btn cg-btn--ghost" to="/">{t('manifest_public_back')}</Link></p>
      </article>
    </Frame>
  )
}
