# Elevation + Skill Map: alcance como es hoy y como debe ser

Versión 0.1 · 25-oct-2026 · **BORRADOR para revisión de Alejo (PO) y Mauricio (Tech Lead)**. Pedido por Mauricio para tener el contexto completo y real antes de diseñar la landing y construir. No es una aprobación y no cambia código.

## 0. Cómo leer este documento

Cada afirmación tiene una de tres marcas:

- **[Código]** verificado leyendo el repositorio (rama `ES-9-despliegue-railway`, que contiene `ES-57`). Que exista una ruta o un modelo no prueba que funcione bien.
- **[Documento]** dicho en el PRD, el canvas, el roadmap o Jira, sin comprobarlo en el código.
- **[Decisión]** la dijo Mauricio en este chat.

Lo que no pude comprobar se declara **no verificado**.

## 1. Cómo llegamos aquí

| Momento | Qué era | Fuente |
| --- | --- | --- |
| **MVP anterior (marzo a octubre 2026)** | "Elevation clínico": espacio de bienestar y reflexión con IA, pensado primero para Paraguay, con check-in de ánimo, chat, terapeutas, sesiones por video, planes de pago y un backoffice con prompts versionados y comité ético. En Jira, la épica ES-1 y las historias ES-48 a ES-56 figuran como **Listo**. | `docs/PRD.md`, `docs/ROADMAP.md`, Jira |
| **Giro a Elevation + Skill Map (octubre 2026)** | Acompañamiento emocional **no clínico** más orientación profesional con evidencias, para profesionales adultos en reconversión; piloto de seis personas, cinco en español y una en inglés, financiado por el fundador. | PRD v0.3, canvas v0.2 |
| **Hoy** | Staging en Railway con el producto anterior funcionando y las bases del Corte 1 (despliegue, CI, QA). Todo el Skill Map y lo nuevo del PRD está **por construir**. | Este documento |

**Lo que Mauricio pidió tener claro [Decisión]:** el Skill Map **no es otro producto aparte**: se añade a Elevation y queda **ligado con los chats y con la parte psicológica** de la aplicación.

## 2. El producto de hoy, verificado en el código

### 2.1 Quién usa la plataforma [Código]
Roles del sistema: persona usuaria, **terapeuta** (psicólogo/a), administrador, superadministrador y miembro del comité ético ("board").

### 2.2 Qué existe

| Módulo | Qué hace hoy | Evidencia | Notas |
| --- | --- | --- | --- |
| Registro e ingreso | Alta con nombre, correo y contraseña; bloqueo tras intentos fallidos. | `routes/auth.js` | El registro público crea siempre un usuario común (QA-57-03). |
| **Chat con IA** | Conversación con Claude. El prompt sale del baúl de prompts del terapeuta asignado o del prompt general de Elevation, y se le añade el Manifiesto Ético vigente. Guarda el historial cifrado y le da al modelo los últimos 20 mensajes. | `routes/chat.js`, `utils/crypto.js` | Funciona en staging (humo de QA, chat con Claude real). |
| Check-in y check-out de ánimo | Registra cómo llega y cómo sale la persona de una conversación. | `routes/mood.js` | Heredado del PRD anterior. |
| Calificación y recomendaciones | Estrellas por conversación; recomendaciones de bienestar generadas con IA. | `routes/ratings.js`, `routes/recommendations.js` | |
| Progreso y onboarding | Pantalla de progreso; onboarding de seis pasos temáticos. | `routes/progress.js`, `pages/Onboarding.tsx` | ES-14 lo va a sustituir. |
| **Terapeutas** | Panel con sus pacientes, alertas, historial, historia clínica, notas, resumen con IA y su propio prompt (con propuesta y aprobación de versiones). | `routes/therapistRoutes.js`, `pages/therapist/` | Es la "parte psicológica" actual. |
| Validación de terapeutas | Sube documentos académicos; un administrador o el comité los aprueba o rechaza. | `routes/validation.js`, `TherapistValidation.js` | No verifiqué el flujo completo. |
| Matching | La persona pide o elige terapeuta; un administrador confirma. | `routes/matching.js`, `MatchingModal.tsx` | |
| Sesiones con terapeuta | Programar, iniciar y terminar; notas; sala de video (Daily); resumen con IA al terminar. | `routes/sessions.js` | La videollamada requiere `DAILY_API_KEY` en el entorno; **no está cargada en staging**. |
| Planes y límites | Cuatro planes (Básico, Esencial, Plus, Pro) con límites de mensajes por día, sesiones por mes y acceso a progreso; solicitud de plan con aprobación de administrador. | `PricingPlan.js`, `utils/planLimits.js`, `routes/planRequests.js` | Los precios y textos son administrables; **los límites están fijos en el código por plan**. |
| Backoffice | Usuarios (crear, asignar terapeuta o plan, desbloquear, restablecer contraseña), métricas, baúl de prompts con versiones y aprobación, contenido de la landing, precios, manifiesto ético. | `routes/admin*.js`, `pages/admin/` | |
| Contenido editable de la landing | Textos de la landing por clave, en ES y EN, editables por superadmin. | `routes/landingContent.js` | |
| ES/EN | Textos de la aplicación en los dos idiomas. | `frontend/src/i18n/` | |

