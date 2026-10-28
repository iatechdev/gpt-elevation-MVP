# ES-16 — Tono y ejercicios opcionales ES/EN

[Dev-Codex]

27-oct-2026 · **Propuesta de diseño, contenido y plan técnico para aprobación. Sin código de implementación.**

Rama propia: `ES-16-tono-ejercicios`, desde `main` 4311d69. Fuentes: Jira ES-16; PRD RF-14/15/16; contrato ES-20 (`15-CONTRATO-CONVERSACIONES-DIARIO.md`); código de `backend/routes/chat.js`, `utils/promptSafety.js`, `utils/safety.js`, `frontend/src/pages/ChatPage.tsx` y `UserDashboard.tsx`; design system y guía UX interiores.

## 1. Hallazgos y alcance

El servidor ya impone límites no clínicos, fortalezas sustentadas y una pregunta principal. Falta concretar no acabar siempre preguntando, identidad explícita de IA, omisión/pausa sin presión y un tratamiento determinista de la petición de silencio. El fallback de proveedor/500 sigue solo en ES. Los dos chats actuales consumen el mismo POST del servidor.

Se propone un catálogo pequeño de **tres ejercicios editoriales de reflexión, valores y contribución**, de una pregunta cada uno, más reglas de tono y pausa en el servidor. Los ejercicios no necesitan LLM ni nuevos datos persistidos. La reflexión escrita es opcional y local; la persistencia de diario corresponde a ES-15/ES-20. No se presentan notas locales como entradas guardadas.

**Revisión humana pendiente:** ES-17 (tono y ejercicios) y ES-24 (escenarios sensibles) están Por hacer; los comentarios del código también califican esos controles como borrador. ES-21 Listo acredita el tramo técnico, no la revisión especializada. El mecanismo se puede implementar y probar; el catálogo propuesto no se declara revisado ni listo para piloto. Su publicación estará desactivada por defecto hasta registrar revisión editorial ES/EN y la validación correspondiente en esos tickets.

## 2. Pantallas y flujo

1. Un enlace «Ejercicios opcionales / Optional exercises» en el cuerpo del dashboard y junto a las herramientas del chat existente, sin reubicar conversación, check-in o checkout. Identificación visible «Asistente de IA / AI assistant».
2. `/app/exercises`: selector ES/EN, regreso a la pantalla de origen (solo chat/dashboard), introducción, tres tarjetas con título, propósito y tiempo orientativo. «Elegir / Choose» y «Omitir / Skip»; omitir vuelve al origen sin POST, penalización, evento ni tarea.
3. Elegir tarjeta muestra **una sola pregunta principal**, instrucciones breves, notas opcionales en textarea y el aviso «Estas notas no se guardan ni se comparten». No se genera una respuesta automática a lo que la persona escriba, ni se envía al chat o al puente.
4. «Copiar mis notas / Copy my notes» copia solo tras un clic explícito, con aviso de portapapeles local y estados copiando/copied/fallido. Si falla, las notas permanecen y se puede seleccionar/copiar manualmente.
5. «Cerrar ejercicio / Close exercise» vuelve al selector si está vacío. Si hay notas, un diálogo ofrece volver al ejercicio, copiarlas y permanecer en la pantalla, o cerrar sin guardar. El cierre no se llama logro, evaluación ni evidencia profesional.
6. Cambio de idioma conserva las notas originales, sin traducirlas. Recarga, Atrás o salida con notas pendientes pide confirmar pérdida; cambio/fin de sesión elimina las notas de memoria y oculta el contenido privado.
7. La bandera pública de compilación `VITE_ENABLE_COMPANION_EXERCISES` exige exactamente `true` y por defecto está desactivada. Sin esa bandera habilitada: sin enlaces visibles y ruta con estado «Los ejercicios aún no están disponibles / Exercises are not available yet». El frontend no ofrece un interruptor para habilitar contenido sin revisar. Las pruebas usan la bandera solo en compilación local/staging.

