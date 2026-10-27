# ES-23 — Exportación personal y solicitud de eliminación

> **Numeración (QA-23-06):** este documento es el 18. El 16 de `main` es `16-LIMITES-Y-FRONTERA-PRIVADA.md` (ES-21).

[Dev-Codex] · 26-oct-2026 · Implementación del plan técnico de Jira, comentario 10127, aprobado en la sesión de desarrollo. Base inicial: `main` 6b17291.

## Estado y alcance verificable

Backend Express/Sequelize/Postgres y contrato para los controles de Alejo. La exportación personal cubre los datos de la aplicación enumerados abajo, exclusivamente del dueño autenticado. Las cuentas con registros del servicio humano o relaciones que requieren política de retención reciben `data_review_required`: no se entrega un archivo parcial como si fuera completo.

**ES-23 integrada sigue pendiente.** La exportación profesional y la invalidación de evaluaciones/rutas/cachés necesitan los contratos de ES-25 y ES-27. Esta entrega no contiene fixtures inventados de esas historias: la exportación profesional responde `503 professional_contract_pending`. El consumo de `DerivedInvalidation` para derivados profesionales sigue pendiente y no se marca `handledAt`.

La solicitud de cuenta bloquea sesiones y cesión de datos, registra trabajo durable y permite purgar el contenido activo conocido en mantenimiento. El proceso conserva el estado `awaiting_verification` hasta resolver las dependencias y verificar proveedores y copias. No existe una transición automática a `completed`, ni se prometen siete o treinta días.

`DATA_RIGHTS_ENABLED=true` habilita **estas rutas** en el entorno aprobado. Por defecto están deshabilitadas. El bloqueo por una solicitud de eliminación ya registrada sigue vigente incluso al deshabilitar las rutas. Esto permite detener solicitudes nuevas sin reabrir acceso a cuentas bloqueadas.

## Autenticación y transporte

- JWT vigente de ES-18, con `jti`, en `Authorization: Bearer …`. No se acepta un propietario en el cuerpo, la ruta ni un enlace de descarga.
- Propiedad obtenida de `req.user.id`; ningún rol privilegiado obtiene acceso a archivos ajenos. Las cuentas de roles distintos de participante requieren revisión de sus datos y obligaciones antes de exportar/purgar.
- Respuestas del espacio de exportación y borrado con `Cache-Control: no-store`, `Pragma: no-cache` y `Vary: Authorization`. No hay archivos en GCS, enlaces firmados ni objetos públicos para estas exportaciones.
- JSON inválido se rechaza sin imprimir su contenido en logs. Errores del nuevo servicio: código estable y texto ES/EN; nunca SQL, valores de entrada ni respuestas de proveedores.

## Vista previa y descarga

### `POST /api/exports/preview`

Únicos campos aceptados: `{ "type": "personal", "locale": "es" }`. `locale` admite `es` o `en`; se conserva el contenido original, sin traducciones de IA. `type: "professional"` está reservado pero no disponible. Los campos desconocidos se rechazan, incluyendo `UserId`, selecciones o permisos inventados.

`201` (vista previa nueva) o `200` (se reutilizó la vigente): `{ id, expiresAt, data }`. `id` es un UUID aleatorio; `expiresAt` vence a los diez minutos. `data` es la representación completa que se descargará, no solo un contador. La UI muestra esa representación como **vista previa**, nunca como archivo guardado ni como permiso para compartir.

El JSON tiene `schemaVersion: 1`, `type`, `locale`, `profile` y las colecciones de la matriz de datos. Los valores ausentes se representan como `null`. Se conserva el texto original de los campos privados; el archivo personal no debe reutilizarse como reporte profesional.

La tabla `ExportRequests` almacena solo dueño, idioma, vencimiento y una huella HMAC del contenido, ligada al UUID con separación de dominio. La clave proviene del secreto JWT configurado; rotarlo invalida vistas previas antiguas. No se persiste una segunda copia del contenido ni la huella se entrega al cliente. Al crear una vista previa se purgan los metadatos vencidos de ese dueño.

