# Arquitectura de información y textos de la landing pública de Elevation

Versión 0.1 · 25-oct-2026 · **BORRADOR para revisión de Alejo (PO) y Mauricio (Tech Lead)**. Redactado a pedido de Mauricio como insumo de ES-60 (diseño de la landing). No es una aprobación, no cambia código y no sustituye al PRD.

> **Léelo junto con** `ALCANCE-COMO-ES-Y-COMO-DEBE-SER.md` (mismo directorio): qué existe hoy en el código, qué debe existir y qué decisiones siguen abiertas. Este documento solo cubre los textos y el orden de la landing.

## 0. Para qué sirve este documento

La landing pública (la "front office") es la primera página que ve cualquier persona que llega a Elevation. Debe contar **qué es Elevation, qué objetivos tiene, cómo funciona, para quién es (personas en transición y psicólogos/orientadores profesionales), qué es el Skill Map, cuánto cuesta y cómo vincularse**. Este documento fija:

1. los **públicos** y el **orden de las secciones** (mapa de información);
2. el **texto propuesto en ES y EN** de cada sección;
3. las **claves de contenido** que el sistema editable de la landing necesitará;
4. las **reglas de lenguaje** (qué no se puede decir);
5. las **decisiones pendientes** donde las fuentes se contradicen o falta información.

**Fuera de alcance (acordado por Mauricio):** la zona de usuarios, la zona de psicólogos, el chat y el backoffice; llevan otro diseño. Solo se enlaza hacia ellos.

**Fuentes.** PRD v0.3 (`docs/elevation-skillmap/02-PRD.md`), canvas de negocio v0.2 (`01-CANVAS-NEGOCIO.md`), one-pager para psicólogos (`05-ONEPAGER-PSICOLOGO.md`), prototipo visual de referencia y su guion (sitio de Netlify), el código actual de la landing, de precios y de rutas (`frontend/src/`, `backend/routes/pricing.js`) y la presentación para stakeholders. Cada sección indica su fuente; lo que no tiene fuente se marca **[por decidir]**.

## 1. Qué dice hoy la landing y qué falta

La landing actual (`frontend/src/pages/LandingPage.tsx`) tiene: héroe, proceso en tres pasos, bloque verde, llamada final y aviso legal. **No menciona a psicólogos ni profesionales, ni el Skill Map, ni precios en la página** (los planes viven en `/pricing`), y su tono viene del producto anterior (clínico). Falta todo lo que Mauricio pidió: objetivos, funcionamiento completo, psicólogos, Skill Map, precios y vinculación.

## 2. Públicos

| Público | Qué necesita saber | Acción que queremos |
| --- | --- | --- |
| **A. Persona en transición profesional** (profesional adulto) | Que hay un espacio para comprender lo que vive y reconocer lo que puede aportar, sin presión ni promesas falsas. | Crear cuenta y elegir por dónde empezar. |
| **B. Psicólogo/a u orientador/a profesional** | Qué papel tiene, qué ve y qué nunca ve, cómo se protege a la persona y cómo participar. | Unirse como profesional o asesorar el diseño. |
| **C. Aliado o institución** (opcional) | Que existen cohortes con facilitación y reportes agregados. | Escribir para conversar. **[por decidir D-05]** |

## 3. Mapa de información (orden de la página)

| # | Sección | Objetivo | Público | Fuente | Enlace o acción |
| --- | --- | --- | --- | --- | --- |
| S0 | Cabecera | Orientar, cambiar idioma | A, B | Referencia visual | Menú; ES/EN; Ingresar |
| S1 | Héroe | Promesa en una frase | A, B | Canvas §1 | Dos puertas (S2) |
| S2 | Dos puertas de entrada | Elegir por dónde empezar | A | Prototipo; PRD §4 | Registro |
| S3 | El problema | Reconocerse | A | PRD §1; canvas §3 | — |
| S4 | Qué es Elevation + Skill Map | Entender los dos módulos | A, B | PRD §0; one-pager | — |
| S5 | Cómo funciona | Ver el recorrido completo | A, B | PRD §4; canvas §5 | — |
| S6 | Privacidad y límites | Generar confianza | A, B | PRD RF-02, 04, 14; one-pager | Política de privacidad |
| S7 | Qué ofrece a las personas | Funciones concretas | A | PRD RF-03 a RF-16 | — |
| S8 | Para psicólogos y orientadores | Rol y valor profesional | B | One-pager; PRD RF-11; canvas §3 | Unirse como profesional |
| S9 | Skill Map | Explicar capacidades con evidencia | A, B | PRD RF-05 a RF-09, RF-17 | — |
| S10 | Ejemplo ilustrativo | Mostrar "una experiencia, más de una lectura" | A | Prototipo | — |
| S11 | Objetivos y estado del proyecto | Honestidad sobre dónde estamos | A, B, C | PRD §0, §10; canvas §9 | — |
| S12 | Planes y precios | Cuánto cuesta | A | Backend de precios; canvas §7 | **[D-01]** |
| S13 | Cómo vincularte | Pasos de registro | A, B | App actual (`/login`, `/pricing`) | Crear cuenta |
| S14 | Preguntas frecuentes | Resolver dudas y límites | A, B | PRD; one-pager | — |
| S15 | Cierre y pie | Última llamada y avisos | A, B | PRD RF-14 | Crear cuenta |

