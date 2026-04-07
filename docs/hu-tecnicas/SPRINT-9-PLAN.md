# Sprint 9 — Videollamadas + Planes + Limitacion de usuarios

> Estado: EN PROGRESO
> Fecha inicio: 6 de abril de 2026
> Documentado por: Claude (Tech Lead AI) + Mauro Roldan

---

## Contexto

Sprint 8 cerrado con 17/20 puntos (DT-002 en progreso con Alejo).

Las grandes features pendientes son:
1. Videollamadas con Daily.co
2. Google Calendar sync
3. Sistema de planes y limitacion de usuarios por plan
4. Modal matching completo

---

## HUs del Sprint 9

| HU | Descripcion | Pts | Prioridad | Estado |
|---|---|---|---|---|
| HU-077 | Sistema de planes y limitacion de usuarios | 5 | Critico | COMPLETADO |
| HU-067 | Videollamada Daily.co integrada | 8 | Alto | Pendiente |
| HU-068 | Google Calendar sync | 5 | Alto | Pendiente |
| HU-073 | Modal matching completo | 2 | Normal | Pendiente |

---

## Avances sesion 06/04/2026

### AdminPrompts.tsx — COMPLETADO
- UI completa de gestion del Prompt Vault
- Lista de prompts en panel izquierdo con nombres legibles (fmtKey)
- Historial de versiones con estados: active, pending_review, approved, rejected, archived
- Botones contextuales: Aprobar / Rechazar (con nota) / Rollback
- Conectado a endpoints reales del backend
- Fix: variable de entorno es VITE_BACKEND_URL (no VITE_API_URL)

### AdminMetrics.tsx — COMPLETADO
- 7 KPIs en cards: total usuarios, activos, terapeutas, sesiones, activos esta semana, animo promedio, calificacion promedio
- Grafica de barras de actividad ultimos 30 dias
- Tabla top terapeutas con pacientes y calificacion
- Conectado a GET /api/admin/metrics

### Flujo completo prompts terapeuta — COMPLETADO
- Terapeuta ve su prompt activo / pendiente / rechazado
- Banner de rechazo con motivo visible en TherapistDashboard
- Terapeuta puede re-proponer despues de un rechazo (nueva version)
- Fix critico: eliminados 10 constraints UNIQUE de la tabla PromptVaults en Cloud SQL
- Backend: GET /api/therapist/prompt retorna campo `rejected` con la ultima version rechazada

### Manifiesto Etico — COMPLETADO (06/04/2026)
- Modelo EthicManifest encriptado AES-256-CBC
- Versionado automatico, campo uploadedBy para trazabilidad
- backend/routes/board.js con endpoints completos
- backend/routes/chat.js inyecta manifiesto al system prompt de Claude Haiku
- BoardManifest.tsx, BoardLayout.tsx, BoardRoute.tsx
- AdminSidebar con seccion Ethics Board para superadmin
- Rol board en todo el stack

### Deuda naming App.tsx + AdminSidebar — COMPLETADO (06/04/2026)
- /admin/contenido -> /admin/content
- /admin/usuarios -> /admin/users
- /admin/metricas -> /admin/metrics
- /precios eliminada (alias de /pricing)
- Regla: todo path de URL y codigo fuente en ingles

---

## Avances sesion 07/04/2026

### HU-077 — Sistema de planes y solicitudes — COMPLETADO

#### Modelos y BD
- backend/User.js — campo planId agregado (allowNull: true, FK a PricingPlans)
- backend/PricingPlan.js — campo slug agregado (unique, valores: basic/essential/plus/pro)
- backend/PlanRequest.js — modelo nuevo: userId, planId, status (pending/approved/rejected), adminNote, resolvedBy, resolvedAt
- backend/associations.js — asociaciones User <-> PricingPlan y User <-> PlanRequest completas
- Tablas sincronizadas en Cloud SQL: PlanRequests creada, columna planId en Users, columna slug en PricingPlans

#### Backend
- backend/utils/planLimits.js — config central de limites por plan (chatMessagesDay, sessionsMonth, canAccessProgress, canMatchTherapist). -1 = ilimitado.
- backend/routes/plans.js — GET /api/plans (publico), GET /api/user/plan/me (autenticado, retorna plan + limits)
- backend/routes/planRequests.js — endpoints completos:
  - POST /api/plan-requests — usuario solicita plan (valida no tener pendiente)
  - GET /api/plan-requests/me — solicitud pendiente del usuario
  - GET /api/admin/plan-requests/admin?status=pending — lista para admin
  - PUT /api/admin/plan-requests/admin/:id/approve — aprueba y asigna planId al usuario
  - PUT /api/admin/plan-requests/admin/:id/reject — rechaza con nota obligatoria
