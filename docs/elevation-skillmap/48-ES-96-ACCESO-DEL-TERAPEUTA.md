# ES-96 · Acceso del terapeuta a los datos de la persona (PROPUESTA para revisión de QA)

28-oct-2026 · Autor: Dev-Worker-Claude · Decide lo técnico: Mauricio; el alcance, Alejo. Origen: informe QA de ES-93 (hallazgos ES93-A1, A3 y M7). Decisiones 2a–2d indicadas por Mauricio el 28-oct-2026, **pendientes de confirmar por Alejo** en lo de alcance. Todo lo que no se pudo verificar está marcado «no verificado».

## Decisiones aplicadas
| | Decisión | Cómo queda |
| --- | --- | --- |
| 2a | El terapeuta ve **solo lo que la persona autorizó** | Propósito `therapist_sharing` (ES-19), exigido en cada ruta que entrega datos de una persona. |
| 2b | Sí existe un propósito «terapeuta» | `therapist_sharing`, opcional y revocable, con versión de política 1. |
| 2c | Qué pasa con lo ya visto al desvincular o revocar | El acceso se corta en la siguiente petición. Las **notas que escribió el terapeuta** son su registro profesional y **no se borran**; su retención la define Mauricio (ES-23 `requiresReview` ya impide purgar a quien las tiene). El terapeuta no guarda copias de la persona: lo que ve se calcula en cada lectura. |
| 2d | El alta y validación del profesional | **Fuera del piloto**: la vinculación es manual por el administrador (ES-99 / M3). |

## La autorización va ligada a UN terapeuta
El consentimiento `therapist_sharing` usa como **alcance** `therapist-<id>` (el terapeuta al que se autoriza). Por eso:
- Si el administrador reasigna a la persona a otro terapeuta, **el nuevo no hereda la autorización**: ve solo lo mínimo hasta que la persona decida de nuevo. (Si vuelve el anterior, recupera la que se le dio.)
- La persona no elige el alcance: `PUT /api/consents/therapist_sharing { status }` lo resuelve el servidor con **su terapeuta actual**. Mandar `scope` es 400; sin terapeuta vinculado es `409 no_therapist`.
- `GET /api/consents` muestra `therapist_sharing` con el estado frente al terapeuta actual y `applicable: false` si no tiene ninguno.

## Qué ve el terapeuta
| Sin autorización | Con autorización |
| --- | --- |
| Lista `/pacientes`: id y nombre (parte del vínculo, para agendar), `sharing: false`; sin correo, ánimo, valoraciones ni tendencias (campos neutros). | Todo lo anterior (`sharing: true`). |
| `/alerts`: la persona no aparece (las alertas se calculan con el ánimo). | Alertas de inactividad y progreso. |
| `/historial`, `/historia`, `/resumen-ia`, crear y editar notas: `403 consent_required` («es / en»). | Acceso. |
| `/api/sessions/therapist`: `patientEmail` vacío. | Correo incluido. |

Una persona de **otro terapeuta, inexistente, inactiva, con eliminación solicitada o desvinculada** responde `404` uniforme (no se revela que existe). La lectura se hace con el consentimiento comprobado **dentro de una transacción con bloqueo compartido** (ADR-003 de ES-19): una revocación en curso espera a la lectura y ninguna lectura nueva ve un consentimiento retirado. El bloqueo no se mantiene durante la llamada a la IA del resumen.

## La persona se desvincula sola: `DELETE /api/sessions/user/my-therapist`
Idempotente. Quita el vínculo, cancela las sesiones **futuras** agendadas entre ambos (`cancelReason = unlinked_by_person`; lo terminado se conserva) y retira la autorización a ese terapeuta (queda en el historial de decisiones).

## Eliminación de cuenta (ES-93 A1)
`requestDeletion` (ES-23) ahora, en la **misma transacción**, desvincula al terapeuta y cancela las sesiones futuras (`account_deletion`). El acceso se corta **al aceptar la solicitud**, no al purgar (el purgado es un paso de mantenimiento manual y, mientras haya notas clínicas, queda en `awaiting_review`). Además, cada ruta comprueba que la persona esté activa y sin eliminación solicitada, lo que cubre las solicitudes aceptadas **antes** de este cambio.

## M7
`Cache-Control: no-store` en todo el router del terapeuta y en el de sesiones (datos de personas y de su terapeuta).

## Pruebas
`npm run test:therapist-privacy:pg` (HTTP, JWT, middlewares de rol y Postgres reales): sin autorización nunca dada; autorizar (alcance del servidor, sin elegir a quién); revocar con una revocación a medias que hace esperar la lectura; terapeuta nuevo sin herencia; desvincularse sola; eliminación de cuenta (lista, alertas, ficha, notas y sesiones) y una solicitud heredada sin desvincular; personas inactivas; roles ajenos; `no-store`. Además, ES-19 (seis propósitos), ES-18 A/B y ES-78 actualizados.

## No verificado
- **La persona hoy no tiene pantalla para autorizar a su terapeuta**: la interfaz de consentimientos no existe en el frontend (la API de ES-19 sí). Hasta que la haya (Puerta de diseño, ES-100 u otro ticket), una persona vinculada **no comparte nada** salvo que se autorice por la API. En staging/piloto hay que concederlo por ese medio o con una semilla; no lo hago aquí porque es un cambio de frontend.
- La interfaz del terapeuta ante los campos neutros de quien no autorizó (muestra ceros; el aviso «sin autorización» es de ES-100).
- Retención de las notas del terapeuta tras una eliminación (decisión de Mauricio).
- Supabase real; los pasos de CI.