No se añaden recordatorios, contadores regresivos, rachas, puntuaciones, deberes automáticos ni mensajes por haber abandonado. El silencio de una persona que simplemente no escribe no provoca llamadas ni mensajes. No se crea una conversación simulada entre la tarjeta y el modelo.

## 3. Wireframes

```text
CATÁLOGO · /app/exercises
┌─────────────────────────────────────────────────────┐
│ Volver                                       ES EN │
│ Ejercicios opcionales                               │
│ Puedes elegir uno, omitirlo o cerrar cuando quieras. │
│ ┌ Reflexionar ┐ ┌ Lo que valoro ┐ ┌ Mi contribución ┐│
│ │ Propósito  │ │ Propósito     │ │ Propósito        ││
│ │ 3–5 min*   │ │ 3–5 min*      │ │ 3–5 min*         ││
│ │ Elegir     │ │ Elegir        │ │ Elegir           ││
│ └────────────┘ └───────────────┘ └──────────────────┘│
│ *Tiempo orientativo; a tu ritmo.             Omitir │
└─────────────────────────────────────────────────────┘

EJERCICIO ELEGIDO
┌─────────────────────────────────────────────────────┐
│ Volver                                       ES EN │
│ [Título]                                            │
│ [Propósito + tiempo orientativo]                     │
│ [Una pregunta principal ES o EN]                     │
│ [Instrucción opcional breve]                         │
│ Notas opcionales                                    │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Texto propio, solo en memoria                    │ │
│ └─────────────────────────────────────────────────┘ │
│ Estas notas no se guardan ni se comparten.           │
│ [Copiar mis notas]                   [Cerrar ejercicio]│
│ [Estado: copiado / no se pudo copiar]                │
└─────────────────────────────────────────────────────┘

SALIR CON NOTAS
┌─────────────────────────────────────────────────────┐
│ Las notas se perderán al cerrar.                    │
│ [Volver al ejercicio] [Copiar notas] [Cerrar sin guardar]│
└─────────────────────────────────────────────────────┘
```

Móvil: tarjetas apiladas, textarea al ancho, acciones que se envuelven y controles de 44px. Escritorio: hasta tres tarjetas, ejercicio en columna centrada; sin paneles secundarios con más preguntas.

## 4. Catálogo propuesto para revisión editorial

Versión editorial inicial `1`, tres claves estables; textos **propuestos**, sin revisor/fecha ficticios. Tiempo orientativo 3–5 minutos en los tres; es una estimación editorial, no duración de una intervención validada ni promesa de efecto.

| Campo | ES | EN |
| --- | --- | --- |
| `reflection.title` | Una situación que quiero comprender | A situation I want to understand |
| `reflection.purpose` | Elegir qué parte de una situación quieres explorar, sin tener que explicarlo todo. | Choose which part of a situation to explore, without having to explain everything. |
| `reflection.question` | ¿Qué parte de una situación reciente te gustaría comprender mejor? | Which part of a recent situation would you like to understand better? |
| `reflection.help` | Puedes elegir una situación cotidiana y compartir solo lo que desees. | You can choose an everyday situation and share only what you want. |
| `values.title` | Lo que quiero cuidar en mi próxima etapa | What I want to preserve in my next stage |
| `values.purpose` | Identificar algo que valoras, sin ordenarlo ni convertirlo en una puntuación. | Identify something you value, without ranking or scoring it. |
| `values.question` | ¿Qué valor es importante para ti en tu próxima etapa? | What value matters to you in your next stage? |
| `values.help` | Puedes elegir una palabra o una idea; no necesitas justificarla. | You can choose a word or an idea; you do not need to justify it. |
| `contribution.title` | Reconocer mi contribución | Recognizing my contribution |
| `contribution.purpose` | Distinguir tu acción del resultado conocido o desconocido. | Distinguish your action from a known or unknown outcome. |
| `contribution.question` | ¿Qué hiciste tú en una situación de la que te gustaría conservar un aprendizaje? | Think of a situation you want to learn from: what did you do? |
| `contribution.help` | Puedes describir una acción, aunque no conozcas el resultado. | You can describe an action even if you do not know the outcome. |

