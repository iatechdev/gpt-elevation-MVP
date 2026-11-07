// ES-152: botones, campos y chips del diseño «Cartografía». Ninguna pieza trae texto visible propio: todo llega por props (i18n en quien las usa).
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ')

export type ButtonVariant = 'primary' | 'ghost' | 'danger'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }

/** Un solo botón primario por vista. Altura mínima 46 px; deshabilitado conserva borde y texto legibles. */
export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx('cg-btn', variant !== 'primary' && `cg-btn--${variant}`, className)} {...rest} />
}

/** Acción con aspecto de enlace (subrayado de marca). Si navega a otra ruta usa <a>/<Link>; esto es para acciones. */
export function LinkButton({ className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cx('cg-linkbtn', className)} {...rest} />
}

type FieldShell = { label: string; hint?: string; error?: string; className?: string }

function describedBy(id: string, hint?: string, error?: string) {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ')
  return ids || undefined
}

function Messages({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  return (
    <>
      {hint && <p className="cg-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="cg-error" id={`${id}-err`}>{error}</p>}
    </>
  )
}

export function TextField({ label, hint, error, className, id: given, ...rest }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId(); const id = given ?? auto
  return (
    <div className={cx('cg-field', className)}>
      <label className="cg-label" htmlFor={id}>{label}</label>
      <input id={id} className="cg-input" aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} {...rest} />
      <Messages id={id} hint={hint} error={error} />
    </div>
  )
}

export function TextAreaField({ label, hint, error, className, id: given, ...rest }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId(); const id = given ?? auto
  return (
    <div className={cx('cg-field', className)}>
      <label className="cg-label" htmlFor={id}>{label}</label>
      <textarea id={id} className="cg-textarea" aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} {...rest} />
      <Messages id={id} hint={hint} error={error} />
    </div>
  )
}

export function SelectField({ label, hint, error, className, id: given, children, ...rest }: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId(); const id = given ?? auto
  return (
    <div className={cx('cg-field', className)}>
      <label className="cg-label" htmlFor={id}>{label}</label>
      <select id={id} className="cg-select" aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} {...rest}>{children}</select>
      <Messages id={id} hint={hint} error={error} />
    </div>
  )
}

export function CheckField({ label, className, ...rest }: { label: ReactNode; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <label className={cx('cg-check', className)}><input type="checkbox" {...rest} /><span>{label}</span></label>
}

export type ScaleOption = { value: string; label: string }

/** Escala de opciones (p. ej. niveles 1–5) como grupo de radios: se usa con flechas, el valor elegido se ve por relleno y por foco. */
export function ScaleField({ legend, name, options, value, onChange, hint, error, disabled, className }: {
  legend: string; name: string; options: ScaleOption[]; value?: string; onChange?: (value: string) => void
  hint?: string; error?: string; disabled?: boolean; className?: string
}) {
  const id = useId()
  return (
    <fieldset className={cx('cg-field', className)} aria-describedby={describedBy(id, hint, error)} disabled={disabled}>
      <legend className="cg-label">{legend}</legend>
      <div className="cg-scale">
        {options.map(option => (
          <label key={option.value}>
            <input type="radio" name={name} value={option.value} checked={value === undefined ? undefined : value === option.value} onChange={() => onChange?.(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
      <Messages id={id} hint={hint} error={error} />
    </fieldset>
  )
}

export type ChipTone = 'neutral' | 'wait' | 'ok' | 'bad'

/** Chip de estado: siempre con palabra; `symbol` opcional refuerza sin depender del color. */
export function Chip({ tone = 'neutral', symbol, children }: { tone?: ChipTone; symbol?: string; children: ReactNode }) {
  return <span className={cx('cg-chip', tone !== 'neutral' && `cg-chip--${tone}`)}>{symbol && <span aria-hidden="true">{symbol}</span>}{children}</span>
}
