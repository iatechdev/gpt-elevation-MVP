import './accessRegister.ts' // ES-232: catálogo de textos de esta pieza
import { useId, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { PublicFrame } from '../shell/frames'
import './accessCartografia.css'

/** Marco público de Cartografía (marca, idioma, pie) + una tarjeta centrada con el título. Lo usan entrar, crear cuenta y recuperar acceso. */
export function AccessCard({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  const titleId = useId()
  return (
    <PublicFrame migrated>
      <div className="ac-wrap">
        <section className="ac-card" aria-labelledby={titleId}>
          <header className="ac-heading">
            <h1 id={titleId}>{title}</h1>
            {intro && <p>{intro}</p>}
          </header>
          {children}
        </section>
      </div>
    </PublicFrame>
  )
}

/** Campo de texto con etiqueta visible, ayuda y error por campo (aria-invalid + aria-describedby). `adornment` es el botón «Mostrar» de las contraseñas. */
export function AccessField({ id, label, error, invalid, hint, adornment, inputRef, ...input }: {
  id: string; label: string; error?: string; invalid?: boolean; hint?: string; adornment?: ReactNode; inputRef?: React.Ref<HTMLInputElement>
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'>) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : '', input['aria-describedby'] ?? ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="ac-field">
      <label htmlFor={id}>{label}</label>
      <div className={adornment ? 'ac-input-row has-adornment' : 'ac-input-row'}>
        <input id={id} ref={inputRef} {...input} className="ac-input" aria-invalid={error || invalid ? true : undefined} aria-describedby={describedBy} />
        {adornment}
      </div>
      {hint && <p id={`${id}-hint`} className="ac-hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="ac-error" role="alert">{error}</p>}
    </div>
  )
}

/** ES-301: casilla obligatoria del registro. Los dos enlaces abren en pestaña nueva (con el aviso para lectores de pantalla) y NO cambian la casilla; el error va por campo. */
export function TermsCheck({ checked, error, disabled, inputRef, onChange }: { checked: boolean; error?: string; disabled?: boolean; inputRef?: React.Ref<HTMLInputElement>; onChange: (checked: boolean) => void }) {
  const { t } = useLanguage()
  const newTab = <span className="ac-sr"> ({t('access.terms_new_tab')})</span>
  return (
    <div className="ac-field ac-check">
      <div className="ac-check__row">
        <input id="access-terms" ref={inputRef} type="checkbox" checked={checked} disabled={disabled} aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'access-terms-error' : undefined} onChange={event => onChange(event.target.checked)} />
        <label htmlFor="access-terms">
          {t('access.terms_a')}<Link to="/privacidad" target="_blank" rel="noopener noreferrer">{t('access.terms_privacy')}{newTab}</Link>
          {t('access.terms_and')}<Link to="/terminos" target="_blank" rel="noopener noreferrer">{t('access.terms_terms')}{newTab}</Link>{t('access.terms_end')}
        </label>
      </div>
      {error && <p id="access-terms-error" className="ac-error" role="alert">{error}</p>}
    </div>
  )
}