### 2.3 Lo que el material anterior dice que existe y **no encontré en el código**

| Dicho en | Qué dice | Qué encontré |
| --- | --- | --- |
| Roadmap (fase 1) | "Protocolo de detección de crisis ✅" | **Ninguna referencia a crisis o riesgo en `backend/`.** Puede vivir en el prompt (no lo verifiqué) o en el proyecto antiguo (`platform/`). |
| PRD anterior | Reflexiones guardadas con etiquetas, insights, exportación, derecho al olvido | **No hay diario, reflexiones ni exportación** en el backend. El PRD v0.3 coincide: faltan diario, consentimientos, trabajos de IA y anonimización. |
| Jira (ES-54) | Notificaciones y restablecimiento de contraseña | Solo hay un restablecimiento hecho por un administrador. **No hay correo saliente ni "olvidé mi contraseña"** en el backend. Va en ES-12 (correo transaccional). |
| HU-068 | Google Calendar | No hay integración en el backend. |

**Consecuencia para la landing:** no se puede anunciar diario privado, exportación, detección de crisis ni recordatorios como funciones disponibles. Hasta que existan, van como "próximamente" o no van.

## 3. El producto objetivo

### 3.1 Una plataforma, dos módulos ligados [Documento + Decisión]
**Elevation** es la experiencia principal: acompañamiento, chat, diario, ejercicios y la parte psicológica. **Skill Map** es el módulo profesional: capacidades con evidencia, rutas, experimento y plan. Quedan ligados por un **puente de consentimiento**.

### 3.2 Cómo se liga el Skill Map con el chat y la parte psicológica

1. **Conversación y diario** son privados de la persona (chat, diario, ejercicios).
2. La persona puede pedir una **síntesis privada** editable (brújula: valores, motivaciones, límites).
3. **Puente:** la persona elige, campo por campo, qué conclusión profesional pasa al dominio de carrera; ve la vista previa exacta y confirma. Solo cruza lo aprobado, nunca la transcripción, el diario ni indicadores de crisis (RF-04).
4. El **Skill Map** trabaja solo con lo autorizado y con las evidencias que la persona cuenta: capacidades candidatas, nivel vacío mientras no haya evidencia (RF-06).
5. El **profesional (psicólogo o facilitador)** ve únicamente el resumen profesional que la persona autoriza, da feedback sobre rutas y evidencias, y nunca ve lo privado (RF-11).
6. **Revocar** el permiso invalida lo derivado, que se recalcula con lo que sigue autorizado (RF-02, RF-04).

### 3.3 Qué queda fuera del MVP [Documento]
Terapia, diagnóstico, selección automática de personal, ranking entre personas, garantía de empleo, postulaciones automáticas, marketplace, aplicación móvil nativa.

## 4. Brechas: de lo que hay a lo que debe haber

| Área | Hoy [Código] | Debe ser [PRD] | Brecha | Tickets |
| --- | --- | --- | --- | --- |
| Identidad y roles | Roles por token, sin contrato de cuenta activa ni revocación | Identidad canónica, propiedad verificada en servidor | Grande | ES-18, ES-57 |
| Consentimiento | Aceptación general al registrarse | Consentimiento por propósito, con versión y revocación | Nueva | ES-19 |
| Conversación | Chat con prompt de terapeuta o general; tono socrático no garantizado | Tono socrático, silencios, ejercicios, límites no clínicos | Media | ES-13, ES-16, ES-21 |
| Diario | No existe | Diario privado editable, con contexto selectivo | Nueva | ES-15, ES-20 |
| Brújula y puente | No existen | Síntesis editable y puente autorizado | Nueva | ES-25, ES-26 |
| Evidencias y Skill Map | No existen | Evidencias con procedencia, mapa con nivel nulo, radar | Nueva | ES-27 a ES-30 |
| Rutas, experimento y plan | No existen | Catálogo curado, tres rutas, experimento, plan 7/30/90 | Nueva | ES-31 a ES-34 |
| Parte psicológica | Terapeutas con historia clínica, notas y resumen con IA | Facilitador sin acceso a lo privado; modelo clínico armonizado con el producto no clínico | **Contradicción: ver D-02** | ES-35 y decisión del PO |
| Planes | 4 planes con sesiones con terapeuta y límites fijos | [Decisión] se mantienen y son administrables | Textos y límites por revisar | ES-12 y landing |
| Seguridad y privacidad | Cifrado de mensajes; cabeceras de seguridad; P1 corregidos | Aislamiento probado con base real, exportación y eliminación | Media | ES-21, ES-23 |
| Correo y videollamada | No hay correo; video sin clave en staging | Correo transaccional, videollamadas, dominio | Media | ES-12 |
| Presupuesto de IA | No existe | Topes por persona, reintentos, costos | Nueva | ES-22 |
| Calidad de IA | Sin evaluación | 30 casos, mínimo 24/30 pertinentes | Nueva | ES-44, ES-46 |
| Diseño | Landing y pantallas del MVP anterior (serif, verdes, daisyUI sin instalar) | Sistema de diseño unificado con daisyUI; referencia visual editorial | Nueva | ES-37, ES-38, ES-60 a ES-67 y nuevas |

