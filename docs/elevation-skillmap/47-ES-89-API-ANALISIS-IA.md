# ES-89 · API del análisis de IA del contexto profesional (PROPUESTA para revisión de QA)

28-oct-2026 · Autor: Dev-Worker-Claude · Decide lo técnico: Mauricio; el alcance, Alejo. Subtarea E de ES-84 (spike `43-SPIKE-WORKER-ES-84.md`, §7). Depende de ES-85, ES-87 y ES-88. **Sin frontend**: ninguna pantalla nueva; el resultado se mostrará en la interfaz existente (ES-30). Todo lo que no se pudo verificar está marcado «no verificado».

## Rutas (`/api/skill-analysis`, `verificarToken`; titular = sesión; `Cache-Control: no-store`)
| Método y ruta | Qué hace |
| --- | --- |
| `POST /jobs` `{ requestId }` | Crea el análisis del contexto profesional activo. `201` nuevo, `200` si ya existía ese `requestId`. |
| `GET /jobs` | Los últimos 20 análisis de la persona. |
| `GET /jobs/:id` | Un análisis con sus candidatas (con etiquetas `{es, en}` del catálogo). |
| `POST /jobs/:id/cancel` | Cancela un análisis vivo. Idempotente. |
| `GET /candidates?status=` | Candidatas de la persona (hasta 200). |
| `POST /candidates/:id/review` `{ action: 'accept', level? }` o `{ action: 'reject' }` | La persona decide una candidata. |

Errores `{ code, error }` con texto «es / en»: `invalid_input` 400, `consent_required` 403, `not_found` 404 (también para ids ajenos o mal formados: no se revela que existen), `no_context` 409, `analysis_in_progress` 409 (con el análisis vivo), `job_final` 409, `already_reviewed` 409, `candidate_invalidated` 409, `cannot_raise_level` 422.

## Reglas
- **Propietario en el servidor en cada acceso**: todas las consultas filtran por `UserId` de la sesión. No hay lectura para administradores, terapeutas ni facilitadores.
- **Crear**: exige consentimiento `professional_bridge` vigente (bloqueo compartido en la transacción, como el resto de lectores) y una versión de contexto activa. Un análisis vivo por persona (`PENDING`, `RUNNING` o `REVIEW_REQUIRED`): acota el gasto; las altas de una misma persona se serializan con un candado de transacción. `contextHash` = sha256 del payload cifrado, igual que calcula el SQL del worker (probado: el worker acepta el job creado por el API).
- **Respuestas sin internos**: nunca `contextHash`, `fence`, lease, `requestId`, `UserId`, `errorCode` ni el payload. El motivo se da como código grueso `reason`: `budget`, `provider`, `invalid_output`, `revoked`, `context_changed` o `internal`; `retryAt` cuando el análisis espera por presupuesto.
- **Cancelar**: `PENDING`/`RUNNING`/`REVIEW_REQUIRED` → `CANCELLED`. El worker lo nota en su heartbeat y su publicación se rechaza por el `fence`. Lo que la persona aún no revisó se descarta (`REJECTED`); lo que ya aceptó se conserva. Si hay una publicación en curso, espera a que confirme y entonces descarta lo publicado.
- **Revisar**: `accept` sin `level` conserva el nivel propuesto (puede ser `null`); con `level` solo puede **bajarlo** o ponerlo en `null`; subirlo, o poner nivel donde no se propuso ninguno, es `422 cannot_raise_level`. La propuesta de la IA (`level`) no cambia (inmutable por disparador): la decisión se guarda aparte en `confirmedLevel` + `reviewedAt` (migración `20261028210000`, con CHECK `1 ≤ confirmedLevel ≤ level`). Las decisiones son finales e idempotentes (repetir lo mismo = `200`; cambiarlas = `409`). Cuando no queda nada por revisar, el análisis pasa a `COMPLETED`.
- **Aceptar no certifica competencia** y **no crea evaluaciones del Skill Map**: ver «Decisión a revisar».

## Disparo: explícito o automático (pendiente de Alejo)
`AI_ANALYSIS_TRIGGER` (por defecto `explicit`): la persona pide el análisis con `POST /jobs`. Con `automatic`, `careerContext.confirm` pide el análisis solo, en la misma transacción que crea la versión de contexto (`skillAnalysis.autoCreate`): solo con consentimiento vigente, con `requestId` derivado del de la confirmación, sin duplicar si ya hay uno vivo y sin hacer nunca fallar la confirmación. Cambiar de uno a otro es cambiar esa variable; el código es el mismo.

## Decisión a revisar (OBJECIÓN de diseño, ver PR)
El spike dice que al confirmar se usa el camino de ES-28/29 (`/api/skill-map/proposals/confirm`). Ese camino crea una evaluación del Skill Map y **exige evidencias confirmadas** (ES-29: «nivel null sin evidencia»), mientras que el worker solo ve el contexto profesional (motivaciones, valores, intereses…), que no son evidencia. Por eso aceptar una candidata **solo registra la decisión de la persona**; convertirla en parte del mapa queda para ES-30, con la regla de evidencia que decidan Mauricio y Alejo.

## Pruebas
`npm run test:skill-analysis:pg` (Express real, JWT real y Postgres real con las migraciones reales; el worker es una conexión real con el rol restringido, así las candidatas se producen de verdad): autenticación, consentimiento y contexto, validación de entrada, idempotencia, un análisis vivo por persona (seis altas simultáneas = una), propietario (404 y ids malformados), consulta sin internos, motivos y `retryAt`, revisión completa (subir nivel, idempotencia, cierre, CHECK de base de datos, exportación), cancelación (pendiente, en curso, por revisar, con una publicación en curso), revocación, y el disparo automático.

## No verificado
- Supabase real y su pooler; el CI de los PR.
- Qué mostrará la interfaz existente con estos datos (sin frontend en este ticket).
- Límite de tasa por IP o por persona: el repositorio no tiene un limitador general; el tope real es «un análisis vivo por persona» más el presupuesto de IA (ES-22). Si Mauricio quiere un limitador explícito, es un ticket aparte.