Ningún texto atribuye fortalezas, éxitos o resultados antes de que la persona los describa. Estos ejercicios no puntúan competencias, diagnostican ni prometen bienestar o empleo. No se incorporan técnicas ACT, clínicas o protocolos sensibles sin revisión del especialista.

## 5. Textos de interfaz y chat ES/EN

| ES | EN |
| --- | --- |
| Ejercicios opcionales | Optional exercises |
| Puedes elegir uno, omitirlo o cerrar cuando quieras. | You can choose one, skip it or close whenever you want. |
| Elegir / Omitir / Volver | Choose / Skip / Back |
| Tiempo orientativo: 3–5 minutos, a tu ritmo. | Suggested time: 3–5 minutes, at your own pace. |
| Notas opcionales | Optional notes |
| Estas notas no se guardan ni se comparten. | These notes are not saved or shared. |
| Copiar mis notas | Copy my notes |
| Se copiarán al portapapeles de este dispositivo. | They will be copied to this device’s clipboard. |
| Copiando… / Copiado al portapapeles | Copying… / Copied to clipboard |
| No pudimos copiar. Puedes seleccionar tus notas y copiarlas manualmente. | We could not copy. You can select your notes and copy them manually. |
| Cerrar ejercicio / Volver al ejercicio | Close exercise / Back to exercise |
| Las notas se perderán al cerrar. | Closing will discard your notes. |
| Cerrar sin guardar | Close without saving |
| Lo dejamos aquí. Puedes volver cuando quieras. | We can stop here. You can return whenever you want. |
| Los ejercicios aún no están disponibles. | Exercises are not available yet. |
| Asistente de IA | AI assistant |
| Soy Elevation, un asistente de IA para explorar lo que quieras compartir. Puedes omitir cualquier tema o hacer una pausa. ¿Qué te gustaría explorar hoy? | I’m Elevation, an AI assistant for exploring what you choose to share. You can skip any topic or pause. What would you like to explore today? |
| Preparando respuesta… | Preparing a response… |
| Está bien. Lo dejamos aquí. | That’s okay. We can stop here. |
| No pudimos completar la respuesta. Puedes volver a intentarlo. | We could not complete the response. You can try again. |

Las últimas dos filas son la pausa fija sin LLM y el fallback del servidor (con códigos existentes de error). El texto de bienvenida nuevo reemplaza solo la bienvenida local; no reescribe mensajes guardados. Nunca se presenta una persona leyendo en vivo ni una disponibilidad humana inexistente.

## 6. Estados, componentes y accesibilidad

Reutilizar LanguageProvider y catálogo i18n, React Router, ProtectedRoute y token existente. daisyUI 5 con prefijo `elv-`: card, button, textarea, link; diálogo semántico con foco inicial en volver/cancelar, Escape y restauración del foco.

Tokens interiores: fondo #F9F9F7; superficie #FAF8F4/blanca; texto #1C1917; bordes #D6D2C4; acento decorativo oliva #6B7D5C y acción/foco #4A6741 con contraste AA; advertencia #92400E y error #B91C1C. Playfair Display **400** en títulos; Inter 16px cuerpo y 14px apoyo; espaciado 4/8/12/16/24/32; radios .65/1rem. Variables semánticas locales, sin modificar el tema global o rediseñar las otras zonas.

Estados: selector sin ejercicio; ejercicio con notas vacías o locales sin guardar; copiando; copiado comprobado; error de copia; confirmación de cierre; cerrado; contenido no publicado; sesión terminada. No existe estado «guardado en servidor» porque esta interfaz no persiste notas, ni carga remota del catálogo que justifique una pantalla de carga falsa. Las llamadas del chat conservan sus códigos/estados existentes.

