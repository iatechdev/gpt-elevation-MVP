import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import './mapAccess.css'

/** Tarjeta destacada del inicio: lleva al mapa. No pide datos al servidor ni muestra datos de la persona. */
export function MapAccessCard() {
  const { t } = useLanguage()
  return <section className="map-access" aria-labelledby="map-access-title">
    <div className="map-access-text">
      <p className="map-access-eyebrow">{t('skill_map.eyebrow')}</p>
      <h2 id="map-access-title">{t('skill_map.title')}</h2>
      <p>{t('skill_map.access_text')}</p>
      <Link className="map-access-cta" to="/app/skill-map">{t('skill_map.access_cta')}</Link>
    </div>
    {/* Ilustración decorativa de los cinco territorios; no representa datos. */}
    <svg className="map-access-art" viewBox="0 0 320 190" aria-hidden="true" focusable="false">
      <g stroke="var(--elv-line-control)">
        <rect x="8" y="10" width="100" height="56" rx="16" fill="var(--elv-tone-dir)" />
        <rect x="214" y="6" width="98" height="60" rx="16" fill="var(--elv-tone-con)" />
        <rect x="8" y="124" width="96" height="56" rx="16" fill="var(--elv-tone-com)" />
        <rect x="118" y="120" width="92" height="62" rx="16" fill="var(--elv-tone-ing)" />
        <rect x="222" y="124" width="90" height="56" rx="16" fill="var(--elv-tone-inn)" />
      </g>
      <g stroke="var(--elv-text-2)" strokeWidth="1.5" fill="none" strokeDasharray="4 3"><path d="M108 38H214" /><path d="M58 66V124" /><path d="M262 66V124" /><path d="M160 120V86" /></g>
      <rect x="132" y="66" width="56" height="20" rx="4" fill="var(--elv-card)" stroke="var(--elv-line-control)" />
      <circle cx="143" cy="76" r="4" fill="var(--elv-card)" stroke="var(--elv-text-2)" strokeDasharray="2 2" />
    </svg>
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
