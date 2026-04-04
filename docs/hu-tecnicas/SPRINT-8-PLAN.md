# Sprint 8 — Plan de Consolidación Técnica

> Estado: PLANIFICADO
> Foco: Refactorización backend + frontend + CMS completo + validación terapeuta
> Fecha inicio: 4 de abril de 2026
> Documentado por: Claude (Tech Lead AI) + Mauro Roldán

---

## Contexto del sprint

Después de completar los Sprints 6A y 7 con 27 puntos de funcionalidad entregada, se identificaron las siguientes brechas críticas que deben resolverse antes de continuar con features:

1. `server.js` monolítico (700+ líneas) — necesita refactorización en routers
2. Frontend sin internacionalización completa (backoffice y therapist views en inglés hardcodeado)
3. CMS incompleto — Hero, precios y textos de plataforma no son 100% administrables
4. Validación académica de terapeutas no existe
5. Inconsistencia de estilos entre login, plataforma y landing
6. Paquetes de cobro hardcodeados en la página de precios

---

## HUs del Sprint 8

| HU/DT | Descripción | Pts | Prioridad |
|---|---|---|---|
| DT-006 | Refactorizar server.js en routers modulares | 5 | 🔴 Crítico |
| DT-002 | i18n completo — backoffice y therapist views | 3 | 🔴 Crítico |
| HU-074 | CMS completo — Hero + precios administrables | 5 | 🟡 Alto |
| HU-075 | Validación académica terapeuta + flujo Junta | 4 | 🟡 Alto |
| HU-076 | Design system unificado — consistencia visual | 3 | 🟡 Alto |

**Total: 20 puntos**

---

## DT-006 — Refactorización server.js

### Estado actual
Todo el negocio está en `backend/server.js` (~700 líneas). Los únicos routers modulares son:
- `backend/routes/adminUsers.js`
- `backend/routes/therapistRoutes.js`
- `backend/routes/sessions.js`

### Estructura objetivo

```
backend/
  server.js          ← Solo bootstrap: cors, middlewares, routers, puerto
  routes/
    auth.js          ← POST /api/register, POST /api/login
    chat.js          ← POST /api/chat, GET /api/messages
    mood.js          ← POST /api/mood/checkin, POST /api/mood/checkout, GET /api/mood/history
    ratings.js       ← POST /api/rating, GET /api/rating/avg
    recommendations.js ← POST /api/recommendations/generate, GET /api/recommendations
    progress.js      ← GET /api/user/progress, PUT /api/user/onboarding-complete
    matching.js      ← POST /api/matching/request, POST /api/matching/choose, admin confirms
    landingContent.js ← GET/PUT /api/landing-content
    adminMetrics.js  ← GET /api/admin/metrics
    adminPrompts.js  ← GET/POST /api/admin/prompt, superadmin endpoints
    adminUsers.js    ← ya existe ✅
    therapistRoutes.js ← ya existe ✅
    sessions.js      ← ya existe ✅
```

### Reglas de refactorización
- `server.js` final debe tener máximo 80 líneas
- Cada router usa `require()` de modelos dentro de los handlers (patrón ya establecido en sessions.js)
- Los middlewares (`verificarToken`, `verificarAdmin`, `verificarSuperAdmin`) se mueven a `backend/middlewares/auth.js`
- Las funciones de encriptación se mueven a `backend/utils/crypto.js`
- El cliente Anthropic se mueve a `backend/utils/anthropic.js`
- **Sin cambios en endpoints** — mismas rutas, mismo comportamiento

---

## DT-002 — i18n Completo

### Vistas a actualizar
- `frontend/src/pages/admin/AdminDashboard.tsx`
- `frontend/src/pages/admin/AdminUsers.tsx`
- `frontend/src/pages/admin/AdminPrompts.tsx`
- `frontend/src/pages/admin/AdminContent.tsx`
- `frontend/src/pages/admin/AdminMetrics.tsx`
- `frontend/src/pages/therapist/TherapistDashboard.tsx`
- `frontend/src/pages/therapist/TherapistPatient.tsx`

### Claves a agregar en es.ts / en.ts
Ver doc `DT-002-i18n-backoffice-therapist.md` para lista completa.

---

## HU-074 — CMS Completo

### Lo que existe
- `LandingContent` model en BD ✅
- `GET /api/landing-content` y `PUT /api/landing-content` ✅
- `AdminContent.tsx` con editor básico ✅

### Lo que falta
- Precios/paquetes de cobro administrables (nuevo modelo `PricingPlan`)
- Textos de la plataforma (chat welcome, onboarding, etc.) administrables
- Imágenes del Hero administrables (integración Cloudinary Sprint 5 pendiente)
- Videos de la plataforma administrables

### Nuevo modelo `PricingPlan`
```
id, name, price, currency, period, features (JSON array), isActive, order
```

---

## HU-075 — Validación Académica Terapeuta

### Flujo objetivo
```
1. Terapeuta se registra
2. En su dashboard: sube certificados/títulos (PDF o imagen)
3. La Junta de Elevation recibe notificación
4. Junta revisa y aprueba/rechaza
5. Si aprueba → terapeuta queda activo y puede recibir pacientes
6. Si rechaza → terapeuta recibe nota y puede volver a postular
```

### Nuevo modelo `TherapistValidation`
```
id, therapistId, documentType, documentUrl, status (pending/approved/rejected),
reviewedBy, reviewNote, submittedAt, reviewedAt
```

---

## HU-076 — Design System Unificado

### Inconsistencias identificadas
- Login: diseño minimalista correcto
- Landing: diseño correcto
- Dashboard usuario: diseño correcto
- Dashboard admin: diferente al diseño de Manus (más básico)
- Dashboard terapeuta: diferente al diseño de Manus
- Componentes: no hay un archivo de tokens de diseño compartido

### Objetivo
Crear `frontend/src/styles/tokens.ts` con:
```ts
export const colors = {
  primary: '#6B7D5C',
  primaryLight: '#EAF0E6',
  primaryDark: '#4A6741',
  text: '#1C1917',
  textMuted: '#78716C',
  border: '#E7E5E4',
  bg: '#F9F9F7',
  white: '#fff',
  danger: '#DC2626',
  warning: '#F59E0B',
  info: '#0369A1',
}
export const radius = { sm: '0.65rem', md: '0.85rem', lg: '1rem', xl: '1.25rem' }
export const shadow = { card: '0 2px 12px rgba(26,28,27,0.06)' }
```

---

## Lo que queda para Sprint 9

- HU-067: Videollamada Daily.co (8 pts)
- HU-068: Google Calendar sync (5 pts)
- HU-073: Modal matching funcional completo (2 pts)
- Subida de archivos/videos (Cloudinary)
- Sistema de notificaciones
- Tests unitarios críticos

---
*Documentado: 4 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
