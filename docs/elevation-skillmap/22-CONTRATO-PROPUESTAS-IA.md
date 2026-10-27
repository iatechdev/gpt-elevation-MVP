# ES-28 (parte backend) · Contrato de las propuestas de la IA (PROPUESTA para aprobación)

27-oct-2026 · Dev-Claude · Cubre la parte de IA que se acordó dejar «dentro de ES-28» al aprobar ES-27 y ES-29 (RF-05, RF-06). **Es una propuesta: no hay código hasta que Mauricio (técnico) y Alejo (alcance) la aprueben.** Solo backend; el formulario y las tarjetas de ES-28 los construye Alejo con este contrato (puerta de diseño aplica a esa parte, no a esta). **Depende de ES-27 (#28) y ES-29 (#30), aún sin fusionar:** la implementación se apilará sobre la rama de ES-29.

## 1. Idea en una frase

La IA **propone borradores**; **nada se guarda ni se evalúa hasta que la persona lo revisa, lo edita y lo confirma**. Hay dos propuestas independientes: (A) un borrador de evidencia a partir de turnos del chat, y (B) una evaluación por habilidad a partir de evidencias ya confirmadas. La IA no puede aumentar logros, inventar citas ni subir niveles.

## 2. Reglas comunes (lo que se cumple siempre)

1. **Todo pasa por `callClaude` (ES-22):** presupuesto por persona y cohorte, tiempo de espera, reintentos acotados, registro de uso sin contenido (`kind: evidence_proposal` / `assessment_proposal`). Presupuesto agotado → 429; sin configurar → 503; fallo del proveedor → 502 reintentable.
2. **Lo escrito por la persona o por terceros es un dato no confiable:** va dentro de `fenceUntrusted` con el delimitador aleatorio por solicitud (ES-21); las instrucciones fijas del sistema están separadas y se enmascaran secretos (ES-22). Una instrucción incrustada en un turno o en una evidencia es texto, no una orden. *Reduce el riesgo, no lo elimina; no se evaluó contra ataques reales.*
3. **La salida del modelo es JSON validado.** Lo inválido se descarta; si nada sobrevive, 502 `invalid_model_output` y no se guarda nada. El modelo **no puede declarar confianza**: se calcula por reglas (ES-29).
4. **Citas comprobadas:** cada cita del modelo debe aparecer en el turno o en la evidencia que cita (texto normalizado); la que no aparezca se descarta.
5. **Sin lenguaje clínico, porcentajes ni promesas:** una salida que contenga `%` o términos de empleabilidad/diagnóstico/prescripción se descarta. *Es un filtro por palabras, limitado.*
6. **Propuestas sin estado:** no se guardan en base de datos. Cada propuesta lleva un `token` firmado de 10 minutos (ligado a la persona y al contenido) que se devuelve al confirmar; así no hay datos derivados del chat en reposo y no hay nada que purgar.
7. **Idioma:** `locale` (`es` \| `en`) fija el idioma de la salida; los textos de la persona se conservan en su idioma.

## 3. Propuesta A · Evidencia desde el chat

`POST /api/evidence/proposals` `{ turnIds: [int] (1–6), locale }`
- Exige el consentimiento `professional_bridge` **ya vigente** (si no, 403 `consent_required` y no se llama a la IA: evita gastar presupuesto en algo que luego no se podría confirmar). *(Decisión abierta 1.)*
- Lee **solo los mensajes de la persona** de esos turnos (no las respuestas del asistente) y solo turnos propios (ajeno = 404). Los turnos que el detector de riesgo (ES-21) marque **no se usan** como fuente; no se dice por qué ni se guarda. Si no queda ninguno: 422 `no_usable_source` (sin llamar a la IA).
- La IA devuelve un borrador con el esquema de ES-27 (`title`, `situation`, `responsibility`, `actions`, `alternatives`, `goal`, `delivered`, `observedEffect`, `learning`, `autonomy`) y una cita por turno usado.
- **Control contra aumentar logros (mecánico):** (a) todo número que aparezca en `delivered` u `observedEffect` debe aparecer en los turnos citados, o se descarta la propuesta; (b) si un número de `goal` aparece también en `delivered`/`observedEffect`, la propuesta se entrega con la advertencia `goal_number_in_outcome` para que la persona lo confirme de forma explícita. **No puede verificar el sentido de una frase**: la garantía real es que la persona revisa cada campo antes de confirmar.
- Respuesta: `{ proposal: { payload (borrador), origins: [{type:'chat_turn', id, quote}] }, warnings, token, expiresAt }`.
- **Para guardarla** la persona usa la API de ES-27 (`POST /api/evidence`) con `origins` y, opcionalmente, `proposalToken`: el servidor marca `authoring: ai_proposed` (parte de una propuesta de la IA, aunque la persona la haya editado). Sin token, `authoring` sigue siendo `person`. La persona confirma con `status: confirmed`; las reglas de ES-27 (consentimiento, cita real, versiones) se aplican igual.

## 4. Propuesta B · Evaluación por habilidad

`POST /api/skill-map/proposals` `{ skillKeys?: [≤8], locale }` y `POST /api/skill-map/proposals/confirm`.
- Entradas del modelo: **solo** las evidencias `confirmed` y vigentes de la persona (`getConfirmedEvidence`) y las rúbricas del catálogo publicado (contenido del cliente). Nunca ánimo, diario, chat ni crisis. Sin evidencias: 422 `no_evidence` (sin llamar a la IA). Sin catálogo: 503 `catalog_unavailable`.
- La salida se valida con `validateAssessmentOutput` (ES-29): habilidad del catálogo, nivel 1–4 o `null`, evidencia propia y vigente, cita real, sin confianza declarada.
- **Tope por evidencia:** el nivel propuesto no puede superar la autonomía más alta que la propia persona declaró en las evidencias que cita; si no declaró ninguna, se entrega con la advertencia `no_declared_autonomy`. *(Decisión abierta 2.)*
- Respuesta: `{ proposals: [{ skillKey, level, evidenceRefs, rationale, confidence, confidenceReason }], warnings, token, expiresAt }`. La `confidence` la calcula el servidor con las reglas de ES-29.
- `POST /api/skill-map/proposals/confirm` `{ token, requestId, proposals, accept: [skillKey…], overrides?: {skillKey: level|null} }`: verifica el token contra el contenido, **vuelve a comprobar que las evidencias siguen vigentes** y guarda de forma **atómica e idempotente** (todo o nada; reintento con el mismo `requestId` devuelve lo mismo) las aceptadas como pista `self`, `authoring: ai_proposed`. La persona puede **bajar un nivel o poner `null`**; **no puede subirlo** por encima del propuesto.
- Discrepancias: se aplican las reglas de ES-29 (`contradictory` cuando el nivel difiere 2 o más de la autonomía declarada).

## 5. Seguridad y privacidad (resumen)

El chat sigue siendo privado: **al motor profesional nunca llega un turno ni una cita**; solo el borrador que la persona confirmó, con el consentimiento vigente (ES-27). Los textos de la persona salen hacia el proveedor de IA igual que en el chat ordinario (ya declarado en la política de datos); no se registran en telemetría (ES-22 guarda solo metadatos). Las propuestas no se almacenan.

## 6. Pruebas previstas (proveedor simulado; no se llama a Claude real)

IDs ajenos y roles · turnos marcados por el detector excluidos · **canarios** (diario, ánimo, crisis, respuestas del asistente) fuera del prompt y de la salida · instrucción incrustada en un turno o evidencia (queda dentro del delimitador; una salida que la obedece se descarta) · salida con JSON roto, claves extra, niveles fuera de rango, habilidad inventada, cita inventada, confianza declarada, `%`, número inflado en `delivered` y número de meta repetido en el logro · tope de nivel por autonomía · token alterado, vencido, de otra persona o con contenido cambiado · confirmación atómica e idempotente y evidencia que cambia entre propuesta y confirmación (también en **Postgres real**) · presupuesto agotado/sin configurar/proveedor caído (429/503/502) y que **no se llama al proveedor** en los casos de rechazo previo · `authoring: ai_proposed` solo con token válido · mutaciones de los controles críticos · errores ES/EN.

## 7. Lo que no cubre

El formulario y las tarjetas (Alejo/Codex); evaluación de calidad con casos reales (corpus de ES-44/46) y una muestra controlada con Claude real (la hace QA); conversación guiada para completar campos faltantes; re-proponer a partir de correcciones de la persona; la pista de revisión humana (ES-35).

## 8. Decisiones abiertas para aprobar

1. **Propuesta A exige `professional_bridge` ya vigente** al proponer (propuesto: sí, para no gastar presupuesto en algo no confirmable). ¿De acuerdo?
2. **Tope de nivel por autonomía declarada** y advertencia cuando no hay (propuesto). ¿De acuerdo?
3. **`proposalToken` en la API de ES-27** para marcar `authoring: ai_proposed` (cambio pequeño en código de #28, que se hará en este PR apilado). ¿De acuerdo?
4. **Propuestas sin estado** (token firmado, nada guardado) en lugar de una tabla de propuestas. ¿De acuerdo?
5. **Registro:** la parte de IA es backend y mía; sugiero registrarla como subtarea de ES-28 para no mezclarla con las 5 h del formulario (Alejo/Codex).

**Estimación:** ≈ 8–10 h en total (A ≈ 4 h, B ≈ 3 h, pruebas en Postgres real y mutaciones ≈ 2 h). No hay horas asignadas en el ticket para esta parte (ES-28 tiene 5 h para el formulario).