## 4. Textos propuestos (ES / EN)

> Convención: **[por decidir]** = no hay fuente o hay contradicción (ver §7). Los textos en inglés son traducción de trabajo; no los ha revisado una persona nativa.

### S0 · Cabecera
- ES: Elevation · Para ti · Para profesionales · Skill Map · Planes · Ingresar · [ES | EN]
- EN: Elevation · For you · For professionals · Skill Map · Plans · Sign in · [ES | EN]
- Regla: ningún enlace a una ruta que no exista. "Mi espacio" y "Mi experiencia" del prototipo **no** van en la landing: son pantallas de la plataforma.

### S1 · Héroe
- Etiqueta ES: ACOMPAÑAMIENTO + EXPLORACIÓN PROFESIONAL · EN: SUPPORT + PROFESSIONAL EXPLORATION
- Titular ES: **Lo que has vivido cuenta.** · EN: **What you have lived through counts.**
- Subtítulo ES: Un espacio para comprender lo que vives, reconocer lo que puedes aportar y construir tu siguiente paso profesional en la era de la IA.
- Subtítulo EN: A space to understand what you are going through, recognise what you can contribute, and build your next career step in the age of AI.
- Línea de apoyo ES: Un punto de partida. Ningún camino impuesto. · EN: A starting point. No path imposed.
- Fuente: promesa principal del canvas §1 y prototipo.

### S2 · Dos puertas de entrada
- Título ES: ¿Por dónde quieres empezar? · EN: Where would you like to start?
- Puerta 01 ES: **Hacer espacio** — Ordenar lo que estoy viviendo. Conversar o escribir, sin tener que convertirlo en una tarea profesional.
- Puerta 01 EN: **Make space** — Sort through what I am going through. Talk or write, without turning it into a career task.
- Puerta 02 ES: **Mirar otra vez** — Reconocer lo que puedo aportar. Partir de una experiencia concreta y explorar las capacidades que podría mostrar.
- Puerta 02 EN: **Look again** — Recognise what I can contribute. Start from a concrete experience and explore the capabilities it could show.
- Acción: ambas llevan a crear cuenta o ingresar; qué hacer con la elección después del registro **[por decidir D-09, ver §7]**.
- Nota: PRD §4 llama a estas dos entradas "Mi espacio" (acompañamiento y diario) y "Mi siguiente paso" (orientación). Unificar nombres en el diseño.

### S3 · El problema
- Título ES: Cambiar de rumbo no debería significar empezar de cero. · EN: Changing direction should not mean starting from zero.
- Cuerpo ES: Cuando tu trabajo deja de encajar contigo o tu industria cambia, es común sentir que tu identidad está atada a un cargo, no saber qué otras industrias existen y temer invertir en una formación equivocada. Muchas herramientas te dan listas de profesiones o cursos, pero no te explican por qué encajan ni cómo empezar.
- Cuerpo EN: When your job stops fitting you or your industry changes, it is common to feel your identity is tied to a job title, not know which other industries exist, and fear investing in the wrong training. Many tools give you lists of careers or courses, but do not explain why they fit or how to begin.
- Fuente: PRD §1 y canvas §3 ("Profesional").

