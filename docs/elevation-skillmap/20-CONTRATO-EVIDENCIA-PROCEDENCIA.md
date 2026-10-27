# ES-27 · Contrato de evidencia profesional con procedencia (PROPUESTA para aprobación)

27-oct-2026 · Dev-Claude · Cubre SP2-HU09 (RF-05). **Es una propuesta: no hay código hasta que Mauricio (técnico) y Alejo (alcance) la aprueben.** Backend y contrato de API; sin interfaz (los controles los construye Alejo), por lo que no aplica la puerta de diseño de frontend.

## 1. Idea en una frase

La persona registra, **escrita por ella directamente**, una contribución real con sus límites: qué buscaba, qué entregó y qué efecto se observó, cada afirmación con su procedencia. El sistema la valida, la versiona y avisa a lo derivado cuando cambia. **No infiere, no completa y no convierte una meta en un logro.**

## 2. Modelo de datos (tablas nuevas, sin tocar las existentes)

- `Evidences`: `id`, `UserId`, `currentVersion`, `deletedAt`.
- `EvidenceVersions` (inmutables): `EvidenceId`, `UserId`, `version`, `status` (`draft` \| `confirmed`), `payload` (**cifrado v2**), `requestId`, `createdAt`. Únicos: `(EvidenceId, version)` y `(UserId, requestId)`.
- Editar crea una versión nueva; nunca se modifica una versión anterior.

## 3. Esquema del `payload` (validado en servidor, claves cerradas)

| Campo | Regla |
| --- | --- |
| `title` | texto, 1–120 |
| `situation` | texto, 1–1000 |
| `responsibility` | afirmación (§4), 1–1000: qué fue **personalmente** suyo |
| `actions` | lista de 1–8 afirmaciones |
| `alternatives` | lista de 0–5 textos (opcional): qué consideró y descartó |
| `goal` | texto, 0–500: **la meta buscada** |
| `delivered` | afirmación: **lo entregado realmente** |
| `observedEffect` | `{ known: true, claim }` \| `{ known: false }`: **el efecto observado, o desconocido** |
| `learning` | texto, 0–1000 |
| `autonomy` | `null` \| `conceptual` \| `assisted` \| `autonomous` \| `leads` (escala 1–4 del PRD; es autorreporte, no certificación) |
| `artifactRefs` | lista de 0–5 referencias (§6), opcional |

**Meta ≠ logro:** `goal`, `delivered` y `observedEffect` son campos separados y obligatorios de distinguir; el sistema nunca los fusiona ni copia uno en otro. «La meta era 10.000 usuarios» vive en `goal`; no puede aparecer como `delivered` ni `observedEffect` si la persona no lo escribe. **El sistema no puede verificar el sentido de un texto**: lo garantiza la estructura y la vista previa.
**Resultado desconocido:** `observedEffect: { known: false }` es válido y se conserva con ese límite (no se rellena ni se rechaza).

## 4. Procedencia por afirmación

Cada afirmación es `{ text, source }` con `source` ∈ `self_report` \| `artifact_examined` \| `exercise_observed`.
- **La persona solo puede enviar `self_report`** (por defecto). Un `source` distinto se rechaza (400): marcar «artefacto examinado» u «observado en ejercicio» exige que alguien o algo lo haya hecho de verdad (un revisor o un ejercicio, otras historias). El esquema ya admite los tres valores para no migrar después. *(Decisión abierta 1.)*
- La interfaz debe mostrar la procedencia de cada afirmación y no mezclarlas.

## 5. Estados y flujo

- `draft`: se puede guardar incompleto (solo `title` y un campo más); nadie lo consume.
- `confirmed`: exige todos los obligatorios y que la persona lo haya visto. Solo las versiones `confirmed` pueden usarse para evaluar capacidades.
- Rutas (todas del dueño, `req.user.id`, `no-store`):
  - `POST /api/evidence` `{ payload, status, requestId }` → 201 `{ id, version }` (idempotente por `requestId`).
  - `PUT /api/evidence/:id` `{ payload, status, baseVersion, requestId }` → versión nueva; `baseVersion` obsoleto → 409 `version_conflict`.
  - `GET /api/evidence` y `GET /api/evidence/:id` (con historial de versiones).
  - `DELETE /api/evidence/:id` → borra: vacía el contenido, marca `deletedAt` y registra la invalidación.
- Un ID ajeno o inexistente da 404 siempre.

## 6. Adjuntos y referencias (no confiables)

