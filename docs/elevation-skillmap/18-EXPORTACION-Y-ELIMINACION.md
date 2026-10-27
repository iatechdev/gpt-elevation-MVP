# ES-23 · Exportación controlada y eliminación de cuenta

26-oct-2026 · Dev-Codex (base) y Dev-Claude · Cubre SP2-HU17 (RF-12). Contrato para que Alejo construya los controles; **no hay interfaz en esta HU**.

## 1. Estado y límites (leer primero)

- **Apagado por defecto.** Sin `DATA_RIGHTS_ENABLED=true`, las rutas responden 503 `data_rights_unavailable`. No se activa en producción hasta que QA apruebe, Mauricio decida la política de datos con atención humana (§6) y se cumpla el §5.
- **Exportación profesional: no disponible.** Responde 503 `professional_contract_pending` hasta que existan los contratos de ES-25 (puente) y ES-27 (evidencia). No se adivinan esquemas.
- **Plazos de 7/30 días: no verificados.** Nada en el sistema los promete: el recibo trae `deadlinesVerified: false`. Falta confirmar la capacidad de Railway, Supabase y los respaldos antes de comunicarlos a la persona.
- **Invalidación de evaluaciones, rutas y cachés:** los eventos de `DerivedInvalidation` se conservan sin procesar. Se consumen cuando existan esos derivados (ES-29, ES-32).
- **El borrado completo no es automático.** Un procedimiento de mantenimiento (§4) lo ejecuta con los procesos detenidos. Un worker durable requiere aprobación de Mauricio (RFC-001) y no existe.

## 2. Rutas (todas bajo sesión vigente, respuesta `no-store`)

| Ruta | Cuerpo | Éxito | Errores estables |
| --- | --- | --- | --- |
| `POST /api/exports/preview` | `{ type: "personal", locale: "es" \| "en" }` | 201 `{ id, expiresAt, data }` (vigencia 10 min) | 400 `invalid_input`; 403 `deletion_pending`; 409 `data_review_required`; 503 `professional_contract_pending` (type `professional`) |
| `POST /api/exports/:id/download` | vacío | 200 JSON adjunto `elevation-personal.json`, idéntico a `data` de la vista previa | 404 `export_not_found` (ID ajeno o inexistente); 410 `export_expired`; 409 `export_outdated` (cambió algún origen: pedir otra vista previa); 403 `deletion_pending`; 409 `data_review_required` |
| `POST /api/account/deletion-requests` | `{ confirm: true }` | 202 recibo (nuevo) o 200 (repetido, mismo recibo) | 400 `invalid_input` |

Todos los errores traen `error` bilingüe (`ES / EN`) y `code` estable; el cliente debe mapear por `code`. Cualquier otro fallo es 503 `data_rights_failed` (reintentar).

**Recibo:** `{ id, status, requestedAt, activePurgedAt, deadlinesVerified: false }`. Estados: `accepted` → `awaiting_verification` (datos activos purgados; falta verificar proveedores y respaldos) | `awaiting_review` (política pendiente, §6) | `failed` (reintentable). Nunca `completed` antes de verificar.

**Contenido de la exportación personal** (`schemaVersion: 1`): perfil (sin contraseña ni secretos), mensajes, turnos de chat, diario (sin entradas eliminadas), ánimo, valoraciones, recomendaciones, consentimientos e historial, solicitudes de plan, invalidaciones y, desde ES-23, **uso de IA** (solo metadatos: tipo, modelo, periodo, tokens, costo, error; nunca mensajes ni prompts) y su contador de presupuesto. No incluye datos de otras personas.

### Guía para los controles de UI (textos ES/EN a cargo de Alejo)
- Selección vacía no existe en la exportación personal (es completa del dueño). En la profesional (futura) la selección será explícita por campo.
- Estados de la vista previa: vigente / vencida (410) / obsoleta (409). Ante 409 o 410, ofrecer "generar otra vista previa".
- Advertir antes de la descarga: **una copia ya descargada no se puede recuperar automáticamente.**
- Eliminar: pedir confirmación explícita; al aceptar, **la sesión queda bloqueada** (la persona no podrá entrar). Mostrar el recibo y no prometer plazos.
- 409 `data_review_required`: mostrar un mensaje de "requiere revisión por el equipo", sin detalle.

