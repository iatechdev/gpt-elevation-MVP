# Sprint 9 — Videollamadas + Planes + i18n + Desbloqueo usuarios

> Estado: EN PROGRESO
> Fecha inicio: 6 de abril de 2026
> Documentado por: Claude (Tech Lead AI) + Mauro Roldan

---

## Contexto

Sprint 8 cerrado con 17/20 puntos (DT-002 en progreso con Alejo).

Las grandes features pendientes eran:
1. Videollamadas con Daily.co ✅
2. Google Calendar sync
3. Sistema de planes y limitacion de usuarios por plan ✅
4. Modal matching completo ✅

---

## HUs del Sprint 9

| HU | Descripcion | Pts | Prioridad | Estado |
|---|---|---|---|---|
| HU-077 | Sistema de planes y limitacion de usuarios | 5 | Critico | COMPLETADO |
| HU-073 | Modal matching completo | 2 | Normal | COMPLETADO |
| HU-067 | Videollamada Daily.co integrada | 8 | Alto | COMPLETADO |
| HU-078 | Desbloqueo + reset password usuarios | 3 | Alto | COMPLETADO |
| HU-081 | Fix AdminMetrics + AdminPrompts (dano DT-002) | 2 | Critico | COMPLETADO |
| HU-082 | i18n ES/EN completo toda la app | 5 | Alto | COMPLETADO |
| HU-068 | Google Calendar sync | 5 | Alto | Pendiente |

**Puntos completados Sprint 9: 25/25 (excluyendo HU-068)**

---

## DEPLOY + LOGIN 100% FUNCIONAL EN PRODUCCION ✅ (08/04/2026)

**URL:** https://elevation-mvp-747531656650.us-central1.run.app

> ⚠️ TODO lo de las sesiones 09-14/04 esta en repo (feature/mvp-elevation) pero NO desplegado aun.
> Pendiente hacer deploy a Cloud Run con los comandos abajo.

### Variables de entorno Cloud Run (configuracion final correcta)
| Variable | Valor |
|---|---|
| ANTHROPIC_API_KEY | sk-ant-... |
| DB_USER | postgres |
| DB_PASS | ... |
| DB_HOST | /cloudsql/eleveation-490611:us-south1:elevation-bd |
| DB_NAME | elevation |
| DB_PORT | 5432 |
| JWT_SECRET | ... |
| PROMPT_ENCRYPTION_KEY | ... |
| GCS_BUCKET_NAME | elevation-therapist-docs |
| GCS_KEY_FILE | ./gcs-credentials.json |
| FRONTEND_URL | https://elevation-mvp-747531656650.us-central1.run.app |
| DAILY_API_KEY | pendiente — Alejo gestiona con cliente |

### Conexion Cloud SQL
- Instancia registrada en Cloud Run: `eleveation-490611:us-south1:elevation-bd`
- Conexion via Cloud SQL Auth Proxy (socket unix — sin IP publica expuesta)
- DB_HOST usa el path del socket: `/cloudsql/eleveation-490611:us-south1:elevation-bd`
- **IMPORTANTE:** La BD esta en `us-south1`, no en `us-central1` — el path debe reflejar esto

### Stack de deploy (comandos definitivos)
```cmd
git pull origin feature/mvp-elevation
gcloud builds submit --config cloudbuild.yaml --project eleveation-490611
gcloud run deploy elevation-mvp --image gcr.io/eleveation-490611/elevation-mvp --platform managed --region us-central1 --allow-unauthenticated --project eleveation-490611
```

---

## Avances sesion 06/04/2026

### AdminPrompts.tsx — COMPLETADO
### AdminMetrics.tsx — COMPLETADO
### Flujo completo prompts terapeuta — COMPLETADO
### Manifiesto Etico — COMPLETADO
### Deuda naming App.tsx + AdminSidebar — COMPLETADO

---

## Avances sesion 07-08/04/2026

### HU-077 — Sistema de planes y solicitudes — COMPLETADO
### HU-073 — Modal matching completo — COMPLETADO
### Errores TS — CORREGIDOS

---

## Avances sesion 08/04/2026 (tarde)

### AdminPrompts — Creacion de prompts desde admin/superadmin — COMPLETADO
### LoginPage — Design system tokens — COMPLETADO
### Auth — Ciclo de vida de usuario — COMPLETADO
### Eliminacion de usuarios — COMPLETADO
### Mood labels — COMPLETADO

---

## Avances sesion 08/04/2026 (noche)

### BUG CRITICO — Chat caido en produccion — RESUELTO
- Error: AuthenticationError 401 invalid x-api-key en /api/chat
- Causa: ANTHROPIC_API_KEY invalida/vencida en Cloud Run
- Solucion: regenerar key en console.anthropic.com + redeploy con nueva revision en Cloud Run
- Chat funcionando correctamente post-fix

### HU-067 — Videollamada Daily.co — COMPLETADO
Archivos entregados:
- `backend/routes/sessions.js` — 3 endpoints nuevos
- `frontend/src/pages/therapist/SessionRoom.tsx` — sala completa terapeuta
- `frontend/src/pages/user/SessionRoom.tsx` — vista paciente
- `frontend/src/App.tsx` — rutas nuevas full screen
- `frontend/src/pages/therapist/TherapistDashboard.tsx` — seccion proximas sesiones
- `frontend/src/pages/therapist/TherapistPatient.tsx` — boton agendar + modal duracion

