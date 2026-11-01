import { PASSWORD_RULES, passwordProblems, type PasswordProblem } from './registrationPassword'
import { colors, spacing } from '../styles/tokens'

const hidden: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
}

interface Props {
  id: string
  password: string
  /** Después de un envío rechazado, los requisitos que faltan se marcan en rojo. */
  showErrors: boolean
  /** Requisitos que el servidor rechazó (puede incluir max_bytes). */
  serverProblems?: PasswordProblem[]
  text: (key: string) => string
}

// ES-128: requisitos de la contraseña visibles junto al campo antes de escribir. No depende solo del color: icono y texto oculto.
export function PasswordRequirements({ id, password, showErrors, serverProblems = [], text }: Props) {
  const problems = new Set<PasswordProblem>([...(password ? passwordProblems(password) : PASSWORD_RULES), ...(showErrors ? serverProblems : [])])
  const met = PASSWORD_RULES.filter(rule => !problems.has(rule)).length
  const bytesOver = problems.has('max_bytes')
  const summary = password ? text('landing.access.pw.summary').replace('{n}', String(met)).replace('{total}', String(PASSWORD_RULES.length)) : ''
  return (
    <div id={id} style={{ fontSize: '0.8rem', color: colors.textSubtle, textAlign: 'left', width: '100%', marginTop: `-${spacing.xs}` }}>
      <p style={{ margin: `0 0 ${spacing.xs}`, color: colors.textMuted }}>{text('landing.access.pw.title')}</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {PASSWORD_RULES.map(rule => {
          const ok = !problems.has(rule)
          const color = ok ? colors.success : showErrors ? colors.danger : colors.textSubtle
          return (
            <li key={rule} style={{ display: 'flex', gap: spacing.xs, color, overflowWrap: 'anywhere' }}>
              <span aria-hidden="true" style={{ width: '1em', flexShrink: 0 }}>{ok ? '✓' : '○'}</span>
              <span>{text(`landing.access.pw.${rule}`)}<span style={hidden}> — {text(ok ? 'landing.access.pw.met' : 'landing.access.pw.pending')}</span></span>
            </li>
          )
        })}
      </ul>
      <p style={{ margin: `${spacing.xs} 0 0`, color: bytesOver ? colors.danger : colors.textSubtle, overflowWrap: 'anywhere' }}>
        {text('landing.access.pw.max_bytes')}
      </p>
      <span aria-live="polite" style={hidden}>{summary}</span>
    </div>
  )
}
