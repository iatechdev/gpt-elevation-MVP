# Sprint 8 — Plan de Consolidación Técnica

> Estado: EN EJECUCIÓN 🚀
> Foco: Refactorización backend + i18n completo + CMS + validación terapeuta + design system
> Fecha inicio: 4 de abril de 2026
> Documentado por: Claude (Tech Lead AI) + Mauro Roldán

---

## Estado actual del sprint (5 de abril de 2026)

| HU/DT | Descripción | Pts | Estado |
|---|---|---|---|
| DT-006 | Refactorizar server.js en routers modulares | 5 | ✅ Completado |
| DT-002 | i18n completo — backoffice y therapist views | 3 | ⏳ En progreso (Alejo) |
| HU-074 | CMS completo — precios + textos plataforma administrables | 5 | ✅ Completado |
| HU-075 | Validación académica terapeuta + GCS + flujo Junta | 4 | ✅ Completado |
| HU-076 | Design system unificado — tokens compartidos | 3 | ⏳ Pendiente |

**Puntos completados: 14 / 20**

---

## Contexto del sprint

Después de completar los Sprints 5, 6A y 7, se identificaron las siguientes brechas críticas:

1. `server.js` monolítico (~500 líneas reales) — necesita refactorización en routers modulares
2. Frontend sin internacionalización completa (backoffice y therapist views con strings en inglés hardcodeados)
3. CMS incompleto — `PricingPage.tsx` 100% hardcodeada, precios y textos de plataforma no administrables
4. Validación académica de terapeutas no existe — no hay flujo de subida de documentos ni revisión por la Junta
5. Inconsistencia visual entre vistas (admin/therapist vs landing/user dashboard)
6. `sessions.js` tiene funciones de crypto duplicadas

---

## ✅ DT-006 — Refactorización server.js — COMPLETADO

### Resultado
- `server.js`: ~500 líneas → **68 líneas de bootstrap puro**
- 13 routers modulares creados en `backend/routes/`
- 3 utils/middlewares como fuentes únicas de verdad
- Crypto y Anthropic duplicados eliminados de `sessions.js` y `therapistRoutes.js`
- Validado en browser, pusheado a `feature/mvp-elevation`

### Archivos creados
- `backend/middlewares/auth.js` — verificarToken, verificarAdmin, verificarSuperAdmin
- `backend/utils/crypto.js` — encriptar, desencriptar (AES-256-CBC)
- `backend/utils/anthropic.js` — cliente Anthropic singleton
- `backend/routes/auth.js`, `chat.js`, `mood.js`, `ratings.js`, `recommendations.js`
- `backend/routes/progress.js`, `landingContent.js`, `adminMetrics.js`, `adminPrompts.js`, `matching.js`

### Lección aprendida
Al crear archivos en VS Code, verificar que estén guardados (sin el punto ● en la pestaña) antes de reiniciar el servidor.

---

## ⏳ DT-002 — i18n Completo — EN PROGRESO (Alejo)

Ver `DT-002-TAREA-ALEJO.md` para instrucciones detalladas.

### Vistas a actualizar (7 archivos)
- `frontend/src/pages/admin/AdminDashboard.tsx`
- `frontend/src/pages/admin/AdminUsers.tsx`
- `frontend/src/pages/admin/AdminPrompts.tsx`
- `frontend/src/pages/admin/AdminContent.tsx`
- `frontend/src/pages/admin/AdminMetrics.tsx`
- `frontend/src/pages/therapist/TherapistDashboard.tsx`
- `frontend/src/pages/therapist/TherapistPatient.tsx`

---

## ✅ HU-074 — CMS Completo — COMPLETADO

### Resultado
- `PricingPlan` modelo bilingüe en BD (`name_es/en`, `description_es/en`, `features_es/en`)
- `backend/routes/pricing.js` — CRUD completo con soporte bilingüe
- `GET /api/pricing` público + `/api/admin/pricing` con auth
- `PricingPage.tsx` reemplazada — consume API, sin nada hardcodeado, responde a ES/EN
- `AdminContent.tsx` — tab "💰 Precios" con CRUD completo de planes
- Bug resuelto: token era `elevation_token`, no `token`

### Decisiones tomadas
- Opción B para idiomas: campos separados `name_es`/`name_en` en el mismo registro (no registros duplicados)
- Soft delete en lugar de hard delete para planes

---

## ✅ HU-075 — Validación Académica Terapeuta — COMPLETADO

### Resultado
- Bucket GCS `elevation-therapist-docs` creado (privado, us multi-region)
- Service Account `elevation-storage` con rol "Administrador de objetos de Storage"
- `backend/utils/storage.js` — singleton GCS con `uploadFile`, `getSignedUrl`, `deleteFile`
- `backend/TherapistValidation.js` — modelo con documentType, documentPath, status
- `backend/routes/validation.js` — upload, status, pending, download, approve, reject
- Rutas montadas: `/api/therapist/validation` (verificarToken) + `/api/junta` (verificarSuperAdmin)
- `TherapistDashboard.tsx` — sección validación académica con subida de documentos
- `AdminContent.tsx` — tab "🎓 Validaciones" para revisión de la Junta
- Flujo completo validado: terapeuta sube → Junta ve → aprueba/rechaza

### Decisión de rutas (lección aprendida)
El frontend usa `/api/junta/pending`, `/api/junta/:id/download`, `/api/junta/:id/approve` y `/api/junta/:id/reject` — NO `/api/junta/validations/...` porque el router está montado en `/api/junta` directamente.

### Configuración GCS
- Bucket: `elevation-therapist-docs`
- Librería: `@google-cloud/storage` + `multer`
- Credenciales: `backend/gcs-credentials.json` (en `.gitignore`, nunca al repo)
- Variables de entorno: `GCS_BUCKET_NAME`, `GCS_KEY_FILE`
- Signed URLs: expiración 1 hora, solo GET

---

## ⏳ HU-076 — Design System Unificado — PENDIENTE

### Objetivo
Crear `frontend/src/styles/tokens.ts` con colores, radios, sombras y espaciados compartidos.

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

### Alcance
Solo crear `tokens.ts` + aplicar como piloto en `AdminDashboard` y `TherapistDashboard`.
El resto se migra progresivamente en Sprint 9+.

### ⚠️ Precaución: NO tocar `BreathingBackground.tsx` — es frágil

---

## Lo que queda para Sprint 9

- HU-067: Videollamada Daily.co (8 pts)
- HU-068: Google Calendar sync (5 pts)
- HU-073: Modal matching funcional completo (2 pts)
- HU-043: Gestión de imágenes/videos (Cloudinary para media pública)
- Sistema de notificaciones en app
- Tests unitarios críticos (auth, matching, progress)

---

## Regla de trabajo acordada (5 de abril de 2026)

**Claude NO sube código directamente al repo** — solo sube documentación a `main`.
Todo el código lo entrega en el chat para que Mauro lo aplique en local, pruebe y haga push.
Esta regla aplica para el resto del proyecto.

---

*Actualizado: 5 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
