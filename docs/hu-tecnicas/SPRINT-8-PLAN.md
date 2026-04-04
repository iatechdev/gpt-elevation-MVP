# Sprint 8 — Plan de Consolidación Técnica

> Estado: EN EJECUCIÓN 🚀
> Foco: Refactorización backend + i18n completo + CMS + validación terapeuta + design system
> Fecha inicio: 4 de abril de 2026
> Documentado por: Claude (Tech Lead AI) + Mauro Roldán

---

## Contexto del sprint

Después de completar los Sprints 5, 6A y 7, se identificaron las siguientes brechas críticas que deben resolverse antes de continuar con features de Sprint 9 (videollamadas, Google Calendar):

1. `server.js` monolítico (~500 líneas reales) — necesita refactorización en routers modulares
2. Frontend sin internacionalización completa (backoffice y therapist views con strings en inglés hardcodeados)
3. CMS incompleto — `PricingPage.tsx` 100% hardcodeada, precios y textos de plataforma no administrables
4. Validación académica de terapeutas no existe — no hay flujo de subida de documentos ni revisión por la Junta
5. Inconsistencia visual entre vistas (admin/therapist vs landing/user dashboard)
6. `sessions.js` tiene funciones de crypto duplicadas — anticipa el problema que tendrán todos los nuevos routers

---

## HUs del Sprint 8

| HU/DT | Descripción | Pts | Prioridad | Asignado |
|---|---|---|---|---|
| DT-006 | Refactorizar server.js en routers modulares | 5 | 🔴 Crítico | Mauro + Claude |
| DT-002 | i18n completo — backoffice y therapist views | 3 | 🔴 Crítico | Alejo (supervisado) |
| HU-074 | CMS completo — precios + textos plataforma administrables | 5 | 🟡 Alto | Mauro + Claude |
| HU-075 | Validación académica terapeuta + GCS + flujo Junta | 4 | 🟡 Alto | Mauro + Claude |
| HU-076 | Design system unificado — tokens compartidos | 3 | 🟡 Alto | Mauro + Claude |

**Total: 20 puntos**

---

## Orden de ejecución (semana a semana)

### Semana 1 — Base técnica (DT-006 + DT-002 en paralelo)

**DT-006 primero** — es el que más riesgo tiene. Sin staging, todo se prueba en local antes del push.
**DT-002 en paralelo** — Alejo lo ejecuta mientras se resuelve DT-006. Es mecánico y bajo riesgo.

Orden interno de DT-006:
1. Crear `utils/crypto.js`, `utils/anthropic.js`, `middlewares/auth.js`
2. Actualizar `sessions.js` para que use `utils/crypto.js` (único router con crypto duplicado confirmado)
3. Crear routers uno por uno, probando cada endpoint antes de continuar:
   - `auth.js` → probar login
   - `chat.js` → probar chat
   - `mood.js` → probar check-in
   - `ratings.js`
   - `recommendations.js`
   - `progress.js`
   - `landingContent.js`
   - `adminMetrics.js`
   - `adminPrompts.js`
   - `matching.js` — el más largo, va de último
4. `server.js` final limpio (~60 líneas)

### Semana 2 — Features (HU-074, HU-075, HU-076)

Orden: HU-074 → HU-075 → HU-076

---

## DT-006 — Refactorización server.js

### Diagnóstico del estado actual

- `server.js` real: ~500 líneas (no 700 como estimado inicialmente)
- Routers ya modulares y funcionando:
  - `backend/routes/adminUsers.js` ✅ — sin crypto propio, importa modelos al tope
  - `backend/routes/therapistRoutes.js` ✅
  - `backend/routes/sessions.js` ✅ — **TIENE CRYPTO DUPLICADO** — hay que actualizarlo al crear utils/crypto.js
- Middlewares actuales (`verificarToken`, `verificarAdmin`, `verificarSuperAdmin`) viven en `server.js` y se aplican en el montaje de rutas, no dentro de los routers

### Estructura objetivo

```
backend/
  server.js              ← Solo bootstrap: cors, middlewares, routers, puerto (~60 líneas)
  middlewares/
    auth.js              ← verificarToken, verificarAdmin, verificarSuperAdmin
  utils/
    crypto.js            ← encriptar, desencriptar (AES-256-CBC)
    anthropic.js         ← cliente Anthropic singleton
  routes/
    auth.js              ← POST /api/register, POST /api/login
    chat.js              ← POST /api/chat, GET /api/messages
    mood.js              ← POST /api/mood/checkin, /checkout, GET /api/mood/history
    ratings.js           ← POST /api/rating, GET /api/rating/avg
    recommendations.js   ← POST /api/recommendations/generate, GET /api/recommendations, PUT /:id/seen
    progress.js          ← GET /api/user/progress, PUT /api/user/onboarding-complete
    matching.js          ← POST /api/matching/request, /choose, GET admin/pending, POST admin/:id/confirm
    landingContent.js    ← GET /api/landing-content, PUT /api/landing-content
    adminMetrics.js      ← GET /api/admin/metrics
    adminPrompts.js      ← GET/POST /api/admin/prompt*, GET/POST /api/superadmin/prompt*
    adminUsers.js        ← ya existe ✅
    therapistRoutes.js   ← ya existe ✅
    sessions.js          ← ya existe ✅ (actualizar crypto)
```