### S4 · Qué es Elevation y qué es Skill Map
- Título ES: Dos módulos, un mismo recorrido · EN: Two modules, one journey
- **Elevation** ES: Conversación con inteligencia artificial, ejercicios breves y un diario privado para explorar lo que vives, tus valores y lo que quieres conservar o cambiar. Con pausas, con silencio y sin tareas impuestas.
- **Elevation** EN: AI-supported conversation, short exercises and a private journal to explore what you are going through, your values, and what you want to keep or change. With pauses, with silence, and no imposed tasks.
- **Skill Map** ES: Un mapa de tus capacidades construido con tu experiencia y muestras de tu trabajo. Explica qué evidencia respalda cada capacidad y te ayuda a comparar opciones, elegir qué aprender y probar una ruta.
- **Skill Map** EN: A map of your capabilities built from your experience and work samples. It shows what evidence backs each capability and helps you compare options, choose what to learn and test a route.
- Aclaración ES: Funciona también para profesiones no tecnológicas. · EN: It also works for non-technical professions.
- Fuente: PRD §0 ("Elevation es la experiencia principal; SkillMap es el módulo profesional") y one-pager.

### S5 · Cómo funciona
- Título ES: Un recorrido que tú diriges · EN: A journey you direct
- Pasos ES:
  1. **Empieza por donde quieras.** Acompañamiento y diario, o directamente tus opciones profesionales. La exploración emocional no es un requisito para buscar trabajo.
  2. **Tu brújula.** Una síntesis editable de tus valores, intereses y límites. Puedes corregirla, rechazarla o confirmarla.
  3. **Tú decides qué compartir.** Solo las conclusiones profesionales que revises y autorices pasan al proceso de carrera.
  4. **Tus evidencias y tu Skill Map.** Cuentas casos de tu trayectoria y ves qué capacidades respaldan.
  5. **Compara tres rutas.** Continuidad, adyacente y exploratoria, con fuentes, barreras y brechas.
  6. **Prueba, decide y planifica.** Un experimento pequeño, una decisión razonada y un plan a 7, 30 y 90 días.
- Pasos EN:
  1. **Start wherever you like.** Support and journaling, or go straight to your career options. Emotional exploration is not a prerequisite for a job search.
  2. **Your compass.** An editable summary of your values, interests and limits. You can correct, reject or confirm it.
  3. **You decide what to share.** Only the professional conclusions you review and authorise move into the career process.
  4. **Your evidence and your Skill Map.** You describe cases from your career and see what capabilities they support.
  5. **Compare three routes.** Continuity, adjacent and exploratory, with sources, barriers and gaps.
  6. **Test, decide and plan.** A small experiment, a reasoned decision and a 7-, 30- and 90-day plan.
- Nota ES: Diseñado como un recorrido de 30 días. Es una propuesta que estamos validando; no es un plazo para conseguir empleo.
- Nota EN: Designed as a 30-day journey. It is a proposal we are validating; it is not a timeline for finding a job.
- Fuente: PRD §4 y canvas §1 y §5.

### S6 · Privacidad y límites
- Título ES: Tu espacio es tuyo, y sabemos cuáles son nuestros límites · EN: Your space is yours, and we are clear about our limits
- Viñetas ES:
  - **El asistente de IA es acompañamiento no clínico y orientación profesional.** No diagnostica, no hace psicoterapia, no es un servicio de urgencias y no garantiza empleo. La IA puede equivocarse. Si quieres atención psicológica, puedes trabajar con un profesional acreditado de la red de Elevation, en un espacio separado.
  - **Lo privado se queda privado.** Tu psicólogo/a no lee tus conversaciones con el asistente, y estas no pasan al mapa. Solo cruzan las conclusiones profesionales que tú revisas y autorizas, y puedes retirar el permiso.
  - **Sin evidencia, una pregunta; no un déficit.** Una emoción o una preferencia no demuestra una competencia, y tu estado de ánimo no influye en tu mapa.
  - **Tú tienes el control.** Puedes exportar lo que elijas y pedir la eliminación de tus datos.
  - **Si estás en una situación de riesgo,** esto no es un servicio de urgencias: contacta a los servicios de emergencia o de salud de tu país. **[por decidir D-08]**
- Viñetas EN:
  - **The AI assistant is non-clinical support and career guidance.** It does not diagnose, provide psychotherapy, act as an emergency service or guarantee jobs. AI can be wrong. If you want psychological care, you can work with an accredited professional in Elevation's network, in a separate space.
  - **What is private stays private.** Your psychologist does not read your conversations with the assistant, and they do not go to the map. Only the professional conclusions you review and authorise cross over, and you can withdraw permission.
  - **No evidence is a question, not a deficit.** A feeling or a preference does not prove a capability, and your mood does not affect your map.
  - **You are in control.** You can export what you choose and request deletion of your data.
  - **If you are in a risky situation,** this is not an emergency service: contact the emergency or health services in your country. **[to decide D-08]**
