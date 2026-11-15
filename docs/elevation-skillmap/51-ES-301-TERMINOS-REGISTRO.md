# ES-301 · Registro con aceptación del aviso de privacidad y términos (servidor)

Entrega solo de SERVIDOR (punto 1 del ticket). La casilla del frontend (punto 2) llega en otro PR tras ES-155 tramo B; el texto legal ES/EN y la versión inicial (punto 3) los aprueba Alejo. **No se ha inventado ningún texto legal.**

## Contrato de `POST /api/register`
Cuerpo existente: `name`, `email`, `password`. Nuevo, opcional hoy:

| Campo | Tipo | Significado |
|---|---|---|
| `acceptedTerms` | `true` (booleano exacto) | la persona aceptó |
| `termsVersion` | texto `[A-Za-z0-9._-]{1,32}` | la versión del aviso que vio |

- La **versión vigente** sale de la constante `TERMS` de `backend/utils/terms.js`, nunca del cliente. El cliente declara qué versión vio; el servidor la compara.
- `acceptedAt` lo pone el **servidor**. Cualquier fecha, versión adicional, `role` o `id` que mande el cliente se ignora.
- Se guardan en `Users.termsVersion` y `Users.acceptedAt` (migración `20261113030000-es301-terms-acceptance.cjs`: aditiva e idempotente; las cuentas existentes quedan en NULL = sin aceptación registrada).
- La aceptación se valida **antes** de consultar si el correo existe (no crea un oráculo de cuentas); un correo ya registrado no pisa su aceptación original.

### Respuestas 400 (código estable, mensaje ES / EN)
| `code` | Cuándo |
|---|---|
| `terms_required` | el registro exige aceptación y no vino (incluye `currentVersion`) |
| `terms_not_accepted` | `acceptedTerms` no es exactamente `true` (o falta con `termsVersion`) |
| `terms_version_invalid` | `termsVersion` falta, no es texto o no cumple la forma |
| `terms_version_mismatch` | no es la versión vigente (incluye `currentVersion`) |
| `terms_not_available` | se envió una aceptación pero aún no hay versión publicada |

### Estado inicial (MARCADOR)
`TERMS = { version: null, required: false }`. Mientras `version` sea `null`: el registro funciona **como hoy** (sin casilla) y NO se acepta una aceptación (`terms_not_available`): guardar «aceptó la versión X» de un texto que no existe sería una promesa vacía. `required` solo tiene efecto con una `version` fijada.

**Para activar (mismo PR que la casilla del frontend):** Alejo entrega el texto aprobado y la versión inicial → se fija `version` y `required: true` en `terms.js`. Hasta entonces nada cambia para quien se registra.

## Privacidad (ES-23)
- Exportación: `profile.termsVersion` y `profile.acceptedAt` (lo propio de la cuenta).
- Purga: la lápida de la cuenta deja ambos en NULL. **Decisión pendiente de Alejo/legal:** si debe conservarse la evidencia de aceptación tras la eliminación (hoy se borra, el criterio más minimalista).

## Cambio adicional en el mismo handler
Dos registros simultáneos del mismo correo: uno gana y el otro chocaba con el índice único devolviendo 500; ahora recibe el mismo 400 «ya registrado».

## Fuera de alcance
Frontend (casilla, enlace al aviso, errores por campo), texto legal, aceptación al **aceptar una invitación** (`routes/invitations.js` también crea cuentas y no registra aceptación: requiere decisión del PO), login y recuperar contraseña.

## Pruebas
`test/es-301-terms.test.cjs` (lógica pura), `test/integration/es-301-postgres.cjs` (HTTP real + PostgreSQL real: marcador, matriz de 400, fecha/versión del servidor, correo existente, carrera, ES-23 y migración up/up/down/up), `scripts/es301-mutations.cjs` (mutaciones). CI: `npm run test:register-terms:pg`.
