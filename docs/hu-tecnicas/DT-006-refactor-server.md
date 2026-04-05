# DT-006 — Refactorización server.js

> Estado: ✅ COMPLETADO
> Sprint: 8
> Responsable: Mauro Roldán + Claude (Tech Lead AI)
> Completado: 5 de abril de 2026

---

## Resultado

`backend/server.js` pasó de ~500 líneas monolíticas a **68 líneas de bootstrap puro**.
Todo el código duplicado fue eliminado de los routers existentes.
Arquitectura limpia — una sola fuente de verdad para crypto, Anthropic y middlewares JWT.

---

## Archivos creados

### Utils y middlewares (fuentes únicas de verdad)

| Archivo | Contenido |
|---|---|
| `backend/middlewares/auth.js` | `verificarToken`, `verificarAdmin`, `verificarSuperAdmin` |
| `backend/utils/crypto.js` | `encriptar`, `desencriptar` (AES-256-CBC) |
| `backend/utils/anthropic.js` | Cliente Anthropic singleton |

### Routers nuevos

| Archivo | Endpoints |
|---|---|
| `backend/routes/auth.js` | `POST /api/register`, `POST /api/login` |
| `backend/routes/chat.js` | `POST /api/chat`, `GET /api/messages` |
| `backend/routes/mood.js` | `POST /api/mood/checkin`, `/checkout`, `GET /api/mood/history` |
| `backend/routes/ratings.js` | `POST /api/rating`, `GET /api/rating/avg` |
| `backend/routes/recommendations.js` | `POST /generate`, `GET /`, `PUT /:id/seen` |
| `backend/routes/progress.js` | `GET /api/user/progress`, `PUT /api/user/onboarding-complete` |
| `backend/routes/landingContent.js` | `GET /api/landing-content`, `PUT /api/landing-content` |
| `backend/routes/adminMetrics.js` | `GET /api/admin/metrics` |
| `backend/routes/adminPrompts.js` | Todos los endpoints `/api/admin/prompt*` y `/api/superadmin/prompt*` |
| `backend/routes/matching.js` | `POST /request`, `/choose`, `GET /pending`, `POST /:id/confirm` |

### Routers actualizados (eliminación de duplicados)

| Archivo | Cambio |
|---|---|
| `backend/routes/sessions.js` | Eliminadas funciones `encriptar`/`desencriptar` propias → usa `utils/crypto.js` |
| `backend/routes/therapistRoutes.js` | Eliminadas funciones `encrypt`/`decrypt` y `new Anthropic()` propios → usa `utils/` |

---

## Diagnóstico de duplicados resueltos

### Crypto (antes duplicado en 3 lugares, ahora en 1)

| Archivo | Antes | Después |
|---|---|---|
| `server.js` | `encriptar`, `desencriptar` definidas localmente | Eliminadas |
| `sessions.js` | `encriptar`, `desencriptar` copiadas | `require('../utils/crypto')` |
| `therapistRoutes.js` | `encrypt`, `decrypt` copiadas (nombres en inglés) | `require('../utils/crypto')` |
| `utils/crypto.js` | No existía | ✅ Fuente única |

### Anthropic (antes duplicado en 2 lugares, ahora en 1)

| Archivo | Antes | Después |
|---|---|---|
| `server.js` | `new Anthropic({ apiKey: ... })` | Eliminado |
| `therapistRoutes.js` | `new Anthropic({ apiKey: ... })` | `require('../utils/anthropic')` |
| `utils/anthropic.js` | No existía | ✅ Fuente única (singleton) |

### Middlewares JWT (antes en server.js, ahora en middlewares/auth.js)

Todos los routers reciben los middlewares aplicados desde `server.js` al montarse — ningún router los define internamente.

---

## Checklist de validación — Completado ✅

Validado en local (localhost:5173 + localhost:8080) el 5 de abril de 2026:

- ✅ Login usuario — retorna token, redirige según rol y onboardingCompleted
- ✅ Login admin — redirige a `/admin/dashboard`
- ✅ Check-in de ánimo — registra en BD
- ✅ Chat con IA — responde correctamente
- ✅ Dashboard admin — carga métricas
- ✅ Gestión de prompts — lista y edita prompts
- ✅ Servidor arranca limpio sin errores

---

## Lección aprendida

Al crear archivos nuevos en VS Code, verificar que estén guardados (sin el punto ● en la pestaña) antes de reiniciar el servidor. Un archivo sin guardar hace que `require()` retorne `{}` en lugar del router, generando el error `argument handler must be a function`.

---

*Completado: 5 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