- Enlaces: política de privacidad (**conservar su URL pública actual**, criterio de ES-57).
- Fuente: one-pager (límites y privacidad), PRD RF-02, 04, 12, 14.
- **Estado hoy:** el puente de consentimiento, la exportación y la eliminación por parte de la persona **no existen todavía** en el código, y no encontré una detección de crisis en el backend. Estas viñetas describen el producto objetivo: se publican con el estado "Próximamente", o cuando existan. Lo que sí existe hoy: chat cifrado en base de datos y cabeceras de seguridad.

### S7 · Qué ofrece a las personas
Seis bloques, cada uno con un **estado visible** (Disponible / En piloto / Próximamente) que debe confirmar Dev antes de publicar **[por decidir D-03]**.

**Estado verificado hoy en el código** (ver `ALCANCE-COMO-ES-Y-COMO-DEBE-SER.md` §2): existe la conversación con IA, el check-in de ánimo y los planes. **No existen** el diario privado, los ejercicios, la brújula, la exportación ni la eliminación de datos por parte de la persona, ni el Skill Map. Hasta que existan, esas funciones salen como "Próximamente" o no salen.

| Bloque | ES | EN | Fuente |
| --- | --- | --- | --- |
| Conversación con ritmo | Una pregunta a la vez, con pausas y silencio. Puedes cerrar sin tarea. | One question at a time, with pauses and silence. You can close without a task. | RF-15 |
| Ejercicios | Ejercicios cortos de reflexión, valores o reconocimiento de logros, con propósito, duración y opción de omitirlos. | Short exercises on reflection, values or recognising achievements, with purpose, duration and an option to skip. | RF-15 |
| Diario privado | Crea, edita y borra entradas. Tú eliges si el acompañamiento puede consultar una. | Create, edit and delete entries. You choose whether the support can read one. | RF-15 |
| Brújula editable | Valores, intereses y límites que tú confirmas. | Values, interests and limits that you confirm. | RF-03 |
| Español e inglés | Toda la experiencia en los dos idiomas; tu idioma, tu país y tu mercado laboral son cosas distintas. | The whole experience in two languages; your language, country and target job market are separate things. | RF-16 |
| Tus datos | Exporta un resumen profesional o elimina tu cuenta y sus derivados. | Export a professional summary or delete your account and derived data. | RF-12 |

### S8 · Para psicólogos y profesionales del acompañamiento
**La zona del psicólogo funciona como hoy** (decisión de Mauricio, 25-oct). La landing la cuenta tal como existe y explica cómo se liga con el Skill Map mediante lo que la persona autoriza.
- Título ES: Para quienes acompañan a otras personas · EN: For those who support other people
- Introducción ES: Si eres psicólogo/a o coach profesional, Elevation te da un espacio propio para acompañar a las personas que te eligen, con un asistente de IA que cuida el tiempo entre sesiones. El criterio profesional es tuyo.
- Introducción EN: If you are a psychologist or professional coach, Elevation gives you your own space to support the people who choose you, with an AI assistant that looks after the time between sessions. The professional judgement is yours.
- Viñetas ES (cada una con su estado, **por confirmar con Dev, D-03**):
  - **Panel de tus pacientes.** Cómo llegan y cómo salen de cada conversación (ánimo de entrada y de salida), valoraciones y alertas.
  - **Historia clínica y notas.** Tus notas se guardan cifradas y solo las ves tú.
  - **Resúmenes con IA** del progreso, a partir de ánimo, valoraciones y tus notas, para prepararte antes de cada sesión.
  - **Sesiones y videollamada.** Programa, inicia y cierra sesiones con tus pacientes.
  - **Tu propio estilo de acompañamiento.** Puedes proponer cómo conversa el asistente con tus pacientes, con aprobación del comité ético.
  - **Verificación de credenciales** por el comité ético de Elevation.
- Viñetas EN:
  - **Your patient panel.** How people arrive at and leave each conversation (mood in and out), ratings and alerts.
  - **Clinical history and notes.** Your notes are stored encrypted and only you can read them.
  - **AI summaries** of progress, based on mood, ratings and your notes, to prepare for each session.
  - **Sessions and video calls.** Schedule, start and close sessions with your patients.
  - **Your own style of support.** You can propose how the assistant talks to your patients, subject to ethics committee approval.
  - **Credential verification** by Elevation's ethics committee.
