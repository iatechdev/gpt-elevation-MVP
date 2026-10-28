import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { exercisesEnabled } from './publication'
import './exercises.css'
export function ExerciseTools({ from }: { from: 'chat' | 'dashboard' }) {
  const { t } = useLanguage()
  return <div className="exercise-tools"><span>{t('exercise.ai')}</span>{exercisesEnabled && <Link to={`/app/exercises?from=${from}`}>{t('exercise.title')}</Link>}</div>
}
