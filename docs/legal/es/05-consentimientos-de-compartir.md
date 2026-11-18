# Consentimientos para compartir y para lectura por IA (puente profesional y afines)

> **BORRADOR SIN REVISIÓN LEGAL** · versión de trabajo `2026-11-v2` · ES-335 · 18-nov-2026.
> Reúne los textos de consentimiento por propósito del sistema (contrato 14, contrato 19 y los textos de la interfaz vigentes). Cada permiso es **independiente**, **revocable** y queda registrado con propósito, alcance, versión y fecha. No hay un consentimiento global ni una casilla que los dé todos juntos.
> Marcadores: `[POR COMPLETAR PC-nn]` y `[VERIFICAR VF-nn]`; lista en `../POR-COMPLETAR.md`.

## Reglas comunes a todos los permisos

1. **Es tu decisión y puedes retirarla cuando quieras.** Retirar un permiso no cambia tu acceso a Elevation ni tus otras opciones.
2. **Cada permiso es independiente.** Dar uno no da otros; rechazar uno no bloquea el uso necesario de la aplicación ni las demás funciones.
3. **Solo se comparte lo que autorizas, y solo con quien autorizas.** El permiso de compartir con un profesional o revisor queda ligado a **esa persona**: si cambia, la nueva persona no hereda la autorización.
4. **Lo privado sigue privado.** Tus conversaciones, tu diario y cualquier indicio de crisis **nunca** llegan al motor profesional ni a terceros por ningún permiso.
5. **Una copia ya descargada no puede recuperarse automáticamente.** Si descargaste tus datos, retirar un permiso no borra esa copia.
6. **Si algo de lo que autorizaste cambia o desaparece** (por ejemplo, retiras la fuente), lo que dependía de ello queda marcado «para revisión».
7. Puedes ver el historial de tus decisiones (propósito, alcance, versión, fecha) en la aplicación.

## 1. Puente profesional (`professional_bridge`)

**Qué autorizas:** que los **textos que tú elijas** cruzar desde tu exploración privada hacia tu trabajo de carrera puedan ser leídos por tu profesional. Lo que cruza se elige **texto por texto** (con un máximo de 12 textos en total y 3 por categoría).

**Qué pasa si lo das:**
- Tu profesional puede ver únicamente los campos que cruzaste, con su versión y la fecha en que los autorizaste.
- Cada lectura queda registrada (qué claves y quién las consumió), nunca el texto ni una huella.
- Una idea propuesta por la IA es una **hipótesis**: nada cruza hasta que tú confirmes cada una.

**Qué no pasa:** no cruzan tus conversaciones, tu diario ni indicadores de crisis; un texto no compartible no se deja cruzar.

**Cómo lo retiras:** «Revocar» un texto o «Retirar todo». Desde ese momento tu profesional deja de ver tu perfil profesional autorizado.

## 2. Compartir con mi profesional (`therapist_sharing`)

**Qué autorizas:** que **tu profesional asignado** vea **tu correo, tu ánimo y tus valoraciones**. **No** verá tus chats, tu diario ni tu mapa de carrera.
El permiso está ligado a ese profesional (`therapist-<id>`).
**Cómo lo retiras:** desde «Compartir mis datos con mi profesional». Si no se puede confirmar el cambio, la interfaz te lo dice y te pide comprobar antes de continuar.

## 3. Compartir con el facilitador (`facilitator_sharing`)

**Qué autorizas:** compartir con el facilitador lo que se defina para ese fin. [VERIFICAR VF-12: el contrato 14 lista este propósito pero, a la fecha de redacción, no está claro que haya una función que lo consuma en producción; confirmar con Mauricio y, si no existe, retirar esta sección antes del lanzamiento.]

## 4. Revisión por un revisor (`professional_review`)

**Qué autorizas:** que **un revisor concreto** vea material que tú marcaste y registre una revisión, que podrás **objetar**. El permiso está ligado a ese revisor (`reviewer-<id>`) y se retira por revisor.
**Qué pasa si lo retiras:** deja de poder ver el material; sus revisiones ya registradas siguen siendo suyas y tú conservas el derecho de objetarlas. [VERIFICAR VF-13: confirmar con Mauricio el comportamiento exacto de las revisiones ya hechas tras el retiro.]
La función está «en validación»: tus objeciones se guardan y tu revisor puede verlas.

## 5. Lectura por la IA de mis fuentes (`insights_chat`, `insights_diary`, `insights_resume`, `resume_ai_reading`)

**Qué autorizas (por fuente, por separado):** que la IA lea **{tu chat | tu diario | tu hoja de vida}** para **proponerte ideas** sobre cómo eres y qué te mueve.
- Se leen **hasta 20 de tus mensajes más recientes** (no las respuestas del asistente), **hasta 10 de tus entradas de diario** más recientes, o el texto de la versión de la hoja de vida que elijas (**sin tus datos de contacto**).
- El texto que se lee lo procesa el proveedor de IA para generar las ideas. **A un profesional no llega nada.**
- Los textos que el sistema marca como de riesgo **se saltan**.
- Cada idea es una hipótesis con una frase tuya como cita. Nada se guarda ni llega a tu profesional sin que confirmes cada idea.
- **Retirar el permiso no borra** tus hojas de vida; eso se hace aparte. Retirar `resume_ai_reading` sí borra tus hojas de vida analizadas [VERIFICAR VF-14: el comentario del código dice que retirarlo borra las hojas de vida, mientras el texto de la interfaz dice que no; confirmar con Mauricio cuál es el comportamiento real y alinear el texto].

## 6. Notificaciones (`notifications`)
Recibir avisos de la plataforma. Es opcional y revocable. [VERIFICAR VF-15: confirmar con Mauricio qué notificaciones se envían hoy y por qué canal.]

## 7. Investigación (`research`)
Existe como opción separada y opcional, **independiente** de «Tu opinión» (documento 06). Hoy ninguna función la utiliza. [VERIFICAR VF-06: confirmar con Alejo si habrá un uso de investigación; de haberlo, redactarlo aquí antes de ofrecerlo.]

## 8. Permiso «necesario» (`necessary`)
Cubre la operación necesaria para usar la aplicación (cuenta, sesión, seguridad). Es obligatorio y solo se termina eliminando la cuenta.
