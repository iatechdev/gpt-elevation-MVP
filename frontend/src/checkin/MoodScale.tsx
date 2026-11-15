import './register.ts' // ES-232: catálogo de textos de esta pieza
import { useId } from 'react'
import { MOOD_VALUES, type MoodValue } from './moodLogic.ts'
import { useLanguage } from '../i18n/useLanguage'

/** Glifo de relieve: elipses concéntricas, tantas como el número (decorativo; la palabra y el número llevan el significado). */
function Glyph({ n }: { n: number }) {
  return (
    <svg className="ck-glyph" viewBox="0 0 60 40" width="60" height="40" aria-hidden="true" focusable="false">
      {Array.from({ length: n }, (_, i) => i + 1).map(i => (
        <ellipse key={i} cx="30" cy="20" rx={5 + i * 5} ry={2.5 + i * 2.4} fill="none" stroke="currentColor" strokeWidth={i === n ? 2.2 : 1} />
      ))}
    </svg>
  )
}

/** Escala de cinco palabras (más el número) con radios nativos: flechas cambian la opción, Tab entra una sola vez al grupo; sin emojis. */
export function MoodScale({ value, onChange, disabled, error }: { value: MoodValue | null; onChange: (value: MoodValue) => void; disabled?: boolean; error?: boolean }) {
  const { t } = useLanguage()
  const errorId = useId()
  return (
    <fieldset className="ck-scale" disabled={disabled} aria-describedby={error ? errorId : undefined}>
      <legend className="ck-legend">{t('checkin.legend')}</legend>
      <div className="ck-options">
        {MOOD_VALUES.map(n => (
          <label key={n} className="ck-option">
            <input type="radio" name="mood" value={n} checked={value === n} aria-invalid={error ? true : undefined} onChange={() => onChange(n)} />
            <Glyph n={n} />
            <span className="ck-word">{t(`checkin.mood_${n}`)}</span>
            <span className="ck-num">{n}</span>
          </label>
        ))}
      </div>
      {error && <p id={errorId} className="ck-error" role="alert">{t('checkin.need')}</p>}
    </fieldset>
  )
}
