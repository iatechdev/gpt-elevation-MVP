# ES-19 · Contrato de consentimiento por propósito

26-oct-2026 · Dev-Claude · Cubre SP2-HU03 (RF-02, RF-11). Backend implementado en la rama de ES-19; la interfaz y la analítica solo tienen contrato aquí, no código. Los consumidores (puente ES-25, consola del facilitador ES-35, exportación ES-23) todavía no existen.

## 1. Propósitos (lista cerrada)

| Clave | Qué autoriza | ¿Obligatorio? | Revocable por API |
| --- | --- | --- | --- |
| `necessary` | Operación necesaria para usar la aplicación | Sí | No: solo con la eliminación de la cuenta (ES-23) |
| `professional_bridge` | Transferir lo elegido desde la exploración privada al trabajo de carrera | No | Sí |
| `facilitator_sharing` | Compartir con el facilitador lo que se defina para ese fin | No | Sí |
| `research` | Uso de datos para investigación | No (opcional) | Sí |
| `notifications` | Recibir notificaciones | No (opcional) | Sí |

No hay un consentimiento global. Cada decisión es independiente: rechazar `research` o `notifications` no bloquea el uso necesario ni otras funciones. Nada en el backend exige hoy `necessary` para usar la aplicación (el registro actual no muestra términos); el valor `undecided` no restringe nada.

## 2. Modelo de datos (tablas nuevas, creadas por `sync()`; sin migración)

- `Consents`: una fila vigente por `(UserId, purpose, scope)` con `status` (`granted` | `revoked`), `version` y `decidedAt`. Índice único sobre esa clave.
- `ConsentEvents`: historial de solo altas, una fila por cambio real (`UserId`, `purpose`, `scope`, `status`, `version`, `decidedAt`). Sin texto de conversaciones, diario ni contenido derivado.
- `scope` admite hoy solo `default`. El alcance por campos del puente lo definirá ES-25 ampliando la lista.
- **Versión de política:** `REQUIRED_VERSION` (hoy 1 para todos). Un `granted` con versión menor deja de valer y se muestra como `outdated`: la persona debe volver a decidir.
- Al eliminar una cuenta los registros no se borran en cascada (no hay clave foránea): lo resuelve ES-23.

## 3. API de la persona (solo el titular; nunca administradores)

El titular siempre es el usuario del token; un identificador en el cuerpo o en la ruta no se usa.

| Ruta | Efecto |
| --- | --- |
| `GET /api/consents` | `{ consents: [{ purpose, required, scope, status, version, requiredVersion, decidedAt }] }`, siempre los cinco propósitos. `status`: `undecided` \| `granted` \| `revoked` \| `outdated` |
| `PUT /api/consents/:purpose` | Cuerpo `{ status: 'granted' \| 'revoked', scope?: 'default' }`. Devuelve `{ purpose, scope, status, version, decidedAt, changed }`. Idempotente: repetir el mismo estado no crea evento (`changed: false`) |
| `GET /api/consents/history` | `{ history: [{ purpose, scope, status, version, decidedAt }] }`, más reciente primero (máx. 100) |

Errores: 400 entrada inválida; 404 propósito desconocido; 409 `necessary_not_revocable`; 403 sin sesión; 503 si no se puede comprobar la sesión; 500 sin detalles internos.

## 4. Verificación al acceder (para quien consuma datos de otra persona)

- `hasConsent(userId, purpose, scope)`: lectura simple.
- `requireConsent(purpose, ownerOf)`: middleware; 403 `consent_required` si no hay consentimiento vigente, 503 si no puede comprobarlo.
- `withConsent(userId, purpose, fn)`: comprueba el consentimiento **dentro de una transacción con bloqueo compartido** y ejecuta `fn(transaction)`. Una revocación concurrente espera a que la operación termine; cualquier operación que empiece después de la revocación se rechaza. Úsese para exportaciones, publicaciones y cualquier flujo de varios pasos (patrón de ADR-003).
- Un consumidor nunca debe guardar el resultado de un consentimiento en caché ni inferirlo de un checkbox.
- La invalidación de derivados y cachés tras revocar la completan ES-25 y ES-23.

## 5. Contrato para la interfaz (sin código todavía)

- La interfaz muestra los cinco propósitos con una decisión independiente por propósito; sin casilla global.
- Estados: sin decidir, concedido, revocado, desactualizado (volver a pedir). Cargando, guardando y error recuperable.
- Textos ES y EN por clave de propósito en el catálogo i18n; el backend no devuelve textos.
- **Al revocar `facilitator_sharing` o `professional_bridge` debe mostrarse:** «Una copia ya descargada no puede recuperarse automáticamente» / «A copy you already downloaded cannot be retrieved automatically» (RF-02).
- La pantalla pasa por la puerta de diseño antes de implementarse.

## 6. Contrato de analítica (sin contenido privado)

Eventos permitidos, solo con estos campos: `consent.granted` y `consent.revoked` con `{ purpose, scope, version, at }` y un identificador seudónimo de la persona. Prohibido incluir texto de conversaciones, diario, ánimo, indicadores de crisis o contenido derivado. Agregados por cohorte suprimen subgrupos de menos de cinco personas (RF-11).

## 7. Qué no cubre este ticket

- Consumidores reales de los permisos (ES-25, ES-35, ES-23) y la invalidación de derivados.
- Condicionar el módulo de terapeutas existente: decisión del 26-oct de mantenerlo funcionando; queda como riesgo aceptado hasta que se decida si se apoya en `facilitator_sharing`.
- Pantallas de consentimiento y registro de la aceptación de `necessary` al crear la cuenta.
- Prueba de concurrencia con Postgres real (dos conexiones): solo se simuló en memoria con exclusión mutua por fila.
