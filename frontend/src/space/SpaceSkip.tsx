import { useLanguage } from '../i18n/useLanguage'
import { skipCopy } from './skipCopy'
import './space.css'

// ES-232: vive aparte de SpaceNav para que el arranque no arrastre los textos del chat y del diario. Mismo marcado y mismos estilos que antes.
export function SpaceSkip() {
  const { lang } = useLanguage()
  return <a className="space-skip space-scope" href="#space-main">{skipCopy[lang]}</a>
}
