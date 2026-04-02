# HU-050 — Historia Clínica del Cliente

> Sprint 5 | Must Have | 8 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán

---

## Contexto

El terapeuta necesita una vista completa de cada paciente que va más allá del historial emocional básico implementado en HU-046. La historia clínica incluye notas del terapeuta, resumen generado por IA y el historial emocional completo.

---

## Modelo nuevo — ClinicalNote

```js
ClinicalNote: {
  id:          INTEGER (PK)
  UserId:      INTEGER (FK → User) — el paciente
  therapistId: INTEGER (FK → User) — el terapeuta que escribe
  content:     TEXT (encriptado con AES-256)
  type:        STRING — 'session_note' | 'observation' | 'goal'
  sessionDate: DATE
  createdAt:   DATE
  updatedAt:   DATE
}
```

**Importante:** El campo `content` se encripta con AES-256 al guardar — datos de salud mental, nunca en claro en la BD.

---

## Endpoints nuevos

```
GET  /api/therapist/pacientes/:id/historia     ← historia clínica completa
POST /api/therapist/pacientes/:id/notas        ← crear nota clínica
PUT  /api/therapist/notas/:noteId              ← editar nota
GET  /api/therapist/pacientes/:id/resumen-ia  ← resumen generado por IA
```

### GET /api/therapist/pacientes/:id/historia
Retorna:
- Datos del paciente (name, email, createdAt, therapistId)
- MoodLogs últimos 60 días
- SessionRatings últimos 60 días
- ClinicalNotes del terapeuta (desencriptadas)
- Resumen IA (si existe)

### POST /api/therapist/pacientes/:id/notas
Body:
```json
{
  "content": "El paciente muestra avances en regulación emocional...",
  "type": "session_note",
  "sessionDate": "2026-04-02"
}
```
El backend encripta `content` antes de guardar.

---

## Frontend — TherapistPatient.tsx (ampliar)

Agregar al detalle del paciente:

### Sección: Notas clínicas
```
[+ Nueva nota]  [Tipo: Todas ▼]

┌─────────────────────────────────┐
│ 02 abr 2026 · Nota de sesión    │
│ El paciente muestra avances...  │
│ [Editar]                        │
└─────────────────────────────────┘
```

### Sección: Resumen IA
```
[Generar resumen con IA]

Último resumen: 01 abr 2026
"El paciente ha mostrado una tendencia positiva..."
```

---

## Criterio de aceptación

- [ ] Terapeuta puede crear notas clínicas para sus pacientes
- [ ] Las notas se guardan encriptadas en la BD
- [ ] Terapeuta puede editar sus propias notas
- [ ] Terapeuta puede ver el historial completo: moods + ratings + notas
- [ ] Terapeuta puede generar un resumen IA del paciente
- [ ] Solo el terapeuta asignado puede ver las notas de un paciente

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
