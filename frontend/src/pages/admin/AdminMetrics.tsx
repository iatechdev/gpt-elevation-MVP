// frontend/src/pages/admin/AdminMetrics.tsx
// DT-002 — i18n
import { useLanguage } from '../../i18n/useLanguage'

export function AdminMetrics() {
  const { t } = useLanguage()
  return (
    <div>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.8rem', color: '#1C1917', marginBottom: '0.5rem' }}>
        {t('admin_metrics')}
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#78716C' }}>{t('admin_session_activity')}</p>
    </div>
  )
}
