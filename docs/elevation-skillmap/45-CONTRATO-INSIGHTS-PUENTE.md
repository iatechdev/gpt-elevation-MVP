# ES-111 (parte backend) · Contrato de los insights de «El Puente» (PROPUESTA para aprobación)

29-oct-2026 · Dev-Worker-Claude · Responde a lo que ES-111 dejó abierto: **quién genera los insights, con qué consentimiento y qué cruza al perfil profesional**. **Es una propuesta: no hay código hasta que Mauricio (técnico) y Alejo (alcance) la aprueben.** Es una historia nueva (hoy sin ticket en Jira). Solo backend y contrato de API; activar la pantalla ya construida en #95 es un paso posterior y pasa por la puerta de diseño solo si cambia el layout.

## 1. Idea en una frase

La IA **propone borradores de insights** a partir de **tres fuentes de la propia persona** (conversación del chat, diario y hoja de vida), **solo si la persona autorizó analizar esa fuente**; **nada se guarda ni cruza** hasta que la persona ve cada insight y lo autoriza uno a uno, con el flujo de vista previa y confirmación que ya existe (ES-25). Un insight es una **hipótesis**: no es nivel, no es competencia demostrada, no es diagnóstico.

## 2. Decisiones ya tomadas (no se reabren aquí)

- **Mauricio, 29-oct:** los insights salen de la conversación del chat, del diario y de la hoja de vida. ES-84 (worker) **no** los genera: solo lee el contexto profesional ya autorizado.
- **ES-111 (D4–D6 y ajuste a D5, aprobados):** la pantalla `/app/bridge` reutiliza el puente de ES-25; autorizar un insight = confirmar una nueva versión del contexto con ese texto añadido; revocar uno = versión sin él; revocar todos = `/revoke`. Topes heredados: 12 textos en total y 3 por categoría.
- **Reglas de ES-25, ES-28, ES-21 y ES-22:** no cambian. Este contrato las reutiliza.

## 3. Qué es un insight

| Campo | Contenido |
| --- | --- |
| `key` | Una de las categorías cerradas del puente: `motivations`, `values`, `interests`, `energy_gives`, `energy_drains`, `desired_conditions`, `constraints` |
| `text` | Hasta 500 caracteres, redactado como hipótesis en el idioma de la persona. Es lo **único** que puede cruzar, y solo tras autorizarlo |
| `origins` | Referencias privadas a la fuente: `{type: 'chat_turn' \| 'diary_entry' \| 'resume_version', id, quote}`. **Nunca viajan** al motor profesional |
| `skillKey` (opcional) | Habilidad del catálogo a la que apoya. **Metadato privado**: no viaja al motor. Permite el estado «En conversación» del mapa (ver §9) |

El texto del insight no copia la cita ni la entrada: la `quote` es una frase literal corta (hasta 200 caracteres, **la elige y comprueba el servidor**) que la pantalla muestra **difuminada** hasta que la persona pulsa el ojo.

## 4. Consentimientos (ES-19): uno por fuente

La lista de ES-19 es cerrada; se añaden **tres propósitos nuevos**, explícitos, separados entre sí y de `professional_bridge`, no obligatorios y revocables:

| Clave | Qué autoriza |
| --- | --- |
| `insights_chat` | Que la IA lea **mis mensajes** del chat (no las respuestas del asistente) para proponerme insights |
| `insights_diary` | Que la IA lea **mis entradas del diario** para proponerme insights |
| `insights_resume` | Que la IA lea **el texto de mi hoja de vida** para proponerme insights |

- Sin migración de esquema (`Consent.purpose` es texto validado en código; se añaden a `PURPOSES` y `REQUIRED_VERSION`).
- **Analizar ≠ compartir.** Estos consentimientos solo permiten que la IA proponga. Para que un insight **cruce al perfil profesional** hace falta además `professional_bridge` vigente al confirmar (camino A de ES-25) y la autorización de la persona insight por insight.
- Se comprueban **dentro de la transacción de `withConsent`** (ES-19 §4): una revocación concurrente se respeta; al revocar una fuente, el siguiente análisis ya la rechaza. Sin consentimiento de ninguna fuente pedida: 403 `consent_required` **y no se llama a la IA** (no se gasta presupuesto).