- Lo que no ves ES: **La conversación de la persona con el asistente de IA es un espacio separado y privado: no la lees.** Si quiere compartir algo contigo, lo decide ella. · EN: **The person's conversation with the AI assistant is a separate, private space: you do not read it.** If they want to share something with you, they decide.
- Y el Skill Map ES: Cuando el Skill Map esté disponible, la persona podrá compartir contigo, si lo decide, las conclusiones profesionales que revisó, para que acompañes su transición con más contexto. **Próximamente.** Qué ve el psicólogo y cómo lo ve queda por definir (D-12).
- Y el Skill Map EN: When the Skill Map is available, the person will be able to share with you, if they choose, the professional conclusions they reviewed, so you can support their transition with more context. **Coming soon.** What the psychologist sees and how is still to be defined (D-12).
- Invitación ES: **¿Quieres aportar tu criterio?** También estamos formando el piloto con profesionales de la psicología que nos ayuden a revisar el encuadre, el lenguaje, la seguridad y la privacidad. · EN: **Want to contribute your expertise?** We are also shaping the pilot with psychology professionals who help us review the framing, language, safety and privacy.
- Botón: Unirme como profesional / Join as a professional → alta con validación de credenciales **[por confirmar, D-04]**.
- Fuente: zona de terapeutas en el código (`routes/therapistRoutes.js`, `routes/sessions.js`, `routes/validation.js`), Manifiesto Ético §2.2 y §3, HU-046, HU-049, HU-050, one-pager para psicólogos.
- **Aclaración:** no hay contradicción con el PRD. El asistente de IA es no clínico y el psicólogo es un profesional acreditado en un espacio separado; el puente del Skill Map (RF-04) conecta ese espacio solo con lo que la persona autoriza.

### S9 · Skill Map
- Título ES: Tu experiencia, convertida en capacidades con evidencia · EN: Your experience, turned into capabilities with evidence
- Viñetas ES:
  - **Capacidades transversales y de dominio**, cada una con su evidencia y su criterio de evaluación.
  - **Estados claros:** sin evidencia, evidencia inicial, evidencia revisada o contradictoria. Sin evidencia se muestra vacío, nunca un déficit inventado.
  - **Autonomía en cuatro niveles** (conceptual, aplicada con asistencia, autónoma y repetible, lidera o enseña). Es una guía, no una certificación.
  - **Tres rutas fundamentadas** con fuentes y fechas: continuidad, adyacente y exploratoria. Sin un porcentaje de "empleabilidad" ni de "reemplazo por IA".
  - **Un experimento de 20 a 45 minutos** para probar una ruta antes de invertir en ella.
- Viñetas EN:
  - **Transversal and domain capabilities**, each with its evidence and assessment criteria.
  - **Clear states:** no evidence, initial evidence, reviewed evidence or contradictory. With no evidence it stays empty, never an invented deficit.
  - **Autonomy in four levels** (conceptual, applied with assistance, autonomous and repeatable, leads or teaches). It is a guide, not a certification.
  - **Three grounded routes** with sources and dates: continuity, adjacent and exploratory. No "employability" or "AI replacement" percentage.
  - **A 20-to-45-minute experiment** to test a route before investing in it.
- Bloque "era de la IA" ES: Entender cómo cambian las tareas de los roles que exploras y qué capacidades de criterio siguen importando. No predecimos qué profesión desaparecerá. · EN: Understand how the tasks of the roles you explore are changing and which judgement skills still matter. We do not predict which profession will disappear.
- Fuente: PRD RF-05 a RF-09 y RF-17; canvas §1.

### S10 · Ejemplo ilustrativo
- Rótulo obligatorio ES: **Ejemplo ilustrativo. No es un caso real.** · EN: **Illustrative example. Not a real case.**
- Título ES: Una experiencia. Más de una lectura. · EN: One experience. More than one reading.
- Cita ES: "Pensé que solo había organizado un proyecto." · EN: "I thought I had only organised a project."
- Nota ES: Acciones → posibles capacidades. Hipótesis que tú puedes revisar. · EN: Actions → possible capabilities. Hypotheses you can review.
- Regla: sin nombres, cifras ni resultados; texto final revisado por el especialista (ES-17) y por Mauricio o Alejo. Si no está listo, la sección se oculta.
- Fuente: prototipo (caso ficticio de docencia).

