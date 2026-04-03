# HU-071 — Vista "Mi Terapeuta" (Usuario)

> Sprint 6A | Must Have | 3 puntos
> Documentada: 3 de abril de 2026
> Aprobada por: Mauro Roldán
> **Completada: 3 de abril de 2026**
> Depende de: HU-066 (TherapySession base), HU-061 (User Dashboard)

---

## Contexto

El usuario necesita saber quién es su terapeuta asignado, ver su perfil y ver sus próximas sesiones.

---

## Ruta

```
/app/my-therapist
```

Accesible desde:
- Header del dashboard: "Mi terapeuta"
- Widget "Próxima sesión" del dashboard

---

## Archivos creados/modificados

- `frontend/src/pages/MyTherapist.tsx` — página nueva completa
- `frontend/src/App.tsx` — ruta `/app/my-therapist` agregada bajo ProtectedRoute

## Decisiones técnicas

- Endpoint reutilizado: `GET /api/sessions/user/my-therapist` (ya existía en sessions.js de HU-066)
- No se creó endpoint nuevo — la lógica ya estaba implementada
- Botón videollamada se habilita automáticamente 15 min antes de `scheduledAt`
- Si `therapistProfile` es null: muestra "Perfil no completado aún" sin romper la UI
- Estado sin terapeuta muestra CTA de matching que redirige al dashboard

---

## Criterios de aceptación

- [x] Usuario ve nombre, email y perfil de su terapeuta asignado
- [x] Usuario ve sus próximas sesiones con el terapeuta
- [x] Botón "Entrar a videollamada" se habilita 15 min antes de la sesión
- [x] Usuario ve historial de sesiones completadas con su mood
- [x] Si no tiene terapeuta: muestra mensaje + botón de matching
- [x] Botón "Cambiar de terapeuta" navega al dashboard

---
*Documentada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
*Completada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
