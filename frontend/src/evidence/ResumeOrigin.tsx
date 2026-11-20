// ES-110: de dónde sale una evidencia que vino de una hoja de vida, y la diferencia entre «declarada» y «respaldada» (por FORMA y palabra, no solo por color).
// ES-308 (PR 2): las insignias son `Chip` de Cartografía: «declarada» lleva ○ y «respaldada» lleva ✓ (el símbolo reemplaza el borde punteado frente al relleno).
import './register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useLanguage } from '../i18n/useLanguage'
import { Banner, Chip } from '../cartografia'
import type { Evidence } from './model'
import { formatDate } from './resumeSkills'

export const DeclaredBadge = ({ short = false }: { short?: boolean }) => { const { t } = useLanguage(); return <Chip symbol="○">{t(short ? 'evidence.rs_declared_short' : 'evidence.rs_declared')}</Chip> }
export const BackedBadge = () => { const { t } = useLanguage(); return <Chip tone="ok" symbol="✓">{t('evidence.rs_backed')}</Chip> }

// Origen, nivel y estado de una evidencia. Lo escrito a mano o desde el chat no lleva nada de esto.
export function OriginBlock({ row }: { row: Evidence }) {
  const { t, lang } = useLanguage()
  if (!row.origin) return null
  const { origin } = row
  const declared = row.status === 'draft' // hasta que la persona la respalda con una situación real y la confirma, sigue siendo «declarada»
  return <div className="pg-origin">
    <div className="pg-chips">
      <Chip>{t('evidence.rs_origin').replace('{v}', String(origin.version)).replace('{date}', formatDate(origin.date, lang))}</Chip>
      <Chip>{t('evidence.rs_level_none')}</Chip>
      {declared ? <DeclaredBadge short /> : <BackedBadge />}
    </div>
    {origin.needsReview && <Banner title={t('evidence.rs_review')}><p><strong>{t('evidence.rs_origin_deleted')}</strong></p><p>{t('evidence.rs_origin_deleted_text')}</p><small className="cg-hint">{t('evidence.rs_review_hint')}</small></Banner>}
    {declared && !origin.needsReview && <small className="cg-hint">{t('evidence.rs_back_it')}</small>}
  </div>
}
