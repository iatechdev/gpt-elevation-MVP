// ES-186 parte D (HU-P35) · Administración de personas usuarias, emparejamientos y solicitudes de plan: /admin/users en tres pestañas con fallo independiente.
// Sin diálogos del navegador; los errores se traducen por el `code` del servidor; las acciones privilegiadas se ocultan o se rechazan según el rol y las respuestas 403 (las guardas del
// servidor no se tocan). Detalle de cada diálogo en AdminUsersManage / AdminUsersInvite / AdminUsersQueues.
// ES-310 (PR 5): apariencia con Cartografía (tokens --cg-*, sin estilos en línea); flujo, estados y textos sin cambios.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../../cartografia/pages.css'
import { Button, Tabs } from '../../cartografia'
import { useAdminText } from '../../i18n/useAdminText'
import { asArray, pickPeople, useAdminList } from './adminUsersApi.ts'
import { TAB_LABEL, type Person } from './adminUsersLogic.ts'
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

  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [managingId, setManagingId] = useState<number | null>(null)
  const [prefill, setPrefill] = useState<{ email: string; name: string } | null>(() => readPrefill(location.state))
  const [inviting, setInviting] = useState(() => readPrefill(location.state) !== null)
  const [notification, setNotification] = useState('')
  const opener = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)

  // ES-95: «Crear cuenta de terapeuta» desde una solicitud aprobada abre la invitación con el correo (y el nombre, solo para mostrar). Viaja en el estado de navegación,
  // nunca en la URL; se lee al montar y el estado se consume para que no quede en el historial.
  useEffect(() => { if (readPrefill(location.state)) navigate(location.pathname, { replace: true, state: null }) }, [location, navigate])

  const manage = useCallback((id: number, from: HTMLElement) => { opener.current = from; setNotification(''); setManagingId(id) }, [])
  const managing = managingId === null ? null : people.items.find((p) => p.id === managingId) ?? null
  const therapists = people.items.filter((p) => p.role === 'therapist' && p.active && !p.deletionRequested).map((p) => ({ id: p.id, name: p.name }))
  const count = (state: 'loading' | 'ok' | 'error', n: number) => (state === 'ok' ? ` (${n})` : '')

  // El foco vuelve al botón que abrió el diálogo (o, si ya no existe —la cuenta desapareció—, a «Invitar persona»).
  const open = managing !== null || inviting
  useEffect(() => {
    if (wasOpen.current && !open) { const target = opener.current?.isConnected ? opener.current : document.getElementById('au-invite'); opener.current = null; target?.focus() }
    wasOpen.current = open
  }, [open])

  return (
    <div className="pg au">
      <header className="pg-head">
        <h1 className="pg-title">{tr('Usuarios')}</h1>
        <p className="pg-lead">{tr('Cuentas, emparejamientos y solicitudes de plan.')}</p>
      </header>
      <div className="pg-actions">
        <Button id="au-invite" onClick={(e) => { opener.current = e.currentTarget; setPrefill(null); setInviting(true) }}>{tr('Invitar persona')}</Button>
      </div>

      <div aria-live="polite" className="pg-live">{notification && <div role="status" className="cg-banner"><span className="cg-banner__title">{tr(notification)}</span></div>}</div>

      <Tabs label={tr('Secciones')} tabs={TABS.map((t) => ({
        id: t,
        label: `${tr(TAB_LABEL[t])}${t === 'matching' ? count(matching.state, matching.items.length) : t === 'plans' ? count(plans.state, plans.items.length) : ''}`,
        panel: t === 'people'
          ? <PeoplePanel list={people} roleFilter={roleFilter} statusFilter={statusFilter} setRoleFilter={setRoleFilter} setStatusFilter={setStatusFilter} actorRole={actorRole}
            onManage={manage} />
          : t === 'matching'
            ? <MatchingPanel list={matching} onResolved={() => { matching.reload(); people.reload() }} />
            : <PlanRequestsPanel list={plans} onResolved={() => { plans.reload(); people.reload() }} />,
      }))} />

      {managing && <AdminUsersManage person={managing} therapists={therapists} actorRole={actorRole} onChanged={people.reload} onClose={() => setManagingId(null)} onNotice={setNotification} />}
      {inviting && <AdminUsersInvite actorRole={actorRole} prefill={prefill} onClose={() => { setInviting(false); setPrefill(null) }} onInvited={people.reload} />}
    </div>
  )
}
