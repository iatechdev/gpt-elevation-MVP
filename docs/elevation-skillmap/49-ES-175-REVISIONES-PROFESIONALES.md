# ES-175 · Revisiones profesionales recibidas y objeción (HU-P24) — contrato implementado

Estado: implementado en la rama `ES-175-servidor-revisiones`. Parte de la propuesta 11612, aprobada por Mauricio con las decisiones del comentario 11886 (12-nov-2026).
La franja «datos ficticios» de la pantalla se retira SOLO cuando Mauricio firme este contrato (decisión 10); este PR no toca el frontend.

## Decisiones
1. Permiso NUEVO `professional_review`, con alcance por revisor `reviewer-<id>` (como `therapist-<id>`); separado de `facilitator_sharing`. No es un interruptor global: se gestiona desde `/api/me/review-shares` (por eso `GET /api/consents` no lo lista y `PUT /api/consents/professional_review` responde 400 `use_review_shares`). Versionado (`REQUIRED_VERSION`).
2. UNA objeción por revisión y UNA respuesta por objeción (índices únicos): sin réplicas.
3. El revisor ve a la persona como alias «Persona n» (ES-177), nunca nombre, correo ni id.
4. El **revisor es un usuario con rol `therapist`** (confirmado por Infra el 12-nov-2026; no existe rol «facilitador»). Se verifica en el servidor (`verificarTerapeuta` y `users.role='therapist'` activo al autorizar).
5. Retención: mientras exista la cuenta; se exporta (descifrado) y se purga con ES-23 (`personalData.CORE`). Un plazo distinto lo define el PO con criterio legal (no verificado, no bloquea).

## Modelo (migración aditiva, RLS)
`ReviewShares` (autorización versionada: solo referencias `{evidenceId, version}`), `ProfessionalReviews` (INMUTABLE; `supersedesId` para correcciones; observation/limits cifrados v2), `ReviewObjections` (reason cifrado), `ReviewResponses` (text cifrado; `UserId` = persona dueña).

## Rutas (propietario = `req.user.id`; id ajeno = el mismo 404 que uno inexistente; `Cache-Control: no-store`)
Persona: `GET /api/me/professional-reviews`; `POST /api/me/professional-reviews/:id/objection {reason, requestId, locale}`; `GET|POST /api/me/review-shares`; `DELETE /api/me/review-shares/:id`.
Revisor (lado mínimo, sin pantallas): `GET /api/reviewer/shares`; `POST /api/reviewer/reviews`; `GET /api/reviewer/objections`; `POST /api/reviewer/objections/:id/response`.

## Reglas
- Permiso verificado en CADA acceso con `withConsent` (bloqueo compartido: una retirada concurrente espera). Retirar corta el acceso NUEVO del revisor y de la objeción al instante; NO borra lo que escribió la persona. Orden de bloqueo: consentimiento → autorización/revisión.
- Compartible: solo evidencias propias, confirmadas, vigentes, SIN origen en el chat y sin marca «para revisión». NUNCA llega: crisis, diario, chat, correo, evidencias no marcadas.
- Idempotencia por `requestId` (única por actor); misma clave con otros datos = 409 `request_conflict`. Repetir una objeción/respuesta ya guardada devuelve la misma fila (200), también tras retirar el permiso (es lo ya guardado, no un dato nuevo).
- Códigos estables: 400 `invalid_input|required|too_long|control_chars|invalid_evidence`; 403 `consent_revoked` (persona) / `consent_required` (revisor); 404 `not_found|reviewer_not_found`; 409 `already_objected|already_responded|share_not_current|request_conflict`. Nunca 500 por entrada inválida.
- Texto plano ≤ 2000 caracteres, sin caracteres de control; se guarda y se entrega LITERAL (la pantalla lo muestra como texto).
- Una autorización nueva al mismo revisor sustituye a la anterior (`materialVersion` +1); la revisión original se conserva y la pantalla dice «El material cambió» (`materialChanged`).

## Pruebas
`backend/test/integration/es-175-postgres.cjs` (PostgreSQL real + HTTP real, 0 IA): flujo completo, propietario A/B, una objeción/una respuesta con carrera (12 y 8 simultáneas), repetición idempotente, acceso retirado (antes, a mitad y por otra vía), entradas hostiles, inmutabilidad, evidencias con origen en el chat, exportación ES-23 y historial de consentimiento. Mutaciones detectadas: objetar sin permiso, objetar sin dueño, compartir chat/sin filtro, revisor ve sin permiso, crear revisión sin permiso, objeciones del revisor sin permiso, revisión sobre autorización no vigente, lista sin dueño.

## Cambios tras la QA de #262 (E262-1 a E262-7)
- **E262-1:** autorizar valida PRIMERO las evidencias (propias) y después al revisor; con evidencia inválida la respuesta es la misma para cualquier reviewerId, y cualquier revisor no utilizable (inexistente, no therapist, inactivo, uno mismo) da el mismo 404 `reviewer_not_found`. Límite honesto: quien tiene evidencia válida distingue un revisor utilizable por el éxito; lo frena el tope (E262-7).
- **E262-2:** `materialChanged` también cuando la persona EDITÓ o BORRÓ una evidencia compartida, para la persona (lista de revisiones) y para el revisor (`GET /api/reviewer/shares`: `materialChanged` y `changed` por elemento). El revisor sigue viendo la versión FIJADA.
- **E262-3:** una evidencia borrada no aparece en el material del revisor y `POST /api/reviewer/reviews` la rechaza con 400 `invalid_evidence`.
- **E262-4:** el permiso (`consent.grantIn`) y la autorización se crean en UNA transacción.
- **E262-5:** `listReviews` y `reviewerObjections` por lotes (una comprobación de permiso por persona).
- **E262-7:** tope de 30 autorizaciones por persona y hora (429 `rate_limited`).
