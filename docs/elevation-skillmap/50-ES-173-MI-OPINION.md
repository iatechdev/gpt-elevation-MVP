# ES-173 · «Mi opinión» del piloto (HU-P22) — contrato de SERVIDOR implementado

Estado: implementado en la rama `ES-173-servidor-opinion` (entrega b). Parte de la propuesta 11613, aprobada por delegación de Mauricio con las decisiones del comentario 11887 (12-nov-2026).
La franja «Vista de revisión · datos ficticios» de la pantalla se retira SOLO cuando Mauricio firme el contrato real (decisión 10); este PR no toca el frontend (la conexión es la entrega c).

## Decisiones (11887)
1. Permiso NUEVO `pilot_feedback` (alcance `default`), separado de `research`: opinar no autoriza otros usos. Versionado (`REQUIRED_VERSION`) y revocable desde `PUT /api/consents/pilot_feedback`.
2. Ventanas `day7|day30` y las 4 categorías de «qué ayudó» (`ideas|experience|next_step|other`) definitivas. UNA respuesta por persona y ventana (índice único).
3. Retención: mientras exista la cuenta o hasta que la persona retire su respuesta (se BORRA). Se exporta y se purga con ES-23 (`personalData.CORE`). El plazo del agregado lo define Alejo (no bloquea).

## Aclaraciones que este PR hace al contrato 11613 (a confirmar)
- **La ventana viaja explícita** (`window`): el contrato no decía cómo elige el servidor entre `day7` y `day30`. No se deriva de la antigüedad de la cuenta (sería una regla de negocio inventada): `GET`/`DELETE` la reciben en la consulta y `PUT` en el cuerpo; sin ella o fuera del catálogo, 400 `invalid_window`.
- **Leer lo propio y retirar NO exigen el permiso**: revocarlo no puede impedir que la persona vea o borre lo suyo. Solo ESCRIBIR exige el permiso vigente (403 `consent_required`). `GET` informa `permission.granted`.
- **Los agregados exigen además ≥ 5 personas que RESPONDIERON** (no solo 5 elegibles): con 5 elegibles y 1 respuesta, publicar «positivas 1» reidentificaría a quien respondió. Es más estricto que el contrato.
- **Elegibles** = personas (rol `user`, activas, sin eliminación pendiente) con el permiso `pilot_feedback` VIGENTE ahora. Revocarlo, retirar la respuesta o eliminar la cuenta saca a la persona del agregado al instante.
- Los agregados salen de `GET /api/admin/pilot-metrics` (administración; sin ruta ni parámetro para respuestas individuales): `listening` (día 7: respondieron `listened` y `respected`; positivas = ambas «yes»), `utility` (día 30: `professionalClarity` ≠ `not_explored`; positivas = «yes»); `activation` y `experiment` no salen de esta opinión: `not_available`.

## Modelo (migración aditiva, RLS)
`PilotFeedbacks` (`UserId`, `windowKey` [WINDOW es palabra reservada], `questionnaireVersion`, `answers` JSONB, `version`, `status` active|withdrawn, `lastRequestId`). Índice único `(UserId, windowKey)`. RLS desde la migración `20261113020000-es173-pilot-feedback.cjs` (idempotente; `down` con `ALLOW_DESTRUCTIVE_MIGRATION`, nunca en producción). Sin clave foránea a Users: la purga ES-23 la borra por `UserId`.

## Rutas (el titular es siempre `req.user.id`; `Cache-Control: no-store`)
- `GET /api/me/pilot-feedback?window=day7|day30` → `{ feedback: { window, status: none|active|withdrawn, version, questionnaireVersion, answers|null, lastRequestId, permission: { purpose, granted } } }`.
- `PUT /api/me/pilot-feedback { requestId, baseVersion, questionnaireVersion, window, answers }` → 201 (nueva versión) o 200 `replay` (misma petición). `answers` lleva EXACTAMENTE `initialValue, valueArea, listened, respected, professionalClarity, helpedBy`; todas opcionales pero al menos una; `valueArea` solo con `initialValue = yes`; sin texto libre.
- `DELETE /api/me/pilot-feedback?window=…[&baseVersion=n]` → BORRA lo respondido (se sobrescribe con `{}`, `lastRequestId` a NULL, `status = withdrawn`, versión +1). Idempotente.
- `GET /api/admin/pilot-metrics` (rol admin/superadmin) → `{ minPeople: 5, metrics: [...] }`; una métrica `ready` lleva `counts { eligible, responded, missing, positive }`; `suppressed` NO lleva conteos.
- Códigos estables: 400 `invalid_input|invalid_answers|empty_answers|invalid_window|unsupported_questionnaire`; 403 `consent_required`; 409 `version_conflict` (con `current`) y `request_conflict`; nunca 500 por entrada inválida.

## Reglas
- Orden en `PUT`: forma → permiso (dentro de la transacción, con bloqueo compartido: `withConsent`) → repetición por `requestId` → versión → escritura. Consentimiento primero, versiones después (sin interbloqueo).
- Primera respuesta simultánea: gana una; las demás se reintentan UNA vez y ven la fila (repetición o conflicto), nunca 5xx.
- Una versión anterior del permiso deja de valer. `research` NO autoriza la opinión.

## Pruebas
`backend/test/integration/es-173-postgres.cjs` (PostgreSQL real + HTTP real, 0 IA): flujo, versión, catálogo cerrado (entradas hostiles), una respuesta por ventana, retiro real, revocación, propietario A/B/profesional/administración, agregados con 4 y 5 personas, carreras ×40 y purga/exportación ES-23, migración up/down/up. `backend/scripts/es173-mutations.cjs` rompe 16 controles a propósito y comprueba que la prueba los detecta. CI: `npm run test:pilot-feedback:pg`.

## Límites declarados
- Los agregados se calculan al leer (sin caché): con pocas personas es instantáneo; con miles habría que indexar. Fuera del piloto de 6 personas.
- Un conteo de «no positivas» (`responded − positive`) puede ser pequeño aunque el agregado se publique (≥ 5 respondieron): no identifica a nadie, pero no es un corte por subgrupo protegido.
- No hay límite de intentos por persona (como en ES-175/E262-7): cada escritura es de UNA fila propia y acotada.
- Plazo de retención del agregado: no definido (PO).