Pruebas a 320/375/768/1440, zoom 200%, teclado completo, labels explícitos, foco visible, salto al contenido, avisos aria-live sin robar foco al entrar, estado comunicado por texto y prefers-reduced-motion. Sin cuenta regresiva, notificaciones por tiempo ni envío al dejar de escribir.

## 7. Plan técnico de backend y datos

### API y modelo

Reutilizar `POST /api/chat {message,lang?,country?,requestId?,contextEntryIds?}`, `GET /api/messages` y `GET /api/chat/turns/:requestId`. **Sin endpoints, parámetros, tablas ni migraciones nuevos.** Catálogo editorial estático versionado en `shared/`, importado por frontend; no obtiene respuestas de personas ni usa una llamada a Claude para generar ejercicios.

Notas de ejercicios: solo RAM del navegador, sin localStorage, sessionStorage, URL, logs, API, portapapeles automático ni analítica. Copiar es una acción explícita de la persona; se comunica su destino local. No se almacena una lista de quién hizo/abandonó ejercicios y no se generan eventos exercise_completed en ES-16; la medición se acuerda en ES-36.

### Tono ordinario

Ampliar los límites fijos del prompt, manteniéndolos al final tras manifiesto/contexto: una pregunta principal, permitir respuestas sin pregunta, omitir sin presión, fortalezas sustentadas en el relato, sin simular humanos en vivo, sin diagnóstico/promesas y sin convertir ánimo o valores en capacidad. El proveedor/modelo/presupuesto siguen siendo los de `callClaude` y ES-22.

No se promete verificar semánticamente todo texto libre con conteos de signos de interrogación o eliminar frases a ciegas: esos filtros no acreditan tono ni fundamento. Se evalúan escenarios concretos, la configuración enviada al proveedor y las respuestas con revisión humana; se distingue proveedor simulado de Claude real.

### Petición explícita de silencio

Detectar un conjunto acotado de frases completas ES/EN, normalizadas con el helper existente: p. ej. «quiero quedarme en silencio», «silencio, por favor», «I want to sit in silence», «please let me be quiet». No una búsqueda amplia de la palabra silencio: una cita, una negación o una pregunta sobre el silencio no deben disparar pausa automáticamente.

Conservar la validación de entradas del diario/propietario y la reclamación por requestId del flujo actual. **Los escenarios graves de ES-21 se resuelven primero.** La pausa determinista solo se aplica en ausencia de señal de riesgo; high/medium conservan su flujo vigente. La clasificación de riesgo no se persiste ni se propaga. Para una petición ordinaria de pausa: una única respuesta breve ES/EN, sin pregunta ni llamada al proveedor. Se confirma con el `confirmTurn` existente en una transacción, manteniendo historial privado y replay idempotente si se envía requestId.

No se añade un estado clínico o una bandera de pausa a la persona, ni se bloquea un mensaje posterior que envíe por iniciativa propia. No hay tareas/timers de seguimiento. Frases ambiguas o con contexto quedan sujetas a la instrucción de tono y revisión: este reconocedor acotado no es un clasificador universal.

Idioma: preferencia explícita válida, después idioma reconocido por el flujo existente/petición y finalmente ES; nunca deducir país del idioma. Fallbacks de proveedor/500 se ofrecen en ES y EN sin modificar códigos/retryable ni afirmar que una respuesta fallida se guardó.

### Seguridad y privacidad

`verificarToken` y `req.user.id` siguen siendo la identidad canónica. Se reutilizan `loadContextEntries` con UserId y deletedAt, `claimTurn`, `confirmTurn`, cifrado de Message/ChatTurn y recuperación por dueño. No se rediseñan helpers de Mauricio ni se añaden owner IDs desde el cliente. Mensaje/respuesta ordinaria y de pausa se guardan como la conversación existente, sin datos de ejercicios ni nuevas categorías de consentimiento.