DAILY_API_KEY: modo mock activo hasta que Alejo entregue key real del cliente.

### DT-002 — i18n backoffice y terapeuta — COMPLETADO (merge commit Alejo 28c2088)

### TherapistPatient.tsx — Design system tokens — COMPLETADO

### Dominio elevation-ia.com — EN PROCESO
- Dominio comprado en GoDaddy
- Pendiente: configurar Domain Mapping en Cloud Run + registros DNS en GoDaddy

---

## Avances sesion 09/04/2026

### HU-078 — Desbloqueo + reset password — COMPLETADO
Backend (`backend/routes/adminUsers.js`):
- PUT /api/admin/usuarios/:id/unlock — desbloquea cuenta bloqueada por intentos fallidos
- PUT /api/admin/usuarios/:id/reset-password — superadmin puede setear contrasena temporal

Frontend (`frontend/src/pages/admin/AdminUsers.tsx`):
- Badge 🔒 en tabla cuando isLocked === true
- Boton "Desbloquear cuenta" en panel lateral (visible si isLocked || !active)
- Modal "Resetear contrasena" con input password + validacion minimo 6 chars (solo superadmin)
- GET /api/admin/usuarios retorna isLocked, lockedUntil, loginAttempts

### HU-081 — Fix AdminMetrics + AdminPrompts — COMPLETADO
- Ambos componentes reconstruidos tras dano del commit DT-002 de Alejo
- Funcionalidad 100% restaurada y probada

---

## Avances sesion 14/04/2026

### HU-082 — i18n ES/EN completo toda la app — COMPLETADO

**Paso 1 — Claves (completado sesion 09/04):**
- `frontend/src/i18n/es.ts` — 230+ claves: Landing, Login, Check-in, Chat, Admin completo, Therapist completo, Board, General
- `frontend/src/i18n/en.ts` — espejo exacto en ingles

**Paso 2 — t() aplicado (completado sesion 14/04):**
- `frontend/src/layouts/AdminLayout.tsx` — selector ES/EN en header ✅
- `frontend/src/layouts/TherapistLayout.tsx` — selector ES/EN en header ✅
- `frontend/src/pages/admin/AdminDashboard.tsx` ✅
- `frontend/src/pages/admin/AdminMetrics.tsx` ✅
- `frontend/src/pages/admin/AdminPrompts.tsx` ✅
- `frontend/src/pages/admin/AdminContent.tsx` ✅
- `frontend/src/pages/admin/AdminUsers.tsx` ✅
- `frontend/src/pages/therapist/TherapistDashboard.tsx` ✅
- `frontend/src/pages/therapist/TherapistPatient.tsx` ✅

Hook: `useLanguage()` — expone `t(key)` y `lang` ('es' | 'en')
Selector persiste en localStorage. Plan name se muestra en idioma activo.

---

## Pendiente — Proximo Sprint

### Features MVP restantes
1. **HU-068** — Google Calendar sync (requiere Google OAuth configurado en GCP)
2. **HU-079** — Flujo "olvide mi contrasena" con email (requiere SMTP configurado)
3. **HU-080** — Notificaciones in-app + email (depende de HU-079)
4. **Dominio elevation-ia.com** — DNS GoDaddy + Domain Mapping Cloud Run
5. **Deploy** — Todo lo de sesiones 09-14/04 en repo pero no desplegado aun

### Deuda tecnica pendiente
- GCS_KEY_FILE apunta a ./gcs-credentials.json — resolver con Secret Manager
- backend/message.js (minuscula) es archivo zombie — limpiar
- Seguridad BD: evaluar mover instancia a us-central1
- DAILY_API_KEY — agregar cuando Alejo entregue key del cliente

---

## Decisiones de arquitectura confirmadas

- VITE_BACKEND_URL (no VITE_API_URL) — variable de entorno del frontend
- Board = rol etico independiente, no superadmin
- Planes pricing: Basico $0 / Esencial $12 / Plus $29 / Pro $59 USD
- Naming: archivos, rutas URL y codigo fuente siempre en ingles
- Linux es case-sensitive — todos los require() deben coincidir exactamente con el nombre del archivo
- DB en us-south1 — DB_HOST debe usar `/cloudsql/eleveation-490611:us-south1:elevation-bd`
- Cloud SQL Auth Proxy via socket (no IP publica) — seguro para produccion
- Deploy: Cloud Build + Cloud Run, imagen en gcr.io/eleveation-490611/elevation-mvp
- Usuario desactivado puede reactivarse registrandose con el mismo email
- Eliminacion fisica solo para superadmin, con confirmacion por nombre exacto
- SessionRoom del terapeuta va fuera de TherapistLayout (pantalla completa sin sidebar)
- DAILY_API_KEY ausente activa modo mock automaticamente — no rompe el flujo
- Matching: admin aprueba la asignacion, terapeuta ve nuevo paciente en su lista
- Dominio: elevation-ia.com (GoDaddy) → Cloud Run Domain Mapping con HTTPS automatico de Google
- i18n: toda la app es bilingue ES/EN incluyendo backoffice. Selector en AdminLayout + TherapistLayout. Claves en es.ts/en.ts — Alejo solo toca esos dos archivos, nunca los componentes.
- Refactoring: antes de comprimir/simplificar un archivo, informar explicitamente que se elimino y por que. Analisis conjunto antes de decidir.

---

*Actualizado: 14 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldan*
