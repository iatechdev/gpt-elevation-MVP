// HU-046 + HU-049 + HU-062 + HU-065 + HU-067 + HU-082 + ES-177 — Panel profesional + i18n
// ES-177: cada bloque (Resumen, Próximas sesiones, Personas, Avisos, Validación académica y Guía para la IA) carga su endpoint y falla por separado, con su «Reintentar».

import '../../cartografia/pages.css'
import { useLanguage } from '../../i18n/useLanguage'
import { useSection } from './useSection'
import { AlertsBlock, PeopleBlock, SummaryBlock, UpcomingBlock, type AlertsData, type UpcomingSession } from './PanelSections'
import { ValidationBlock, type ValidationDoc } from './ValidationBlock'
import { GuideBlock, type PromptData } from './GuideBlock'
import type { PanelPerson } from './panelFormat'

export function TherapistDashboard() {
  const { t, lang } = useLanguage()
  const locale = lang === 'es' ? 'es-CO' : 'en-US'

  const people = useSection<PanelPerson[]>('/api/therapist/pacientes')
  const upcoming = useSection<UpcomingSession[]>('/api/sessions/therapist/upcoming')
  const alerts = useSection<AlertsData>('/api/therapist/alerts')
  const validation = useSection<ValidationDoc[]>('/api/therapist/validation/status')
  const guide = useSection<PromptData>('/api/therapist/prompt')

  return (
    <div className="pg tp">
      <header className="pg-head tp-head">
        <h1 className="pg-title">{t('panel_title')}</h1>
      </header>

      <SummaryBlock state={people} t={t} locale={locale} />

      <div className="tp-two">
        <div className="tp-col">
          <UpcomingBlock state={upcoming} t={t} locale={locale} />
          <PeopleBlock state={people} upcoming={upcoming.data ?? []} t={t} locale={locale} />
        </div>
        <div className="tp-col">
          <AlertsBlock state={alerts} t={t} />
          <ValidationBlock state={validation} t={t} locale={locale} />
          <GuideBlock state={guide} t={t} locale={locale} lang={lang} />
        </div>
      </div>
    </div>
  )
}