- **Sin subida de archivos en esta HU.** Una referencia es `{ kind: "url", url, note? }` (solo `https`, sin credenciales, ≤ 500) o `{ kind: "text", excerpt }` (≤ 1000). Se **guarda como dato y nunca se descarga, se abre ni se ejecuta** (sin SSRF). *(Decisión abierta 2.)*
- Todo texto se normaliza (ES-21) y se enmascaran secretos (ES-22). Quien use este contenido en un prompt lo debe delimitar con `fenceUntrusted`: una instrucción incrustada es texto, no una orden.
- Las referencias a otros objetos (p. ej. un `artifactRef` que apunte a una evidencia propia) se verifican por dueño antes de persistir. No se permiten referencias al diario, al chat ni al puente: **esta evidencia es información profesional ingresada directamente** (mismo criterio que el camino directo de ES-25).

## 7. Cambios e invalidación

- Cada versión nueva y cada borrado registran un evento en `DerivedInvalidations` (`sourceType: evidence`, `sourceId`, `reason: edited \| deleted`), que las evaluaciones y rutas (ES-29, ES-32) consumirán para recalcular. Un evento registrado no es una invalidación procesada.
- Una evaluación dependiente debe citar `(evidenceId, version)`; no puede apuntar a «la última».

## 8. Lectura del motor

Una función de servidor, `getConfirmedEvidence(userId, consumer)`, entrega solo las versiones `confirmed` vigentes y no borradas (campos del §3, sin IDs internos de la persona). No hay ruta HTTP para el motor. **No exige `professional_bridge`** porque la persona lo escribió directamente en el flujo profesional. *(Decisión abierta 4.)*

## 9. Pruebas previstas

Dueño y roles (ID ajeno = 404; administrador, terapeuta y facilitador sin acceso) · esquema (claves extra, tipos, longitudes, 13 acciones, `source` ajeno, URL no https o con credenciales) sin 500 · meta/entrega/efecto nunca fusionados · resultado desconocido guardado tal cual · borrador no consumible por el motor · versiones, `baseVersion` obsoleto, idempotencia por `requestId` · edición y borrado emiten invalidación · instrucción incrustada en texto o URL se guarda como dato y no cambia nada (con un «motor» simulado y `fenceUntrusted`) · canarios de diario/chat/crisis no aparecen · cifrado v2 real y concurrencia (ediciones simultáneas, misma `baseVersion`) en **Postgres real** · mutaciones de los controles críticos · errores ES/EN.

## 10. Relación con otras historias

ES-23: la exportación personal incluirá estas evidencias y la eliminación las purgará (se añade al registro de datos personales). ES-25: sin dependencia de código; el motor profesional leerá el puente y la evidencia por funciones separadas. ES-29/32: consumen `(evidenceId, version)` y los eventos de invalidación. HU02: no verificado qué exige; el diseño no depende de ella.

## 11. Lo que no cubre

Interfaz; subida y análisis de archivos; revisión por un tercero (que es quien podría marcar `artifact_examined` / `exercise_observed`); propuestas de la IA para estructurar la evidencia (si se añaden, su salida pasará por este mismo esquema); validación editorial de los textos.

## 12. Decisiones abiertas para aprobar

1. **Procedencia:** la persona solo envía `self_report`; los otros dos valores los fijará una revisión o un ejercicio futuros (propuesto). ¿De acuerdo?
2. **Adjuntos:** sin subida de archivos; solo referencia URL `https` o extracto de texto, nunca descargada (propuesto). ¿De acuerdo?
3. **Detector de riesgo (ES-21) sobre estos textos:** propongo **no bloquearlos**, a diferencia del puente: una enfermera, docente o trabajadora social puede describir legítimamente situaciones de crisis ajenas y un bloqueo por palabras daría falsos positivos que penalizan justo a esas profesiones. La persona ve y confirma lo que escribe. ¿Prefieres bloquear igual que en el puente?
4. **Lectura del motor** sin exigir `professional_bridge` (es texto profesional directo). ¿De acuerdo?
5. **Autonomía** como autorreporte de 4 niveles o `null`. ¿De acuerdo?

**Estimación:** dentro de las 8 h del ticket (rango 6–10) si se aprueba tal cual.

## 13. Revisión tras las respuestas de Mauricio (27-oct-2026)

Las respuestas 1 y 5 se aceptan tal cual. Las 2, 3 y 4 cambian el diseño porque **la evidencia nace de la conversación del chat**, no se escribe aparte.

