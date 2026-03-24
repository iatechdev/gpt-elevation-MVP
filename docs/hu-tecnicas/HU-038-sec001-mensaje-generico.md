# HU-038 — SEC-001: Mensaje genérico en login + rate limiting

> Sprint 3 | Must Have | 2 puntos  
> Aprobada por Mauro Roldán — 24 marzo 2026  
> Referencia: `docs/hu-tecnicas/SEC-001-user-enumeration.md`

---

## Descripción

Como equipo de seguridad, necesitamos corregir el hallazgo SEC-001 (User Enumeration) unificando los mensajes de error del login y aplicando rate limiting por IP.

---

## Problema actual

El endpoint `POST /api/login` retorna mensajes distintos según el caso:
- `"Usuario no encontrado"` → el atacante sabe que el email no existe
- `"Contraseña incorrecta"` → el atacante sabe que el email sí existe

Esto permite enumerar usuarios válidos del sistema.

---

## Criterios de aceptación

### Backend
- [ ] Mensaje unificado en todos los casos de error: `"Credenciales incorrectas"`  
  (en producción — el log interno puede seguir siendo detallado)
- [ ] Rate limiting por IP: máximo 10 intentos por minuto en `/api/login`
- [ ] Después de 10 intentos: HTTP 429 con mensaje `"Demasiados intentos. Intentá más tarde."`
- [ ] El bloqueo por IP es independiente del bloqueo por cuenta (HU-024)
- [ ] Tiempo de respuesta del login normalizado (evitar timing attacks): mínimo 200ms siempre

### Frontend
- [ ] Mostrar mensaje unificado recibido del backend sin modificarlo
- [ ] En caso de HTTP 429: mostrar mensaje de rate limit con countdown visual opcional

---

## Cambios en backend/server.js

```js
// 1. Instalar express-rate-limit
// npm install express-rate-limit

const rateLimit = require('express-rate-limit')

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minuto
  max: 10,                   // máx 10 intentos
  message: { error: 'Demasiados intentos. Intentá más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.post('/api/login', loginLimiter, async (req, res) => {
  // ...
  // ANTES: res.status(404).json({ error: 'Usuario no encontrado' })
  // DESPUÉS:
  if (!user || !passwordMatch) {
    await delay(200) // normalizar tiempo de respuesta
    return res.status(401).json({ error: 'Credenciales incorrectas' })
  }
})

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

---

## Archivos modificados

- `backend/server.js` — mensajes unificados + rate limiter
- `frontend/src/pages/LoginPage.tsx` — display mensaje unificado

---

## Definición de hecho

- [ ] Email inexistente y contraseña incorrecta retornan exactamente el mismo mensaje y status code
- [ ] 11 intentos seguidos desde la misma IP → HTTP 429
- [ ] El log interno del servidor sigue mostrando el motivo real (para debugging)
- [ ] No hay regresión en el flujo de login exitoso
- [ ] HU-024 (bloqueo por cuenta) sigue funcionando correctamente en paralelo

---
*Documentado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