**Frecuencia y reutilización (QA-23-03).** Armar el archivo es costoso (hasta ~10 MiB en una transacción), así que: (a) las vistas previas de un mismo dueño se atienden **de una en una** dentro del proceso; (b) si ya hay una vista previa **vigente con el mismo idioma y el mismo contenido** se **reutiliza** (mismo `id` y `expiresAt`, respuesta `200`, ninguna fila nueva); (c) si cambió el contenido o el idioma, la nueva **reemplaza** a las anteriores: nunca hay más de una vigente por dueño y el `id` anterior deja de servir (`404`); (d) hay un **límite de frecuencia por persona** (no por IP): `DATA_RIGHTS_PREVIEWS_PER_MINUTE`, por defecto 6, y `DATA_RIGHTS_DOWNLOADS_PER_MINUTE`, por defecto 12; al superarlo, `429 rate_limited`. *Despliegue de una sola instancia en el piloto: con varias instancias el límite y la serialización serían por instancia, y la garantía de una sola fila vigente la dan el reemplazo transaccional y la huella.*

### `POST /api/exports/:id/download`

Sin cuerpo, o `{}`. Solo el dueño puede usar el UUID. `200 application/json`, `Content-Disposition: attachment; filename="elevation-personal.json"`. La descarga vuelve a obtener los datos y compara su huella con la vista previa. Una edición, adición o eliminación que cambie el archivo exige una nueva vista previa.

Ambas operaciones usan una lectura consistente `REPEATABLE READ`. La descarga conserva un bloqueo compartido de la fila del dueño hasta entregar los bytes a HTTP. La aceptación del borrado usa un bloqueo exclusivo de esa misma fila y espera a las descargas ya autorizadas. Una vez aceptada la eliminación no empieza una descarga nueva.

**Descarga que coincide con la aceptación del borrado (QA-23-04).** Si la base detecta el choque (fallo de serialización `40001` o interbloqueo `40P01`) **antes** de entregar bytes, el servidor **reintenta una vez** de forma interna: el reintento ve el borrado aceptado y responde `403 deletion_pending`. Si ni así puede completarse responde `409 concurrent_change` (reintentable), nunca `503 data_rights_failed`. **Tras entregar bytes a HTTP no se reintenta**, para no enviar el archivo dos veces. No es posible retirar bytes ya enviados o copias que la persona ya descargó.

Límites de esta versión: máximo 5.000 filas por colección y aproximadamente 10 MiB de contenido serializado. Si se superan, se rechaza la exportación entera; nunca se trunca silenciosamente. El procedimiento de exportación asistida para casos mayores queda pendiente de operación.

## Solicitud de eliminación y recibo

### `POST /api/account/deletion-requests`

Cuerpo exacto: `{ "confirm": true }`. Debe presentarse una confirmación explícita en los controles UI que implemente su propia historia.

`202` al aceptar; `200` al repetir con una sesión válida del mismo dueño. Respuesta:

```json
{
  "id": "UUID de recibo",
  "status": "accepted",
  "requestedAt": "fecha ISO",
  "activePurgedAt": null,
  "deadlinesVerified": false,
  "repeated": false
}
```

La transacción serializa por dueño, crea un único `DeletionRequest`, fija `active=false`, revoca consentimientos mediante el helper compartido de ES-19 y elimina los metadatos de sus exportaciones. La restricción única de `UserId` impide trabajos duplicados. La aceptación y el bloqueo se revierten juntos si falla la transacción.

Las sesiones existentes y los nuevos logins comprueban la marca durable de eliminación, incluso si alguien vuelve a poner `active=true`. También la comprueban `hasConsent`, `withConsent` y los cambios de consentimiento. La revocación de consentimientos espera los consumidores que ya mantienen su bloqueo compartido. Las rutas administrativas de reactivación, desbloqueo, reset y borrado físico rechazan cuentas con solicitud pendiente.

