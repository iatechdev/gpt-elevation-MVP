// ES-186 parte D · Estilos compartidos de /admin/users (solo tokens del sistema de diseño; ningún color nuevo).
import type { CSSProperties } from 'react'
import { colors, radius, spacing, typography } from '../../styles/tokens'
import type { Role, Status } from './adminUsersLogic.ts'

const base: CSSProperties = { fontFamily: typography.fontBody, fontSize: '0.875rem', fontWeight: 500, borderRadius: radius.md, cursor: 'pointer', minHeight: 44, padding: `0 ${spacing.lg}` }
export const btn = {
  primary: { ...base, background: colors.primary, color: '#fff', border: 'none' } as CSSProperties,
  ghost: { ...base, background: 'transparent', color: colors.textMuted, border: `0.5px solid ${colors.border}` } as CSSProperties,
  danger: { ...base, background: 'transparent', color: colors.danger, border: `0.5px solid ${colors.danger}` } as CSSProperties,
  soft: { ...base, background: colors.primaryLight, color: colors.primaryDark, border: 'none' } as CSSProperties,
  disabled: { cursor: 'not-allowed', opacity: 0.6 } as CSSProperties,
}
export const field: CSSProperties = { width: '100%', minHeight: 44, padding: `0 ${spacing.md}`, borderRadius: radius.md, border: `0.5px solid ${colors.borderLight}`, background: '#fff', fontSize: '0.875rem', color: colors.text, fontFamily: typography.fontBody, boxSizing: 'border-box' }
export const label: CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: spacing.xs }
export const section: CSSProperties = { marginBottom: spacing.lg, paddingBottom: spacing.lg, borderBottom: `0.5px solid ${colors.bgMuted}` }
export const notice = (kind: 'ok' | 'error'): CSSProperties => ({ padding: `${spacing.sm} ${spacing.md}`, borderRadius: radius.md, fontSize: '0.84rem', marginBottom: spacing.md, background: kind === 'ok' ? colors.successLight : colors.dangerLight, color: kind === 'ok' ? colors.success : colors.danger })

export const roleBadge = (role: Role): CSSProperties => {
  const palette: Record<Role, [string, string]> = { user: [colors.primaryLight, colors.primaryDark], therapist: [colors.infoLight, colors.info], admin: [colors.warningLight, colors.warning], superadmin: ['#FCE7F3', '#9D174D'], board: ['#F0FDF4', '#166534'] }
  return { display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: radius.full, fontSize: '0.72rem', fontWeight: 600, background: palette[role][0], color: palette[role][1] }
}
export const statusBadge = (status: Status): CSSProperties => {
  const palette: Record<Status, [string, string]> = { active: [colors.successLight, colors.success], inactive: [colors.dangerLight, colors.danger], locked: [colors.warningLight, colors.warning], deletion: [colors.bgMuted, colors.text] }
  return { display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: radius.full, fontSize: '0.72rem', fontWeight: 600, background: palette[status][0], color: palette[status][1] }
}