## 5. Disparo

**Propuesta: a petición de la persona** (botón «Analizar mi diario / mi chat / mi hoja de vida» en «El Puente», una fuente a la vez o varias), **no automático**. Motivo: el diario y el chat son privados; un análisis que corre solo, sin que ella lo pida, es lo más sensible del producto. *(Decisión abierta 1: Mauricio decidió «automático» para el worker de ES-84, que lee solo contexto ya autorizado; este caso es distinto porque lee conversación y diario.)* El automático, si se aprueba, solo podría correr sobre fuentes con consentimiento vigente y una vez por cambio de fuente, nunca en bucle.

## 6. API (propuestas sin estado, como ES-28)

`POST /api/insights/proposals` `{ sources: ['chat'|'diary'|'resume'] (1–3), turnIds?: [int], entryIds?: [int], resumeId?: int, locale }` → `200 { insights: [...], warnings, discarded, token, expiresAt }`

- **Titular siempre el del token.** Un id ajeno es 404 (`origin_not_found`), indistinguible de uno inexistente.
- **Qué se lee de cada fuente** (límites **propuestos**, a confirmar; ninguno está medido):
  - `chat`: solo los mensajes **de la persona** de los turnos indicados, o los últimos 20 si no indica; nunca las respuestas del asistente.
  - `diary`: las entradas indicadas, o las 10 más recientes; se descifran **solo en memoria**.
  - `resume`: el texto extraído de su última versión (ES-109) **en memoria**; pasa por el saneado de ES-109 (sin datos personales de contacto) y **no se guarda ni se registra**.
- **Frontera:** los turnos o entradas que el detector de riesgo (ES-21) marca **no se usan** y no se dice por qué ni se guarda. Un indicador de crisis nunca llega al insight ni al motor profesional. Si no queda nada usable: 422 `no_usable_source` sin llamar a la IA.
- **Todo pasa por `callClaude` (ES-22):** presupuesto por persona y cohorte, tiempo de espera, reintentos acotados, registro de uso **sin contenido** (`kind: insight_proposal`). Agotado → 429; sin configurar → 503; fallo del proveedor → 502 reintentable.
- **Lo escrito por la persona es dato no confiable:** va dentro de `fenceUntrusted` con delimitador aleatorio; las instrucciones fijas van aparte y se enmascaran secretos. *Reduce el riesgo de inyección, no lo elimina; no se evaluó con ataques reales.*
- **Respuesta sin estado:** nada se guarda. El `token` firmado (10 min, ligado a la persona y al contenido) se devuelve al autorizar; no hay datos derivados del chat o del diario en reposo.

**Autorizar un insight** no tiene ruta nueva: la pantalla usa `POST /api/career-context/preview` y `/confirm` de ES-25 con `{key, text, origin}`, con dos cambios pequeños:

1. `origin.type` admite `'resume_version'` (el `id` es la versión de la hoja de vida; el nombre sigue al de la tabla de ES-109) además de `diary_entry`, `chat_turn` y `direct`, y el servidor comprueba que la fuente es de la persona sin copiar su contenido.
2. **`GET /api/career-context` devuelve el origen de cada texto** (tipo, id y marca de tiempo, **sin contenido**), como pidió Dev en ES-111. Sin esto, al recomponer una versión se perdería la dependencia del consentimiento. Es un dato privado de la persona; nunca va al motor profesional.

## 7. Salida del modelo: validada y filtrada

