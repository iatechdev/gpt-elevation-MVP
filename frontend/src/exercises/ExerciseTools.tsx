import { useLanguage } from '../i18n/useLanguage'
import './exercises.css'
// Solo la identificación de la IA. El enlace a los ejercicios vive en el menú de «Mi espacio» (SpaceNav), que ya lo ofrece con la bandera activa.
export function ExerciseTools() {
  const { t } = useLanguage()
  return <div className="exercise-tools"><span>{t('exercise.ai')}</span></div>
}