### Reglas de refactorización (no negociables)

- `server.js` final: máximo 80 líneas
- **Sin cambios en endpoints** — mismas rutas, mismo comportamiento, mismos status codes
- Los middlewares se aplican en `server.js` al montar la ruta (no dentro de los routers)
  - Patrón: `app.use('/api/ruta', verificarToken, require('./routes/ruta'))`
- Cada router importa sus modelos al tope del archivo (no dentro de los handlers)
  - Excepción: `sessions.js` usa el patrón de importar dentro de handlers — no cambiar ese patrón por ahora
- `sessions.js` debe actualizarse para importar de `utils/crypto.js` en lugar de tener las funciones duplicadas
- Rate limiting (`loginLimiter`) queda en `server.js` y se pasa al router `auth.js` como parámetro o se define dentro de auth.js

### Patrón de montaje en server.js final

```js
const { verificarToken, verificarAdmin, verificarSuperAdmin } = require('./middlewares/auth');

app.use('/api',              require('./routes/auth'));           // register, login (auth propio)
app.use('/api',              verificarToken, require('./routes/chat'));
app.use('/api/mood',         verificarToken, require('./routes/mood'));
app.use('/api',              verificarToken, require('./routes/ratings'));
app.use('/api/recommendations', verificarToken, require('./routes/recommendations'));
app.use('/api/user',         verificarToken, require('./routes/progress'));
app.use('/api/matching',     verificarToken, require('./routes/matching'));  // rutas user
app.use('/api/admin/matching', verificarAdmin, require('./routes/matching')); // rutas admin
app.use('/api/landing-content', require('./routes/landingContent'));
app.use('/api/admin/metrics',   verificarAdmin, require('./routes/adminMetrics'));
app.use('/api/admin',           verificarAdmin, require('./routes/adminPrompts'));
app.use('/api/superadmin',      verificarSuperAdmin, require('./routes/adminPrompts'));
app.use('/api/admin/usuarios',  verificarAdmin, require('./routes/adminUsers'));
app.use('/api/therapist',       verificarToken, require('./routes/therapistRoutes'));
app.use('/api/sessions',        verificarToken, require('./routes/sessions'));
```

---

## DT-002 — i18n Completo (backoffice + therapist)

### Responsable: Alejo (con supervisión de Mauro)

### Vistas a actualizar (7 archivos)
- `frontend/src/pages/admin/AdminDashboard.tsx`
- `frontend/src/pages/admin/AdminUsers.tsx`
- `frontend/src/pages/admin/AdminPrompts.tsx`
- `frontend/src/pages/admin/AdminContent.tsx`
- `frontend/src/pages/admin/AdminMetrics.tsx`
- `frontend/src/pages/therapist/TherapistDashboard.tsx`
- `frontend/src/pages/therapist/TherapistPatient.tsx`

### Patrón a seguir (mismo que ya existe en otras vistas)
```tsx
import { useLanguage } from '../../i18n/useLanguage';
const { t } = useLanguage();
// Reemplazar strings hardcodeados por t('clave')
// Agregar la clave en es.ts y en.ts
```

### Regla: nunca texto hardcodeado en el JSX — todo por `t('clave')`

Ver `DT-002-i18n-backoffice-therapist.md` para lista completa de claves.

---

## HU-074 — CMS Completo

### Decisión de arquitectura

`PricingPage.tsx` está 100% hardcodeada. Se reemplaza por completo — no se parchea.
Toda la data de precios y textos de plataforma viene de la BD, administrable desde el backoffice.

### Lo que se crea

**Backend:**
- Nuevo modelo `PricingPlan`:
  ```
  id, name, description, price, currency, period,
  features (JSON array), isActive, order, createdAt, updatedAt
  ```
- Nuevos endpoints:
  - `GET /api/pricing` — público, retorna planes activos ordenados
  - `POST /api/admin/pricing` — crear plan (verificarAdmin)
  - `PUT /api/admin/pricing/:id` — editar plan (verificarAdmin)
  - `DELETE /api/admin/pricing/:id` — desactivar plan (verificarSuperAdmin)

**Frontend:**
- `PricingPage.tsx` reemplazado — consume `GET /api/pricing`
- `AdminContent.tsx` ampliado con tab "Precios" para CRUD de planes

### Lo que NO entra en este sprint
- Imágenes del Hero administrables (requiere GCS — ver HU-075)
- Videos administrables — Sprint 9

---

## HU-075 — Validación Académica Terapeuta

### Decisión de storage: Google Cloud Storage (GCS)