### S11 · Objetivos y estado del proyecto
- Título ES: Lo que queremos lograr, y dónde estamos · EN: What we want to achieve, and where we are
- Objetivos ES: acompañamiento respetuoso y sin presión; un mapa de capacidades respaldado por evidencia; decisiones profesionales mejor fundamentadas; privacidad bajo tu control; una experiencia completa en español e inglés.
- Objetivos EN: respectful, pressure-free support; a capability map backed by evidence; better-grounded career decisions; privacy under your control; a complete experience in Spanish and English.
- Estado ES: Estamos construyendo la plataforma por etapas. Primero, un piloto cerrado con un grupo pequeño de personas en reconversión profesional, para aprender antes de ampliar. No presentamos cifras de eficacia ni de tracción porque todavía no existen.
- Estado EN: We are building the platform in stages. First, a closed pilot with a small group of people changing careers, so we learn before we scale. We do not present efficacy or traction figures because they do not exist yet.
- **No publicar** el tamaño exacto, los países ni los idiomas del piloto sin aprobación del PO **[D-06]**: con seis personas, esos datos pueden identificar a alguien.
- Fuente: PRD §0 y §10.

### S12 · Planes y precios — **decidido por Mauricio el 25-oct (D-01)**
**Decisión:** la landing muestra los **planes que ya existen** (hoy Básico 0, Esencial 12, Plus 29 y Pro 59 dólares al mes) y esa información es **administrable** desde el backoffice. La página no lleva precios escritos: los lee del backend (`GET /api/plans`; administración en `/api/admin/pricing`).

- Título ES: Elige cómo quieres acompañarte · EN: Choose how you want to be supported
- Subtítulo ES: Empieza sin costo y cambia de plan cuando lo necesites. · EN: Start at no cost and change plans whenever you need.
  - Solo es cierto mientras exista un plan de precio 0 (hoy, Básico). Si el administrador lo retira, este texto debe cambiar.
- Cada tarjeta muestra, desde el backend: nombre, descripción, precio con moneda y periodo, lista de funciones y si va destacado.
- Botón de cada plan ES: Crear cuenta y solicitar este plan · EN: Create an account and request this plan. Para una persona con sesión iniciada: Solicitar este plan / Request this plan (flujo existente de solicitud de plan, que aprueba un administrador).
- Estados: cargando, error al cargar (mensaje y reintento), sin planes (mensaje "Pronto publicaremos los planes").
- Nota ES: Los planes de pago pasan por la aprobación de un administrador. · EN: Paid plans go through administrator approval.

**Riesgos a revisar con el PO antes de publicar (D-01):**
1. Los textos actuales de los planes vienen del producto anterior: el plan Plus dice "para quienes quieren un proceso terapéutico consistente" y varios incluyen "sesiones con terapeuta". Eso choca con la regla de no prometer terapia. Como son administrables, se corrigen desde el backoffice, sin tocar código.
2. Los **límites** de cada plan (mensajes por día, sesiones por mes, acceso a progreso) están fijos en el código por slug (`utils/planLimits.js`), no en la base. Cambiarlos requiere desarrollo.
3. Ningún plan define aún qué parte del **Skill Map** incluye. Hay que decidirlo antes de anunciarlo en una tarjeta.
4. Los escenarios de 49, 79 y 119 dólares del canvas son internos: **no** se usan.

### S13 · Cómo vincularte
- Título ES: Empezar es sencillo · EN: Getting started is simple
- Para personas, pasos ES: 1) Crea tu cuenta con tu nombre, correo y contraseña. 2) Elige tu idioma. 3) Empieza por la puerta que prefieras. 4) Decide qué compartir y qué guardar para ti.
- Para personas, pasos EN: 1) Create your account with your name, email and password. 2) Choose your language. 3) Start with the door you prefer. 4) Decide what to share and what to keep to yourself.
- Para profesionales **[por decidir D-04]**: ES: Cuéntanos tu perfil profesional y validaremos tus credenciales antes de darte acceso. · EN: Tell us about your professional profile and we will verify your credentials before giving you access.
- Estado actual verificado: existe registro abierto con nombre, correo y contraseña en `/login`. El alta y validación de psicólogos existe en el código (rutas y modelo de validación académica), pero no verifiqué su flujo completo.
- Fuente: app actual.

