// ES-301: marcado mínimo de los textos legales (sin HTML): [[x]] marcador visible, **x** negrita.
import { Fragment, type ReactNode } from 'react'
import { LEGAL, type LegalContent, type LegalDoc } from './legalCopy.ts'

const TOKEN = /(\[\[[^\]]+\]\]|\*\*[^*]+\*\*)/g

/** `[[x]]` → marcador visible «[x]» (texto, no solo color); `**x**` → negrita. Nunca HTML. */
export function inline(text: string): ReactNode[] {
  return text.split(TOKEN).filter(Boolean).map((part, index) => {
    if (part.startsWith('[[')) return <mark key={index} className="lg-todo">{`[${part.slice(2, -2)}]`}</mark>
    if (part.startsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    return <Fragment key={index}>{part}</Fragment>
  })
}

/** ¿El contenido que se muestra tiene algún marcador `[[…]]` (dato por completar)? ES-336: se mira el contenido que de verdad se pinta (el publicado o el del repo). */
export const contentHasMarkers = (content: LegalContent) =>
  [content.updated ?? '', ...content.sections.flatMap(s => [...(s.paragraphs ?? []), ...(s.bullets ?? []), ...(s.numbered ?? [])])].some(text => text.includes('[['))

export const hasMarkers = (doc: LegalDoc, lang: 'es' | 'en') => contentHasMarkers(LEGAL[lang][doc])
