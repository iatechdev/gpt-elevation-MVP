import type { ReactNode, Ref } from 'react'
import '../cartografia'
import '../cartografia/pages.css'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'

// ES-307: cabecera de pantalla de «Mi espacio» en Cartografía (etiqueta + título + frase de apoyo) para las pantallas ya migradas.
// ES-329: titleRef (opcional) deja el foco en el título al recuperarse de un error (E254-3).
// El marco, el idioma, el tema y «Saltar al contenido» los pone PersonLayout (ES-153); esto es solo el contenido.
export function PersonScreen({ title, lead, wide = false, titleRef, children }: { title: string; lead?: string; wide?: boolean; titleRef?: Ref<HTMLHeadingElement>; children: ReactNode }) {
  const { lang } = useLanguage()
  return <div className="pg">
    <header className="pg-head"><p className="cg-tag">{copy[lang].space}</p><h1 className="pg-title" ref={titleRef} tabIndex={titleRef ? -1 : undefined}>{title}</h1>{lead && <p className="pg-lead">{lead}</p>}</header>
    <div className={`pg-stack${wide ? ' pg-wide' : ''}`}>{children}</div>
  </div>
}

/** Región viva (status/alert) que siempre existe en el DOM; con texto se dibuja como aviso (⚠ en error: nunca solo color). */
export function Notice({ id, error = false, text, children }: { id?: string; error?: boolean; text: string; children?: ReactNode }) {
  return <div id={id} role={error ? 'alert' : 'status'} aria-live="polite" className={text ? `cg-banner${error ? ' cg-banner--error' : ''}` : 'pg-live'}>
    {text && <span className="cg-banner__title">{text}{children}</span>}
  </div>
}
