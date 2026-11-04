# Ampliación de la auditoría · Chat con IA, niveles, registro y planes (ES-148)

UX-Claude · 3-nov-2026 (tarde) · Staging, cuentas sintéticas. Continúa [INFORME-AUDITORIA-UX.md](INFORME-AUDITORIA-UX.md) (H-01 a H-23); aquí H-24 en adelante.
**Qué se ejecutó de verdad** y qué se leyó solo en el código está marcado en cada hallazgo (columna «Base»).

## 0. Respuestas directas a las preguntas de Mauricio

| Pregunta | Respuesta (con su base) |
|---|---|
| **¿Cómo se marcan las aptitudes y se registran los niveles?** | Hay tres pasos y dos caminos. Camino manual: en «Evidencias» la persona cuenta una experiencia (situación, su parte, acciones, lo entregado, efecto observado, autonomía) y **la confirma**; en «Mi mapa» elige una capacidad → «Registrar mi nivel» → (1) elige de 1 a 8 evidencias confirmadas, (2) elige nivel 1–4 leyendo el criterio del catálogo, (3) nota opcional de hasta 500 caracteres; si luego edita o borra esa evidencia, el nivel deja de mostrarse. Camino con IA: «Analizar mi evidencia con IA» → elige capacidades → la IA propone un nivel con su razón → la persona acepta, **baja**, deja sin evaluar o no guarda (**nunca sube**); la propuesta vence a los 10 minutos. *Base: código (`SelfAssessPanel.tsx`, `skill-map/copy.ts`, `evidence/FormFields.tsx`); **no ejecutado** porque no se aprobó escribir evidencias (ver §6).* |
| **¿Cuál es el formulario de registro de cada persona cuando va a hacer la compra?** | **No existe un formulario de compra ni una pasarela de pago.** El registro pide solo **nombre, correo y contraseña** (con una lista de reglas de contraseña en vivo) y no tiene casillas de consentimiento ni enlace a la política de privacidad. «Comprar» hoy es **solicitar un plan**: botón «Solicitar este plan» → queda «en revisión» y **un administrador la aprueba**; no se piden datos de pago. *Base: ejecutado en staging (capturas de registro y planes; medida: 3 campos, 0 casillas) y código (`pricing/plans.ts`, `backend/routes/auth.js`).* |
| **¿Cómo veo mis planes?** | Hoy: en el panel hay una tarjeta «Mi plan» (Gratis · Básico · mensajes de IA/día 10 · sesiones/mes 0) con «Ver planes →», que lleva a `/pricing` (otra pantalla con otro marco visual). No hay una pantalla «Mi plan» con el plan actual, el uso y el estado de la solicitud juntos. *Base: ejecutado (capturas del panel y de `/pricing` con sesión).* |
| **¿Cómo se ven los mensajes de la persona y la respuesta de la IA?** | Mensaje de la persona: bloque negro alineado a la derecha; respuesta: bloque beige a la izquierda con «✦ ELEVATION», en **texto plano** (el formato Markdown aparece sin interpretar). *Base: ejecutado con **4 llamadas reales** a la IA aprobadas por Mauricio; capturas en `capturas/chat-real/`.* |

## 1. Chat con respuestas reales de la IA (4 turnos aprobados)

Qué se hizo: una persona sintética envió 4 mensajes inocuos (sin datos personales): una apertura típica, una experiencia concreta, un «No sé.» y, en inglés, una pregunta por los límites del asistente. Transcripción y medidas: `capturas/chat-real/transcripcion.json`; capturas de cada momento (escribir → enviando → respuesta) en esa misma carpeta.

**Lo que está bien (no tocar el fondo):**
- La voz del asistente cumple las reglas del producto: no diagnostica ni promete; separa **hechos** de **hipótesis** («te dejo como hipótesis para que la corrijas»); hace **una sola pregunta** por turno; ante «No sé.» no insiste, ofrece caminos más ligeros y la **pausa**; responde en el idioma de la persona; declara lo que **no** puede hacer (terapia, diagnóstico, prometer empleo, certificar competencias, compartir sin control de la persona).
- Latencia de respuesta de ~3–5,5 s en las 4 muestras (medida por Playwright; no es un benchmark).

