# HU-061 — User Dashboard: Layout + Widget Estado Emocional

> Sprint 6 | Must Have | 3 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán
> Referencia visual: Manus design — /dashboard

---

## Contexto

Primer paso del dashboard unificado. Crear el layout base y el widget de estado emocional (check-in rápido integrado).

---

## Nueva ruta

`/app/dashboard` — home principal del usuario después del login.

Flujo actualizado:
- Login exitoso → `/app/dashboard` (ya no va a `/app/checkin`)
- `/app/checkin` queda como ruta legacy pero el check-in vive en el dashboard

---

## Layout

```
Header: [Logo] [Mi progreso] [Mi terapeuta] [Perfil]

Body (dos columnas):
┌─────────────────┬──────────────────────────┐
│ Columna izq 40% │ Columna der 60%          │
│ Widget 1        │ Chat con Elevation IA    │
│ Widget 2        │ (mismo que /app/chat)    │
│ Widget 3        │                          │
└─────────────────┴──────────────────────────┘

Sección inferior:
[Recomendaciones personalizadas 2x2]
```

---

## Widget 1 — Estado emocional

```
♡ Estado emocional
[😞] [😔] [😐] [🙂] [😊]
```

- Al seleccionar emoji: guarda checkin_mood via POST /api/mood/checkin
- Si ya hizo check-in hoy: muestra el emoji seleccionado destacado en verde, no permite cambiar
- Si no hizo check-in: chat deshabilitado con mensaje "Seleccioná cómo llegás hoy para empezar"

---

## Criterios de aceptación

- [ ] Nueva ruta /app/dashboard funcionando
- [ ] Login redirige a /app/dashboard en lugar de /app/checkin
- [ ] Layout de dos columnas responsivo
- [ ] Header con Mi progreso (→/app/progress), Mi terapeuta (placeholder), Perfil (placeholder)
- [ ] Widget estado emocional funcional con los 5 emojis
- [ ] Check-in guarda correctamente en BD
- [ ] Chat visible en columna derecha y funcional

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