## 3. Qué se borra y qué se conserva

- **Se borra al procesar:** mensajes, turnos de chat, diario, ánimo, valoraciones, recomendaciones, consentimientos e historial, solicitudes de plan, **uso de IA y contador de presupuesto de la persona**, exportaciones pendientes, tokens y cortes de sesión.
- **Se conserva (mínimo necesario):** la fila de la cuenta como lápida (nombre `Deleted account`, correo inutilizable, contraseña aleatoria, inactiva), el libro de solicitudes de borrado y los eventos de invalidación sin procesar.
- **No se toca:** el contador de la cohorte (`UserId = 0`), porque el gasto ya ocurrido sigue contando para el tope.
- **Pérdida aceptada:** al borrar `AiUsages` se pierde el detalle de costo por llamada de esa persona; el total de la cohorte se conserva.

## 4. Procedimiento de mantenimiento: procesar un borrado

Solo operación humana, en una ventana de mantenimiento.
1. Detener **todos** los procesos que escriben (web, jobs, integraciones) y esperar a que terminen las operaciones en curso.
2. Con `DATABASE_URL` apuntando al entorno correcto, ejecutar `node scripts/purgePersonalData.js <id-de-la-solicitud> --producers-stopped-and-drained` (para reaplicar un borrado ya procesado, añadir `--replay` como tercer argumento). Imprime solo el estado; no imprime identificadores ni contenido.
3. Si falla, la purga se revierte completa y la solicitud queda `failed` (reintentable). Repetirla es seguro.
4. Reanudar los procesos. Registrar fecha y resultado.

## 5. Procedimiento de restauración (los borrados se reaplican)

Un respaldo anterior a un borrado **puede resucitar datos** y, si el libro de solicitudes vive en la misma base, también lo pierde. Por eso:
1. **Antes de restaurar**, exportar el libro `DeletionRequests` del entorno actual (solo `id`, `UserId`, `status`, fechas; sin contenido) y guardarlo fuera de la base que se restaura. Si no se pudo (caída total), usar el último volcado de ese libro guardado en la ventana de mantenimiento anterior.
2. Restaurar **en un entorno aislado**, sin tráfico ni sesiones y con las rutas apagadas (`DATA_RIGHTS_ENABLED` sin definir).
3. Cargar el libro guardado (insertar las solicitudes que falten) y, para cada solicitud, ejecutar el §4 con la opción `--replay`, que vuelve a purgar aunque ya figure como procesada.
4. Verificar: ninguna cuenta con solicitud tiene datos activos y todas siguen bloqueadas.
5. Solo entonces abrir el acceso.
- **No verificado:** este procedimiento se probó con réplica en Postgres real (la prueba de integración restaura registros y los vuelve a purgar), no con un respaldo real de Supabase ni con la restauración de un proveedor. Falta ensayarlo allí y confirmar si los respaldos del proveedor se pueden purgar o solo expiran.

## 6. Decisión pendiente (Mauricio): registros con atención humana

Si la persona tiene sesiones de terapia, notas clínicas, perfil de terapeuta, validaciones, emparejamientos o cualquier relación con un terapeuta, la exportación y el borrado **se detienen con 409/`awaiting_review`**: no se omite en silencio parte de una exportación "completa" ni se borra algo con obligación de retención profesional. Mientras no exista la política (qué se exporta, qué se retiene y por cuánto tiempo), esas personas no pueden exportar ni eliminar por este flujo.

## 7. Activación y reversión

- Variable: `DATA_RIGHTS_ENABLED` (`true` para activar). Sin migración manual en `main`: las tablas `ExportRequests` y `DeletionRequests` las crea `sync()` o la migración aditiva `backend/migrations/20261026-es23-data-rights.cjs` (`node scripts/migrateDataRights.js`), idempotente.
- Reversión del código: **conservar `DeletionRequests` y la guarda de sesión y consentimiento.** Borrar el libro podría devolver acceso a cuentas con solicitud; nunca es una reversión válida.
- CI: el trabajo `data-rights-postgres` ejecuta la prueba de integración contra un Postgres desechable.
