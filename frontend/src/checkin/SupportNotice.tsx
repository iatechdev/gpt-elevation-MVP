import './register.ts' // ES-232: catálogo de textos de esta pieza
import { useEffect, useState } from 'react'
import { Banner } from '../cartografia'
import { useLanguage } from '../i18n/useLanguage'
import { loadContactEntries, type ContactEntry } from './contactEntries.ts'

type Services = { status: 'loading' } | { status: 'ready'; entries: ContactEntry[] } | { status: 'error' }

/** Aviso de apoyo (respuestas «Cargado»/«Bajo»): no clínico, sin diagnóstico ni consejo. Los servicios de ayuda salen de la lista de ES-193 (activos y verificados):
 *  sin entradas o con error se queda el texto genérico, sin ningún número. */
export function SupportNotice({ country }: { country: string | null }) {
  const { t, lang } = useLanguage()
  const [services, setServices] = useState<Services>({ status: 'loading' })
  useEffect(() => {
    if (country === null) return // el país de residencia aún no llegó: no se pide una lista de otro país
    const controller = new AbortController()
    loadContactEntries(country, controller.signal)
      .then(entries => { if (!controller.signal.aborted) setServices({ status: 'ready', entries }) })
      .catch(() => { if (!controller.signal.aborted) setServices({ status: 'error' }) })
    return () => controller.abort()
  }, [country])
  return (
    <Banner title={t('checkin.support_title')}>
      <p>{t('checkin.support_body')}</p>
      {services.status === 'loading' && <p className="ck-muted" role="status">{t('checkin.support_loading')}</p>}
      {services.status === 'error' && <p>{t('checkin.support_error')}</p>}
      {services.status === 'ready' && services.entries.length > 0 && (
        <section aria-label={t('checkin.support_services')}>
          <h2 className="ck-services-title">{t('checkin.support_services')}</h2>
          <ul className="ck-services">
            {services.entries.map(entry => (
              <li key={entry.id}>
                <strong>{entry.name}</strong> <span>{entry.contact}</span>
                <span className="ck-muted">{entry.description[lang]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Banner>
  )
}