- JSON validado por esquema; lo inválido se descarta; si todo se descarta, 502 `invalid_model_output` y no se guarda nada.
- `key` de la lista cerrada, `text` ≤ 500, `skillKey` (si viene) del catálogo vigente; máximo 12 insights por corrida y 3 por categoría. **La IA no declara confianza, nivel ni autonomía.**
- **Citas comprobadas:** cada `quote` debe aparecer, normalizada, en el mensaje, entrada o texto de hoja de vida que cita; la que no aparezca descarta el insight.
- **Sin lenguaje clínico, de empleabilidad ni números inventados:** se reutiliza el filtro de la salida de ES-28 (términos de diagnóstico, tratamiento, medicación, empleabilidad…, y ningún porcentaje o número que la persona no haya escrito). Es un filtro por palabras, limitado.
- **Redacción como hipótesis** («parece que…», «podría ser que…»), nunca «eres…». Sin halagos, sin comparaciones con otras personas, sin porcentajes de reemplazo por IA.

## 8. Qué cruza y qué no (frontera)

- **Cruza** únicamente `{key, text}` de los insights que la persona autorizó, bajo `professional_bridge` vigente (ES-25 §6).
- **Nunca cruza:** `origins`, `quote`, `skillKey`, el texto del diario, del chat o de la hoja de vida, indicadores de crisis, nombre, correo.
- **Revocar** un insight autorizado o todos funciona como en ES-25 (versión sin él, o `/revoke`); lo derivado queda «para revisión» (`DerivedInvalidations`). **Revocar un consentimiento `insights_*`** detiene los análisis nuevos pero **no borra** los textos que la persona ya autorizó (son su copia aprobada); para retirarlos usa «revocar» del puente. *(Decisión abierta 4.)*

## 9. Efecto en el mapa de competencias (ES-30)

«En conversación» = habilidad con **al menos un insight autorizado vigente** que la apoya (`skillKey` en los `origins` privados de una versión activa) y **sin nivel**. Se calcula en el servidor para el titular y **no es nivel ni evidencia**: no cambia el radar ni crea evaluaciones (regla ES-29: nivel `null` sin evidencia). Si la versión se revoca, el estado desaparece.

## 10. Pruebas previstas (proveedor simulado; no se llama a Claude real)

IDs ajenos y roles · cada fuente sin su consentimiento (403 y **no se llama a la IA**) · consentimiento revocado durante la operación (transacción) · **canarios** (respuestas del asistente, turnos con crisis, entradas con crisis, diario cuando solo se pidió chat) fuera del prompt y de la salida · instrucción incrustada en un mensaje, entrada o hoja de vida (queda dentro del delimitador; una salida que la obedece se descarta) · JSON roto, claves extra, categoría inválida, `skillKey` inventada, cita inventada, número o porcentaje inventado, términos clínicos · topes 12 y 3 · token alterado, vencido o de otra persona · presupuesto agotado/sin configurar/proveedor caído (429/503/502) sin llamar al proveedor en los rechazos previos · autorizar con `origin: resume` y comprobar que el origen vuelve en `GET /api/career-context` y **no** en lo que lee el motor · «En conversación» solo con insight autorizado vigente · **Postgres real** y E2E con servidor de IA simulado.

## 11. Lo que no cubre

Calidad de los insights con Claude real (la muestra controlada la hace QA con casos sintéticos, como en ES-28) · pantalla de consentimientos por fuente (puerta de diseño) · generación automática (si se aprueba, historia aparte) · análisis de documentos que no sean la hoja de vida · reproceso al cambiar una fuente · lector de pantalla y otros navegadores.

## 12. Decisiones abiertas para aprobar

1. **Disparo:** ¿a petición (propuesto) o automático?
2. **Consentimientos:** ¿tres propósitos separados por fuente (propuesto) o uno solo «insights»?
3. **Límites de lectura por corrida** (20 turnos, 10 entradas, última hoja de vida): ¿de acuerdo como arranque, a ajustar tras medir?
4. **Revocar una fuente** no borra lo ya autorizado: ¿de acuerdo?
5. **Cambios pequeños en ES-25:** origen `resume` y `GET /api/career-context` con origen de cada texto, más `skillKey` como metadato privado: ¿de acuerdo?
6. **Registro:** ticket nuevo en Jira bajo ES-111 o épica de El Puente. Lo crea Mauricio o Alejo (alcance).

