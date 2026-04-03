# HU-072 — Onboarding de 6 Pasos para Usuario Nuevo

> Sprint 7 | Must Have | 4 puntos
> Documentada: 3 de abril de 2026
> Aprobada por: Mauro Roldán
> Depende de: HU-061 (User Dashboard)

---

## Contexto

Hoy cuando un usuario nuevo se registra, va directo al dashboard sin ninguna guía. Esta HU implementa un onboarding de 6 pasos que:
- Presenta la plataforma
- Recoge preferencias iniciales
- Explica el flujo (check-in → chat → check-out)
- Lleva al usuario a hacer su primer check-in

El onboarding solo se muestra una vez — cuando el usuario no ha completado onboarding todavía.

---

## Flujo de 6 pasos

```
Paso 1 — Bienvenida
  "Bienvenido/a a Elevation"
  Explicación del concepto: IA + terapeuta + vos

Paso 2 — ¿Qué te trajo hasta acá?
  Selector de motivación: ansiedad / relaciones / autoconocimiento / hábitos / curiosidad
  (Guardado en perfil para personalizar)

Paso 3 — Así funciona Elevation
  Explicación del flujo diario: check-in → chat → check-out
  Ilustración simple del proceso

Paso 4 — Tu privacidad
  Resumen de la política de datos en lenguaje simple
  Checkbox: "Entendido, acepto los términos"

Paso 5 — ¿Querés trabajar con un terapeuta?
  Opción A: "Sí, quiero encontrar mi terapeuta" → abre matching
  Opción B: "Por ahora solo quiero explorar" → continúa sin terapeuta

Paso 6 — ¡Listo!
  Mensaje de bienvenida personalizado
  Botón: "Empezar mi primer check-in"
```

---

## UI — Stepper

```
┌─────────────────────────────────────────┐
│  ELEVATION                              │
│                                         │
│  ●──●──●──●──●──● Paso 3 de 6          │
│                                         │
│  Así funciona Elevation                 │
│                                         │
│  [Contenido del paso]                   │
│                                         │
│  [← Anterior]      [Siguiente →]        │
└─────────────────────────────────────────┘
```

---

## Lógica de activación

- Se muestra cuando `user.onboardingCompleted === false` (campo nuevo en modelo User)
- Al completar el paso 6 → `PUT /api/user/onboarding-complete`
- Se guarda en BD y en localStorage para no volver a mostrar

---

## Backend

### Campo nuevo en modelo User:
```
onboardingCompleted: Boolean, default: false
```

### Endpoint:
```
PUT /api/user/onboarding-complete
Body: { motivation: string }
Actualiza: User.onboardingCompleted = true, User.motivation = motivation
```

---

## Criterios de aceptación

- [ ] Onboarding se muestra solo a usuarios nuevos (onboardingCompleted = false)
- [ ] Stepper de 6 pasos con navegación Anterior/Siguiente
- [ ] Paso 2 guarda motivación del usuario
- [ ] Paso 4 requiere aceptar términos para continuar
- [ ] Paso 5 integra el modal de matching (HU-060)
- [ ] Al completar → onboardingCompleted = true, nunca vuelve a mostrar
- [ ] Botón final lleva al primer check-in

---
*Documentada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
