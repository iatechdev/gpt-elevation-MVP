import { useLanguage } from '../i18n/useLanguage'
import './exercises.css'
// Solo la identificación de la IA. El enlace a los ejercicios vive en «Mis herramientas» (SpaceToolsPage).
export function ExerciseTools() {
  const { t } = useLanguage()
  return <div className="exercise-tools"><span>{t('exercise.ai')}</span></div>
}