**Estimación (no comprometida, por contraste con ES-28 ≈ 8–10 h):** generador y consentimientos ≈ 8–10 h; cambios en ES-25 y «En conversación» ≈ 4–6 h; pruebas en Postgres real y mutaciones incluidas. Activar la pantalla de #95 con datos reales: ≈ 2–3 h aparte.

## 13. Costo de IA

Cada análisis consume cupo de tokens de la persona (V-12; propuesta de arranque aprobada en ES-84: 600.000 por persona y 4.000.000 por cohorte al mes, sin medir). No hay cifra de costo en dólares verificada.

## 14. Estado de la implementación (ES-121, aprobada el 29-oct-2026 con las decisiones 1 a 5)

**Código:** `backend/utils/insightProposal.js`, `backend/routes/insights.js` (`POST /api/insights/proposals`), propósitos `insights_chat` e `insights_diary` en `utils/consent.js`, y cambios en `utils/careerContext.js` (habilidad como metadato privado, origen visible para el titular) y `utils/skillMap.js` (`inConversation`).

**Diferencias respecto al texto del contrato (todas hacia el lado más estricto o de menor alcance)**
- **La hoja de vida** se añadió en un PR apilado sobre ES-121 (sección «Fuente hoja de vida» más abajo).
- La habilidad (`skillKey`) de un insight se **valida contra el catálogo publicado** también al autorizar (vista previa y confirmación), y el token de la vista previa la liga: cambiarla después impide confirmar (409).
- `GET /api/career-context` devuelve, solo al titular, `origin` (`{type, id}` o `{type:'direct'}`) y `skillKey` por texto; **sin contenido ni marca de tiempo**. `getApprovedContext` (motor profesional) no cambia: solo `{key, text}`.
- `GET /api/skill-map` añade `inConversation: boolean` por habilidad: hay un insight autorizado vigente que la apoya y no hay ningún nivel vigente (autoevaluación ni revisión). No crea evaluaciones ni cambia el radar.
- El error 403 de consentimiento incluye `purpose` (qué fuente falta).
- Un insight cuya cita, categoría o habilidad no es válida se descarta completo; si el modelo propone y se descarta todo: 502 `invalid_model_output`. Lista vacía del modelo: 200 con `insights: []`.
- Los límites de lectura (20 turnos, 10 entradas) se aplican también en el servidor aunque la persona indique ids (máximo 20 y 10).

**Contrato de API**

| Ruta | Éxito | Errores estables |
| --- | --- | --- |
| `POST /api/insights/proposals` `{sources, turnIds?, entryIds?, locale}` | 200 `{insights:[{key,text,skillKey?,origins:[{type,id,quote}]}], usedSources:{chat,diary}, discarded, token, expiresAt}` | 400 `invalid_input` · 403 `consent_required` (+`purpose`) · 404 `origin_not_found` · 422 `no_usable_source` · 502 `invalid_model_output` / proveedor · 429 `ai_budget_exhausted` · 503 `ai_budget_not_configured` |

**Pruebas:** `backend/test/es-121-insights.test.cjs` (proveedor simulado, 10 pruebas), `backend/test/integration/es-121-postgres.cjs` (Postgres real, cifrado y bloqueos reales) y 12 mutaciones de los controles críticos, todas detectadas. **No verificado:** la calidad de los insights con Claude real (la muestra controlada la hace QA con casos sintéticos), el comportamiento ante ataques de inyección reales y la frontera con la hoja de vida (pendiente de ES-109).