- backend/routes/adminUsers.js — endpoint PUT /api/admin/usuarios/:id/plan + include PricingPlan en GET lista
- backend/routes/pricing.js — campo slug agregado al POST y PUT
- backend/server.js — rutas /api/plans, /api/user/plan, /api/plan-requests, /api/admin/plan-requests montadas

#### Frontend
- frontend/src/pages/UserDashboard.tsx — Widget Mi Plan (4to widget columna izquierda):
  - Badge con nombre y color por slug (basic/essential/plus/pro)
  - Precio o Gratis
  - Limites: mensajes IA/dia y sesiones/mes
  - Features del plan (hasta 3)
  - CTA Ver planes para basic y essential
  - Llama a GET /api/user/plan/me al cargar
- frontend/src/pages/PricingPage.tsx — flujo completo:
  - Usuario no logueado -> navigate('/login')
  - Usuario logueado -> POST /api/plan-requests con planId real
  - Estados: idle / loading / success / already_pending / error
  - Banner de confirmacion verde + redirect a dashboard en 3s
  - Header muestra Mi espacio si esta logueado
  - Fix: VITE_API_URL -> VITE_BACKEND_URL
- frontend/src/pages/admin/AdminUsers.tsx — panel de plan requests:
  - Boton azul con contador cuando hay pendientes
  - Panel desplegable con solicitudes: nombre usuario, plan, precio, email, fecha
  - Aprobar -> llama approve -> plan asignado automaticamente
  - Rechazar -> modal con nota obligatoria -> llama reject
  - Columna Plan en tabla de usuarios (badge o guion)
  - Fix: VITE_API_URL -> VITE_BACKEND_URL
- frontend/src/pages/admin/AdminContent.tsx — fix VITE_API_URL + campo slug en formulario de planes

#### Planes en BD (cargados desde AdminContent -> tab Precios)
| Slug | Nombre | Precio | Sesiones/mes | Mensajes IA/dia |
|---|---|---|---|---|
| basic | Basico | $0 | 0 | 10 |
| essential | Esencial | $12 | 1 | 30 |
| plus | Plus | $29 | 4 | 100 |
| pro | Pro | $59 | ilimitado | ilimitado |

#### Flujo validado de punta a punta
1. Usuario logueado -> /pricing -> click Comenzar -> solicitud registrada -> banner verde -> redirect dashboard
2. Admin -> AdminUsers -> boton plan requests -> panel -> Aprobar -> plan asignado
3. Usuario -> dashboard -> widget Mi Plan muestra plan correcto con badge, precio y limites
4. Si usuario ya tiene solicitud pendiente -> mensaje 409 claro
5. Si usuario no logueado -> redirect a /login

---

## Pendiente Sprint 9

### Proximo a trabajar

1. HU-067 — Videollamada Daily.co integrada
2. HU-068 — Google Calendar sync
3. HU-073 — Modal matching completo
4. UI terapeuta — revisar pre-carga de prompt rechazado en modal de propuesta

### HU-067 — Videollamada Daily.co
- Daily.co como proveedor (no Google Meet — bloquea iframes)
- $0.004/participante-minuto, 10,000 min gratis/mes
- Integracion via iframe embebido
- El link de la sala se guarda en TherapySession.meetingUrl

### HU-068 — Google Calendar sync
- OAuth con Google Calendar API
- Sincronizar sesiones agendadas con calendario del terapeuta

### HU-073 — Modal matching completo
- MatchingModal.tsx existe, flujo incompleto
- Falta: usuario elige terapeuta -> admin confirma

---

## Lo que queda del Sprint 8

- DT-002 — i18n backoffice + therapist (Alejo lo esta trabajando)
  - Ver docs/hu-tecnicas/DT-002-TAREA-ALEJO.md
  - Mauro revisa antes de hacer push

---

## Decisiones de arquitectura confirmadas

- VITE_BACKEND_URL (no VITE_API_URL) — variable de entorno del frontend
- Board = rol etico independiente, no superadmin
- Superadmin accede al Manifiesto desde AdminLayout (/admin/manifest)
- Board accede desde BoardLayout (/board/manifest)
- Planes pricing: Basico $0 / Esencial $12 / Plus $29 / Pro $59 USD
- Naming: archivos, rutas URL y codigo fuente siempre en ingles
- Manifiesto Etico: encriptado en BD con AES-256-CBC
- Asignacion de plan: flujo PlanRequest -> aprobacion admin -> planId en User
- planLimits.js es la fuente unica de verdad para limites por plan. -1 = ilimitado.
- Planes se crean desde AdminContent -> tab Precios (no seed quemado)

---

*Actualizado: 7 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldan*
