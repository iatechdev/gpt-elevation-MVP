# ES-29 · Contrato del Skill Map trazable con nivel nullable (PROPUESTA para aprobación)

27-oct-2026 · Dev-Claude · Cubre SP2-HU11 (RF-06). **Es una propuesta: no hay código hasta que Mauricio (técnico) y Alejo (alcance) la aprueben.** Backend y contrato de API; sin interfaz (los controles los construye Alejo), por lo que no aplica la puerta de diseño de frontend. **Depende de ES-27 (PR #28, aún sin fusionar):** la implementación se apilará sobre su rama.

## 1. Idea en una frase

Un mapa donde **cada nivel está sustentado por evidencias confirmadas y una rúbrica versionada, o es `null`**. La IA solo **propone**; la persona confirma; un nivel nunca sube por el ánimo ni se convierte en un porcentaje de empleabilidad. Si la evidencia cambia, el nivel deja de mostrarse hasta recalcularlo.

## 2. Catálogo y rúbricas (contenido, no código)

- Archivos versionados `backend/config/skillCatalog.json` y `backend/config/skillRubrics.json`: `catalogVersion`, y por habilidad `skillKey` (clave canónica estable), tipo (`transversal` \| `domain`), etiquetas ES/EN y su rúbrica (`rubricVersion`, criterios observables por nivel 1–4, fuente y quién la verificó y cuándo).
- **El código solo carga y valida el catálogo; no inventa habilidades ni criterios.** Los archivos **salen vacíos** (igual que `supportResources.json` de ES-21) y las pruebas usan un catálogo sintético. Sin contenido real no se puede evaluar ninguna habilidad: **es un bloqueo para el piloto, no para el código** (*Decisión abierta 1*).
- Una habilidad o rúbrica sin fuente y verificador completos no se carga.

## 3. Modelo de datos (tabla nueva, solo se añaden filas)

`SkillAssessments` (append-only; una fila vigente por persona + habilidad + pista):
`UserId`, `skillKey`, `track` (`self` \| `review`), `level` (`1..4` \| `null`), `state` (`initial` \| `reviewed` \| `contradictory`), `catalogVersion`, `rubricVersion`, `evidenceRefs` (lista de `{evidenceId, version}`), `confidence` (`low` \| `medium` \| `high`), `confidenceReason`, `rationale` (**cifrado v2**), `authoring` (`person` \| `ai_proposed`), `status` (`current` \| `superseded`), `requestId`, `createdAt`. Único: `(UserId, requestId)` y, parcial, una `current` por `(UserId, skillKey, track)`.
- El estado **«sin evidencia»** no se guarda: es la ausencia de fila vigente (nivel `null`).
- **Autoevaluación y revisión son pistas separadas** (`self` / `review`); nunca se mezclan ni se promedian.

## 4. Reglas que el servidor impone siempre

1. `level` ≠ `null` **exige** al menos una `evidenceRef`; sin evidencia, el nivel es `null` (se rechaza lo contrario).
2. Cada `{evidenceId, version}` debe ser **del dueño**, **confirmada** y **la versión vigente** (pertenencia y vigencia). Una evidencia del chat solo cuenta con el consentimiento `professional_bridge` vigente (lo resuelve `getConfirmedEvidence` de ES-27).
3. `skillKey` ∈ catálogo vigente; `rubricVersion` = la del catálogo cargado.
4. **Confianza calculada por reglas, no declarada por el modelo** (el PRD dice que la confianza del LLM no está calibrada). Propuesta: `low` con una sola evidencia de autorreporte; `medium` con dos o más evidencias distintas; `high` solo cuando haya procedencia `artifact_examined` o `exercise_observed` (hoy imposible: solo se acepta autorreporte). `confidenceReason` se genera con la misma regla.
5. **Entradas del modelo = solo evidencias confirmadas.** Nunca ánimo, diario, chat ni etiquetas de crisis. Una prueba verifica que el código del Skill Map no importa esos modelos.
6. Sin porcentaje de empleabilidad, sin puntuación global y sin comparar numéricamente habilidades distintas (el mapa no devuelve agregados).
7. Ninguna conversión automática 1–5 → 1–4 (§8).

## 5. Flujo: la IA propone, la persona confirma

1. `POST /api/skill-map/proposals` `{ skillKeys? }` → el servidor lee `getConfirmedEvidence`, arma el prompt con las evidencias **delimitadas como datos no confiables** (`fenceUntrusted`), llama a Claude por `callClaude` (`kind: assessment`; presupuesto, tiempo de espera y registro de ES-22) y **valida la salida**: esquema, `skillKey` del catálogo, referencias a evidencias propias y vigentes, y que toda cita textual aparezca en esa evidencia. Lo inválido se descarta (502 `invalid_model_output` si nada es válido); **nada se guarda**. Devuelve propuestas con un `token` firmado de 10 minutos ligado a la persona y al contenido.
2. `POST /api/skill-map/confirm` `{ token, requestId, accept: [skillKey…], overrides? }` → guarda de forma **atómica e idempotente** (por `requestId`) las aceptadas como pista `self`, `authoring: ai_proposed`. La persona puede **rebajar o poner `null`** a una propuesta (`overrides`); **no puede subir un nivel por encima de lo que sustenta la evidencia propuesta** (se rechaza y se pide otra evidencia).
3. `POST /api/skill-map/self` `{ skillKey, level, evidenceRefs, requestId }` → la persona fija su propia autoevaluación (mismas reglas del §4). 
4. **Discrepancia → revisión humana:** si la propuesta de la IA y el nivel de la persona difieren en 2 o más niveles, o la evidencia cita hechos que se contradicen, la fila queda en estado `contradictory` y se marca «requiere revisión»; **no se resuelve sola**.
5. `GET /api/skill-map` → una entrada por habilidad del catálogo: `{ skillKey, labels, type, self, review, state, confidence, confidenceReason, evidenceCount, stale }`. Sin evidencia: `level: null`, `state: no_evidence`.

## 6. Cuando cambian las evidencias

- El mapa **comprueba al leer** que cada `{evidenceId, version}` citada sigue siendo la versión vigente y confirmada. Si no, la entrada pasa a `stale: true`, **su nivel se muestra como `null`** (no se muestra un nivel que ya no está sustentado) y se pide recalcular con las fuentes aún permitidas. No se recalcula sola.
- Esa lectura marca como procesados (`handledAt`) los eventos de `DerivedInvalidations` (`sourceType: evidence`) de la persona. Un evento registrado no equivale a una invalidación procesada; aquí sí se procesa.
- Revocar `professional_bridge` ya revoca las evidencias del chat (ES-27); las evaluaciones que dependían de ellas quedan `stale` por la misma regla.

## 7. Revisión humana (pista `review`)

El modelo de datos y las reglas ya admiten la pista `review` con `authoring: person`, pero **quién revisa y desde qué consola no está definido** (la consola de facilitación es ES-35). Esta HU **no** expone el endpoint de revisión: solo guarda la discrepancia y la marca (*Decisión abierta 2*).

## 8. Evaluaciones técnicas legadas (escala 1–5)

En la base activa (`backend/`) **no existe ninguna tabla de habilidades, radar o niveles**; el perfilador anterior (`platform/`, `TechProfiler`) no es la base activa y este PR no lo toca ni migra. Por eso **no hay nada que convertir ni borrar**: la nueva escala se guarda con su propio campo y cualquier dato legado que se importe en el futuro irá en una tabla aparte, con su escala y rúbrica originales, sin conversión (*Decisión abierta 4*: confirmar que no hay datos legados que importar al piloto).

## 9. Pruebas previstas

Reglas del §4 una por una (nivel sin evidencia, evidencia ajena, versión no vigente, evidencia en borrador, habilidad fuera del catálogo, rúbrica distinta) · salida del modelo malformada, con claves extra, con niveles fuera de 1–4, con citas inventadas, con instrucciones incrustadas en la evidencia (con proveedor simulado) · **canarios de ánimo, diario, chat y crisis fuera del prompt y de la salida** · un nivel no sube por el ánimo (el ánimo ni siquiera se lee) · confirmación atómica e idempotente (reintentos y confirmaciones simultáneas en **Postgres real**) · cambio y borrado de evidencia → `stale` y nivel `null` · revocación del puente · pistas `self`/`review` separadas · discrepancia → `contradictory` · presupuesto de IA agotado (429) · mutaciones de los controles críticos · errores ES/EN.

## 10. Lo que no cubre

Interfaz; el contenido real del catálogo y las rúbricas; el endpoint de revisión humana; el radar y los «déficits» (ES-30); rutas (ES-32); evaluación con casos reales (corpus de ES-44/46); importación de datos legados.

## 11. Decisiones abiertas para aprobar

1. **Catálogo y rúbricas:** ¿quién los redacta y verifica (Alejo / especialista de dominio) y cuándo? El código sale con los archivos vacíos y las pruebas con datos sintéticos. **Sin contenido real, el piloto no puede evaluar nada.**
2. **Revisión humana:** ¿se aprueba que esta HU solo guarde la discrepancia y deje el endpoint de revisión para ES-35?
3. **IA dentro de ES-29:** el criterio de aceptación pide validar la salida del modelo, así que propongo incluir la propuesta con Claude (con proveedor simulado en las pruebas). Estimación: **12–14 h** (el ticket tiene 10 h, rango 8–12). Alternativa: ES-29 entrega almacén, reglas, validación y mapa (≈ 9–10 h) y la propuesta de la IA va aparte.
4. **Datos legados 1–5:** ¿confirmas que no hay datos legados que llevar al piloto?
5. **Confianza por reglas** (no la declarada por el modelo), con el tope `medium` mientras solo exista autorreporte. ¿De acuerdo?

## 12. Revisión tras las respuestas de Mauricio (27-oct-2026)

**1 · Catálogo y rúbricas administrables por el cliente desde el backoffice.** Sustituye al §2 (archivos JSON): el contenido vive en base de datos, versionado y publicable.
- `SkillCatalogs` (`version`, `status`: `draft` \| `published` \| `archived`, `publishedAt`, `publishedBy`) y `SkillDefinitions` (`catalogId`, `skillKey` canónica y estable, `type`, etiquetas ES/EN y rúbrica: criterios observables por nivel 1–4 en ES/EN, `source`, `verifiedBy`, `verifiedAt`).
- **Solo un catálogo `published` está vigente.** Un catálogo publicado es inmutable: para cambiarlo se crea un borrador copiado del vigente, se edita y se publica como versión nueva. Así cada evaluación sigue apuntando a la rúbrica exacta con la que se hizo.
- **Publicar exige** que cada habilidad tenga etiquetas ES/EN, los 4 niveles descritos en ambos idiomas, fuente, verificador y fecha; si falta algo, no se publica (422 con la lista de faltantes).
- API para el backoffice (rol de administración existente; *a confirmar si el cliente usa `admin` o `board`*): `GET/POST /api/admin/skill-catalog` (versiones y borrador nuevo), `PUT /api/admin/skill-catalog/:id/skills/:skillKey`, `DELETE …/skills/:skillKey`, `POST /api/admin/skill-catalog/:id/publish`. Cada publicación registra quién y cuándo (sin copiar contenido a los registros). La **pantalla del backoffice** la construye Alejo con este contrato.
- Si el catálogo vigente cambia una rúbrica, las evaluaciones antiguas **conservan su versión** y el mapa las marca `catalogOutdated` (recalcular, a elección de la persona); no se recalcula sola.
- El sistema **no trae contenido propio**: sin catálogo publicado, el mapa responde «catálogo no disponible» y no evalúa nada.

**2 · Revisión humana.** Decido que **esta HU guarde la discrepancia y deje el endpoint de revisión para ES-35**. Motivo: un revisor tendría que leer la evidencia de otra persona; eso es un flujo de datos nuevo que exige el propósito `facilitator_sharing` (ES-19), una consola y su propio diseño de permisos. Hacerlo aquí, sin esa consola, arriesga abrir un acceso que no está diseñado. El modelo ya tiene la pista `review`, así que ES-35 solo añade el endpoint y la consola.

**3 · Alcance e IA (recomendación).** Con el catálogo administrable la HU crece. Estimación honesta:
- Catálogo/rúbricas en BD + API de administración + publicación: **4–5 h**
- Evaluaciones, reglas, confirmación atómica, pistas, estado `stale`, mapa y validación de la salida del modelo (función pura, probada con salidas simuladas): **8–9 h**
- Pruebas en Postgres real y mutaciones: incluidas.
- **Total sin la llamada a Claude: ≈ 13–14 h** (el ticket tiene 10 h, rango 8–12; el catálogo administrable es alcance nuevo).
- **Recomiendo dejar la propuesta con Claude para una historia siguiente (≈ 3–4 h)**, por dos razones: (a) no se puede probar con sentido sin un catálogo real publicado, que el cliente aún no ha cargado; (b) así la frontera de privacidad y las reglas quedan probadas antes de añadir una llamada de IA. El criterio «validar salida del modelo» se cumple con el validador (`validateAssessmentOutput`), que la historia siguiente solo conecta a `callClaude`. *(Pendiente: decidir si se registra como ticket nuevo o dentro de ES-28; el alcance lo decide Alejo.)*

**4 · No hay datos legados 1–5.** Confirmado: no hay nada que importar. Para **organizar el piloto** hace falta contenido que crea el cliente (catálogo y rúbricas, desde el backoffice) y, para probar en staging, **datos sintéticos claramente marcados** (un script de siembra solo para staging que se niega a correr en producción, como el de ES-66). No se inventan fuentes ni verificaciones: si el cliente quiere arrancar más rápido, puedo preparar un **borrador de catálogo inicial** (`draft`, marcado «sin verificar») para que lo revise, edite y publique; no queda publicado por mí.

**5 · Confianza calculada por reglas: implicaciones.**
- *A favor:* es determinista, explicable («una sola evidencia de autorreporte») y comprobable; el PRD dice que la confianza que declara un LLM no está calibrada.
- *Límites:* mide cantidad y procedencia de la evidencia, **no su calidad**; dos evidencias flojas dan «media». Mientras solo exista autorreporte, **«alta» es inalcanzable**: la interfaz no la mostrará en el piloto hasta que haya artefactos examinados, ejercicios observados o revisión humana.
- *Parámetros:* los umbrales son una decisión de producto (Alejo). Se guardan con un `confidenceRuleVersion` en cada evaluación para poder cambiarlos sin reescribir la historia.
- *Qué sigue haciendo el modelo:* redactar la justificación; nunca la confianza ni el nivel final.

## 13. Estado de la implementación (aprobada el 27-oct-2026)

**Decisiones aprobadas:** (1) catálogo y rúbricas administrables desde el backoffice, dentro de ES-29 (≈ 13–14 h); (2) la propuesta de la IA va dentro de ES-28; (3) se prepara un borrador de catálogo inicial; (4) el backoffice usa el rol `admin` (también `superadmin`, que ya pasa por `verificarAdmin`). La revisión humana queda para ES-35 y la confianza se calcula por reglas.

**Código:** `backend/SkillCatalog.js`, `SkillDefinition.js`, `SkillAssessment.js`, `utils/skillCatalog.js`, `utils/skillMap.js`, `routes/skillCatalog.js` (montada en `/api/admin/skill-catalog`), `routes/skillMap.js` (montada en `/api/skill-map`), `seeds/skillCatalogDraft.json` y `scripts/seedSkillCatalogDraft.js`.

**Contrato de API**

| Ruta | Quién | Notas |
| --- | --- | --- |
| `GET/POST /api/admin/skill-catalog`, `GET /:id` | admin, superadmin | `POST` crea el único borrador abierto (copia el vigente); 409 `draft_exists` |
| `PUT/DELETE /api/admin/skill-catalog/:id/skills/:skillKey` | admin, superadmin | solo en borrador; 409 `catalog_not_editable` si está publicado |
| `POST /api/admin/skill-catalog/:id/publish` | admin, superadmin | 422 `incomplete_catalog` con `missing` por habilidad; registra quién publicó |
| `GET /api/skill-map` | la persona | una entrada por habilidad; 503 `catalog_unavailable` sin catálogo publicado |
| `POST /api/skill-map/self` | la persona | `{ skillKey, level, evidenceRefs, rationale?, requestId }`; `level: null` retira la vigente |

Errores de `self`: 400 `invalid_input` / `unknown_skill` · 422 `evidence_required` / `evidence_not_valid` (con `index`) · 409 `conflict`. Cada entrada del mapa trae `self` y `review` (siempre `null` hasta ES-35), `state` (`no_evidence` \| `initial` \| `contradictory` \| `stale`), `confidence` y su motivo en ES/EN, `catalogOutdated` y `needsReview`.

**Reglas implementadas:** nivel solo con evidencia propia, confirmada y en su versión vigente; confianza por reglas (`low` con una evidencia, `medium` con dos o más, `high` solo con procedencia examinada u observada, hoy inalcanzable); discrepancia de 2 o más niveles con la autonomía declarada en la evidencia → `contradictory`; si una evidencia citada cambia, se borra o se revoca, el nivel se muestra `null` (`stale`) y se procesan los eventos de invalidación; ningún agregado ni porcentaje; el módulo no importa ánimo, diario, chat ni crisis.

**Validador para ES-28:** `validateAssessmentOutput(output, { skillKeys, evidence })` descarta lo inválido (esquema, habilidad fuera del catálogo, nivel sin evidencia, evidencia ajena o no vigente, cita inventada, confianza declarada) y sanea el texto. La llamada a Claude, con `callClaude` y `fenceUntrusted`, se conecta en ES-28.

**Borrador de catálogo inicial:** `node scripts/seedSkillCatalogDraft.js` crea un **borrador** con 8 habilidades transversales (comunicación, trabajo en equipo, resolución de problemas, planificación y organización, adaptabilidad, aprendizaje autónomo, análisis de información, influencia y liderazgo), ES/EN y 4 niveles. **Está sin verificar**: no trae fuente, verificador ni fecha, así que el backoffice no permite publicarlo hasta que el cliente los complete. En producción solo se ejecuta con confirmación de Mauricio.

**Pendiente tras fusionar #25 (ES-23):** añadir `SkillAssessments` al registro de datos personales (exportar y purgar). Las tablas de catálogo no son datos personales.