### Correcciones tras el informe de QA (29-oct-2026)
- **ES121-QA-01 (Alto, corregido):** las lecturas del chat y del diario usan la **misma transacción** de `withConsent` (una conexión por propuesta). Antes retenían dos y con N propuestas simultáneas ≥ el tamaño del pool se agotaba. Prueba con Postgres real: 20 personas a la vez con un pool de 5, todas terminan (sin el arreglo, 16 de 20 fallaban con `SequelizeConnectionAcquireTimeoutError`).
- **ES121-QA-02 (Medio, corregido):** un insight que **promete** empleo, contratación, ofertas, mejor pago o éxito se descarta (`conseguirás empleo`, `te contratarán`, `mejor salario`, `ofertas de trabajo`, `job offers`, `higher salary`, `te garantizo`…). No se bloquea que la persona diga qué valora o necesita («valoras un sueldo estable»). Es un filtro por palabras: puede dejar pasar una promesa con otra redacción y puede descartar un texto legítimo.
- **Observación (Baja): el `token` de la propuesta no lo consume ningún endpoint.** Es así a propósito en esta entrega: la autorización de un insight usa el token de vista previa de ES-25, que sí se verifica. El `token` queda reservado (firma ligada a la persona y al contenido, 10 minutos) por si una ruta futura necesita comprobar que una propuesta salió de este servidor; hoy no autoriza nada.
- **Observación (Baja): un texto inyectado pasa si cita una frase real.** Si la persona escribe una instrucción en su propio chat o diario y el modelo la obedece citando una frase real, el insight llega **solo a la propia persona**, como hipótesis marcada «tú decides»; no se guarda ni cruza sin su autorización. Es una limitación conocida del filtrado por citas; la mitigación es el delimitador, la cita verificada y los filtros.

### Fuente hoja de vida (PR apilado sobre ES-121, 30-oct-2026)
Decisión de Mauricio (30-oct): **permiso propio** `insights_resume`, separado de `resume_ai_reading` (que sirve para sacar campos del mapa).
- **Permiso:** `insights_resume` (opcional, sin decidir por defecto). Analizar chat o diario, o tener `resume_ai_reading`, **no** lo reemplazan. Retirarlo se respeta desde la siguiente petición (mismo bloqueo compartido de ES-19).
- **Qué se lee:** el PDF **cifrado** de la propia persona: su última versión, o la que indique `resumeId` (id ajeno o inexistente = 404 `origin_not_found`). Dentro de la transacción de `withConsent` solo se lee y descifra el PDF; el texto se extrae y se **depura de contacto** con el mismo saneador de ES-109 **después**, fuera de la transacción (no retiene la conexión mientras se lee el PDF). Nada de ese texto se guarda ni se registra.
- **No sirve como fuente (422 `no_usable_source`, sin llamar a la IA y sin decir por qué):** persona sin hoja de vida, PDF escaneado/corrupto/con contraseña, texto con contacto restante, o texto marcado por el detector de riesgo.
- **Citas:** se comprueban contra el texto ya depurado; una cita al correo o al teléfono (que ya no existen en ese texto) descarta el insight.
- **Origen en el puente (ES-25):** `origin: {type: 'resume_version', id}`; el servidor comprueba que la versión es de la persona y guarda solo `id` y su fecha de creación. Si la hoja de vida se borra (o se retira `resume_ai_reading`, que borra todas las versiones), el contexto autorizado **se conserva** y queda **«para revisión»** (`needsReview: true`). El motor profesional sigue leyendo solo `{key, text}`.
- **Límite de lectura:** una hoja de vida por corrida, hasta 8 000 caracteres de texto depurado hacia el modelo (arranque, a ajustar tras medir).

**Pruebas:** `backend/test/es-121-resume.test.cjs` (4 pruebas, PDFs sintéticos reales; proveedor simulado), 3 pruebas nuevas en `backend/test/integration/es-121-postgres.cjs` (PDF cifrado de verdad, última versión por defecto, id ajeno, borrado por revocación de `resume_ai_reading`, 20 personas simultáneas con pool de 5) y 9 mutaciones de la fuente, todas detectadas. **No verificado:** calidad de los insights con Claude real sobre hojas de vida reales (la muestra controlada la hace QA con casos sintéticos); hojas de vida con diseños complejos (columnas, imágenes) cuyo texto el extractor lea desordenado; pantalla de consentimiento para esta fuente (puerta de diseño).
