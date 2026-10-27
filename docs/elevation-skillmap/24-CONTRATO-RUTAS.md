# ES-32 · Contrato de rutas fundamentadas y restricciones (PROPUESTA para aprobación)

27-oct-2026 · Dev-Claude · Cubre SP2-HU14 (RF-07, RF-08, RF-17). **Es una propuesta: no hay código hasta que Mauricio (técnico) y Alejo (alcance) la aprueben.** Backend y contrato de API; la pantalla «Mis rutas» la construye Alejo con este contrato (puerta de diseño aplica a esa parte, no a esta). **Depende de cuatro PR aún sin fusionar:** #27 (ES-25, puente), #28 (ES-27, evidencia), #30 (ES-29, Skill Map) y #33 (ES-31, catálogo de rutas). La implementación debe empezar cuando estén en `main` (§9).

## 1. Idea en una frase

Las rutas **salen del catálogo curado por el cliente**, no de la imaginación del modelo. Primero se aplican **filtros duros** con las restricciones que la persona declaró de forma estructurada; después se clasifican los candidatos en **continuidad, adyacencia y exploración** con reglas explicables; y cada ruta muestra **tres dimensiones separadas** (preferencias, transferencia demostrada y viabilidad), cada una en palabras, **sin un porcentaje global de empleabilidad**. Si el catálogo no sustenta tres rutas se muestran una o dos; si no sustenta ninguna, se dice y se ofrece revisión humana. **No se inventan vacantes.**

## 2. Entradas (de dónde sale cada dato)

| Dato | Fuente | Regla |
| --- | --- | --- |
| Restricciones y preferencias **estructuradas** | La persona, directamente (§3) | Los filtros duros solo usan estos datos: un texto libre no se puede filtrar de forma fiable |
| Contexto profesional aprobado (motivaciones, valores, intereses…) | `getApprovedContext` (ES-25) | Solo informativo en esta versión; no filtra ni puntúa |
| Capacidades demostradas | Skill Map vigente (ES-29): niveles **no `null` y no `stale`**, con sus evidencias | Un nivel sin sustento no cuenta |
| Rutas, fuentes, ofertas y recursos | Catálogo publicado (ES-31), con la frescura ya calculada | Sin catálogo: 503 `catalog_unavailable` |

**Nunca entran** ánimo, diario, transcripciones ni etiquetas de crisis. Si el puente está revocado o no hay contexto, el motor sigue funcionando con las restricciones y el Skill Map (la preferencia queda «por confirmar»).

## 3. Restricciones y preferencias estructuradas (nuevo almacén)

`RouteConstraintsVersions` (inmutables, `payload` **cifrado v2**, `requestId` único por persona, una vigente):
- **Duras (no negociables):** `targetMarkets` (códigos de país, 1–3; *obligatorio*: sin él no se puede filtrar), `languages` (idiomas en los que puede trabajar), `modalities` (presencial / híbrido / remoto aceptables) y `acceptRegulated` (`yes` \| `no` \| `unknown`).
- **Blandas (preferencias):** `originContextKey` (el contexto del piloto del que parte, para la continuidad), `interestContextKeys` (contextos que le interesan) y `preferredModalities`.
- API: `PUT /api/routes/constraints` (crea una versión; `baseVersion` obligatorio y `requestId` idempotente) y `GET /api/routes/constraints`. Solo la propia persona; los textos libres no existen en este almacén.
- **Entrada directa de la persona:** no depende del puente ni del chat, igual que el camino directo de ES-25.

## 4. El motor de rutas (determinista, explicable y sin IA en esta versión)

`GET /api/routes` calcula **en el momento** (no guarda propuestas):

1. **Filtros duros**, en este orden, con motivo contado:
   - mercado fuera de `targetMarkets` → descartada (`market`);
   - idiomas exigidos no cubiertos por `languages` → descartada (`language`); si la ficha dice `unknown` → se queda con «por confirmar»;
   - ninguna modalidad aceptable → descartada (`modality`); si la ficha dice `unknown` → «por confirmar»;
   - profesión regulada y `acceptRegulated = no` → descartada (`regulated`); si es `unknown` → se queda con la advertencia y la pregunta.
   Se devuelve cuántas se descartaron por cada motivo (sin listar roles descartados por mercado de otro país).
2. **Clasificación** de las que quedan (como máximo **una por casilla**):
   - **Continuidad:** el rol pertenece al `originContextKey` de la persona.
   - **Adyacencia:** fuera de ese contexto pero comparte **al menos una capacidad esencial demostrada**.
   - **Exploración:** pasa los filtros y coincide con sus intereses (`interestContextKeys` o modalidad preferida), **aunque aún no haya transferencia demostrada**; se etiqueta «evidencia insuficiente todavía».
   Dentro de una casilla gana el rol con más capacidades esenciales demostradas y, a igualdad, el de fuentes más recientes. **Sin ese fundamento la casilla queda vacía**: no se rellena con opciones inventadas.
3. **Una similitud por sí sola nunca recomienda un rol:** para entrar en continuidad o adyacencia hace falta pertenencia o transferencia demostrada.

## 5. La ficha de cada ruta

`{ slot, roleKey, labels, industry, market, tasks (con su exposición a la IA, sin porcentajes), barriers, languagesRequired, modality, regulated, sources (con fechas y stale), offers (con estado current / expired y salario «no publicado» si aplica), resources (de las brechas), dimensions, uncertainties, verificationTask }`

