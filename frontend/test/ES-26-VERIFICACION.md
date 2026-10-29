# ES-26 — tramo directo aprobado

Diseño Jira 10214; aprobación explícita: «Aprobar el tramo directo propuesto». Base `origin/main` 4311d69. Cambios solo en `frontend/`.

## Alcance

`/app/compass`, enlazada desde el cuerpo del dashboard: campos nuevos directos, selección inicialmente desmarcada, límites 12 campos / 3 por categoría / 500 caracteres, vista previa exacta del servidor, autorización explícita, confirmación y consulta posterior. Contexto vigente e historial de solo lectura; retirada con confirmación. ES/EN, responsive y teclado.

No se precargan versiones guardadas como texto directo. Quedan pendientes contratos para reeditar conservando origen privado, seleccionar chat/diario y detallar resultados afectados. No hay síntesis LLM, puntajes ni invalidación inventada del Skill Map. Esta entrega **no cierra la HU completa**.

## Seguridad y privacidad

- Reutiliza `GET /api/career-context` y `POST /preview`, `/confirm`, `/revoke` con el token existente. `verificarToken` resuelve el propietario en servidor; el cliente no envía un propietario.
- Solo se serializan campos seleccionados con `{origin:{type:'direct'}}`. Los demás textos nunca salen de la pantalla; ningún origen privado guardado se convierte en directo.
- Borrador y token de vista previa solo en memoria: sin almacenamiento local, DOM, URLs ni logs. Se conserva el mecanismo de sesión existente.
- El cambio de sesión elimina el estado privado; un 401 durante edición también retira borrador y contexto. Respuestas atrasadas de otra sesión se ignoran.
- Tras confirmar/retirar se consulta el estado real. ACK perdido, lectura fallida o reemplazo concurrente no se presentan como éxito. No se reintentan mutaciones automáticamente. `/revoke` retira la versión vigente al ejecutarse, sin parámetro ficticio de versión.
- Se reutiliza el cifrado y la entrega de campos autorizados al motor. Sin nuevas tablas, migraciones ni cambios de consentimiento/permisos.

## Resultados reales locales, 27-oct-2026

Node 24.14.0. Base antes del cambio: 22 pruebas, lint/tipos/build exit 0.

| Comprobación | Resultado final |
| --- | --- |
| `npm run lint` | exit 0, 0 errores y 0 advertencias; sin desactivar reglas |
| `npm test` | exit 0, 31/31 (9 nuevas de ES-26) |
| `npx tsc -b` | exit 0 |
| `npm run build` | exit 0 |
| `npm audit` | exit 0, `found 0 vulnerabilities` |
| `node scripts/es26-browser.cjs` | exit 0, 13 comprobaciones con HTTP simulado según contrato |
| `node scripts/es26-api-integration.cjs` | exit 0, 6 comprobaciones con HTTP/JWT/Sequelize/cifrado/PostgreSQL reales |
| `git diff --check` | exit 0 |

Build mantiene aviso de paquete >500 kB: JS 522,56 → 542,36 kB; gzip 133,49 → 139,89 kB. CSS 30,93 → 49,79 kB al incluir controles daisyUI con el prefijo existente. No se oculta ni se relaja el aviso.

Navegador: selección vacía sin POST, representación normalizada exacta, edición invalida revisión, autorización explícita, caducidad de preview, rechazo 422 genérico, cambio/caducidad de sesión, respuestas perdidas, lectura fallida, concurrencia, retirada e historial, cancelar Atrás, Escape en diálogo, ES/EN, anchos 320/375/768/1440, zoom CSS 200%, salto/foco y movimiento reducido. Capturas sintéticas fuera de Git revisadas visualmente. Prueba de luminancia verifica contraste AA de texto/controles/advertencia/error sobre fondo y tarjeta.

Integración real: preview sin persistir, sin token **403**, token de preview de A rechazado para B **409**, listas aisladas, confirmación idempotente, cifrado `v2:`, lista blanca de campos entregada al motor, sustitución completa desde React y retirada que bloquea el motor con `no_context` **404**. JWT revocado: **401**, sin datos privados en la UI.

Dos expectativas del harness fallaron con exit 1 y se corrigieron: ausencia de contexto es 404 (no `null`); sin token es 403 (no 401). También se corrigieron selectores de foco y de versión actual frente a historial del script de navegador. No se cambió backend para acomodar pruebas.

## Reproducir

Desde `frontend/`: instalar dependencias, ejecutar build e iniciar `npm run preview -- --host 127.0.0.1 --port 4226 --strictPort`.

```powershell
$env:PLAYWRIGHT_MODULE='<ruta a playwright instalado>'
$env:ES26_PREVIEW_URL='http://127.0.0.1:4226'
$env:ES26_SCREENSHOT_DIR='<directorio fuera del repo>' # opcional
node scripts/es26-browser.cjs
$env:ES26_BACKEND_DIR='<checkout aislado>/backend'
node scripts/es26-api-integration.cjs
```

Integración requiere dependencias backend (incluido `embedded-postgres`) y Chromium de Playwright. Usa puertos aleatorios loopback, credenciales generadas en memoria y PostgreSQL desechable. Inyecta esa conexión en el módulo `database.js` antes de cargar los módulos reales: no usa `.env`, `DATABASE_URL` existente, datos reales ni proveedor LLM. Proxy del navegador retransmite al servidor real sin respuestas simuladas. Ejecución contra checkout limpio `e66fa5d`, cuyo `backend/` es idéntico al de `4311d69` (diff vacío).

Scripts de navegador/integración son verificaciones locales opcionales, no nuevos pasos CI. CI ejecuta unitarias mediante `npm test`. No verificados: producción, migraciones de producción, lector de pantalla real, Safari/Firefox, selección privada ni detalle de derivados pendientes. Aviso de bundle queda para revisión de Mauricio/QA.
