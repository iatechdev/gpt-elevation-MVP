// ES-186 parte D · Pestaña «Personas»: filtros de rol y estado, aviso de cantidad, vacío con «Limpiar filtros», tabla en escritorio y tarjetas en móvil (≥ 44 px de objetivo).
import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'
import { colors, radius, shadow, spacing } from '../../styles/tokens'
import { filterPeople, MSG, ROLE_LABEL, ROLES, STATUS_LABEL, statusOf, type Person, type Role, type Status } from './adminUsersLogic.ts'
import { btn, field, notice, roleBadge, statusBadge } from './adminUsersStyles.ts'
import type { ListState } from './AdminUsersQueues'
import './adminUsers.css'

const STATUSES: Status[] = ['active', 'inactive', 'locked', 'deletion']

export function PeoplePanel({ list, roleFilter, statusFilter, setRoleFilter, setStatusFilter, onManage, actorRole }: {
  list: ListState<Person>; roleFilter: string; statusFilter: string; setRoleFilter: (v: string) => void; setStatusFilter: (v: string) => void
  onManage: (id: number, opener: HTMLElement) => void; actorRole: string
}) {
  const tr = useAdminText()
  const { lang } = useLanguage()
  const locale = lang === 'en' ? 'en-US' : 'es-CO'
  const byId = new Map(list.items.map((p) => [p.id, p]))
  const shown = filterPeople(list.items, roleFilter, statusFilter)
  const filtered = Boolean(roleFilter || statusFilter)
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  const planName = (p: Person) => (p.plan ? (lang === 'en' ? p.plan.name_en : p.plan.name_es) || p.plan.name_es : '—')
  const therapistName = (p: Person) => (p.therapistId ? byId.get(p.therapistId)?.name ?? '—' : '—')
  const roles: Role[] = actorRole === 'superadmin' ? ROLES : ['user', 'therapist', 'admin']

  return (
    <div>
      <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.lg, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label htmlFor="au-filter-role" style={{ display: 'block', fontSize: '0.72rem', color: colors.textMuted, marginBottom: spacing.xs }}>{tr('Rol')}</label>
          <select id="au-filter-role" style={{ ...field, width: 'auto', minWidth: 170 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">{tr('Todos los roles')}</option>
            {roles.map((r) => <option key={r} value={r}>{tr(ROLE_LABEL[r])}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="au-filter-status" style={{ display: 'block', fontSize: '0.72rem', color: colors.textMuted, marginBottom: spacing.xs }}>{tr('Estado')}</label>
          <select id="au-filter-status" style={{ ...field, width: 'auto', minWidth: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{tr('Todos los estados')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{tr(STATUS_LABEL[s])}</option>)}
          </select>
        </div>
        {list.state === 'ok' && <p role="status" style={{ margin: 0, fontSize: '0.85rem', color: colors.textMuted }}>{shown.length} {tr(shown.length === 1 ? 'cuenta' : 'cuentas')}</p>}
      </div>

      {list.state === 'loading' && <p role="status" style={{ color: colors.textMuted, fontSize: '0.875rem' }}>{tr('Cargando usuarios...')}</p>}
      {list.state === 'error' && (
        <div role="alert" style={notice('error')}>
          <span>{tr('No se pudo cargar la lista de usuarios.')} </span>
          <button type="button" style={btn.ghost} onClick={list.retry}>{tr('Reintentar')}</button>
        </div>
      )}

      {list.state === 'ok' && shown.length === 0 && (
        <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textMuted, fontSize: '0.875rem' }}>
          <p style={{ margin: `0 0 ${spacing.md}` }}>{tr(filtered ? MSG.filteredEmpty : MSG.noAccounts)}</p>
          {filtered && <button type="button" style={btn.ghost} onClick={() => { setRoleFilter(''); setStatusFilter('') }}>{tr('Limpiar filtros')}</button>}
        </div>
      )}

      {list.state === 'ok' && shown.length > 0 && (
        <>
          <div className="au-wide" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: colors.bgCard, borderRadius: radius.lg, boxShadow: shadow.card, border: `0.5px solid ${colors.border}` }}>
              <thead>
                <tr>{[tr('Usuario'), tr('Rol'), tr('Estado'), tr('Plan'), tr('Profesional asignado'), tr('Alta'), tr('Acción')].map((h) => (
                  <th key={h} scope="col" style={{ padding: `${spacing.md} ${spacing.lg}`, textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: `0.5px solid ${colors.border}`, background: colors.bgMuted }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `0.5px solid ${colors.bgMuted}`, overflowWrap: 'anywhere' }}><div style={{ fontWeight: 500, color: colors.text }}>{p.name}</div><div style={{ fontSize: '0.78rem', color: colors.textMuted }}>{p.email}</div></td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `0.5px solid ${colors.bgMuted}` }}><span style={roleBadge(p.role)}>{tr(ROLE_LABEL[p.role])}</span></td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `0.5px solid ${colors.bgMuted}` }}><span style={statusBadge(statusOf(p))}>{tr(STATUS_LABEL[statusOf(p)])}</span></td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `0.5px solid ${colors.bgMuted}`, fontSize: '0.85rem', color: colors.text }}>{planName(p)}</td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `0.5px solid ${colors.bgMuted}`, fontSize: '0.85rem', color: colors.text }}>{therapistName(p)}</td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `0.5px solid ${colors.bgMuted}`, fontSize: '0.85rem', color: colors.textMuted, whiteSpace: 'nowrap' }}>{date(p.createdAt)}</td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `0.5px solid ${colors.bgMuted}` }}>
                      <button type="button" style={btn.ghost} aria-label={`${tr('Gestionar')} ${p.name}`} onClick={(e) => onManage(p.id, e.currentTarget)}>{tr('Gestionar')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="au-narrow" style={{ listStyle: 'none', margin: 0, padding: 0, flexDirection: 'column', gap: spacing.md }}>
            {shown.map((p) => (
              <li key={p.id} style={{ background: colors.bgCard, borderRadius: radius.lg, border: `0.5px solid ${colors.border}`, boxShadow: shadow.card, padding: spacing.lg }}>
                <div style={{ fontWeight: 500, color: colors.text, overflowWrap: 'anywhere' }}>{p.name}</div>
                <div style={{ fontSize: '0.78rem', color: colors.textMuted, overflowWrap: 'anywhere' }}>{p.email}</div>
                <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', margin: `${spacing.sm} 0` }}>
                  <span style={roleBadge(p.role)}>{tr(ROLE_LABEL[p.role])}</span>
                  <span style={statusBadge(statusOf(p))}>{tr(STATUS_LABEL[statusOf(p)])}</span>
                </div>
                <dl style={{ margin: `0 0 ${spacing.md}`, fontSize: '0.82rem', color: colors.text, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: `${spacing.xs} ${spacing.md}` }}>
                  <dt style={{ color: colors.textMuted }}>{tr('Plan')}</dt><dd style={{ margin: 0 }}>{planName(p)}</dd>
                  <dt style={{ color: colors.textMuted }}>{tr('Profesional asignado')}</dt><dd style={{ margin: 0 }}>{therapistName(p)}</dd>
                  <dt style={{ color: colors.textMuted }}>{tr('Alta')}</dt><dd style={{ margin: 0 }}>{date(p.createdAt)}</dd>
                </dl>
                <button type="button" style={{ ...btn.ghost, width: '100%' }} aria-label={`${tr('Gestionar')} ${p.name}`} onClick={(e) => onManage(p.id, e.currentTarget)}>{tr('Gestionar')}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
