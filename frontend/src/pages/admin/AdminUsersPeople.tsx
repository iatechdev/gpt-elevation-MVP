// ES-186 parte D · Pestaña «Personas»: filtros de rol y estado, aviso de cantidad, vacío con «Limpiar filtros», tabla en escritorio y tarjetas en móvil (≥ 44 px de objetivo).
// ES-310 (PR 5): Cartografía. Los roles del filtro salen de filterableRoles (adminUsersLogic), no de una lista escrita aquí; la región de la tabla con desplazamiento es focalizable y con nombre.
import { memo } from 'react'
import { Button, Chip, LinkButton, SelectField } from '../../cartografia'
import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'
import { filterableRoles, filterPeople, formatAltaDate, MSG, ROLE_LABEL, STATUS_LABEL, STATUS_TONE, statusOf, type Person, type Status } from './adminUsersLogic.ts'
import type { ListState } from './AdminUsersQueues'
import './adminUsers.css'

const STATUSES: Status[] = ['active', 'inactive', 'locked', 'deletion']

// ES-199 (PERF-05): memoizado (con onManage y la lista estables en AdminUsers) para que abrir «Gestionar» no vuelva a pintar toda la lista.
export const PeoplePanel = memo(function PeoplePanel({ list, roleFilter, statusFilter, setRoleFilter, setStatusFilter, onManage, actorRole }: {
  list: ListState<Person>; roleFilter: string; statusFilter: string; setRoleFilter: (v: string) => void; setStatusFilter: (v: string) => void
  onManage: (id: number, opener: HTMLElement) => void; actorRole: string
}) {
  const tr = useAdminText()
  const { lang } = useLanguage()
  const locale = lang === 'en' ? 'en-US' : 'es-CO'
  const byId = new Map(list.items.map((p) => [p.id, p]))
  const shown = filterPeople(list.items, roleFilter, statusFilter)
  const filtered = Boolean(roleFilter || statusFilter)
  const date = (iso: string) => formatAltaDate(iso, locale)
  const planName = (p: Person) => (p.plan ? (lang === 'en' ? p.plan.name_en : p.plan.name_es) || p.plan.name_es : '—')
  const therapistName = (p: Person) => (p.therapistId ? byId.get(p.therapistId)?.name ?? '—' : '—')
  const roles = filterableRoles(actorRole)
  const state = (p: Person) => { const s = statusOf(p); return <Chip tone={STATUS_TONE[s].tone} symbol={STATUS_TONE[s].symbol}>{tr(STATUS_LABEL[s])}</Chip> }
  const manage = (p: Person) => <Button variant="ghost" aria-label={`${tr('Gestionar')} ${p.name}`} onClick={(e) => onManage(p.id, e.currentTarget)}>{tr('Gestionar')}</Button>

  return (
    <div className="cg-card pg-card au-panel">
      <div className="au-filters">
        <SelectField id="au-filter-role" label={tr('Rol')} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">{tr('Todos los roles')}</option>
          {roles.map((r) => <option key={r} value={r}>{tr(ROLE_LABEL[r])}</option>)}
        </SelectField>
        <SelectField id="au-filter-status" label={tr('Estado')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{tr('Todos los estados')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{tr(STATUS_LABEL[s])}</option>)}
        </SelectField>
        {filtered && <LinkButton onClick={() => { setRoleFilter(''); setStatusFilter('') }}>{tr('Limpiar filtros')}</LinkButton>}
        {list.state === 'ok' && <p role="status" className="au-count">{shown.length} {tr(shown.length === 1 ? 'cuenta' : 'cuentas')}</p>}
      </div>

      {list.state === 'loading' && <p role="status" className="cg-hint">{tr('Cargando usuarios...')}</p>}
      {list.state === 'error' && (
        <div role="alert" className="cg-banner cg-banner--error">
          <span className="cg-banner__title">{tr('No se pudo cargar la lista de usuarios.')} </span>
          <div className="pg-actions"><Button variant="ghost" onClick={list.retry}>{tr('Reintentar')}</Button></div>
        </div>
      )}

      {list.state === 'ok' && shown.length === 0 && (
        <div className="au-empty">
          <p>{tr(filtered ? MSG.filteredEmpty : MSG.noAccounts)}</p>
        </div>
      )}

      {list.state === 'ok' && shown.length > 0 && (
        <>
          <div className="au-wide">
            <div className="cg-tablewrap" tabIndex={0} role="region" aria-label={tr('Personas')}>
              <table className="cg-table">
                <thead>
                  <tr>{[tr('Usuario'), tr('Rol'), tr('Estado'), tr('Plan'), tr('Profesional asignado'), tr('Alta'), tr('Acción')].map((h) => <th key={h} scope="col">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id}>
                      <td className="au-who"><strong>{p.name}</strong><span className="cg-hint">{p.email}</span></td>
                      <td>{tr(ROLE_LABEL[p.role])}</td>
                      <td>{state(p)}</td>
                      <td>{planName(p)}</td>
                      <td>{therapistName(p)}</td>
                      <td className="au-date">{date(p.createdAt)}</td>
                      <td>{manage(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <ul className="cg-items au-narrow" aria-label={tr('Personas')}>
            {shown.map((p) => (
              <li key={p.id} className="cg-item">
                <div className="pg-itemtop"><strong className="au-name">{p.name}</strong>{state(p)}</div>
                <span className="cg-hint au-name">{p.email}</span>
                <dl className="au-dl">
                  <dt>{tr('Rol')}</dt><dd>{tr(ROLE_LABEL[p.role])}</dd>
                  <dt>{tr('Plan')}</dt><dd>{planName(p)}</dd>
                  <dt>{tr('Profesional asignado')}</dt><dd>{therapistName(p)}</dd>
                  <dt>{tr('Alta')}</dt><dd>{date(p.createdAt)}</dd>
                </dl>
                {manage(p)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
})
