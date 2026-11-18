// ES-186 parte D · Diálogo «Gestionar» de una cuenta: estado (desbloquear, activar/desactivar con confirmación), rol, profesional asignado, enlace de restablecimiento
// y eliminar. Cada respuesta se traduce por el `code` del servidor; sin diálogos del navegador; el resultado se anuncia en una región role="status"/"alert".
// ES-310 (PR 5): Cartografía (Dialog, Chip, Button, SelectField, TextField). Lo visible sale de isSuper / assignableRoles (adminUsersLogic): para admin NO se pintan «Enviar enlace de
// restablecimiento» ni «Solicitar eliminación…»; el servidor sigue decidiendo (403).
import { useState } from 'react'
import { Button, Chip, Dialog, SelectField, TextField } from '../../cartografia'
import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'
import { adminRequest, type Call } from './adminUsersApi.ts'
import { assignableRoles, deleteResult, errorMessage, isSuper, MSG, resetLinkResult, ROLE_LABEL, STATUS_LABEL, STATUS_TONE, statusOf, type Person, type Role } from './adminUsersLogic.ts'
import './adminUsers.css'

type Mode = 'main' | 'deactivate' | 'delete'
type Msg = { kind: 'ok' | 'error'; text: string } | null

export function AdminUsersManage({ person, therapists, actorRole, onChanged, onClose, onNotice }: {
  person: Person; therapists: { id: number; name: string }[]; actorRole: string
  onChanged: () => void; onClose: () => void; onNotice: (text: string) => void
}) {
  const tr = useAdminText()
  const { lang } = useLanguage()
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
  const roleChoices = assignableRoles(actorRole).concat(assignableRoles(actorRole).includes(person.role) ? [] : [person.role])
  const therapistSame = therapistDraft === (person.therapistId ? String(person.therapistId) : '')
  return (
    <Dialog open title={`${tr('Gestionar')} · ${person.name}`} onClose={() => { if (busy === null) onClose() }} actions={<Button variant="ghost" onClick={onClose} disabled={busy !== null}>{tr('Cerrar')}</Button>}>
      <div className="au-section au-dlg">
        <p className="cg-hint au-name">{person.email}</p>
        <div className="pg-chips">
          <Chip>{tr(ROLE_LABEL[person.role])}</Chip>
          <Chip tone={STATUS_TONE[status].tone} symbol={STATUS_TONE[status].symbol}>{tr(STATUS_LABEL[status])}</Chip>
        </div>
        {status === 'locked' && person.lockedUntil && <p className="cg-hint">{tr('Bloqueada hasta')} {new Date(person.lockedUntil).toLocaleString(tr('es-CO'))}</p>}
      </div>

      <div aria-live="polite" className="pg-live">{msg && <div role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind === 'error' ? 'cg-banner cg-banner--error' : 'cg-banner'}><span className="cg-banner__title">{tr(msg.text)}</span></div>}</div>
      {blocked && mode === 'main' && person.active && !locked && (
        <div className="pg-actions">
          <Button variant="danger" autoFocus onClick={() => { setBlocked(false); setMsg(null); setMode('deactivate') }} disabled={busy !== null}>{tr('Desactivar en su lugar')}</Button>
        </div>
      )}

      {locked ? (
        <p className="cg-hint">{tr(MSG.deletionLocked)}</p>
      ) : mode === 'deactivate' ? (
        <div className="au-section">
          <p>{tr('No podrá entrar; sus datos se conservan.')}</p>
          <div className="pg-actions">
            <Button variant="ghost" onClick={() => setMode('main')} disabled={busy !== null} autoFocus>{tr('Cancelar')}</Button>
            <Button variant="danger" onClick={() => void setActive(false)} {...dis('active')}>{busy === 'active' ? tr('Procesando...') : tr('Desactivar')}</Button>
          </div>
        </div>
      ) : mode === 'delete' ? (
        <div className="au-section">
          <p>{requestsDeletion ? tr(MSG.deleteDialog) : tr('Esta acción no se puede deshacer.')}</p>
          <TextField id="au-delete-name" label={`${tr('Escribe el nombre exacto:')} ${person.name}`} autoFocus value={deleteInput} onChange={(e) => { setDeleteInput(e.target.value); setMsg(null) }} autoComplete="off" />
          <div className="pg-actions">
            <Button variant="ghost" onClick={() => { setMode('main'); setDeleteInput(''); setMsg(null) }} disabled={busy !== null}>{tr('Cancelar')}</Button>
            <Button variant="danger" onClick={() => void remove()} disabled={deleteInput !== person.name || busy !== null} aria-busy={busy === 'delete'}>
              {busy === 'delete' ? tr('Procesando...') : requestsDeletion ? tr('Solicitar eliminación') : tr('Eliminar')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="au-section">
            <div className="pg-actions">
              {person.isLocked && <Button variant="ghost" onClick={() => void unlock()} {...dis('unlock')}>{busy === 'unlock' ? tr('Desbloqueando...') : tr('Desbloquear')}</Button>}
              {person.active
                ? <Button variant="ghost" onClick={() => setMode('deactivate')} disabled={busy !== null}>{tr('Desactivar…')}</Button>
                : <Button variant="ghost" onClick={() => void setActive(true)} {...dis('active')}>{busy === 'active' ? tr('Procesando...') : tr('Activar')}</Button>}
            </div>
          </div>
          <div className="au-section au-inline">
            <SelectField id="au-role" label={tr('Rol')} value={roleDraft} onChange={(e) => setRoleDraft(e.target.value as Role)} disabled={busy !== null}>
              {roleChoices.map((r) => <option key={r} value={r}>{tr(ROLE_LABEL[r])}</option>)}
            </SelectField>
            <Button variant="ghost" onClick={() => void saveRole()} disabled={roleDraft === person.role || busy !== null} aria-busy={busy === 'role'}>{tr('Guardar')}</Button>
          </div>
          {person.role === 'user' && (
            <div className="au-section au-inline">
              <SelectField id="au-therapist" label={tr('Profesional asignado')} value={therapistDraft} onChange={(e) => setTherapistDraft(e.target.value)} disabled={busy !== null}>
                <option value="">{tr('Sin asignar')}</option>
                {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </SelectField>
              <Button variant="ghost" onClick={() => void assign()} disabled={therapistSame || busy !== null} aria-busy={busy === 'assign'}>{tr('Asignar')}</Button>
            </div>
          )}
          {isSuper(actorRole) && (
            <div className="pg-actions">
              <Button variant="ghost" onClick={() => void sendReset()} {...dis('reset')}>{busy === 'reset' ? tr('Enviando...') : tr('Enviar enlace de restablecimiento')}</Button>
              <Button variant="danger" onClick={() => { setMode('delete'); setMsg(null); setBlocked(false) }} disabled={busy !== null}>{requestsDeletion ? tr('Solicitar eliminación…') : tr('Eliminar…')}</Button>
            </div>
          )}
        </>
      )}
    </Dialog>
  )
}