**Excepción acotada para reintentar el recibo:** este único POST admite un JWT aún vigente que no estuviera previamente revocado por ES-18, aunque la cuenta tenga solicitud de eliminación. Devuelve solo su recibo y no permite leer datos, cancelar la solicitud ni reactivar la cuenta. No es un token público de seguimiento. Cuando expire la sesión, el seguimiento requiere el procedimiento de soporte por definir; no se debe intentar iniciar una sesión nueva. Se conservan las revocaciones de sesión para no rehabilitar tokens antiguos en esta excepción.

## Matriz de datos

Todas las consultas del núcleo incluyen la columna de dueño indicada. El servidor selecciona columnas explícitas; una columna futura no se vuelve exportable automáticamente.

| Entidad / dueño | Exportación personal | Purga activa de esta entrega |
| --- | --- | --- |
| `CareerContextVersions.UserId` (ES-25) | Versión, estado, fechas y los campos que la persona aprobó, **descifrados y como lista**; sin `origins` ni `requestId` (referencias técnicas internas) | Elimina las versiones propias en la purga y las vuelve a borrar con `--replay` |
| `BridgeTransfers.UserId` (ES-25) | Versión, claves entregadas y consumidor de cada lectura del motor profesional; nunca texto ni huella | Elimina las filas propias |
| `Evidences.UserId`, `EvidenceVersions.UserId` (ES-27) | Evidencias no borradas y todas sus versiones con el contenido **descifrado y como objeto**; sin `origins` ni `requestId`; las versiones vaciadas de una evidencia borrada no se exportan | Elimina todas las filas propias (también las vaciadas) y las vuelve a borrar con `--replay` |
| `AiUsages.UserId`, `AiBudgetCounters.UserId` (ES-22) | Tipo de llamada, modelo, periodo, estado, tokens, costo, latencia y código de error; contador de tokens del periodo. **Sin mensajes, prompts ni respuestas** | Elimina las filas propias. El contador de la cohorte (`UserId = 0`) no es de nadie y no se purga |
| `Users.id` | Nombre, correo, rol, estado, motivación, onboarding, plan y fechas; sin contraseña, intentos de acceso ni claves | Seudonimiza nombre/correo, sustituye contraseña y limpia motivación/asignaciones; conserva ID y marca durable, cuenta inactiva |
| `Messages.UserId` | Rol, contenido descifrado y fechas | Elimina las filas propias |
| `ChatTurns.UserId` | Turno, estado, contenido descifrado y fechas | Elimina las filas propias |
| `DiaryEntries.UserId` | Fecha/contenido/fechas de entradas no borradas | Elimina también las filas previamente borradas |
| `MoodLogs.UserId` | Check-in/check-out y fechas | Elimina las filas propias |
| `SessionRatings.UserId` | Valoración y fechas | Elimina las filas propias |
| `WellnessRecommendations.UserId` | Contenido descifrado, categoría, indicadores de lectura y fechas | Elimina las filas propias |
| `Consents.UserId`, `ConsentEvents.UserId` | Propósito, alcance, versión, decisión y fechas | Revoca en la solicitud; elimina en purga activa |
| `PlanRequests.userId` | Plan, estado, nota dirigida al solicitante y fechas; sin identidad del revisor | Elimina las solicitudes propias |
| `DerivedInvalidations.UserId` | Identificadores, razón y estado propios | Conserva pendientes; falta integración de derivados |
| `ExportRequests.UserId` | Metadatos operativos, fuera del archivo personal | Elimina al aceptar y al purgar |
| `DeletionRequests.UserId` | Recibo por la ruta específica, fuera del archivo | Conserva marca mínima y auditoría; nunca contenido íntimo |
| `RevokedTokens.UserId`, `AuthRevocations.UserId` | Excluidos como material de seguridad | Conserva el bloqueo de tokens; retención operativa por acordar |

