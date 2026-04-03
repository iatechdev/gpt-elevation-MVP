# HU-067 — Videollamada con Daily.co

> Sprint 6B | Must Have | 8 puntos
> Documentada: 3 de abril de 2026
> Aprobada por: Mauro Roldán
> **Depende de: HU-066 (TherapySession base)**

---

## Contexto

Con TherapySession como base, el terapeuta puede iniciar una videollamada con Daily.co directamente desde su dashboard. Al finalizar, hace checkout con nota clínica y mood del paciente.

---

## Flujo completo

```
1. Terapeuta ve en dashboard: [Juan García — Hoy 3:00 PM → Iniciar sesión]
2. Click en "Iniciar sesión" → POST /api/therapist/sessions/:id/start
3. Backend genera sala en Daily.co → retorna meetingUrl
4. Frontend embebe iframe de Daily.co con la URL
5. Paciente recibe notificación (Sprint 6C) con link a /app/session/:id
6. Ambos entran a la videollamada
7. Terapeuta puede escribir notas en sidebar durante la llamada
8. Al terminar: botón "Finalizar sesión" → modal de checkout
9. Checkout: therapistNote + patientMoodAfter → POST /api/therapist/sessions/:id/end
10. IA genera recomendaciones basadas en la sesión → WellnessRecommendation
```

---

## Backend

### Endpoints nuevos:

```
POST /api/therapist/sessions/:id/start
  Auth: verificarToken (role=therapist)
  Acción:
    1. Verifica que session.status === 'scheduled'
    2. Llama Daily.co API para crear sala
    3. Guarda meetingUrl en TherapySession
    4. Cambia status a 'in_progress'
    5. Guarda startedAt = now()
  Retorna: { meetingUrl }

POST /api/therapist/sessions/:id/end
  Body: { therapistNote, patientMoodAfter }
  Auth: verificarToken (role=therapist)
  Acción:
    1. Verifica que session.status === 'in_progress'
    2. Guarda therapistNote (encriptado), patientMoodAfter, endedAt = now()
    3. Cambia status a 'completed'
    4. Llama Claude Haiku para generar WellnessRecommendation para el paciente
  Retorna: { session, recommendations }

POST /api/therapist/sessions/:id/notes
  Body: { content }
  Auth: verificarToken (role=therapist)
  Acción: Crea SessionNote (content encriptado)
  Retorna: { note }

GET /api/user/sessions/:id/join
  Auth: verificarToken (role=user)
  Valida: session.patientId === req.user.id
  Retorna: { meetingUrl } — para que el paciente pueda entrar
```

### Variable de entorno nueva:
```
DAILY_API_KEY=tu_api_key_de_daily_co
```

### Llamada a Daily.co API:
```js
// Crear sala
const response = await fetch('https://api.daily.co/v1/rooms', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
  },
  body: JSON.stringify({
    name: `elevation-${therapistId}-${patientId}-${sessionId}`,
    properties: {
      exp: Math.round(Date.now() / 1000) + 3600, // expira en 1 hora
      enable_recording: 'cloud', // opcional
    },
  }),
})
const room = await response.json()
return room.url // → https://elevation.daily.co/elevation-1-8-42
```

---

## Frontend

### Páginas nuevas:
- `frontend/src/pages/therapist/SessionRoom.tsx` — sala de videollamada para el terapeuta
- `frontend/src/pages/user/SessionRoom.tsx` — vista del paciente para unirse

### Layout de la sala (terapeuta):
```
┌─────────────────────────────────────┬──────────────────┐
│                                     │ 📝 Notas en vivo │
│   Daily.co iframe (videollamada)    │                  │
│                                     │ [Textarea...]    │
│                                     │                  │
│   ⏱ 00:32:15  [🎤] [📷] [🖥️]       │ Historial mood:  │
│                                     │ 😐 😔 🙂 😐 🙂   │
│              [Finalizar sesión]     │                  │
└─────────────────────────────────────┴──────────────────┘
```

### Modal de checkout (al finalizar):
```
¿Cómo fue la sesión?

Mood del paciente al finalizar:
[😞] [😔] [😐] [🙂] [😊]

Nota clínica:
[Textarea mínimo 10 caracteres...]

[Cancelar]  [Guardar y finalizar]
```

### Rutas nuevas en App.tsx:
```
/therapist/session/:id   → SessionRoom (terapeuta)
/app/session/:id         → SessionRoom (usuario/paciente)
```

---

## Criterios de aceptación

- [ ] Terapeuta puede iniciar sesión desde el dashboard → se genera sala Daily.co
- [ ] iframe de Daily.co se embebe correctamente
- [ ] Terapeuta puede escribir notas en vivo (auto-save cada 2s)
- [ ] Timer muestra duración de la sesión en tiempo real
- [ ] Modal de checkout funciona con mood + nota clínica
- [ ] Al finalizar, se generan recomendaciones IA para el paciente
- [ ] Usuario puede unirse a la sesión desde /app/session/:id
- [ ] TherapySession queda con status='completed' al finalizar

---
*Documentada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
