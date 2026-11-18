// ES-186 parte D · «Invitar persona» (invitación por enlace). El requestId se genera POR INTENTO: un doble clic o un reintento tras un corte de red usa el mismo
// (el servidor devuelve la misma invitación, 200 replayed) y se renueva si cambian el correo o el rol o tras un éxito. Antes de decir «enviada» se compara la respuesta
// con lo escrito (E212-2): otro correo/rol o una invitación ya anulada NO es el éxito de lo que se pidió. Administración nunca define ni ve contraseñas ajenas.
// ES-310 (PR 5): Cartografía. Los roles que se ofrecen salen de invitableRoles (adminUsersLogic); el servidor sigue decidiendo (403 role_not_allowed).
import { useRef, useState } from 'react'
import { Button, Dialog, SelectField, TextField } from '../../cartografia'
import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'
import { adminRequest } from './adminUsersApi.ts'
import { createAttempt, endSentence, inviteResult, invitableRoles, MSG, ROLE_LABEL, type Role } from './adminUsersLogic.ts'
import { formatExpiry } from './inviteOutcome.ts'
import './adminUsers.css'

export function AdminUsersInvite({ actorRole, prefill, onClose, onInvited }: { actorRole: string; prefill: { email: string; name: string } | null; onClose: () => void; onInvited: () => void }) {
  const tr = useAdminText()
  const { lang } = useLanguage()
  const attempt = useRef(createAttempt()).current
  const roles = invitableRoles(actorRole)
  const [email, setEmail] = useState(prefill?.email ?? '')
  const [role, setRole] = useState<Role>(prefill ? 'therapist' : 'user')
  const [busy, setBusy] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string; translated?: boolean } | null>(null)

  // El error del correo se vincula al campo (aria-invalid + descripción) y el foco va al campo, para que se anuncie.
  const flagEmail = (message: string) => { setEmailError(message); window.setTimeout(() => document.getElementById('invite-email')?.focus(), 0) }

  async function submit() {
    setMsg(null); setEmailError('')
    if (!email.trim()) { flagEmail(MSG.noEmail); return }
    setBusy(true)
    // Mismo intento (mismo correo y rol) = mismo requestId, aunque se pulse dos veces o se reintente tras un corte.
    const requestId = attempt.idFor(email, role)
    const reply = await adminRequest('/api/admin/invitations', { method: 'POST', body: { email: email.trim(), role, locale: lang, requestId } })
    setBusy(false)
    const result = inviteResult(reply.status, reply.data, { email, role })
    switch (result.kind) {
      case 'error': if (result.field === 'email') flagEmail(result.message); else setMsg({ kind: 'error', text: result.message }); break
      case 'stale': attempt.renew(); setMsg({ kind: 'error', text: MSG.inviteStale }); break
      case 'already': setMsg({ kind: 'ok', text: MSG.inviteAlready }); break
      case 'recorded': attempt.renew(); onInvited(); setEmail(''); setMsg({ kind: 'ok', text: MSG.inviteRecorded }); break
      case 'sent': {
        attempt.renew(); onInvited(); setEmail('')
        const until = result.expiresAt ? ` ${tr('El enlace caduca el')} ${formatExpiry(result.expiresAt, lang)}` : ''
        setMsg({ kind: 'ok', translated: true, text: `${tr('Invitación enviada a')} ${result.email}.${until ? endSentence(until) : ''}` }) // texto ya traducido (lleva datos del servidor)
        break
      }
    }
  }

  return (
    <Dialog open title={tr('Invitar persona')} onClose={() => { if (!busy) onClose() }}
      actions={<><Button variant="ghost" onClick={onClose} disabled={busy}>{tr('Cerrar')}</Button><Button type="submit" form="au-invite-form" disabled={busy} aria-busy={busy}>{busy ? tr('Enviando...') : tr('Enviar invitación')}</Button></>}>
      {prefill?.name && <p className="cg-hint">{tr('Invitación para')} <strong>{prefill.name}</strong>. {tr('El nombre solo se muestra aquí: la persona escribe el suyo al aceptar.')}</p>}
      <div aria-live="polite" className="pg-live">{msg && <div role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind === 'error' ? 'cg-banner cg-banner--error' : 'cg-banner'}><span className="cg-banner__title">{msg.translated ? msg.text : tr(msg.text)}</span></div>}</div>
      <form id="au-invite-form" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
        <TextField id="invite-email" type="email" label={tr('Correo')} value={email} onChange={(e) => { setEmail(e.target.value); setEmailError('') }} error={emailError ? tr(emailError) : undefined} autoComplete="off" />
        <SelectField id="invite-role" label={tr('Rol')} value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roles.map((r) => <option key={r} value={r}>{tr(ROLE_LABEL[r])}</option>)}
        </SelectField>
      </form>
    </Dialog>
  )
}