**Dimensiones separadas, cada una cualitativa y con sus factores a la vista:**
- `preferenceFit` — `matches` \| `partial` \| `outside_interests` \| `unknown`: pertenece a sus contextos de interés / coincide con la modalidad preferida.
- `demonstratedTransfer` — `strong` \| `partial` \| `none_yet` \| `unknown`: qué capacidades esenciales del rol están demostradas (clave, nivel y número de evidencias) y cuáles **«aún sin evidencia»**. Las brechas se nombran con ese texto, **sin barras, sin déficit y sin nivel inventado**.
- `viability` — `clear` \| `conditional` \| `unclear`: barreras de entrada, habilitación pendiente, idiomas por confirmar y frescura de las fuentes.

**Reglas de honestidad:** profesión regulada → `regulated.status: pending` con la nota del cliente; **nunca** se afirma elegibilidad, ni se infiere un permiso de trabajo por residencia o idioma. Oferta `expired` o fuente `stale` → no se presenta como confirmación actual y la ficha trae `verificationTask: true`. Sin ofertas verificadas, la ficha es ocupacional. No hay ningún conteo de vacantes ni inferencia de demanda. `uncertainties` lista lo «por confirmar» (ficha o restricción faltante).

Respuesta global: `{ status, catalogVersion, routes: [...], discarded: {market, language, modality, regulated}, clarifications: [...], humanReview: {offered: bool} }`, con `status`: `ok` \| `partial` (menos de tres rutas) \| `needs_constraints` (falta el mercado) \| `no_pertinent_catalog`.

## 6. Decisiones de la persona y revisión humana

- **Decisiones (único dato que se guarda):** `RouteChoices` (`UserId`, `roleKey`, `slot`, `decision`: `accepted` \| `rejected`, `catalogVersion`, huella de las entradas, `requestId`, versiones). `POST /api/routes/choices`. La persona **puede rechazar cualquiera** y volver a decidir (la anterior queda `superseded`). ES-33 vincula el experimento a una elección aceptada. Si después cambian el catálogo, sus restricciones o su Skill Map, la elección se marca `basisChanged` (hay que revisarla); **no se reescribe sola**.
- **Revisión humana:** cuando el catálogo no sustenta ninguna ruta, o la persona la pide, `POST /api/routes/review-requests` crea una solicitud abierta (`RouteReviewRequests`: dueño, estado, nota opcional ≤300). La consola de facilitación que la atiende es ES-35.

## 7. Seguridad, privacidad y límites

- Todo parte de la sesión (`req.user.id`); ningún id de persona en el cuerpo. Administradores, terapeutas y facilitadores no leen estas rutas.
- Los textos del catálogo se muestran tal cual (ya saneados); el motor no escribe texto libre propio.
- **Sin IA en esta versión.** La preferencia por afinidad semántica con el contexto aprobado queda para una historia siguiente y, cuando exista, **solo podrá modificar `preferenceFit` y la redacción**, nunca el filtro duro ni la elegibilidad de un rol (RF-07).
- Sin porcentaje global, sin ranking entre personas y sin inferir nada del idioma o de la residencia.

## 8. Pruebas previstas

Cada filtro duro y su caso «por confirmar» · mercado faltante → `needs_constraints` · clasificación en las tres casillas y casillas vacías sin relleno · una docente o contadora sintéticas **no reciben programación por defecto** (con el catálogo sintético de ES-31) · transferencia solo con niveles no `null` y no `stale` · brechas sin déficit ni número · profesión regulada siempre `pending` y nunca elegible · oferta vencida / fuente `stale` no se presentan como actuales · catálogo ausente (503) o sin rutas pertinentes (revisión humana) · decisiones: rechazar, cambiar, idempotencia y `basisChanged` tras cambios (también en **Postgres real**) · aislamiento (IDs ajenos, roles) · canarios de ánimo/diario/chat/crisis fuera de las entradas · código sin red ni modelos privados · mutaciones de los controles críticos · errores ES/EN.

## 9. Lo que no cubre y dependencias

La pantalla (Alejo/Codex); preferencias por similitud semántica y la redacción con IA; experimentos y plan 7/30/90 (ES-33); la consola de revisión (ES-35); contenido real del catálogo (lo carga el cliente; sin él, `no_pertinent_catalog`). Coupling con el catálogo de habilidades: aquí se acopla `skillKey` (ES-31 decidió dejarlo para esta historia): una capacidad del rol cuya clave ya no exista se marca `skillMissing` y no cuenta.

**Antes de codificar** deben estar fusionados #27, #28, #30 y #33; si no, la rama tendría que apilar cuatro PR y el diff sería ilegible. *(Decisión abierta 8.)*

## 10. Decisiones abiertas para aprobar

1. **Restricciones estructuradas nuevas** (§3) como única base de los filtros duros, ingresadas por la persona. ¿De acuerdo?
2. **Motor determinista sin IA** en esta versión; la afinidad semántica va después. ¿De acuerdo?
3. **Reglas de las casillas** (§4: continuidad = contexto de origen; adyacencia = capacidad esencial demostrada compartida; exploración = intereses con transferencia aún insuficiente), una ruta por casilla como máximo. ¿De acuerdo?
4. **Dimensiones cualitativas** (sin números) y brechas como «aún sin evidencia». ¿De acuerdo?
5. **Solo se guardan las decisiones** de la persona (no las propuestas), con huella para detectar cambios. ¿De acuerdo?
6. **Revisión humana:** tabla de solicitudes aquí, consola en ES-35. ¿De acuerdo?
7. **Regulada = siempre «habilitación pendiente»**, sin afirmar elegibilidad. ¿De acuerdo?
8. **Orden de trabajo:** empezar cuando #27, #28, #30 y #33 estén en `main`. ¿Quién los fusiona y cuándo?

**Estimación:** 10–12 h (el ticket tiene 8 h, rango 6–10): restricciones 2 h, motor y fichas 4 h, decisiones y revisión 2 h, Postgres real y mutaciones 2–3 h. Sin contenido real en el catálogo no se puede validar la pertinencia con las seis personas.