No se toca el detector, el registro de contactos, la prioridad de seguridad, la transferencia a carrera, terapeutas/board o mecanismos de consentimiento/revocación/exportación/borrado. Mauricio revisa la integración del nuevo guard de pausa y límites fijos antes de QA/piloto. Los logs nuevos no contienen textos privados ni niveles de riesgo.

## 8. Pruebas y revisión

1. Catálogo: tres claves/versiones válidas, propósito/tiempo/una pregunta/omisión ES y EN, textos de cierre sin pregunta, integridad de ambas traducciones, metadatos de revisión no inventados y publicación desactivada por defecto.
2. Navegador: una pregunta activa, notas no salen por red ni almacenamiento, omitir/cerrar sin POST ni evento; conservar notas al cambiar idioma; copiar solo al clic, éxito/error reales, cerrar/Atrás/recarga con confirmación, cambio de sesión, responsive y teclado. Sin timers de seguimiento.
3. Backend con proveedor simulado: petición explícita ES/EN → una respuesta fija y cero llamadas a Claude; requestId repetido → mismo turno, sin duplicados. Citas/negaciones no disparan pausa. Petición de pausa mezclada con escenario grave mantiene la respuesta ES-21; casos medium siguen el control previo. El prompt final conserva límites y entradas no confiables delimitadas; sin consultar diario si no se seleccionó.
4. Propiedad: A/B/admin no leen turnos ni entradas ajenas; contextEntryIds ajenos o borrados siguen en 404. Sin token 401/403. JWT revocado sin contenido privado. Pruebas de chat ES-20, seguridad ES-21 y presupuesto ES-22 como regresión.
5. Integración HTTP/JWT/ORM/PostgreSQL desechable para pausa, persistencia atómica, replay y lectura por dueño; proveedor simulado para el camino generativo si no hay un entorno de prueba autorizado/configurado. No se declara Claude real probado si no se llamó.
6. Frontend lint 0 errores/advertencias, npm test, tsc -b, build, audit; backend sintaxis, pruebas y auditoría conforme a política existente. Registrar resultados reales, fixtures, mocks y no verificado. No correr migraciones ni tocar producción.
7. Evaluación editorial con ejemplos sintéticos: petición de silencio; omisión; resultado desconocido; meta frente a logro; persona que prefiere no responder; profesión no técnica; instrucciones para simular humano/halagar/diagnosticar. Solo el especialista valida escenarios sensibles; un test automatizado no sustituye esa revisión.

## 9. Publicación y condiciones de cierre

Diseño/contenido se publica en Jira y GitHub para revisión de Alejo/Mauricio. ES-17 y ES-24 mantienen la validación especializada; no se toma su estado Por hacer como autorización tácita. Propuesta: preparar mecanismo y fixtures, probar en local/staging y entregar PR borrador con ejercicios desactivados por defecto. Habilitar después de registrar revisión editorial ES/EN de la versión y revisión del especialista donde corresponde; nunca falsificar revisor, fecha, fundamento clínico o referencia ACT.

Alcance técnico: frontend de ejercicios y etiquetas/enlaces/bienvenida; backend de tono, pausa y fallbacks bilingües; pruebas. Diario persistente y navegación completa Mi espacio/Mi siguiente paso siguen en ES-15; recomendaciones, plan profesional y métricas siguen en sus HUs. No se rehace el envío/checkout de los chats ni se crea otro chat.

No se declara completa la HU en contenido revisado o lista para piloto si falta la validación humana. No se fusiona ni despliega desde Codex. Estimación técnica inicial: 4–6 h orientativas, sin tiempos de revisión del especialista o evaluación en staging, que deben acordarse aparte.

**Solicitud de aprobación:** pantallas, catálogo propuesto, textos, alcance técnico y mecanismo de publicación desactivada hasta revisión; después se implementa el mecanismo completo y se deja visible lo que falta validar.