| ID | Sev. | Hallazgo | Evidencia / cómo reproducir | Recomendación | Base |
|---|---|---|---|---|---|
| **H-24** | Alta | **El formato de la respuesta se ve crudo.** 2 de 4 respuestas traen Markdown (`**Lo que puedo hacer:**`, listas con «-»); la interfaz las muestra como texto plano (`white-space: pre-wrap`), con asteriscos y guiones literales. | `capturas/chat-real/04c-respuesta.jpg`; `transcripcion.json` (`markdownCrudo: true`) | Interpretar solo formato mínimo y seguro (negrita, listas) sin HTML; o pedir al prompt que no use Markdown. Decide Dev/PO. | Ejecutado |
| **H-25** | Alta | **La voz es buena pero la pantalla no la sostiene.** Respuestas de 466 a 1.188 caracteres, 3 a 6 párrafos y listas; **la pregunta que sostiene la conversación queda enterrada** al final del bloque. | `01c`, `02c`, `04c` | Destacar la pregunta final; mensajes más cortos (prompt); lectura cómoda (≈60 caracteres por línea). | Ejecutado |
| **H-26** | Media | **No hay atajos para responder** cuando la persona no sabe qué contestar: tras «No sé.», el asistente ofrece tres caminos y la persona debe escribirlos. | `03c` | Respuestas rápidas **elegidas por la persona** («Prefiero no responder esa ahora», «Propón otro camino», «Hacer una pausa»); texto fijo y editable, nunca enviado sin su acción. | Ejecutado |
| **H-27** | Alta | **El cupo de IA es difícil de entender.** En esta muestra, **4 mensajes subieron el uso de 4 % a 21 %** (≈4 puntos por mensaje; **una muestra, no una regla**); la barra solo dice «%» y el panel de plan dice «10 mensajes/día»: **dos medidas distintas** para lo mismo. | `00-antes.jpg` (4 %) → `99-final-escritorio.jpg` (21 %); tarjeta «Mi plan» del panel | Una sola medida con una frase clara; decir que cada mensaje usa una parte; **verificar con el PO cuál es la regla real** (ES-73 D-01 dice que los límites por plan no están verificados). | Ejecutado + código |
| **H-28** | Media | **Poca área para leer.** Cabecera, pestañas y barra de uso ocupan ~210 px arriba y la caja de mensaje con controles ~230 px abajo: en 900 px de alto quedan ~450 px para la conversación; en móvil ≈35 %. | `99-final-escritorio.jpg`, `99-final-movil.jpg` | Una sola franja superior (una línea) y compositor compacto. | Ejecutado |
| **H-29** | Media | **No hay acciones por mensaje.** El asistente mismo dice que lo contado es «la base para reconocer competencias», pero la persona tendría que **reescribirlo** en «Evidencias». | `02c` | «Guardar como evidencia»: abre un borrador con sus palabras, **que ella completa y confirma** (no cuenta hasta entonces). | Ejecutado + código |
| **H-30** | Baja | «Enviando…», «Envío confirmado» y «Sin confirmar» salen como texto suelto bajo el hilo, fuera de la conversación. | `04b-enviando.jpg` | Estados dentro del hilo (indicador de escritura y aviso en el propio mensaje). | Ejecutado |

## 2. Evidencias y niveles (código y copy; sin ejecutar)

| ID | Sev. | Hallazgo | Recomendación | Base |
|---|---|---|---|---|
| **H-31** | Alta | **Formulario de evidencia muy largo en una sola pantalla**: 6 obligatorios (título, situación, tu parte, al menos una acción, lo entregado, efecto observado), 4 opcionales, autonomía y hasta 5 muestras. | Guiado en **3 pasos** (situación → tu parte → resultado y autonomía) con borrador; mismos campos y reglas, menos carga a la vez. | Código (`FormFields.tsx`) |
| **H-32** | Media | **El camino a un nivel está repartido** (evidencias → confirmar → mapa → capacidad → registrar) y solo se explica en un texto. | Un indicador «Cómo se llega a un nivel» (3 pasos con el actual resaltado) en «Mi mapa». | Código + captura del mapa |
| **H-33** | Media | **Dos vocabularios de cupo**: el análisis con IA usa «tu cupo de análisis» y el chat «uso de IA»; la persona no sabe si son lo mismo. | Unificar la explicación del cupo. | Código (`skill_map.ai_privacy`) |
| **H-34** | Media | «Conviene revisar» depende de una regla automática (nivel y autonomía difieren en 2 o más) que solo se explica en un párrafo largo. | Explicar en una línea junto al aviso: «Tu nivel y la autonomía que declaraste difieren: revisa si tu evidencia lo respalda». | Código (`skill_map.review_why`) |

