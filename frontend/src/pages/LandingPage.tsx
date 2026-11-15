import { lazy, Suspense } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import { PublicFrame } from '../shell/frames'
import { Hero } from '../components/portada/Portada'
import { useLandingContent } from '../content/useLandingContent'

// Lo conservado de ES-61…74 (planes, confianza, preguntas, proyecto, acceso y cierre) va en su propio bloque: se pide a la vez que la portada, sin bloquear el primer pintado ni pesar en el arranque.
// «Pruébalo con una escena», los pasos y el hueco de fotografía van en su bloque; mientras llega, un marco con la misma altura evita que el contenido de abajo salte.
const PortadaBody = lazy(() => import('../components/portada/PortadaBody'))
const LandingTail = lazy(() => import('../components/landing/LandingTail'))

/** ES-155 (tramo C): la portada pasa a Cartografía dentro del marco público (cabecera, idioma, un solo main, pie). Reemplaza el héroe, el ejemplo y el recorrido de ES-61…74;
 *  los planes, la confianza y las preguntas, el proyecto, el acceso y el cierre SE CONSERVAN debajo (mismo contenido del CMS `landing.*`, con los colores del sistema). */
export function LandingPage() {
  const { lang, t } = useLanguage()
  const landing = useLandingContent(lang)
  const text = landing.text
  return (
    <PublicFrame migrated>
      <Hero text={text} />
      {/* Un solo límite para los dos bloques: aparecen a la vez. Si el de abajo llegara antes, el salto al ancla (/#planes) caería sobre un hueco de 60 rem que luego se encoge al llegar el de arriba (E282-1). */}
      <Suspense fallback={<div className="pt-try-skel" aria-hidden="true" />}>
        <PortadaBody text={text} />
        <LandingTail text={text} manifestLabel={t('manifest_public_title')} />
      </Suspense>
    </PublicFrame>
  )
}
