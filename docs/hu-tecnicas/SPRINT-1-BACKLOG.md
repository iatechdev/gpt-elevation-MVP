# Sprint 1 — Backlog Oficial

**Fechas:** Por definir  
**Objetivo del Sprint:** Implementar las funcionalidades del PRD que están documentadas pero no implementadas en el MVP actual.

> Estas HU vienen del PRD oficial y de los documentos de Drive. Son funcionalidades que el producto necesita para cumplir sus Reglas de Negocio.

---

## HU-020 — Check-in de Ánimo Obligatorio (RN-004)

**Épica:** Gestión del Bienestar Emocional  
**Story Points:** 5  
**Prioridad:** Must Have  
**Estado:** ⏳ Pendiente

**Como** usuario que inicia una nueva sesión de reflexión,  
**quiero** seleccionar un emoji que represente mi estado de ánimo,  
**para** preparar mi mente para el diálogo y que el sistema mida mi evolución emocional.

### Criterios de Aceptación

- **Given** que abro una nueva conversación, **when** el chat carga, **then** veo la pantalla de check-in con la pregunta *"¿Cómo llegas hoy?"* antes de poder escribir.
- **Given** que veo el check-in, **when** no he seleccionado un emoji, **then** el botón "Comenzar reflexión" está deshabilitado.
- **Given** que selecciono un emoji, **when** confirmo, **then** el sistema registra: user_id, conversation_id, entry_mood_score (0-4), timestamp_entry.
- **Given** que completé el check-in, **when** confirmo, **then** accedo al chat y puedo escribir mi primer mensaje.

### Notas Técnicas
- Tabla: `mood_logs` (user_id, conversation_id, entry_mood_score, exit_mood_score, timestamp_entry, timestamp_exit)
- Disparador: al crear una nueva conversación
- Los 5 emojis: 😊 Bien (4) · 🙂 Tranquilo (3) · 😐 Neutral (2) · 😔 Inquieto (1) · 😞 Mal (0)

---

## HU-021 — Check-out de Ánimo al Finalizar Conversación (RN-005)

**Épica:** Gestión del Bienestar Emocional  
**Story Points:** 3  
**Prioridad:** Must Have  
**Estado:** ⏳ Pendiente

**Como** usuario que termina una sesión de reflexión,  
**quiero** registrar cómo me siento después del diálogo,  
**para** que Elevation pueda medir si la sesión tuvo impacto positivo en mi estado.

### Criterios de Aceptación

- **Given** que presiono "Finalizar conversación", **when** se ejecuta el cierre, **then** veo la pantalla de check-out con la pregunta *"¿Cómo te sientes ahora?"*.
- **Given** que veo el check-out, **when** selecciono un emoji y confirmo, **then** se guarda exit_mood_score en mood_logs.
- **Given** que NO quiero registrar mi estado de salida, **when** presiono "Saltar", **then** exit_mood_score queda NULL y el cierre continúa.
- **Given** que cierro la app sin finalizar formalmente, **when** el sistema detecta inactividad de 24h, **then** la conversación se cierra automáticamente con exit_mood_score = NULL.

---

## HU-022 — Calificación de Experiencia con Estrellas (RN-009)

**Épica:** Experiencia de Usuario  
**Story Points:** 2  
**Prioridad:** Should Have  
**Estado:** ⏳ Pendiente

**Como** usuario que terminó una conversación,  
**quiero** calificar la experiencia con 1 a 5 estrellas,  
**para** dar feedback sobre la calidad del acompañamiento.

### Criterios de Aceptación

- **Given** que completé el check-out de ánimo, **when** confirmo, **then** veo la pantalla de calificación: *"¿Cómo calificarías esta experiencia?"* con 5 estrellas.
- **Given** que veo la calificación, **when** no quiero calificar, **then** puedo presionar "Saltar" y terminar.
- **Given** que selecciono una calificación y confirmo, **then** el dato se guarda asociado a la conversación.

---

## HU-023 — Búsqueda de Reflexiones por Palabra Clave (RN-015)

**Épica:** Reflexiones e Insights  
**Story Points:** 3  
**Prioridad:** Should Have  
**Estado:** ⏳ Pendiente

**Como** usuario con múltiples reflexiones guardadas,  
**quiero** buscar reflexiones por palabra clave,  
**para** encontrar rápidamente pensamientos específicos sin scrollear toda la lista.

### Criterios de Aceptación

- **Given** que estoy en la sección de reflexiones, **when** escribo en el campo de búsqueda, **then** la lista se filtra en tiempo real mostrando solo las reflexiones que contienen ese texto.
- **Given** que busco una palabra que no existe en mis reflexiones, **when** el resultado está vacío, **then** veo un mensaje empático: *"No encontramos reflexiones con esa búsqueda"*.
- **Given** que limpio el campo de búsqueda, **when** el campo está vacío, **then** vuelvo a ver todas mis reflexiones.

---

## HU-024 — Bloqueo Temporal tras Intentos Fallidos (RN-002)

**Épica:** Autenticación y Seguridad  
**Story Points:** 3  
**Prioridad:** Must Have  
**Estado:** ⏳ Pendiente

**Como** plataforma de Elevation,  
**quiero** bloquear temporalmente el acceso tras 3 intentos de login fallidos,  
**para** proteger las cuentas de los usuarios contra ataques de fuerza bruta.

### Criterios de Aceptación

- **Given** que un usuario falla 3 veces el login, **when** intenta el 4to intento, **then** ve el mensaje: *"Por seguridad, espera 15 minutos antes de intentar nuevamente"* y el formulario está bloqueado.
- **Given** que pasaron los 15 minutos, **when** el usuario intenta de nuevo, **then** el formulario se desbloquea y el contador se resetea.
- **Given** que el usuario ingresa correctamente antes del 3er intento fallido, **when** hace login exitoso, **then** el contador de intentos se resetea.

---

## HU-025 — Pantalla de Bienvenida (Primer Acceso) (RN-003)

**Épica:** Onboarding  
**Story Points:** 2  
**Prioridad:** Should Have  
**Estado:** ⏳ Pendiente

**Como** usuario que acaba de registrarse,  
**quiero** ver una pantalla de bienvenida que explique qué es Elevation,  
**para** entender el espacio antes de comenzar mi primera conversación.

### Criterios de Aceptación

- **Given** que soy un usuario nuevo que acaba de completar el registro, **when** accedo por primera vez, **then** veo la pantalla de bienvenida con máximo 3 oraciones explicando Elevation.
- **Given** que veo la bienvenida, **when** presiono "Saltar" o "Comenzar", **then** accedo al chat.
- **Given** que ya vi la bienvenida en mi primer acceso, **when** inicio sesión nuevamente, **then** NO veo la bienvenida (se muestra una sola vez).

---

## HU-026 — Scroll Automático en Chat (UX)

**Épica:** Experiencia de Usuario  
**Story Points:** 1  
**Prioridad:** Should Have  
**Estado:** ⏳ Pendiente

**Como** usuario inmerso en un diálogo extenso,  
**quiero** que la pantalla se desplace automáticamente al último mensaje,  
**para** no perder el hilo ni tener que hacer scroll manual.

### Criterios de Aceptación

- **Given** que llega un mensaje nuevo (mío o de Elevation), **when** el mensaje se renderiza, **then** el scroll baja automáticamente al final con animación suave (smooth).
- **Given** que el usuario hizo scroll hacia arriba para releer, **when** llega un mensaje nuevo, **then** el scroll baja al final.
