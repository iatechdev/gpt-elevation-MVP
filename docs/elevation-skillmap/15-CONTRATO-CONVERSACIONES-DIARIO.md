# ES-20 · Contrato de conversaciones y diario privados

26-oct-2026 · Dev-Claude · Cubre SP2-HU04 (RF-01, RF-15). Backend implementado en la rama de ES-20 (apilada sobre ES-19). La interfaz no cambia en este ticket: el contrato de `POST /api/chat` y `GET /api/messages` que lee la interfaz actual se conserva.

## 1. Chat recuperable e idempotente

`POST /api/chat` — cuerpo `{ message, requestId?, contextEntryIds? }`.

| Campo | Regla |
| --- | --- |
| `message` | Texto no vacío (sin cambios) |
| `requestId` | Opcional. 8 a 64 caracteres `A-Z a-z 0-9 _ -`. Con él, el turno es recuperable e idempotente. Sin él, se comporta como antes (sin turno) |
| `contextEntryIds` | Opcional. Hasta 3 identificadores de entradas del diario **propias y no borradas**. Sin ellos, el diario no entra al prompt |

Respuestas:
- **200** `{ reply }` (con `requestId` si se envió). Repetir el mismo `requestId` y mensaje devuelve la misma respuesta con `replayed: true`, sin llamar a Claude ni duplicar mensajes.
- **409** `request_id_reuse` (mismo `requestId`, otro mensaje) o `turn_in_progress` (otro envío igual en curso; un turno pendiente de más de 2 min se puede reintentar).
- **404** `diary_entry_not_found` (alguna entrada elegida no existe, es ajena o está borrada; no se usa ninguna).
- **502** `{ reply, code: 'provider_unavailable', retryable: true, requestId }` si Claude falla o responde vacío: la conversación válida queda intacta y se puede reintentar con el mismo `requestId`. `reply` conserva el contrato que lee la interfaz.
- **500** `{ reply }` si falla la confirmación (la escritura es atómica; el turno queda reintentable).

`GET /api/chat/turns/:requestId` — estado de un turno **propio**: `{ requestId, status: 'pending' | 'completed' | 'failed', retryable, reply? }`. Permite recuperar desde otro navegador autenticado. Otro usuario, un administrador o un `requestId` inválido reciben 404.

Reglas:
- Los mensajes de usuario y de la respuesta se guardan **juntos y solo si Claude respondió** (sin mensajes huérfanos).
- El historial enviado a Claude son los **20 mensajes más recientes**, en orden y empezando por un mensaje del usuario (corrige INV-04).
- `GET /api/messages` conserva su forma `[ { role: 'user' | 'bot', text } ]`.

## 2. Diario privado (`/api/diary`, solo su dueño)

| Ruta | Efecto |
| --- | --- |
| `POST /api/diary` | `{ date: 'AAAA-MM-DD', content }` (contenido de 1 a 10.000 caracteres; fecha de calendario real, no posterior a mañana). 201 con la entrada |
| `GET /api/diary` | Entradas propias no borradas, fecha descendente (`?limit=` hasta 100) |
| `GET /api/diary/:id` | Una entrada propia; ajena, borrada o inexistente: 404 |
| `PUT /api/diary/:id` | Edita contenido y/o fecha; registra una invalidación `edited` |
| `DELETE /api/diary/:id` | Vacía el contenido, marca `deletedAt`, la retira de listas y del contexto y registra una invalidación `deleted` |

- Edición y borrado son atómicos con su registro de invalidación.
- Ninguna ruta de administrador, terapeuta, facilitador o puente lee el diario (hay una prueba que lo comprueba en el código). Guardar no comparte con nadie.
- El contenido se guarda cifrado con el formato v2.

## 3. Invalidación de dependencias

Tabla `DerivedInvalidations`: `{ UserId, sourceType: 'diary_entry', sourceId, reason: 'edited' | 'deleted', handledAt }`, sin contenido privado. Hoy solo se registra; la consumen los derivados (ES-25 síntesis y puente, ES-23 purga y copias).

## 4. Cifrado

- Formato v2: AES-256-GCM, clave derivada con HKDF de `DATA_ENCRYPTION_KEY`; texto `v2:iv:etiqueta:contenido`. Se usa en `ChatTurns` y `DiaryEntries`.
- `desencriptar` lee ambos formatos. Un dato v2 alterado o con otra clave lanza `DecryptionError` en lugar de devolver el texto cifrado.
- **`Messages` (chat existente) sigue en el formato heredado** (AES-256-CBC sin autenticación, INV-08 restante): migrarlo antes de que ES-9 sea estable dejaría el texto cifrado visible si hubiera que volver a la versión anterior. Los datos antiguos no se re-cifran.
- `DATA_ENCRYPTION_KEY` debe ser la misma en todos los entornos que lean los mismos datos.

## 5. Datos nuevos (creados por `sync()`, sin migración)

`ChatTurns` (índice único `UserId + requestId`), `DiaryEntries` y `DerivedInvalidations`. Reversión: el código anterior ignora estas tablas; no se borran. Al eliminar una cuenta no hay borrado en cascada: lo resuelve ES-23.

## 6. Fuera de alcance

Límites, tiempos de espera y presupuesto por persona (ES-22); saneado completo del prompt y frontera de crisis (ES-21); pantalla del diario (ES-15); envío de `requestId` desde la interfaz; purga de copias y respaldos (ES-23); prueba de concurrencia con Postgres real.
