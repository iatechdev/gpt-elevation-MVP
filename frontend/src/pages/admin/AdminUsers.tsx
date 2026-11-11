// ES-186 parte D (HU-P35) · Administración de personas usuarias, emparejamientos y solicitudes de plan: /admin/users en tres pestañas con fallo independiente.
// Sin diálogos del navegador; los errores se traducen por el `code` del servidor; las acciones privilegiadas se ocultan o se rechazan según el rol y las respuestas 403 (las guardas del
// servidor no se tocan). Detalle de cada diálogo en AdminUsersManage / AdminUsersInvite / AdminUsersQueues.
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAdminText } from '../../i18n/useAdminText'
import { colors, spacing, typography } from '../../styles/tokens'
import { asArray, pickPeople, useAdminList } from './adminUsersApi.ts'
import { TAB_LABEL, type Person } from './adminUsersLogic.ts'
import { btn, notice } from './adminUsersStyles.ts'
import { AdminUsersInvite } from './AdminUsersInvite'
import { AdminUsersManage } from './AdminUsersManage'
import { PeoplePanel } from './AdminUsersPeople'
import { MatchingPanel, PlanRequestsPanel, type MatchingItem, type PlanItem } from './AdminUsersQueues'
import './adminUsers.css'

type Tab = 'people' | 'matching' | 'plans'
const TABS: Tab[] = ['people', 'matching', 'plans']

function readPrefill(state: unknown): { email: string; name: string } | null {
  const data = (state as { newTherapist?: { name?: unknown; email?: unknown } } | null)?.newTherapist
  return data ? { email: String(data.email ?? '').slice(0, 254), name: String(data.name ?? '').slice(0, 120) } : null
}

export function AdminUsers() {
  const tr = useAdminText()
  const location = useLocation()
  const navigate = useNavigate()
  const actorRole = (() => { try { return localStorage.getItem('elevation_role') ?? 'admin' } catch { return 'admin' } })()

  const people = useAdminList<Person>('/api/admin/usuarios', pickPeople)
  const matching = useAdminList<MatchingItem>('/api/admin/matching/pending', asArray)
  const plans = useAdminList<PlanItem>('/api/admin/plan-requests/admin?status=pending', asArray)

  const [tab, setTab] = useState<Tab>('people')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [managingId, setManagingId] = useState<number | null>(null)
  const [prefill, setPrefill] = useState<{ email: string; name: string } | null>(() => readPrefill(location.state))
  const [inviting, setInviting] = useState(() => readPrefill(location.state) !== null)
  const [notification, setNotification] = useState('')
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ people: null, matching: null, plans: null })

  // ES-95: «Crear cuenta de terapeuta» desde una solicitud aprobada abre la invitación con el correo (y el nombre, solo para mostrar). Viaja en el estado de navegación,
  // nunca en la URL; se lee al montar y el estado se consume para que no quede en el historial.
  useEffect(() => { if (readPrefill(location.state)) navigate(location.pathname, { replace: true, state: null }) }, [location, navigate])

  const managing = managingId === null ? null : people.items.find((p) => p.id === managingId) ?? null
  const therapists = people.items.filter((p) => p.role === 'therapist' && p.active && !p.deletionRequested).map((p) => ({ id: p.id, name: p.name }))
  const count = (state: 'loading' | 'ok' | 'error', n: number) => (state === 'ok' ? ` (${n})` : '')

  function onTabKey(e: React.KeyboardEvent) {
    const i = TABS.indexOf(tab)
    const next = e.key === 'ArrowRight' ? TABS[(i + 1) % TABS.length] : e.key === 'ArrowLeft' ? TABS[(i + TABS.length - 1) % TABS.length] : e.key === 'Home' ? TABS[0] : e.key === 'End' ? TABS[TABS.length - 1] : null
    if (next) { e.preventDefault(); setTab(next); tabRefs.current[next]?.focus() }
  }

  return (
    <div style={{ fontFamily: typography.fontBody }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl, flexWrap: 'wrap', gap: spacing.lg }}>
        <div>
          <h1 style={{ fontFamily: typography.fontDisplay, fontWeight: 300, fontSize: '1.8rem', color: colors.text, margin: 0 }}>{tr('Usuarios')}</h1>
          <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: `${spacing.xs} 0 0` }}>{tr('Cuentas, emparejamientos y solicitudes de plan.')}</p>
        </div>
        <button type="button" style={btn.primary} onClick={() => { setPrefill(null); setInviting(true) }}>{tr('Invitar persona')}</button>
      </div>

      <div aria-live="polite">{notification && <div role="status" style={notice('ok')}>{tr(notification)}</div>}</div>

      <div className="au-tabs" role="tablist" aria-label={tr('Secciones')} onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button key={t} ref={(el) => { tabRefs.current[t] = el }} type="button" role="tab" id={`au-tab-${t}`} className="au-tab" aria-selected={tab === t} aria-controls={`au-panel-${t}`}
            tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)}>
            {tr(TAB_LABEL[t])}{t === 'matching' ? count(matching.state, matching.items.length) : t === 'plans' ? count(plans.state, plans.items.length) : ''}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="au-panel-people" aria-labelledby="au-tab-people" hidden={tab !== 'people'}>
        {tab === 'people' && <PeoplePanel list={people} roleFilter={roleFilter} statusFilter={statusFilter} setRoleFilter={setRoleFilter} setStatusFilter={setStatusFilter} actorRole={actorRole}
          onManage={(id) => { setNotification(''); setManagingId(id) }} />}
      </div>
      <div role="tabpanel" id="au-panel-matching" aria-labelledby="au-tab-matching" hidden={tab !== 'matching'}>
        {tab === 'matching' && <MatchingPanel list={matching} onResolved={() => { matching.reload(); people.reload() }} />}
      </div>
      <div role="tabpanel" id="au-panel-plans" aria-labelledby="au-tab-plans" hidden={tab !== 'plans'}>
        {tab === 'plans' && <PlanRequestsPanel list={plans} onResolved={() => { plans.reload(); people.reload() }} />}
      </div>

      {managing && <AdminUsersManage person={managing} therapists={therapists} actorRole={actorRole} onChanged={people.reload} onClose={() => setManagingId(null)} onNotice={setNotification} />}
      {inviting && <AdminUsersInvite actorRole={actorRole} prefill={prefill} onClose={() => { setInviting(false); setPrefill(null) }} onInvited={people.reload} />}
    </div>
  )
}
