# HU-072 — Onboarding de 6 Pasos para Usuario Nuevo

> Sprint 7 | Must Have | 4 puntos
> Documentada: 3 de abril de 2026
> Aprobada por: Mauro Roldán
> **Completada: 3 de abril de 2026**
> Depende de: HU-061 (User Dashboard)

---

## Contexto

Cuando un usuario nuevo se registra, ya no va directo al dashboard sin guía. Esta HU implementa un onboarding de 6 pasos que presenta la plataforma, recoge preferencias y lleva al usuario a su primer check-in.

---

## Flujo de 6 pasos implementado

- **Paso 1 — Bienvenida:** Presenta los 3 pilares de Elevation (IA, terapeuta, usuario)
- **Paso 2 — Motivación:** Selector de tema principal (ansiedad, relaciones, autoconocimiento, hábitos, otro)
- **Paso 3 — Cómo funciona:** Explica el flujo diario check-in → chat → check-out
- **Paso 4 — Privacidad:** 4 puntos clave + checkbox de aceptación obligatorio
- **Paso 5 — ¿Terapeuta?:** Opción A (buscar terapeuta) o Opción B (explorar solo)
- **Paso 6 — ¡Listo!:** Mensaje personalizado según elección + botón al dashboard

---

## Archivos creados/modificados

- `backend/User.js` — campos `onboardingCompleted` y `motivation` agregados
- `backend/server.js` — endpoint `PUT /api/user/onboarding-complete` + `onboardingCompleted` en response del login
- `frontend/src/pages/Onboarding.tsx` — página nueva completa con stepper
- `frontend/src/pages/LoginPage.tsx` — redirect condicional según `onboardingCompleted`
- `frontend/src/App.tsx` — ruta `/app/onboarding` agregada

## Decisiones técnicas

- `onboardingCompleted` se retorna en el login response — el frontend decide el redirect sin fetch adicional
- El stepper usa estado local React — no requiere persistencia entre recargas
- Paso 5 no lanza matching real todavía — HU-060 lo completará
- Al completar, se llama el endpoint Y se guarda en localStorage como respaldo

---

## Criterios de aceptación

- [x] Onboarding se muestra solo a usuarios nuevos (onboardingCompleted = false)
- [x] Stepper de 6 pasos con navegación Anterior/Siguiente
- [x] Paso 2 guarda motivación del usuario
- [x] Paso 4 requiere aceptar términos para continuar
- [x] Paso 5 muestra opciones de matching (flujo completo en HU-060)
- [x] Al completar → onboardingCompleted = true, nunca vuelve a mostrar
- [x] Botón final lleva al dashboard

---
*Documentada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
*Completada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
