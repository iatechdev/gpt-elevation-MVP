// ES-186 parte D · «Invitar persona» (invitación por enlace). El requestId se genera POR INTENTO: un doble clic o un reintento tras un corte de red usa el mismo
// (el servidor devuelve la misma invitación, 200 replayed) y se renueva si cambian el correo o el rol o tras un éxito. Antes de decir «enviada» se compara la respuesta
// con lo escrito (E212-2): otro correo/rol o una invitación ya anulada NO es el éxito de lo que se pidió. Administración nunca define ni ve contraseñas ajenas.
import { useRef, useState } from 'react'
import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'
import { colors, spacing } from '../../styles/tokens'
import { AdminDialog } from './AdminDialog'
import { adminRequest } from './adminUsersApi.ts'
import { createAttempt, endSentence, inviteResult, invitableRoles, MSG, ROLE_LABEL, type Role } from './adminUsersLogic.ts'
import { formatExpiry } from './inviteOutcome.ts'
import { btn, field, label, notice } from './adminUsersStyles.ts'

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

  async function submit() {
    setMsg(null); setEmailError('')
    if (!email.trim()) { setEmailError(MSG.noEmail); return }
    setBusy(true)
    // Mismo intento (mismo correo y rol) = mismo requestId, aunque se pulse dos veces o se reintente tras un corte.
    const requestId = attempt.idFor(email, role)
    const reply = await adminRequest('/api/admin/invitations', { method: 'POST', body: { email: email.trim(), role, locale: lang, requestId } })
    setBusy(false)
    const result = inviteResult(reply.status, reply.data, { email, role })
    switch (result.kind) {
      case 'error': if (result.field === 'email') setEmailError(result.message); else setMsg({ kind: 'error', text: result.message }); break
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
    <AdminDialog title={tr('Invitar persona')} onClose={onClose} busy={busy}>
      {prefill?.name && <p style={{ fontSize: '0.85rem', color: colors.textMuted, margin: `0 0 ${spacing.md}` }}>{tr('Invitación para')} <strong>{prefill.name}</strong>. {tr('El nombre solo se muestra aquí: la persona escribe el suyo al aceptar.')}</p>}
      <div aria-live="polite">{msg && <div role={msg.kind === 'error' ? 'alert' : 'status'} style={notice(msg.kind)}>{msg.translated ? msg.text : tr(msg.text)}</div>}</div>
      <form onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
        <div style={{ marginBottom: spacing.md }}>
          <label style={label} htmlFor="invite-email">{tr('Correo')}</label>
          <input id="invite-email" type="email" style={{ ...field, ...(emailError ? { borderColor: colors.danger } : {}) }} value={email} onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
            aria-invalid={emailError ? true : undefined} aria-describedby={emailError ? 'invite-email-error' : undefined} autoComplete="off" />
          {emailError && <p id="invite-email-error" role="alert" style={{ fontSize: '0.8rem', color: colors.danger, margin: `${spacing.xs} 0 0` }}>{tr(emailError)}</p>}
        </div>
        <div style={{ marginBottom: spacing.lg }}>
          <label style={label} htmlFor="invite-role">{tr('Rol')}</label>
          <select id="invite-role" style={field} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {roles.map((r) => <option key={r} value={r}>{tr(ROLE_LABEL[r])}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
          <button type="button" style={btn.ghost} onClick={onClose} disabled={busy}>{tr('Cerrar')}</button>
          <button type="submit" style={{ ...btn.primary, ...(busy ? btn.disabled : {}) }} disabled={busy} aria-busy={busy}>{busy ? tr('Enviando...') : tr('Enviar invitación')}</button>
        </div>
      </form>
    </AdminDialog>
  )
}