**Lo que cambia**
- **Origen de cada evidencia:** `direct` (la persona la escribe en el flujo profesional) o `chat_derived` (sale de turnos del chat). Sustituye al «todo directo» del §6.
- **La conversación sigue siendo privada.** Del chat solo puede cruzar al motor el **texto estructurado que la persona revisó, editó y confirmó** (la misma regla que el puente de ES-25, RF-04). Nunca la transcripción, ni los turnos, ni los IDs de turno.
- **Referencias a turnos (citas):** una evidencia `chat_derived` guarda, en la parte privada, los IDs de los turnos de los que sale. El servidor comprueba que son de la persona y, si hay una cita textual, que **esa cita aparece de verdad en el turno**; si no, se rechaza. Las citas y los IDs nunca viajan al motor.
- **Decisión 4 (consentimiento), aclarada:** una evidencia `chat_derived` **sí exige `professional_bridge`** al confirmar y en cada lectura del motor, y revocarlo la revoca (mismo mecanismo de ES-25). Una `direct` no lo exige. Si una persona nunca autoriza el puente, el chat sigue funcionando y su Skill Map no recibe evidencias del chat.
- **Decisión 3 (detector de riesgo):** se acepta **no bloquear** el texto escrito por la persona. Una sola salvedad, que es regla no negociable del proyecto (ningún indicador de crisis llega al motor): al **proponer** evidencias desde el chat, los turnos que el detector de ES-21 marque no se usan como fuente. El nivel de riesgo sigue siendo efímero: no se guarda ni se registra.
- **Propuestas de la IA:** si se genera una evidencia propuesta desde el chat, la IA solo **propone** un borrador (`draft`); pasa por `callClaude` (presupuesto, tiempo de espera y registro de ES-22), el chat se envía delimitado como dato no confiable (`fenceUntrusted`), la salida se valida contra este esquema y se descartan las citas que no aparezcan en el turno. Nada se guarda como confirmado sin que la persona lo apruebe.
- **Procedencia:** una afirmación aprobada por la persona sigue siendo `self_report` (son sus palabras, no un artefacto ni un ejercicio observado). Se añade `authoring: person | ai_proposed` para saber si partió de una propuesta de la IA.

**Alcance, hay que decidir (afecta horas):**
- **Opción A:** ES-27 incluye todo (almacén + validación + origen `chat_derived` con citas + propuesta de la IA desde el chat). Estimación: **14–16 h** (el ticket tiene 8 h, rango 6–10).
- **Opción B (recomendada):** ES-27 entrega el almacén, el esquema, el origen `chat_derived` con citas verificadas, el consentimiento, las versiones y la invalidación (≈ 8–10 h, dentro del ticket). La **propuesta automática de la IA** pasa a ES-28 «Mis evidencias: captura y revisión», que ya cubre la captura. Motivo: así la frontera de privacidad queda probada antes de agregar una llamada de IA que lee el chat, y el trabajo de la IA se estima con el diseño de la captura.

## 14. Estado de la implementación (opción B aprobada el 27-oct-2026)

- **Incluye:** almacén versionado y cifrado (`Evidence`, `EvidenceVersion`), esquema validado, borrador/confirmada, procedencia solo `self_report`, origen del chat con dueño y cita verificados, consentimiento `professional_bridge` para las evidencias del chat, invalidación al editar/borrar/revocar y la función de servidor `getConfirmedEvidence`.
- **No incluye (pasa a ES-28):** la propuesta automática de la IA desde el chat. Cuando exista, `authoring: ai_proposed` lo fijará el servidor (la API de este PR solo acepta `person`), pasará por `callClaude` (ES-22), usará `fenceUntrusted` y su salida se validará con `normalizePayload`.
- **Código:** `backend/Evidence.js`, `backend/EvidenceVersion.js`, `backend/utils/evidence.js`, `backend/routes/evidence.js` (montada en `/api/evidence`), gancho en `backend/utils/consent.js`.
- **Errores estables:** 400 `invalid_input` / `invalid_source` · 403 `consent_required` · 404 `evidence_not_found` / `origin_not_found` · 409 `version_conflict` (con `currentVersion`) · 422 `incomplete_evidence` (con `missing`) / `quote_not_found` / `origin_not_usable`.
- **Editar una evidencia confirmada como borrador** la saca del motor hasta que se confirme de nuevo, y registra la invalidación de lo derivado.
- **Cuando #25 (ES-23) esté en `main`:** añadir `Evidences` y `EvidenceVersions` al registro de datos personales (exportar y purgar). Las tablas también deben incluirse en el procedimiento de restauración.
