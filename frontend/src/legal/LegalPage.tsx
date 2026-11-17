// ES-301: páginas públicas /privacidad y /terminos (mismo componente). Texto estático de legalCopy.ts, SIN revisión legal; los marcadores [POR COMPLETAR] se ven.
// Mientras haya marcadores la página lleva <meta name="robots" content="noindex"> (condición de Infra en ES-301); se quita al retirar el último marcador.
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { Banner } from '../cartografia/pieces'
import { PublicFrame } from '../shell/frames'
import { LEGAL, type LegalDoc, type LegalSection } from './legalCopy.ts'
import { hasMarkers, inline } from './markup.tsx'
import './legal.css'

function Section({ section }: { section: LegalSection }) {
  return (
    <section className="lg-section">
      {section.heading && <h2>{section.heading}</h2>}
      {section.bullets && <ul>{section.bullets.map((item, i) => <li key={i}>{inline(item)}</li>)}</ul>}
      {section.numbered && <ol>{section.numbered.map((item, i) => <li key={i}>{inline(item)}</li>)}</ol>}
      {section.paragraphs?.map((paragraph, i) => <p key={i}>{inline(paragraph)}</p>)}
    </section>
  )
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { lang } = useLanguage()
  const content = LEGAL[lang][doc]
  const other = LEGAL[lang][doc === 'privacy' ? 'terms' : 'privacy']
  const title = useRef<HTMLHeadingElement>(null)
  const markers = hasMarkers(doc, lang) || hasMarkers(doc, lang === 'es' ? 'en' : 'es')
  useEffect(() => { document.title = `${content.title} · Elevation` }, [content.title])
  useEffect(() => {
    if (!markers) return
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex'; document.head.appendChild(meta)
    return () => { meta.remove() }
  }, [markers])
  return (
    <PublicFrame migrated>
      <article className="lg" aria-labelledby="lg-title">
        <h1 id="lg-title" ref={title} tabIndex={-1} className="lg-title">{content.title}</h1>
        <Banner title={content.draft}>{content.updated && <p className="lg-updated">{inline(content.updated)}</p>}</Banner>
        {content.sections.map((section, i) => <Section key={i} section={section} />)}
        <nav className="lg-also" aria-label={content.also}>
          <Link to={doc === 'privacy' ? '/terminos' : '/privacidad'}>{other.title}</Link>
          <Link to="/login?mode=register">{content.backToRegister}</Link>
        </nav>
      </article>
    </PublicFrame>
  )
}