## 5. Decisiones abiertas

| ID | Decisión | Quién | Por qué |
| --- | --- | --- | --- |
| D-01 | **Precios: decidido [Decisión].** Se mantienen los cuatro planes actuales y son administrables. Pendiente: revisar que sus textos no prometan "proceso terapéutico" (el plan Plus lo dice hoy) y que los límites del Skill Map por plan estén definidos. | Alejo | El texto de un plan es una promesa pública. |
| D-02 | **La parte psicológica.** El terapeuta de hoy ve historia clínica, notas y resúmenes; el PRD v0.3 es no clínico y le niega al facilitador el acceso a lo privado. ¿Qué ve el psicólogo en la plataforma nueva, y cómo se presentan las "sesiones con terapeuta" de los planes? | Alejo y Mauricio | Define la sección para psicólogos, los planes y el diseño de su zona. |
| D-03 | Estado real de cada función antes de anunciarla en la landing. | Dev | No prometer lo no publicado. |
| D-04 | Cómo se da de alta un psicólogo y qué ve el visitante. | Mauricio | Botón "Unirme como profesional". |
| D-05 | Aliados e instituciones en la landing (B2B2C). | Alejo | Sección opcional. |
| D-06 | Qué se cuenta del piloto en público. | Alejo | Con seis personas, los datos pueden identificar a alguien. |
| D-07 | Ejemplo ilustrativo y su revisión por el especialista. | Alejo y especialista | Sección de la landing. |
| D-08 | Contacto, términos, URL de privacidad y recursos de ayuda por país verificados. | Mauricio y especialista | Pie de página y sección de límites. |
| D-09 | Qué pasa tras elegir una "puerta" en la landing sin duplicar el onboarding de ES-14. | Alejo, UX y Dev | Coherencia entre landing y plataforma. |
| D-10 | Sin analítica en la landing hasta que se apruebe. | Mauricio | Privacidad. |
| D-11 | **daisyUI: decidido [Decisión].** Es la librería de UI. Hoy no está instalada. Se instala dentro del trabajo de la landing (ES-61), acotada, sin cambiar el resto de la aplicación. | Mauricio | |

## 6. Alcance de la landing pública

**Qué es:** la "front office". La ve cualquier persona que llega por primera vez. Cuenta qué es Elevation y su objetivo, cómo funciona, qué ofrece a las personas y a los psicólogos, qué es el Skill Map, los planes y cómo vincularse. El texto de cada sección está en `ARQUITECTURA-Y-TEXTOS-LANDING.md`.

**Qué no es:** la zona de personas usuarias, la zona de psicólogos, el chat ni el backoffice. Llevan otro diseño. La landing solo enlaza a ellos.

**Historias:** ver Jira, épica ES-6 "Rediseño UX/UI". Orden de trabajo:
1. Diseño aprobado (ES-60), con daisyUI y la referencia visual.
2. Base visual (ES-61) y contenido editable (ES-66).
3. Secciones (ES-62 a ES-65 y las nuevas).
4. Planes y registro conectados al backend.
5. Aceptación de calidad (ES-67).

## 7. Orden de trabajo sugerido para todo el producto

1. **Corte 1:** línea base, despliegue, CI, QA y entorno de producción (en curso).
2. **Landing y sistema de diseño** (ES-37, ES-38, ES-60 a ES-67): puede avanzar en paralelo, porque solo toca la página pública.
3. **Base de confianza** (ES-18 a ES-23): identidad, consentimiento, privacidad, límites, presupuesto de IA, exportación y eliminación. **Todo lo nuevo depende de esto.**
4. **Conversación y diario** (ES-13 a ES-17).
5. **Puente y Skill Map** (ES-25 a ES-30).
6. **Rutas, experimento y plan** (ES-31 a ES-36).
7. **Evaluación y piloto** (ES-44 a ES-47).

## 8. Lo que no verifiqué

- El funcionamiento real de cada ruta: solo sé lo que QA probó en staging (registro, ingreso, chat, historial, precios, control de acceso).
- Si el prompt del chat ya contiene un protocolo de crisis.
- El flujo de alta y validación de psicólogos.
- Si las sesiones por video y el resumen con IA funcionan end to end.
- Las partes del PRD marcadas como pendientes de diseño técnico (worker, Redis, contratos de base).
