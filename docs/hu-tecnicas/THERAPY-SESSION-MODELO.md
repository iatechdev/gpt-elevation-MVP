# TherapySession — Modelo Base del MVP

> Documentado: 3 de abril de 2026
> Aprobado por: Mauro Roldán
> Basado en: documento de Alejo Roldán + diseño Manus
> Estado: PENDIENTE DE IMPLEMENTACIÓN — Sprint 6A

---

## Por qué TherapySession es el diferenciador de Elevation

Actualmente en Elevation una "sesión" es implícita — existe solo como un MoodLog del día. Eso funciona para el chat libre, pero no permite:

- Que el terapeuta **agende** una sesión futura
- Que el usuario vea **cuándo es su próxima sesión**
- Que se genere una **sala de videollamada** para un momento específico
- Que se sincronice con **Google Calendar**
- Que haya un **registro clínico formal** de cada encuentro

TherapySession convierte a Elevation de un "chat con IA" a una **plataforma clínica real**.

---

## Modelo de datos

```js
// backend/TherapySession.js

TherapySession: {
  id:               INTEGER (PK, autoincrement)
  therapistId:      INTEGER (FK → User.id, role='therapist')
  patientId:        INTEGER (FK → User.id, role='user')
  scheduledAt:      DATE    — fecha y hora programada
  startedAt:        DATE    — cuando el terapeuta inició la sesión (null hasta entonces)
  endedAt:          DATE    — cuando se finalizó (null hasta entonces)
  duration:         INTEGER — duración en minutos (default: 50)
  status:           STRING  — 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  meetingUrl:       STRING  — URL de Daily.co (null hasta que se inicia)
  recordingUrl:     STRING  — URL de grabación (opcional, null si no se graba)
  therapistNote:    TEXT    — nota clínica del terapeuta (encriptada AES-256)
  patientMoodAfter: INTEGER — mood del paciente al finalizar (1-5)
  cancelReason:     STRING  — razón de cancelación (opcional)
  googleEventId:    STRING  — ID del evento en Google Calendar (null si no sincronizado)
  createdAt:        DATE
  updatedAt:        DATE
}
```

---

## Asociaciones con modelos existentes

```
User (therapist) ──── hasMany ──→ TherapySession (como therapistId)
User (patient)   ──── hasMany ──→ TherapySession (como patientId)
TherapySession   ──── hasMany ──→ SessionNote
TherapySession   ──── hasOne  ──→ MoodLog (el checkout del paciente post-sesión)
```

### Modelos adicionales que necesita TherapySession:

```js
// backend/SessionNote.js — notas en vivo durante la sesión
SessionNote: {
  id:          INTEGER (PK)
  sessionId:   INTEGER (FK → TherapySession.id)
  therapistId: INTEGER (FK → User.id)
  content:     TEXT (encriptado AES-256)
  timestamp:   DATE
  createdAt:   DATE
}

// backend/CalendarSync.js — sincronización con Google Calendar
CalendarSync: {
  id:               INTEGER (PK)
  therapistId:      INTEGER (FK → User.id, UNIQUE)
  googleCalendarId: STRING
  accessToken:      TEXT (encriptado AES-256)
  refreshToken:     TEXT (encriptado AES-256)
  lastSyncAt:       DATE
  isActive:         BOOLEAN (default: true)
  createdAt:        DATE
  updatedAt:        DATE
}
```

---

## Relación con modelos existentes

### MoodLog (ya existe)
El MoodLog existente registra check-in/checkout del chat libre.
Cuando hay una TherapySession:
- El `patientMoodAfter` se guarda en TherapySession (no en MoodLog)
- El MoodLog sigue existiendo para el chat libre diario
- **NO se elimina ni modifica el MoodLog existente**

### ClinicalNote (ya existe)
Las notas clínicas del terapeuta sobre el historial del paciente siguen en ClinicalNote.
Las `SessionNote` son notas **en tiempo real durante la videollamada** — son efímeras y privadas.

### WellnessRecommendation (ya existe)
Después de una TherapySession completada, se pueden generar WellnessRecommendation adicionales basadas en el contexto de la sesión (therapistNote + patientMoodAfter).

---

## Estados del ciclo de vida

```
[scheduled] → terapeuta agenda la sesión
    ↓
[in_progress] → terapeuta hace click en "Iniciar sesión", se genera meetingUrl
    ↓
[completed] → terapeuta hace checkout, se registra endedAt + therapistNote + patientMoodAfter
    
[cancelled] → cualquiera cancela antes de que inicie, se registra cancelReason
```

---

## Endpoints necesarios

