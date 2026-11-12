import { PASSWORD_RULES, passwordProblems, type PasswordProblem } from './registrationPassword'

interface Props {
  id: string
  password: string
  /** Después de un envío rechazado, los requisitos que faltan se marcan en rojo. */
  showErrors: boolean
  /** Requisitos que el servidor rechazó (puede incluir max_bytes). */
  serverProblems?: PasswordProblem[]
  /** ES-156: el resumen «n de 5» se ve y es la única región aria-live (en el registro se mantiene oculto). */
  visibleSummary?: boolean
  text: (key: string) => string
}

// ES-128: requisitos de la contraseña visibles junto al campo antes de escribir. No depende solo del color: icono y texto oculto.
// ES-155: con clases y tokens de Cartografía (accessCartografia.css), así sigue el tema claro/oscuro del sistema.
export function PasswordRequirements({ id, password, showErrors, serverProblems = [], visibleSummary = false, text }: Props) {
  const problems = new Set<PasswordProblem>([...(password ? passwordProblems(password) : PASSWORD_RULES), ...(showErrors ? serverProblems : [])])
  const met = PASSWORD_RULES.filter(rule => !problems.has(rule)).length
  const bytesOver = problems.has('max_bytes')
  const summary = password ? text('landing.access.pw.summary').replace('{n}', String(met)).replace('{total}', String(PASSWORD_RULES.length)) : ''
  return (
    <div id={id} className="ac-req">
      <p>{text('landing.access.pw.title')}</p>
      <ul>
        {PASSWORD_RULES.map(rule => {
          const ok = !problems.has(rule)
          return (
            <li key={rule} className={ok ? 'is-met' : showErrors ? 'is-bad' : undefined}>
              <span aria-hidden="true" className="ac-req__icon">{ok ? '✓' : '○'}</span>
              <span>{text(`landing.access.pw.${rule}`)}<span className="ac-sr"> — {text(ok ? 'landing.access.pw.met' : 'landing.access.pw.pending')}</span></span>
            </li>
          )
        })}
      </ul>
      <p className={bytesOver ? 'is-bad' : undefined}>{text('landing.access.pw.max_bytes')}</p>
      <p aria-live="polite" className={visibleSummary ? undefined : 'ac-sr'}>{summary}</p>
    </div>
  )
}
