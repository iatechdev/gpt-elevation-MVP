import './register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import './mapAccess.css'

/** Tarjeta del inicio (ES-329, Cartografía): lleva al mapa. No pide datos al servidor ni muestra datos de la persona. */
export function MapAccessCard() {
  const { t } = useLanguage()
  return <section className="cg-card pg-card" aria-labelledby="map-access-title">
    <h2 id="map-access-title">{t('skill_map.title')}</h2>
    <p>{t('skill_map.access_text')}</p>
    <div className="pg-actions"><Link className="cg-btn" to="/app/skill-map">{t('skill_map.access_cta')}</Link></div>
  </section>
}

/** Guía del mapa cuando ninguna capacidad tiene nivel. No promete un nivel automático: la evidencia es el primer paso. */
export function MapGuide() {
  const { t } = useLanguage()
  return <section className="map-guide" aria-labelledby="map-guide-title">
    <h2 id="map-guide-title">{t('skill_map.guide_title')}</h2>
    <p>{t('skill_map.guide_text')}</p>
    <ol><li>{t('skill_map.guide_1')}</li><li>{t('skill_map.guide_2')}</li><li>{t('skill_map.guide_3')}</li></ol>
    <Link className="map-access-cta" to="/app/evidence">{t('skill_map.guide_cta')}</Link>
  </section>
}
