// ES-110: de dónde sale una evidencia que vino de una hoja de vida, y la diferencia entre «declarada» y «respaldada» (por FORMA, no solo por color).
import { useLanguage } from '../i18n/useLanguage'
import type { Evidence } from './model'
import { formatDate } from './resumeSkills'

const DashIcon = () => <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="3 3" aria-hidden="true" className="evidence-ico"><circle cx="12" cy="12" r="8" /></svg>
const CheckIcon = () => <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="evidence-ico"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
const DocIcon = () => <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="evidence-ico"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>

export const DeclaredBadge = ({ short = false }: { short?: boolean }) => { const { t } = useLanguage(); return <span className="evidence-badge evidence-badge-dashed"><DashIcon />{t(short ? 'evidence.rs_declared_short' : 'evidence.rs_declared')}</span> }
export const BackedBadge = () => { const { t } = useLanguage(); return <span className="evidence-badge evidence-badge-solid"><CheckIcon />{t('evidence.rs_backed')}</span> }

// Origen, nivel y estado de una evidencia. Lo escrito a mano o desde el chat no lleva nada de esto.
export function OriginBlock({ row }: { row: Evidence }) {
  const { t, lang } = useLanguage()
  if (!row.origin) return null
  const { origin } = row
  const declared = row.status === 'draft' // hasta que la persona la respalda con una situación real y la confirma, sigue siendo «declarada»
  return <div className="evidence-origin">
    <div className="evidence-chips">
      <span className="evidence-badge evidence-badge-sage"><DocIcon />{t('evidence.rs_origin').replace('{v}', String(origin.version)).replace('{date}', formatDate(origin.date, lang))}</span>
      <span className="evidence-badge evidence-badge-dashed">{t('evidence.rs_level_none')}</span>
      {declared ? <DeclaredBadge short /> : <BackedBadge />}
    </div>
    {origin.needsReview && <div className="evidence-review" role="note"><strong>{t('evidence.rs_review')}</strong>
      <p>{t('evidence.rs_review_text').replace('{v}', String(origin.version))}</p><small>{t('evidence.rs_review_hint')}</small></div>}
    {declared && !origin.needsReview && <small>{t('evidence.rs_back_it')}</small>}
  </div>
}