**Exigen revisión previa:** `ClinicalNotes` como dueño o profesional, `TherapySessions` como participante o profesional, `SessionNotes`, perfiles y validaciones profesionales, matching como solicitante o profesional elegido, manifiestos subidos, decisiones de planes resueltas y asignaciones de otros usuarios al profesional. Si cualquiera existe, o el rol de la cuenta no es `user`, no se entrega una exportación incompleta ni se purga el núcleo como si la cuenta estuviera completamente resuelta. No se descargan documentos GCS, grabaciones ni anotaciones de otras personas.

Prompts atribuidos mediante nombres libres, documentos externos, grabaciones, calendarios, obligaciones de conservación y otros registros del servicio humano necesitan la política y el inventario operativo de Mauricio. Esta entrega no los correlaciona por nombre/correo ni borra registros de terceros.

## Estados y errores para UI ES/EN

| HTTP / código | Acción del cliente |
| --- | --- |
| `400 invalid_input` | Corregir entrada. “Datos inválidos.” / “Invalid data.” |
| `401` sesión inválida/cerrada | No seguir mostrando datos privados; conservar únicamente el recibo ya recibido |
| `403 deletion_pending` | Cuenta bloqueada por eliminación; no ofrecer reactivación ni otra descarga |
| `404 export_not_found` | UUID inexistente, inválido o de otro dueño: respuesta indistinguible |
| `409 export_outdated` | “Los datos cambiaron. Genera otra vista previa.” / “Data changed. Create a new preview.” |
| `409 data_review_required` | “Estos datos requieren revisión antes de exportar o eliminar.” / “These records require review before export or deletion.” |
| `409 concurrent_change` | “La cuenta cambió mientras se procesaba la solicitud. Vuelve a intentarlo.” / “The account changed while the request was processed. Try again.” |
| `429 rate_limited` | “Demasiadas solicitudes. Espera un minuto.” / “Too many requests. Wait a minute.” No generar otra vista previa; conservar la vigente |
| `410 export_expired` | Generar otra vista previa; no reutilizar el UUID |
| `413 export_too_large` | No mostrar descarga parcial como completa |
| `503 professional_contract_pending` | “La exportación profesional aún no está disponible.” / “Professional export is not available yet.” |
| `503 data_rights_unavailable` | Funcionalidad deshabilitada; no ofrecerla como disponible |
| `503 data_rights_failed` | Operación no confirmada; permitir reintentar sin afirmar persistencia |

Estados del recibo: `accepted` (solicitud confirmada), `awaiting_review` (política pendiente), `failed` (purga revertida, cuenta bloqueada), `awaiting_verification` (contenido activo conocido purgado; proveedores/copias/derivados pendientes). No mostrar ninguno como “todos tus datos fueron eliminados”.

## Migración, mantenimiento y restauración

1. **Antes de desplegar:** revisión de Mauricio y QA; ejecutar explícitamente `node scripts/migrateDataRights.js` en el entorno autorizado con variables cargadas por el operador. La migración aditiva crea solo `ExportRequests`, `DeletionRequests` e índices. No altera ni borra tablas existentes. Se puede repetir. No se ha ejecutado sobre staging ni producción.
2. Desplegar el código conservando el bloqueo por marca durable. Mantener las rutas deshabilitadas hasta aprobar las dependencias y operación. El arranque legado con `sync()` no sustituye la migración operativa ni una puerta de readiness.
3. Para purgar: detener y drenar **todos** los productores (web, workers e integraciones) antes de `node scripts/purgePersonalData.js <UUID> --producers-stopped-and-drained`. El argumento confirma una condición que debe verificar el operador; no detecta procesos remotos. No se instala ni se lanza un worker adicional. El contrato de jobs asíncronos sigue pendiente.
4. El procesador bloquea la solicitud, purga el núcleo conocido y seudonimiza la identidad en una transacción. Un fallo revierte todo y registra solo un código genérico/contador de intentos; se puede reintentar el mismo UUID. No toca cuentas ajenas. Una repetición posterior a la purga no vuelve a borrar ni duplica el trabajo.
5. Las solicitudes y sus estados deben conservarse en un registro protegido independiente del backup restaurado. Su ubicación, permisos, conciliación y retención requieren aprobación operativa: no están aprovisionados en esta entrega. **No habilitar una restauración si no se dispone del registro de borrados vigente.**
6. Restaurar en un entorno aislado y sin productores activos; conciliar el registro vigente con las solicitudes restauradas **antes de abrir el acceso**. Por cada solicitud reconciliada ejecutar el mismo procesador añadiendo `--replay`: vuelve a purgar filas reintroducidas aunque conste una purga anterior. Ante fallo o política pendiente, conservar acceso bloqueado y no abrir el entorno. Verificar también secuencias e identidad canónica; no asociar dueños por correo.
7. Confirmar con los proveedores reales la purga de archivos, cachés, respaldos, logs y datos de IA, así como sus tiempos. `deadlinesVerified` permanece `false`. No existe un cierre integral automático ni una promesa de siete/treinta días.

