# HU-071 — Vista "Mi Terapeuta" (Usuario)

> Sprint 6A | Must Have | 3 puntos
> Documentada: 3 de abril de 2026
> Aprobada por: Mauro Roldán
> **Depende de: HU-066 (TherapySession base), HU-061 (User Dashboard)**

---

## Contexto

El usuario necesita saber quién es su terapeuta asignado, ver su perfil y ver sus próximas sesiones. Actualmente el therapistId está en el modelo User pero no hay ninguna vista que lo muestre al usuario.

---

## Ruta

```
/app/my-therapist
```

Accesible desde:
- Header del dashboard: "Mi terapeuta"
- Widget "Próxima sesión" del dashboard

---

## UI

```
┌─────────────────────────────────────────┐
│  ← Volver                    ELEVATION  │
└─────────────────────────────────────────┘

 Mi terapeuta

 ┌──────────────────────────────────────┐
 │  [Avatar]  Nombre del terapeuta      │
 │            email@ejemplo.com         │
 │                                      │
 │  Especialidades: Mindfulness, TCC    │
 │  Idiomas: Español, Inglés            │
 │  Bio: "..."                          │
 └──────────────────────────────────────┘

 Próximas sesiones
 ┌──────────────────────────────────────┐
 │  📅 Mañana, 3:00 PM — 50 min        │
 │  [Entrar a videollamada]  (15 min)   │
 └──────────────────────────────────────┘

 Sesiones anteriores
 ┌──────────────────────────────────────┐
 │  01 Abr — Completada  😊 Mood: 4/5  │
 │  25 Mar — Completada  🙂 Mood: 3/5  │
 └──────────────────────────────────────┘

 [¿Querés cambiar de terapeuta?]
 → Muestra modal de matching nuevamente
```

---

## Backend

### Endpoint nuevo:
```
GET /api/user/my-therapist
  Auth: verificarToken (role=user)
  Retorna:
  {
    therapist: {
      id, name, email,
      profile: { specialties, approach, languages, bio }
    },
    upcomingSessions: [{ id, scheduledAt, duration, meetingUrl, status }],
    pastSessions: [{ id, scheduledAt, patientMoodAfter, status }]
  }
  Si no tiene terapeuta: retorna { therapist: null }
```

---

## Criterios de aceptación

- [ ] Usuario ve nombre, email y perfil de su terapeuta asignado
- [ ] Usuario ve sus próximas sesiones con el terapeuta
- [ ] Botón "Entrar a videollamada" se habilita 15 min antes de la sesión
- [ ] Usuario ve historial de sesiones completadas con su mood
- [ ] Si no tiene terapeuta: muestra mensaje + botón de matching
- [ ] Botón "Cambiar de terapeuta" abre modal de matching

---
*Documentada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