### S14 · Preguntas frecuentes
| Pregunta (ES) | Respuesta (ES) |
| --- | --- |
| ¿Es terapia? | El asistente de IA no: es acompañamiento no clínico y orientación profesional, sin diagnóstico ni garantía de empleo. Si quieres atención psicológica, puedes trabajar con un profesional acreditado de la red, en un espacio separado. |
| ¿Mis conversaciones son privadas? | Sí. Tus conversaciones con el asistente no las lee tu psicólogo/a ni pasan al mapa. Solo se comparte lo que tú revisas y autorizas. |
| ¿Qué puede ver mi psicólogo/a? | Tu ánimo de entrada y de salida, tus valoraciones y lo que él o ella anote. **No** lee tus conversaciones con el asistente de IA. Lo que quieras compartir, lo decides tú. |
| ¿Qué hace la IA? | Propone síntesis y opciones. Tú las corriges, las rechazas o las confirmas. Puede equivocarse. |
| ¿El Skill Map certifica mis capacidades? | No. Muestra qué evidencia respalda cada capacidad. Aceptar una capacidad candidata no acredita un nivel. |
| ¿Me garantizan un empleo? | No. Conseguir empleo depende de condiciones externas y no forma parte de lo que ofrecemos. |
| ¿Sirve para profesiones no técnicas? | Está diseñado para que sí: una docente o una contadora no recibe programación por defecto. |
| ¿Puedo borrar mis datos? | Sí, puedes pedir la exportación y la eliminación. Los plazos exactos los confirmaremos antes de prometerlos. |
| ¿Cuánto cuesta? | Depende de la decisión D-01: ver S12. |
| ¿En qué idiomas está? | Español e inglés. |

| Question (EN) | Answer (EN) |
| --- | --- |
| Is this therapy? | The AI assistant is not: it is non-clinical support and career guidance, without diagnosis or employment guarantees. If you want psychological care, you can work with an accredited professional in the network, in a separate space. |
| Are my conversations private? | Yes. Your psychologist does not read your conversations with the assistant, and they do not go to the map. Only what you review and authorise is shared. |
| What can my psychologist see? | Your mood in and out, your ratings and whatever they write down. They do **not** read your conversations with the AI assistant. What you want to share is your decision. |
| What does the AI do? | It proposes summaries and options. You correct, reject or confirm them. It can be wrong. |
| Does the Skill Map certify my capabilities? | No. It shows what evidence supports each capability. Accepting a candidate capability does not certify a level. |
| Do you guarantee a job? | No. Getting a job depends on external conditions and is not part of what we offer. |
| Does it work for non-technical professions? | It is designed to: a teacher or an accountant is not recommended programming by default. |
| Can I delete my data? | Yes, you can request export and deletion. We will confirm the exact timelines before promising them. |
| How much does it cost? | Depends on decision D-01: see S12. |
| Which languages? | Spanish and English. |

### S15 · Cierre y pie
- Cierre ES: Empieza por donde quieras. · EN: Start wherever you like.
- Botón ES: Crear mi cuenta · EN: Create my account. Secundario: Soy profesional / I am a professional.
- Pie ES: El asistente de IA de Elevation ofrece acompañamiento y orientación profesional **no clínicos**; no sustituye la atención psicológica, médica ni de emergencia. · EN: Elevation's AI assistant offers **non-clinical** support and career guidance; it does not replace psychological, medical or emergency care.
- Enlaces: política de privacidad (URL actual), términos y contacto **[D-08]**.

## 5. Claves de contenido propuestas

Prefijo `landing.` en el sistema editable ES/EN (ver ES-66). Una clave por cada texto de §4; no se reutilizan las claves antiguas (`hero_title`, `step1_title`, etc.), que quedan obsoletas.

`landing.nav.*`, `landing.hero.{label,title,subtitle,support}`, `landing.doors.{title,1.title,1.desc,2.title,2.desc}`, `landing.problem.{title,body}`, `landing.modules.{title,elevation,skillmap,note}`, `landing.how.{title,step1..step6,note}`, `landing.trust.{title,bullet1..bullet5}`, `landing.features.{title,item1..item6,status.*}`, `landing.pros.{title,intro,bullet1..bullet4,invite,cta}`, `landing.skillmap.{title,bullet1..bullet5,ai}`, `landing.example.{label,title,quote,note}`, `landing.goals.{title,goals,status}`, `landing.pricing.{title,optionA,...}`, `landing.join.{title,persona.step1..4,pro}`, `landing.faq.{q1..q10,a1..a10}`, `landing.footer.{notice,privacy,terms,contact}`.