**Por qué GCS y no Cloudinary:**
- Ya estamos en el ecosistema GCP (Cloud Run + Cloud SQL en proyecto `elevation-490611`)
- Los buckets GCS pueden ser **privados 100%** — solo el backend firma URLs temporales (signed URLs)
- Ningún tercero accede a los documentos directamente
- Cloudinary está orientado a media pública optimizada — no es el contexto correcto para documentos clínicos/legales
- El Service Account que Cloud Run ya usa se puede reutilizar para acceder a GCS

### Flujo completo

```
1. Terapeuta en su dashboard sube PDF o imagen (certificado/título)
2. Backend recibe el archivo → lo sube a bucket GCS privado
3. BD guarda metadata: tipo, nombre original, ruta en GCS, status=pending
4. La Junta de Elevation ve en su dashboard los documentos pendientes
5. Junta descarga/visualiza el doc via signed URL temporal (expira en 1h)
6. Junta aprueba → therapist.active = true, puede recibir pacientes
7. Junta rechaza → terapeuta recibe nota y puede volver a postular
```

### Nuevo modelo `TherapistValidation`
```
id, therapistId (FK User), documentType (enum: titulo, certificado, colegiado, otro),
documentName (nombre original), documentPath (ruta en GCS), documentUrl (signed URL temporal),
status (enum: pending / approved / rejected),
reviewedBy (nombre del revisor de la Junta), reviewNote, submittedAt, reviewedAt
```

### Endpoints nuevos
- `POST /api/therapist/validation/upload` — terapeuta sube documento (multipart/form-data)
- `GET /api/therapist/validation/status` — terapeuta consulta estado de sus documentos
- `GET /api/junta/validations/pending` — Junta ve pendientes (verificarJunta o verificarSuperAdmin)
- `GET /api/junta/validations/:id/download` — Junta obtiene signed URL temporal
- `POST /api/junta/validations/:id/approve` — Junta aprueba
- `POST /api/junta/validations/:id/reject` — Junta rechaza con nota

### Configuración GCS
- Bucket: `elevation-therapist-docs` (privado, región us-central1 para latencia con Cloud Run)
- Librería: `@google-cloud/storage`
- Autenticación: Service Account del proyecto `elevation-490611` (mismo que Cloud Run)
- Signed URLs: expiración 1 hora, solo GET

---

## HU-076 — Design System Unificado

### Objetivo
Crear un archivo de tokens de diseño compartidos que todos los componentes pueden importar.
Eliminar colores y espaciados hardcodeados dispersos en el código.

### Archivo a crear: `frontend/src/styles/tokens.ts`

```ts
export const colors = {
  primary:      '#6B7D5C',
  primaryLight: '#EAF0E6',
  primaryDark:  '#4A6741',
  text:         '#1C1917',
  textMuted:    '#78716C',
  border:       '#E7E5E4',
  bg:           '#F9F9F7',
  white:        '#ffffff',
  danger:       '#DC2626',
  warning:      '#F59E0B',
  info:         '#0369A1',
  success:      '#16A34A',
}

export const radius = {
  sm: '0.65rem',
  md: '0.85rem',
  lg: '1rem',
  xl: '1.25rem',
}

export const shadow = {
  card: '0 2px 12px rgba(26,28,27,0.06)',
  modal: '0 8px 40px rgba(26,28,27,0.12)',
}

export const spacing = {
  xs: '0.5rem',
  sm: '0.75rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  xxl: '3rem',
}
```

### Alcance: solo crear tokens.ts + aplicar en AdminDashboard y TherapistDashboard como piloto
No refactorizar todos los componentes de una — el resto se migra progresivamente en Sprint 9+.

### ⚠️ Precaución: NO tocar `BreathingBackground.tsx` — es frágil y propenso a vaciarse

---

## Lo que queda para Sprint 9

- HU-067: Videollamada Daily.co (8 pts)
- HU-068: Google Calendar sync (5 pts)
- HU-073: Modal matching funcional completo (2 pts)
- HU-043: Gestión de imágenes/videos (Cloudinary para media pública)
- Sistema de notificaciones en app
- Tests unitarios críticos (auth, matching, progress)

---

## Decisiones tomadas en sesión (4 de abril de 2026)

| Decisión | Razón |
|---|---|
| GCS en lugar de Cloudinary para HU-075 | Documentos clínicos deben ser privados; GCS + signed URLs es la solución correcta. Cloudinary es para media pública. |
| PricingPage.tsx se reemplaza completamente | Parchear algo 100% hardcodeado genera deuda. Más limpio empezar de cero con la data desde BD. |
| DT-002 lo ejecuta Alejo con supervisión | Es mecánico y de bajo riesgo. Buen ejercicio para Alejo. Si hay dudas técnicas, Mauro revisa antes de hacer push. |
| DT-006 router por router, no todo de un tiro | Sin staging, hay que validar en local endpoint por endpoint antes de continuar. |
| sessions.js se actualiza junto con DT-006 | Tiene crypto duplicado — se corrige al crear utils/crypto.js para evitar inconsistencias. |

---

*Documentado: 4 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
