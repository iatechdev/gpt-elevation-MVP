# ES-306 · El correo de una cuenta no distingue mayúsculas (servidor)

Hallazgo E301-3 de QA, preexistente en main: registrar «ANA@x.co» con «ana@x.co» ya registrado creaba una segunda cuenta. Entrega solo de servidor; sin frontend.

## Regla
El correo de una cuenta es **el texto sin espacios a los lados y en minúsculas**. `backend/utils/emailNormalize.js`:
- `normalizeEmail(valor)`: trim + minúsculas (lo que no es texto pasa sin tocar).
- `findUserByEmail(User, correo)`: 1) busca el texto exacto sin espacios (camino rápido; conserva el acceso de cuentas antiguas duplicadas por casing) y 2) respaldo por `lower(btrim(email))` (cuentas antiguas guardadas con mayúsculas o con espacios laterales; si hubiera varias, la más antigua). Solo lee.

## Dónde se aplica
| Flujo | Cambio |
|---|---|
| Registro (`POST /api/register`) | busca con el helper (cualquier casing o espacios = «ya registrado», misma respuesta que el duplicado exacto) y **guarda el correo normalizado**. La carrera de dos casings distintos la frena el índice único y responde el mismo 400 (ES-301). |
| Login | busca con el helper. El conteo de intentos ya normalizaba. Respuestas sin cambios (401/423 uniformes, ES-220). |
| Recuperación de contraseña | busca con el helper; respuesta idéntica exista o no el correo (ES-132). |
| Invitaciones | ya normalizaban y comparaban por `lower(email)` (ahora `lower(btrim(email))`); sin cambio de lógica, cubierto por pruebas. |

## Migración `20261114010000-es306-email-lower-unique.cjs`
Aditiva e idempotente. **Reporta** los grupos de cuentas duplicadas por `lower(btrim(email))` (solo ids y conteo; nunca imprime correos) y crea `users_email_lower_unique` (índice único sobre `lower(btrim(email))`) **solo si no hay duplicados**. Con duplicados no crea el índice, lo avisa y termina bien; no borra, no fusiona ni reescribe ninguna cuenta. Resueltos los duplicados, se vuelve a correr la migración.
- Informe de solo lectura en cualquier entorno: `npm run check:email-duplicates` (salida 0 sin duplicados, 2 con duplicados, 1 si no pudo comprobar).
- `down` exige `ALLOW_DESTRUCTIVE_MIGRATION=true` (ES-59). El índice está en `scripts/drift-allowed.json` (el modelo declara solo el único exacto).

## Qué NO cambia ni queda pendiente
- No se fusionan cuentas existentes (decisión de Mauricio/Alejo). **Antes de migrar producción**, correr `npm run check:email-duplicates` con las variables del entorno; si hay duplicados, el índice no se crea hasta resolverlos.
- `ProfessionalApplication` (solicitud profesional, ES-95) deduplica por correo con el texto exacto; no es una cuenta y no estaba en el alcance: seguimiento aparte.
- No se reescriben correos antiguos con mayúsculas: siguen entrando y se encuentran por `lower(btrim(email))`.

## Pruebas
`test/es-306-email.test.cjs` (lógica pura), `test/integration/es-306-postgres.cjs` (HTTP real + PostgreSQL real), `scripts/es306-mutations.cjs` (14 mutaciones). CI: `npm run test:email-case:pg`.