## 6. Reglas de lenguaje

| No decir | Decir |
| --- | --- |
| Terapia, tratamiento, paciente (para la persona), "sanar" | Acompañamiento, exploración, orientación profesional |
| Diagnóstico, evaluación de salud mental, puntaje emocional | Síntesis editable que tú confirmas |
| Te conseguimos empleo; garantizamos resultados; X % de empleabilidad | Te ayudamos a comprender, demostrar y probar tus opciones |
| Tu profesión no tiene futuro; X % de reemplazo por IA | Cómo cambian las tareas del rol, con fuente y fecha |
| Certificamos tus capacidades | Muestra qué evidencia respalda cada capacidad |
| Feedback humano (si no hay una persona presente) | Voz cálida y cercana |
| Rachas, "no pierdas tu racha", presión por volver | Sin rachas ni obligación de convertir cada reflexión en tarea |
| Cifras de usuarios, eficacia, testimonios, logos | Nada de eso hasta que exista y esté verificado |
| Teléfonos de ayuda sin verificar país y vigencia | Aviso general hasta que haya recursos verificados |
| Funciones como disponibles si no están publicadas | Estado visible: Disponible / En piloto / Próximamente |

## 7. Decisiones pendientes

| ID | Decisión | Quién | Por qué importa |
| --- | --- | --- | --- |
| D-01 | **Precios y planes: DECIDIDO (Mauricio, 25-oct).** Se muestran los planes existentes, administrables. Pendiente de Alejo: revisar los textos de los planes (el Plus dice "proceso terapéutico") y definir qué incluye cada uno del Skill Map. | Alejo (PO) | Ver S12. |
| D-02 | **La parte psicológica: DECIDIDO (Mauricio, 25-oct).** Funciona tal como está hoy. El Skill Map se liga con el puente de consentimiento del PRD (RF-04). No hay contradicción: el asistente de IA es no clínico y está separado del espacio del psicólogo, que es un profesional acreditado. | — | Ver S8 y el documento de alcance §3. |
| D-12 | Cuando el Skill Map exista: ¿qué ve el psicólogo de lo que la persona autoriza, y cómo? | Alejo y Mauricio | S8 lo marca "Próximamente"; no bloquea la landing. |
| D-03 | **Estado real de cada función** (disponible, en piloto, próximamente), sobre todo Skill Map, brújula, puente y diario. | Dev | No anunciar lo que no está publicado (PRD §11). |
| D-04 | **Alta de psicólogos:** flujo y validación de credenciales; qué ve el visitante. | Mauricio | S13 y el botón de S8. |
| D-05 | **Aliados o instituciones** en la landing (B2B2C): sí o no, y cómo contactar. | Alejo | Sección opcional. |
| D-06 | **Mencionar el piloto** y qué datos de él se publican. | Alejo | Riesgo de reidentificación con seis personas. |
| D-07 | **Ejemplo ilustrativo:** texto final y revisión del especialista. | Alejo y especialista | S10. |
| D-08 | **Contacto, términos, URL de privacidad y recursos de ayuda por país** (verificados). | Mauricio y especialista | Pie y S6. |
| D-09 | **Qué hace la elección de puerta** tras el registro (¿llega a "Mi espacio" o "Mi siguiente paso"?) sin duplicar el onboarding de ES-14. | Alejo, UX y Dev | Coherencia entre landing y plataforma. |
| D-10 | **Analítica de la landing:** ninguna por ahora. Cualquier medición requiere aprobación y consentimiento. | Mauricio | Privacidad. |
| D-11 | **Librería de UI:** daisyUI, decisión de Mauricio (25-oct). No está instalada en `frontend/` todavía (hay Tailwind 4). Se instala dentro del trabajo de la landing, acotada a esta página, sin cambios globales de tema. | Mauricio (registrada) | Evita sorpresas en el diseño y en las dependencias. |

## 8. Lo que no verifiqué

- No reabrí la presentación para stakeholders: este texto sale del PRD y del canvas, que son sus fuentes.
- No verifiqué qué funciones están publicadas ni el flujo de alta de psicólogos.
- Las traducciones al inglés no las revisó una persona nativa.
- No evalué el contraste, la accesibilidad ni la longitud de los textos en pantalla: eso es parte del diseño (ES-60).
- Los textos de S6 y S14 sobre privacidad y eliminación deben revisarse con el especialista y con las decisiones de privacidad de la plataforma antes de publicarse.