### Para el terapeuta:
```
GET    /api/therapist/sessions                    — todas las sesiones del terapeuta
GET    /api/therapist/sessions/upcoming           — próximas sesiones (status='scheduled')
POST   /api/therapist/sessions                    — crear nueva sesión
PUT    /api/therapist/sessions/:id                — editar sesión (reschedule, cancel)
POST   /api/therapist/sessions/:id/start          — iniciar sesión (genera Daily.co URL)
POST   /api/therapist/sessions/:id/end            — finalizar sesión (checkout)
POST   /api/therapist/sessions/:id/notes          — agregar nota en tiempo real
GET    /api/therapist/sessions/:id/notes          — ver notas de la sesión
```

### Para el usuario (paciente):
```
GET    /api/user/sessions/upcoming                — próxima sesión del usuario
GET    /api/user/sessions                         — historial de sesiones
```

### Para Google Calendar (Sprint 6B):
```
POST   /api/therapist/google-calendar/auth        — iniciar OAuth
POST   /api/therapist/google-calendar/callback    — recibir token de Google
GET    /api/therapist/google-calendar/sync-status — estado de sincronización
POST   /api/therapist/google-calendar/sync        — forzar sincronización manual
```

---

## Impacto en el frontend por rol

### Usuario (paciente) — nuevo widget en Dashboard:
```
📅 Próxima sesión
Con [Nombre terapeuta]
[Fecha] — [Hora]
[Entrar a videollamada]  ← habilitado 15 min antes de scheduledAt
```
- Endpoint: GET /api/user/sessions/upcoming
- Si no tiene sesión agendada: "No tenés sesión programada"
- Si no tiene terapeuta: muestra botón 🤝 de matching

### Terapeuta — dashboard mejorado:
```
Mis pacientes:
[Juan García]  😐 Estable   Hoy, 3:00 PM      [Iniciar sesión]
[María López]  🙂 Mejorando  Mañana, 10:00 AM  [Ver ficha]
[Carlos Méndez] 😢 Decayendo  En 2 días         [Ver ficha]
```
- Endpoint: GET /api/therapist/sessions/upcoming
- El botón "Iniciar sesión" aparece solo cuando status='scheduled' y faltan ≤ 15 min

### Admin — sin cambios por ahora
- El admin puede ver TherapySessions en el listado de usuarios si es necesario
- No se construye UI de admin para sesiones en Sprint 6

---

## Orden de implementación (Sprint 6A)

1. **Crear `backend/TherapySession.js`** — modelo Sequelize
2. **Crear `backend/SessionNote.js`** — modelo Sequelize  
3. **Agregar asociaciones en `server.js`**
4. **Crear endpoints básicos** (CRUD de sesiones para terapeuta)
5. **Agregar endpoint GET /api/user/sessions/upcoming**
6. **Actualizar TherapistDashboard.tsx** — mostrar sesiones con botón Iniciar
7. **Actualizar UserDashboard (HU-061)** — widget próxima sesión

Después de esto, en Sprint 6B se agrega Daily.co y Google Calendar encima.

---

## Decisiones de arquitectura tomadas

| Decisión | Elección | Razón |
|---|---|---|
| UUID vs INTEGER para id | INTEGER (autoincrement) | Consistente con el resto de modelos del proyecto |
| therapistNote encriptado | Sí, AES-256 | Política de privacidad de datos clínicos |
| patientMoodAfter en TherapySession | Sí | El mood post-sesión es clínico, diferente al mood del chat libre |
| MoodLog se mantiene | Sí | No romper funcionalidad existente de chat libre |
| SessionNote separado | Sí | Las notas en vivo son efímeras, no deben mezclarse con ClinicalNote |
| CalendarSync separado | Sí | El token de Google es sensible y necesita manejo especial |
| Daily.co integración | iframe + JWT | Decisión previa documentada en Sprint 6 plan |

---

## HUs que dependen de TherapySession

| HU | Nombre | Depende de |
|---|---|---|
| HU-061 | User Dashboard | TherapySession (widget próxima sesión) |
| HU-062 | Therapist badges tendencia | TherapySession (sesiones completadas) |
| HU-064 | User widgets progreso | TherapySession (sesiones esta semana) |
| HU-065 | Therapist panel alertas | TherapySession (inactividad) |
| HU-066 | Calendario terapeuta | TherapySession (base de datos de sesiones) |
| HU-067 | Videollamada Daily.co | TherapySession (meetingUrl, status) |
| HU-068 | Google Calendar sync | TherapySession + CalendarSync |
| HU-071 | Vista "Mi terapeuta" (usuario) | TherapySession (próxima sesión) |

---
*Documentado: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
*Basado en: documento Alejo Roldán (Sprint 6 HUs) + diseño Manus*
