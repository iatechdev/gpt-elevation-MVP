import './accessRegister.ts' // ES-232: catálogo de textos de esta pieza
import { useId, type ReactNode } from 'react'
import { PublicFrame } from '../shell/frames'
import './accessCartografia.css'

/** Marco público de Cartografía (marca, idioma, pie) + una tarjeta centrada con el título. Lo usan entrar, crear cuenta y recuperar acceso. */
export function AccessCard({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  const titleId = useId()
  return (
    <PublicFrame>
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
