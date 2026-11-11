// ES-186 parte D · Diálogo «Gestionar» de una cuenta: estado (desbloquear, activar/desactivar con confirmación), rol, profesional asignado, enlace de restablecimiento
// y eliminar. Cada respuesta se traduce por el `code` del servidor; sin diálogos del navegador; el resultado se anuncia en una región role="status"/"alert".
import { useState } from 'react'
import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'
import { colors, spacing } from '../../styles/tokens'
import { AdminDialog } from './AdminDialog'
import { adminRequest, type Call } from './adminUsersApi.ts'
import { assignableRoles, deleteResult, errorMessage, MSG, resetLinkResult, ROLE_LABEL, STATUS_LABEL, statusOf, type Person, type Role } from './adminUsersLogic.ts'
import { btn, field, label, notice, roleBadge, section, statusBadge } from './adminUsersStyles.ts'

type Mode = 'main' | 'deactivate' | 'delete'
type Msg = { kind: 'ok' | 'error'; text: string } | null

export function AdminUsersManage({ person, therapists, actorRole, onChanged, onClose, onNotice }: {
  person: Person; therapists: { id: number; name: string }[]; actorRole: string
  onChanged: () => void; onClose: () => void; onNotice: (text: string) => void
}) {
  const tr = useAdminText()
  const { lang } = useLanguage()
  const isSuper = actorRole === 'superadmin'
  const [mode, setMode] = useState<Mode>('main')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [roleDraft, setRoleDraft] = useState<Role>(person.role)
  const [therapistDraft, setTherapistDraft] = useState<string>(person.therapistId ? String(person.therapistId) : '')
  const [deleteInput, setDeleteInput] = useState('')
  const [blocked, setBlocked] = useState(false) // E228-1: tras un 409 has_dependent_data se ofrece «Desactivar en su lugar»
  const status = statusOf(person)
  const locked = status === 'deletion'
  const requestsDeletion = person.role === 'user'

  // Ejecuta una acción: marca ocupada, traduce la respuesta y recarga la lista. `okText` solo se muestra si el servidor respondió 2xx.
  async function run(key: string, call: Call, okText: string, after?: () => void) {
    setBusy(key); setMsg(null)
    const reply = await call()
    setBusy(null)
    if (reply.status >= 200 && reply.status < 300) { setMsg({ kind: 'ok', text: okText }); onChanged(); after?.() } else setMsg({ kind: 'error', text: errorMessage(reply.status, reply.data) })
  }

  const unlock = () => run('unlock', () => adminRequest(`/api/admin/usuarios/${person.id}/unlock`, { method: 'PUT' }), MSG.unlocked)
  const setActive = (active: boolean) => run('active', () => adminRequest(`/api/admin/usuarios/${person.id}`, { method: 'PUT', body: { active } }),
    active ? MSG.active : MSG.deactivated, () => setMode('main'))
  const saveRole = () => run('role', () => adminRequest(`/api/admin/usuarios/${person.id}`, { method: 'PUT', body: { role: roleDraft } }), MSG.roleSaved)
  const assign = () => run('assign', () => adminRequest(`/api/admin/usuarios/${person.id}/asignar-terapeuta`, { method: 'PUT', body: { therapistId: therapistDraft ? Number(therapistDraft) : null } }), MSG.assigned)

  async function sendReset() {
    setBusy('reset'); setMsg(null)
    const reply = await adminRequest(`/api/admin/usuarios/${person.id}/reset-link`, { method: 'POST', body: { locale: lang } })
    setBusy(null)
    const outcome = resetLinkResult(reply.status, reply.data)
    setMsg({ kind: outcome.ok ? 'ok' : 'error', text: outcome.message })
    if (outcome.ok) onChanged()
  }

  async function remove() {
    if (deleteInput !== person.name) { setMsg({ kind: 'error', text: MSG.nameMismatch }); return }
    setBusy('delete'); setMsg(null)
    const reply = await adminRequest(`/api/admin/usuarios/${person.id}`, { method: 'DELETE' })
    setBusy(null)
    const result = deleteResult(reply.status, reply.data)
    if (result.kind === 'requested') {
      setMode('main'); setDeleteInput(''); onChanged()
      setMsg({ kind: 'ok', text: result.repeated ? MSG.deletionRepeated : MSG.deletionRequested })
    } else if (result.kind === 'deleted') { onNotice(MSG.deleted); onChanged(); onClose() }
    else if (result.kind === 'blocked') { setMode('main'); setDeleteInput(''); setBlocked(true); setMsg({ kind: 'error', text: MSG.deleteBlocked }) }
    else setMsg({ kind: 'error', text: result.message })
  }

  const dis = (key?: string) => ({ disabled: busy !== null, 'aria-busy': key ? busy === key : undefined })
  return (
    <AdminDialog title={`${tr('Gestionar')} · ${person.name}`} onClose={onClose} busy={busy !== null}>
      <div style={{ ...section }}>
        <div style={{ fontSize: '0.8rem', color: colors.textMuted, overflowWrap: 'anywhere' }}>{person.email}</div>
        <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm }}>
          <span style={roleBadge(person.role)}>{tr(ROLE_LABEL[person.role])}</span>
          <span style={statusBadge(status)}>{tr(STATUS_LABEL[status])}</span>
        </div>
        {status === 'locked' && person.lockedUntil && <p style={{ fontSize: '0.8rem', color: colors.warning, margin: `${spacing.sm} 0 0` }}>{tr('Bloqueada hasta')} {new Date(person.lockedUntil).toLocaleString(tr('es-CO'))}</p>}
      </div>

      <div aria-live="polite">{msg && <div role={msg.kind === 'error' ? 'alert' : 'status'} style={notice(msg.kind)}>{tr(msg.text)}</div>}</div>
      {blocked && mode === 'main' && person.active && !locked && (
        <div style={{ marginBottom: spacing.md }}>
          <button type="button" style={btn.danger} autoFocus onClick={() => { setBlocked(false); setMsg(null); setMode('deactivate') }} disabled={busy !== null}>{tr('Desactivar en su lugar')}</button>
        </div>
      )}

      {locked ? (
        <p style={{ fontSize: '0.875rem', color: colors.textMuted }}>{tr(MSG.deletionLocked)}</p>
      ) : mode === 'deactivate' ? (
        <div style={section}>
          <p style={{ fontSize: '0.875rem', color: colors.text }}>{tr('No podrá entrar; sus datos se conservan.')}</p>
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <button type="button" style={btn.ghost} onClick={() => setMode('main')} disabled={busy !== null} autoFocus>{tr('Cancelar')}</button>
            <button type="button" style={btn.danger} onClick={() => void setActive(false)} {...dis('active')}>{busy === 'active' ? tr('Procesando...') : tr('Desactivar')}</button>
          </div>
        </div>
      ) : mode === 'delete' ? (
        <div style={section}>
          <p style={{ fontSize: '0.875rem', color: colors.text, lineHeight: 1.5 }}>
            {requestsDeletion ? tr(MSG.deleteDialog) : tr('Esta acción no se puede deshacer.')}
          </p>
          <label style={label} htmlFor="au-delete-name">{tr('Escribe el nombre exacto:')} <strong>{person.name}</strong></label>
          <input id="au-delete-name" style={field} autoFocus value={deleteInput} onChange={(e) => { setDeleteInput(e.target.value); setMsg(null) }} autoComplete="off" />
          <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md }}>
            <button type="button" style={btn.ghost} onClick={() => { setMode('main'); setDeleteInput(''); setMsg(null) }} disabled={busy !== null}>{tr('Cancelar')}</button>
            <button type="button" style={{ ...btn.danger, ...(deleteInput !== person.name || busy ? btn.disabled : {}) }} onClick={() => void remove()} disabled={deleteInput !== person.name || busy !== null} aria-busy={busy === 'delete'}>
              {busy === 'delete' ? tr('Procesando...') : requestsDeletion ? tr('Solicitar eliminación') : tr('Eliminar')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={section}>
            <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
              {person.isLocked && <button type="button" style={btn.soft} onClick={() => void unlock()} {...dis('unlock')}>{busy === 'unlock' ? tr('Desbloqueando...') : tr('Desbloquear')}</button>}
              {person.active
                ? <button type="button" style={btn.danger} onClick={() => setMode('deactivate')} disabled={busy !== null}>{tr('Desactivar…')}</button>
                : <button type="button" style={btn.soft} onClick={() => void setActive(true)} {...dis('active')}>{busy === 'active' ? tr('Procesando...') : tr('Activar')}</button>}
            </div>
          </div>
          <div style={section}>
            <label style={label} htmlFor="au-role">{tr('Rol')}</label>
            <div style={{ display: 'flex', gap: spacing.sm }}>
              <select id="au-role" style={field} value={roleDraft} onChange={(e) => setRoleDraft(e.target.value as Role)} disabled={busy !== null}>
                {assignableRoles(actorRole).concat(assignableRoles(actorRole).includes(person.role) ? [] : [person.role]).map((r) => <option key={r} value={r}>{tr(ROLE_LABEL[r])}</option>)}
              </select>
              <button type="button" style={{ ...btn.ghost, ...(roleDraft === person.role ? btn.disabled : {}) }} onClick={() => void saveRole()} disabled={roleDraft === person.role || busy !== null} aria-busy={busy === 'role'}>{tr('Guardar')}</button>
            </div>
          </div>
          {person.role === 'user' && (
            <div style={section}>
              <label style={label} htmlFor="au-therapist">{tr('Profesional asignado')}</label>
              <div style={{ display: 'flex', gap: spacing.sm }}>
                <select id="au-therapist" style={field} value={therapistDraft} onChange={(e) => setTherapistDraft(e.target.value)} disabled={busy !== null}>
                  <option value="">{tr('Sin asignar')}</option>
                  {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="button" style={{ ...btn.ghost, ...(therapistDraft === (person.therapistId ? String(person.therapistId) : '') ? btn.disabled : {}) }} onClick={() => void assign()} disabled={therapistDraft === (person.therapistId ? String(person.therapistId) : '') || busy !== null} aria-busy={busy === 'assign'}>{tr('Asignar')}</button>
              </div>
            </div>
          )}
          {isSuper && (
            <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
              <button type="button" style={btn.ghost} onClick={() => void sendReset()} {...dis('reset')}>{busy === 'reset' ? tr('Enviando...') : tr('Enviar enlace de restablecimiento')}</button>
              <button type="button" style={btn.danger} onClick={() => { setMode('delete'); setMsg(null); setBlocked(false) }} disabled={busy !== null}>{requestsDeletion ? tr('Solicitar eliminación…') : tr('Eliminar…')}</button>
            </div>
          )}
        </>
      )}
      <div style={{ marginTop: spacing.lg, textAlign: 'right' }}>
        <button type="button" style={btn.ghost} onClick={onClose} disabled={busy !== null}>{tr('Cerrar')}</button>
      </div>
    </AdminDialog>
  )
}
