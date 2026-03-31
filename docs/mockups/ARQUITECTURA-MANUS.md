# Arquitectura de Elevation — Generada por Manus
> Fuente: Manus AI basado en prompt maestro de Elevation
> Validado: 31 de marzo de 2026

---

## Modelo de Datos (ERD)

```mermaid
erDiagram
    User {
        int id PK
        string name
        string email
        string password
        string role "user, therapist, admin, superadmin, junta"
        int loginAttempts
        date lockedUntil
        boolean active
        int therapistId FK
        string speciality
        string academicTitle
        jsonb therapyStreams
        boolean validatedByJunta
        date validatedAt
    }
    UserProfile {
        int id PK
        int UserId FK
        jsonb wellnessAreas
        jsonb specificTopics
        text mainIntention
        string preferenceMode
        boolean onboardingDone
        date onboardingAt
    }
    MoodLog {
        int id PK
        int UserId FK
        int checkInScore
        int checkOutScore
        text checkInNotes
        text checkOutNotes
        date createdAt
    }
    TherapySession {
        int id PK
        int TherapistId FK
        int UserId FK
        date scheduledAt
        int durationMinutes
        string googleEventId
        text meetUrl
        string status
    }
    SessionRating {
        int id PK
        int UserId FK
        int TherapySessionId FK
        int rating
        text feedback
        date createdAt
    }
    Message {
        int id PK
        int UserId FK
        text content
        string sender
        date createdAt
    }
    PromptVault {
        int id PK
        string key
        text contentEncrypted
        int version
        string status
        boolean isActive
        string promptType
        int therapistId FK
        string proposed_by
        string approved_by
        string ethics_approved_by
        date ethics_approved_at
        text rejection_note
    }
    LandingContent {
        int id PK
        string page
        string key
        string lang
        text value
        string updated_by
        date updatedAt
    }
    WellnessRecommendation {
        int id PK
        int UserId FK
        int therapistId FK
        text content
        string source
        int approvedBy FK
        date approvedAt
        boolean visibleToUser
        date createdAt
    }
    ClinicalNote {
        int id PK
        int TherapistId FK
        int UserId FK
        text content
        date sessionDate
        boolean isPrivate
        date createdAt
    }
    ClinicalDocument {
        int id PK
        int UserId FK
        int TherapistId FK
        string fileName
        text fileUrl
        string fileType
        int uploadedBy FK
        date createdAt
    }

    User ||--o| UserProfile : "has one"
    User ||--o{ User : "therapist -> patients"
    User ||--o{ MoodLog : "logs"
    User ||--o{ TherapySession : "attends"
    User ||--o{ SessionRating : "gives"
    TherapySession ||--o| SessionRating : "receives"
    User ||--o{ Message : "sends"
    User ||--o{ PromptVault : "owns"
    User ||--o{ WellnessRecommendation : "receives"
    User ||--o{ ClinicalNote : "has"
    User ||--o{ ClinicalDocument : "owns"
```

---

## Arquitectura de la API

### `/api/user/*` — Perfil y progreso del usuario
- `GET /api/user/profile`
- `POST /api/user/onboarding`
- `PUT /api/user/preference`
- `GET /api/user/progress`
- `GET /api/user/recommendations`
- `GET /api/user/therapist`

### `/api/mood/*` — Emociones y chat
- `POST /api/mood/check-in`
- `POST /api/mood/check-out`
- `POST /api/mood/chat`
- `POST /api/mood/rate`

### `/api/therapist/*` — Panel del terapeuta
- `GET /api/therapist/patients`
- `GET /api/therapist/patients/:id`
- `GET /api/therapist/patients/:id/notes`
- `POST /api/therapist/patients/:id/notes`
- `GET /api/therapist/patients/:id/recommendations`
- `PUT /api/therapist/recommendations/:id/approve`
- `POST /api/therapist/sessions`
- `POST /api/therapist/prompt`

### `/api/admin/*` — Backoffice
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id/role`
- `PUT /api/admin/users/:id/assign-therapist`
- `GET /api/admin/content/:page`
- `PUT /api/admin/content/:page`
- `GET /api/admin/metrics`
- `GET /api/admin/prompts`
- `PUT /api/admin/prompts/:id/technical-review`

### `/api/junta/*` — Junta Ética
- `GET /api/junta/therapists/pending`
- `PUT /api/junta/therapists/:id/validate`
- `GET /api/junta/prompts/pending`
- `PUT /api/junta/prompts/:id/ethics-review`
- `PUT /api/junta/manifesto`

---

## Lógica de contenido dinámico

1. **BD:** `LandingContent` con `(page, key, lang)` único
2. **Frontend:** fetch a `/api/content/:page?lang=es` al cargar
3. **Fallback:** si falla la API → usa `constants/defaults.ts`
4. **Backoffice:** admin edita → `PUT /api/admin/content/:page`
5. **Bilingüe:** query param `?lang=es` o `?lang=en`

---
*Generado por Manus AI · Validado: 31 de marzo de 2026*