*Buenas decisiones a conservar:* el nivel solo existe con evidencia confirmada que la persona cita; la IA **no puede subir** un nivel; «Sin evaluar» queda en hueco y no en cero; el nivel «no certifica» y no se compara; hay confirmación para retirar un nivel.

## 3. Registro de cuenta y planes

| ID | Sev. | Hallazgo | Evidencia | Recomendación | Base |
|---|---|---|---|---|---|
| **H-35** | Alta | **Registro sin aviso no clínico, sin política de privacidad y sin consentimiento.** Solo nombre, correo y contraseña; 0 casillas; ningún enlace a la política (hay un borrador v0.2 en `docs/landing`). En un producto emocional y con IA es el lugar natural del consentimiento. | `capturas/registro-planes/registro-vacio-es-escritorio.jpg`; `medidas.json` (3 campos, 0 casillas) | Casilla de aceptación (no clínico, privacidad, IA automática) + enlace. **Decisión del PO/legal**. | Ejecutado |
| **H-36** | Alta | **No existe formulario de compra ni pasarela**: «Solicitar este plan» crea una solicitud que un administrador revisa. La persona no sabe qué pasará antes de pulsar. | `planes-con-sesion-es-escritorio.jpg` | Pantalla de confirmación «Revisa tu solicitud»: qué pasa después, que **no se cobra aquí**, y dónde ver el estado. Si habrá cobro, es **una decisión de producto aún no tomada**. | Ejecutado + código |
| **H-37** | Media | **No hay «Mi plan».** El plan actual, el uso y el estado de la solicitud no están juntos; `/pricing` con sesión no indica cuál es el plan actual ni si ya hay una solicitud (solo si ya existe una, bloquea el botón). | panel + `/pricing` | Pantalla «Mi plan» y acceso desde la cabecera en toda la app. | Ejecutado |
| **H-38** | Media | **Tras registrarse hay que iniciar sesión otra vez** («Registro exitoso. Ahora inicia sesión.»). | `es.ts: success_register` | Entrar directo o enlazar claramente; verificar el motivo técnico. | Código |
| **H-39** | Baja | Regla de contraseña con jerga: «Máximo 72 bytes: las tildes y los emojis ocupan más de uno». | `registro-clave-debil-es-escritorio.jpg` | «Si usas acentos o emojis, la contraseña admite menos caracteres.» | Ejecutado |
| **H-40** | Baja | `/pricing` abre con el encabezado «12 PLANES» (es el número de sección de la landing) y con otro marco que la aplicación; en staging solo hay 2 planes de prueba «(sintético)». | `planes-con-sesion-es-escritorio.jpg` | Mismo marco que la app; quitar el número de sección. | Ejecutado |

## 4. Lo que no se puede concluir todavía

- **Qué ocurre al enviar** un registro, una evidencia, un nivel o una solicitud de plan: no se hizo (no hay aprobación de escritura para eso; solo se aprobaron los 4 mensajes de chat).
- **Reglas reales de cupo y de precio**: no verificadas (ES-73 D-01). Los números del prototipo («10 mensajes por día», «4 %») son los que muestra la cuenta de staging, marcados como ejemplo.
- **Calidad de la IA en otros casos** (crisis, temas sensibles, mensajes largos, inyección de instrucciones): no se probó; son pruebas de QA con plan aprobado.
- **El texto de los criterios de cada nivel** (rúbrica del catálogo): se desconoce en esta auditoría; el diseño deja un hueco para el texto del catálogo.

## 5. Efecto en el diseño

Cada hallazgo de este documento está resuelto o planteado en el prototipo [diseno-final/index.html](diseno-final/index.html): conversación como página escrita con la pregunta destacada y respuestas rápidas (H-24 a H-30); «Guardar como evidencia» desde el chat con borrador de 3 pasos (H-29, H-31); «Cómo se llega a un nivel», registro de nivel y análisis con IA (H-32 a H-34); registro con consentimiento (H-35); «Mi plan» con solicitud y estados (H-36, H-37). Detalle en [PROPUESTA-DISENO.md](PROPUESTA-DISENO.md).

## 6. Aprobaciones de Mauricio usadas en esta ampliación

- Aprobado y usado: **hasta 4 mensajes reales al chat** (se usaron 4).
- **No** aprobado (por eso no se ejecutó): crear una evidencia sintética y registrar un nivel; enviar una solicitud de plan.
- Efecto en staging de lo ejecutado: 8 turnos (4 de la persona y 4 del asistente) en el historial de la cuenta sintética de persona; el uso de IA de esa cuenta pasó de 4 % a 21 %.
