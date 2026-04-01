# Elevation — Arquitectura Sprint 5 y Sprint 6

## 📋 Resumen Ejecutivo

**Sprint 5** implementa la plataforma clínica completa: gestión de fichas de pacientes, validación ética de prompts terapéuticos, y solicitud de ingreso de terapeutas.

**Sprint 6** integra calendario, videollamadas y sincronización con Google Calendar.

> Generado por Manus AI · Validado: 1 de abril de 2026

---

## 🗄️ Modelos de Datos Nuevos

### TherapySession
```js
{
  id, therapistId, patientId,
  scheduledAt, startedAt, endedAt,
  duration, // minutos
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
  meetingUrl, // Daily.co URL
  therapistNote,
  patientMoodAfter // 1-5
}
```

### ClinicalNote
```js
{
  id, therapistId, patientId, sessionId,
  title, content,
  isSharedWithPatient: Boolean,
  editHistory: [{ timestamp, editor, changes }]
}
```

### ClinicalDocument
```js
{
  id, patientId, uploadedBy,
  fileName, fileUrl, fileType,
  uploadedAt
}
```

### WellnessRecommendation
```js
{
  id, patientId, therapistId,
  title, description, icon,
  status: 'pending' | 'approved' | 'rejected',
  approvedAt
}
```

### TherapistApplication
```js
{
  id, email, name, phone, country,
  degree, institution, graduationYear, certificateUrl,
  therapyStreams: String[],
  yearsExperience, description, populations,
  status: 'submitted' | 'under_review' | 'approved' | 'rejected',
  reviewedBy, reviewedAt, rejectionReason,
  applicationNumber // 'ELV-2025-0847'
}
```

### CalendarSync
```js
{
  id, therapistId,
  googleCalendarId,
  accessToken, // encrypted
  refreshToken, // encrypted
  lastSyncAt, isActive
}
```

---

## 🔌 Arquitectura de API

### `/api/clinical/*` — Plataforma clínica
- `GET /api/clinical/user/:userId/progress` — Dashboard Mi Progreso
- `GET /api/clinical/user/:userId/file` — Ficha clínica completa
- `POST /api/clinical/user/:userId/note` — Crear nota clínica
- `POST /api/clinical/user/:userId/recommendation/:id/approve` — Aprobar recomendación
- `PUT /api/clinical/user/:userId/document` — Subir documento

### `/api/therapist/*` — Terapeuta
- `GET /api/therapist/:id/patients` — Lista de pacientes
- `GET /api/therapist/:id/prompt` — Prompt activo + historial
- `POST /api/therapist/:id/prompt/propose` — Proponer cambio
- `GET /api/therapist/:id/calendar` — Sesiones del mes
- `POST /api/therapist/:id/session` — Crear sesión
- `POST /api/therapist/:id/session/:sessionId/checkout` — Finalizar sesión
- `POST /api/therapist/:id/google-calendar/sync` — Sincronizar con Google Calendar

### `/api/junta/*` — Junta Ética
- `GET /api/junta/therapists/pending` — Solicitudes pendientes
- `POST /api/junta/therapist/:appId/approve` — Aprobar terapeuta
- `POST /api/junta/therapist/:appId/reject` — Rechazar con nota
- `GET /api/junta/prompts/pending` — Prompts en revisión ética
- `POST /api/junta/prompt/:id/approve-ethics` — Aprobar éticamente
- `POST /api/junta/prompt/:id/reject-ethics` — Rechazar con nota
- `GET /api/junta/manifest` — Manifiesto Ético actual
- `PUT /api/junta/manifest` — Actualizar Manifiesto

### `/api/public/*` — Público
- `POST /api/public/therapist/apply` — Solicitud de ingreso de terapeuta
- `GET /api/public/landing/:page/:language` — Contenido de página

---

## 🔐 Flujos principales

### Aprobación de terapeuta
```
Solicitud → Email confirmación → Junta revisa docs
→ Aprueba → Terapeuta crea prompt → Revisión técnica + ética en paralelo
→ Ambos aprueban → Terapeuta activo
```

### Sesión terapéutica
```
Terapeuta crea sesión → Sistema genera URL Daily.co + sincroniza Google Calendar
→ Sesión en vivo (videollamada + notas) → Checkout (mood + nota + recomendaciones)
→ Registra en ClinicalFileChangeLog
```

---

## 📱 Responsive

| Pantalla | Desktop | Mobile |
|---|---|---|
| MyProgress | — | ✅ mobile-first |
| ClinicalFile | ✅ sidebar+main | — |
| TherapistPrompt | ✅ sidebar+main | — |
| EthicsReview | ✅ sidebar+main | — |
| TherapistApplication | ✅ | ✅ responsive |
| TherapistCalendar | ✅ sidebar+main | — |
| VideoSession | ✅ video+sidebar | ✅ video full |

---

## 📈 Integraciones externas Sprint 6

- **Google Calendar:** OAuth 2.0, sincronización bidireccional
- **Daily.co:** URL generada por sesión, JWT con expiración 24h
- **Claude Haiku:** Prompt personalizado por terapeuta desde PromptVault

---
*Generado por Manus AI · Validado: 1 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
