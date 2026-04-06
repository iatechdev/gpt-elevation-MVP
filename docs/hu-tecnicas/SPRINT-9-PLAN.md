# Sprint 9 — Plan de Videollamadas + Planes + Limitación de usuarios

> Estado: EN PROGRESO
> Fecha inicio: 6 de abril de 2026
> Documentado por: Claude (Tech Lead AI) + Mauro Roldán

---

## Contexto

Sprint 8 cerrado con 17/20 puntos (DT-002 en progreso con Alejo).

Las grandes features pendientes son:
1. Videollamadas con Daily.co
2. Google Calendar sync
3. Sistema de planes y limitación de usuarios por plan
4. Modal matching completo

---

## HUs del Sprint 9

| HU | Descripción | Pts | Prioridad |
|---|---|---|---|
| HU-077 | Sistema de planes y limitación de usuarios | 5 | 🔴 Crítico |
| HU-067 | Videollamada Daily.co integrada | 8 | 🟡 Alto |
| HU-068 | Google Calendar sync | 5 | 🟡 Alto |
| HU-073 | Modal matching completo | 2 | 🟢 Normal |

---

## Avances sesión 06/04/2026

### ✅ AdminPrompts.tsx — COMPLETADO
- UI completa de gestión del Prompt Vault
- Lista de prompts en panel izquierdo con nombres legibles (fmtKey)
- Historial de versiones con estados: active, pending_review, approved, rejected, archived
- Botones contextuales: Aprobar / Rechazar (con nota) / Rollback
- Conectado a endpoints reales del backend
- Fix: variable de entorno es VITE_BACKEND_URL (no VITE_API_URL)

### ✅ AdminMetrics.tsx — COMPLETADO
- 7 KPIs en cards: total usuarios, activos, terapeutas, sesiones, activos esta semana, ánimo promedio, calificación promedio
- Gráfica de barras de actividad últimos 30 días
- Tabla top terapeutas con pacientes y calificación
- Conectado a GET /api/admin/metrics

### ✅ Flujo completo prompts terapeuta — COMPLETADO
- Terapeuta ve su prompt activo / pendiente / rechazado
- Banner de rechazo con motivo visible en TherapistDashboard
- Terapeuta puede re-proponer después de un rechazo (nueva versión)
- Fix crítico: eliminados 10 constraints UNIQUE de la tabla PromptVaults en Cloud SQL que bloqueaban el versionado
- Backend: GET /api/therapist/prompt ahora retorna campo `rejected` con la última versión rechazada

### ✅ Manifiesto Ético — COMPLETADO (06/04/2026)
- Modelo `EthicManifest` — contenido encriptado AES-256-CBC (misma clave que mensajes del chat)
- Versionado automático: v1, v2, v3... — solo uno activo a la vez
- Campo `uploadedBy` — trazabilidad de quién subió cada versión
- `backend/routes/board.js` — router del rol Ethics Board:
  - `POST /api/board/manifest` — sube nueva versión (requiere rol board o superadmin)
  - `GET /api/board/manifest` — historial completo desencriptado
  - `PUT /api/board/manifest/:id/activate` — rollback a versión anterior
  - `GET /api/manifest/active` — consumido internamente por chat.js (sin auth)
- `backend/middlewares/auth.js` — agrega `verificarBoard` (roles: board, superadmin)
- `backend/routes/chat.js` — inyecta manifiesto activo al system prompt de Claude Haiku como bloque ético separado. Falla silenciosa si no hay manifiesto.
- `frontend/src/pages/board/BoardManifest.tsx` — página de gestión del manifiesto con historial, subida y rollback
- `frontend/src/layouts/BoardLayout.tsx` — layout propio para rol board (header + sidebar verde oliva)
- `frontend/src/components/BoardRoute.tsx` — guard de ruta para rol board/superadmin
- Superadmin accede al Manifiesto desde `/admin/manifest` dentro del AdminLayout — navegación unificada con sidebar
- Board accede desde `/board/manifest` con BoardLayout propio
- `AdminSidebar.tsx` — sección "Ethics Board" visible solo para superadmin, link con i18n
- `AdminUsers.tsx` — rol `board` agregado: tipo Role, badge verde (#F0FDF4), tres selectores actualizados
- `backend/routes/adminUsers.js` — `board` agregado a ROLES_VALIDOS y ROLES_PRIVILEGIADOS
- `LoginPage.tsx` — redirección a `/board/manifest` para usuarios con rol board
- Decisión de naming: archivos y rutas siempre en inglés — regla fija para todo el proyecto

### ✅ Deuda naming App.tsx + AdminSidebar — COMPLETADO (06/04/2026)
- Rutas URL del backoffice migradas de español a inglés:
  - `/admin/contenido` → `/admin/content`
  - `/admin/usuarios` → `/admin/users`
  - `/admin/metricas` → `/admin/metrics`
  - `/precios` eliminada (alias redundante de `/pricing`)
- `App.tsx` — paths actualizados, comentarios en inglés
- `AdminSidebar.tsx` — `to:` y `fallback:` actualizados a inglés en los 5 items de nav
- Regla confirmada: **todo path de URL y texto de código fuente en inglés**; los textos visibles al usuario van por i18n (useLanguage)

---

## Pendiente Sprint 9

### 🔴 Próximo a trabajar

1. **HU-077** — planId en User, límites por plan, widget "Mi plan" en UserDashboard
2. **UI terapeuta para proponer prompt** — el modal ya existe, revisar pre-carga del contenido rechazado

### HU-077 — Sistema de planes (decisiones tomadas en sesión)
- Mercado: Latinoamérica B2C
- Terapeutas: Elevation les paga % por sesiones
- Planes propuestos: Básico ($0), Esencial ($12), Plus ($29), Pro ($59) en USD
- Asignación: manual por admin para MVP
- Bloqueo: suave con CTA a upgrade

### HU-067 — Videollamada Daily.co
- Daily.co como proveedor (no Google Meet — bloquea iframes)
- $0.004/participante-minuto, 10,000 min gratis/mes
- Integración via iframe embebido
- El link de la sala se guarda en TherapySession.meetingUrl

### HU-068 — Google Calendar sync
- OAuth con Google Calendar API
- Sincronizar sesiones agendadas con calendario del terapeuta

### HU-073 — Modal matching completo
- MatchingModal.tsx existe, flujo incompleto
- Falta: usuario elige terapeuta → admin confirma

---

## Lo que queda del Sprint 8

- **DT-002** — i18n backoffice + therapist (Alejo lo está trabajando)
  - Ver `docs/hu-tecnicas/DT-002-TAREA-ALEJO.md`
  - Mauro revisa antes de hacer push

---

## Decisiones de arquitectura confirmadas

- VITE_BACKEND_URL (no VITE_API_URL) — variable de entorno del frontend
- Board = rol ético independiente, no superadmin. Tiene poder de veto sobre prompts, sube el Manifiesto Ético. No tiene control técnico de la plataforma.
- Superadmin accede al Manifiesto desde AdminLayout (/admin/manifest) — navegación unificada
- Board accede desde BoardLayout (/board/manifest) — experiencia enfocada
- Planes pricing: Básico $0 / Esencial $12 / Plus $29 / Pro $59 USD
- **Naming: archivos, rutas URL y código fuente siempre en inglés — textos visibles al usuario van por i18n**
- Manifiesto Ético: encriptado en BD con AES-256-CBC, misma clave que mensajes del chat

---

*Actualizado: 6 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
