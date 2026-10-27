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
