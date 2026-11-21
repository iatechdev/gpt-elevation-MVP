// ES-303 (PR B) · Textos de la invitación de revisor (ES/EN). Definitivos los de ES-303 comentario 12827 (Dev); los que solo estaban en la maqueta (12828) los aprobó Infra en 12839. Revisión humana del EN: Alejo.
// El código de invitación NUNCA se interpola en un texto de error. Sin voseo y sin tono clínico.
const words = {
  // Compartidos
  title: ['Revisiones profesionales', 'Professional reviews'],
  retry: ['Reintentar', 'Try again'], cancel: ['Cancelar', 'Cancel'], loading: ['Cargando…', 'Loading…'], sessionExpired: ['Tu sesión venció. Inicia sesión de nuevo.', 'Your session expired. Sign in again.'],
  // Persona: autorizar
  lead: ['Una persona revisora puede leer solo las evidencias que tú elijas y retirar su acceso cuando quieras.', 'A reviewer can read only the evidence you choose, and you can withdraw their access whenever you want.'],
  cardTitle: ['Autorizar una revisión', 'Authorize a review'],
  cardHint: ['Es el código que te dio la persona que revisará. Un código sirve una sola vez y vence a los 7 días.', 'It is the code the reviewer gave you. A code works once and expires after 7 days.'],
  codeLabel: ['Código de invitación', 'Invitation code'], codePlaceholder: ['ABCD-EFGH-JKMN-PQRS', 'ABCD-EFGH-JKMN-PQRS'],
  continue: ['Continuar', 'Continue'], checking: ['Comprobando el código…', 'Checking the code…'],
  fromLink: ['El código llegó por el enlace; revísalo y pulsa Continuar', 'The code came from the link; check it and press Continue'],
  invalidCode: ['No encontramos esa invitación. Revisa el código o pide uno nuevo.', 'We could not find that invitation. Check the code or ask for a new one.'],
  tooMany: ['Demasiados intentos seguidos. Inténtalo más tarde.', 'Too many attempts in a row. Try again later.'],
  offer: ['{name} te ofrece revisar tus evidencias. La invitación vence el {date}.', '{name} is offering to review your evidence. The invitation expires on {date}.'],
  pick: ['Elige qué evidencias puede ver', 'Choose which evidence they can see'],
  pickHint: ['Ninguna está marcada. No se comparten tu diario ni tus conversaciones.', 'None is ticked. Your journal and conversations are not shared.'],
  privacy: ['Solo verá lo que elijas. Nunca ve tu diario, tus conversaciones ni nada relacionado con crisis. Puedes retirar el permiso cuando quieras.', 'They will only see what you choose. They never see your journal, your conversations or anything related to a crisis. You can withdraw permission at any time.'],
  selected: ['Seleccionadas: {n}', 'Selected: {n}'], noEvidence: ['Aún no tienes evidencias para compartir.', 'You have no evidence to share yet.'],
  evidenceUntitled: ['Evidencia sin título', 'Untitled evidence'], evidenceVersion: ['versión {n}', 'version {n}'],
  authorize: ['Autorizar revisión', 'Authorize review'], authorizeTo: ['Autorizar a {name}', 'Authorize {name}'], authorizing: ['Autorizando…', 'Authorizing…'],
  authError: ['No pudimos guardar la autorización. Tu código no se gastó: inténtalo de nuevo.', 'We could not save the authorization. Your code was not used up: try again.'],
  invalidEvidence: ['Alguna evidencia ya no se puede compartir. Actualizamos la lista; revisa tu selección.', 'Some evidence can no longer be shared. We refreshed the list; check your selection.'],
  gone: ['Esta autorización ya no está disponible. Pide un código nuevo a la persona revisora.', 'This authorization is no longer available. Ask the reviewer for a new code.'],
  okTitle: ['Listo. Autorizaste esta revisión.', 'Done. You authorized this review.'], okBody: ['Puedes retirar el acceso cuando quieras.', 'You can withdraw access whenever you want.'],
  withdrawn: ['Retiraste el acceso.', 'You withdrew access.'], evidenceLoadError: ['No pudimos cargar tus evidencias. Inténtalo de nuevo.', 'We could not load your evidence. Try again.'], loadError: ['No pudimos cargar tus autorizaciones.', 'We could not load your authorizations.'], withdrawError: ['No pudimos retirar el acceso. Inténtalo de nuevo.', 'We could not withdraw access. Try again.'],
  listTitle: ['Mis autorizaciones', 'My authorizations'], none: ['Aún no has autorizado a nadie.', 'You have not authorized anyone yet.'],
  reviewer: ['Persona revisora', 'Reviewer'], since: ['Desde el {date}', 'Since {date}'], evidenceCount: ['{n} evidencias', '{n} pieces of evidence'], evidenceOne: ['1 evidencia', '1 piece of evidence'],
  stGranted: ['Activa', 'Active'], stRevoked: ['Retirada', 'Withdrawn'],
  update: ['Actualizar evidencias', 'Update evidence'], withdraw: ['Retirar acceso', 'Withdraw access'], updateTitle: ['Actualizar las evidencias de esta persona revisora', 'Update this reviewer’s evidence'],
  // Revisor: invitar
  inviteTitle: ['Invitar a una persona', 'Invite a person'],
  inviteLead: ['Genera un código de un solo uso y envíaselo por un canal que controles. Quien lo canjee elegirá qué evidencias compartir contigo.', 'Generate a one-time code and send it through a channel you control. Whoever redeems it will choose which evidence to share with you.'],
  create: ['Crear invitación', 'Create invitation'], creating: ['Creando…', 'Creating…'],
  newTitle: ['Tu código de invitación', 'Your invitation code'], newWarn: ['Este código se muestra solo ahora. Cópialo y envíaselo a la persona.', 'This code is shown only now. Copy it and send it to the person.'],
  copyCode: ['Copiar código', 'Copy code'], copyLink: ['Copiar enlace', 'Copy link'], copied: ['Código copiado', 'Code copied'], linkCopied: ['Enlace copiado', 'Link copied'], copyFailed: ['No se pudo copiar. Selecciona el código y cópialo a mano.', 'Could not copy. Select the code and copy it by hand.'],
  done: ['Listo', 'Done'], replay: ['Esta invitación ya se creó; el código solo se mostró una vez.', 'This invitation was already created; the code was shown only once.'],
  invitesTitle: ['Invitaciones', 'Invitations'], invitesNone: ['Aún no has creado invitaciones.', 'You have not created any invitations yet.'],
  invitesError: ['No pudimos cargar tus invitaciones.', 'We could not load your invitations.'], createError: ['No pudimos crear la invitación. Inténtalo de nuevo.', 'We could not create the invitation. Try again.'],
  full: ['Ya tienes 10 invitaciones activas. Anula alguna o espera a que venzan.', 'You already have 10 active invitations. Cancel one or wait for them to expire.'],
  notAllowed: ['Tu cuenta no puede crear invitaciones.', 'Your account cannot create invitations.'],
  stActive: ['Activa', 'Active'], stUsed: ['Usada', 'Used'], stExpired: ['Vencida', 'Expired'], stRevoked2: ['Anulada', 'Cancelled'],
  expires: ['Vence el {date}', 'Expires on {date}'], usedOn: ['Usada el {date}', 'Used on {date}'], revokedOn: ['Anulada el {date}', 'Cancelled on {date}'], createdOn: ['Creada el {date}', 'Created on {date}'],
  revoke: ['Anular', 'Cancel'], revokeTitle: ['Anular invitación', 'Cancel invitation'], revokeBody: ['¿Anular esta invitación? La persona ya no podrá usar el código.', 'Cancel this invitation? The person will no longer be able to use the code.'],
  revokeYes: ['Sí, anular', 'Yes, cancel'], revokeKeep: ['Conservar', 'Keep it'], revokeError: ['No pudimos anular la invitación. Actualizamos la lista.', 'We could not cancel the invitation. We refreshed the list.'], revoked: ['Invitación anulada.', 'Invitation cancelled.'],
  invitation: ['Invitación', 'Invitation'],
} as const
export type AuthKey = keyof typeof words

export function format(text: string, params: Record<string, string | number> = {}) { return Object.keys(params).reduce((out, key) => out.split(`{${key}}`).join(String(params[key])), text) }
export const authText = (lang: 'es' | 'en', key: AuthKey, params?: Record<string, string | number>) => format(words[key][lang === 'en' ? 1 : 0], params)
export const authKeys = Object.keys(words) as AuthKey[]
export const authWords = words