**Reversión de código:** deshabilitar solicitudes nuevas conservando tablas y controles de marca durable en sesiones y consentimiento. Volver a una versión anterior sin esos controles puede reabrir acceso y no es una reversión segura. Nunca borrar el registro de solicitudes como rollback.

## Decisiones de producto pendientes (QA-23-02 y QA-23-05)

- **QA-23-02 · política de retención de los registros del servicio humano (decide Mauricio).** Pacientes con sesión terapéutica, terapeutas y administradores quedan en `409 data_review_required` y **no pueden exportar**; su borrado queda en `awaiting_review` y **no se purga**. Hasta que exista la política (qué se exporta, qué se retiene por obligación profesional y por cuánto tiempo), esas personas no pueden ejercer estos derechos por este flujo. **No es un defecto del código: es un pendiente explícito.**
- **QA-23-05 · reautenticación de la solicitud de borrado (decide Mauricio con Alejo).** La solicitud de eliminación se acepta con una sesión vigente, sin pedir la contraseña de nuevo. Es una decisión de producto; no se cambia en este PR.

## Pruebas y pendientes de aceptación

- Corrida local final `npm test`: **132/132**, sin fallos ni pruebas omitidas. Incluye diez casos propios de ES-23 y regresión de identidad, consentimiento y diario.
- Corrida PostgreSQL 17 local aislada: **5/5**, sin fallos ni omisiones. La migración se aplicó dos veces y se comprobó contra los modelos de Sequelize. Esta evidencia no equivale a una restauración de backups de los proveedores ni a staging.
- `npm audit --omit=dev --audit-level=high`: salida 0; seis vulnerabilidades moderadas transitivas, ninguna alta/crítica reportada. No se cambian versiones de dependencias en esta entrega.
- HTTP real, JWT y montajes de producción con persistencia simulada: ES/EN, IDs ajenos, roles, campos no exportables, edición/vencimiento, solicitud atómica, sesiones, reintentos y revisión de registros humanos.
- PostgreSQL 17 real, base aleatoria local desechable: migración repetida, compatibilidad ORM, lectura consistente, bloqueo de publicación/aceptación, revocación concurrente, unicidad, rollback SQL, reintento y reaplicación de datos restaurados. El test solo acepta `ES23_TEST_DATABASE_URL` con host loopback y crea/elimina su propia base; nunca usa `DATABASE_URL`.
- CI: `npm run test:data-rights:pg` contra servicio Postgres 17 del runner; `npm test` conserva su suite HTTP con dobles. Los resultados reales de la corrida final se registran en el PR, sin equiparar ejecución local con CI/staging.
- Pendientes para cerrar la historia: contratos e integración ES-25/27/jobs; invalidación de derivados; política del servicio humano; procedimiento de recibo sin sesión; retención y réplica del registro de borrados; respaldo/restauración y proveedores reales; QA y aceptación integral ES/EN.
