# Elevation — Estado de Historias de Usuario
> Última actualización: 31 de marzo de 2026 | Sprint 4 EN CURSO 🚀

---

## 🏁 SPRINT 1 — Cerrado ✅

| HU | Nombre | Puntos | Estado |
|---|---|---|---|
| HU-020 | Check-in de ánimo obligatorio | 5 | ✅ |
| HU-021 | Check-out de ánimo al finalizar | 3 | ✅ |
| HU-022 | Calificación con estrellas | 2 | ✅ |
| HU-024 | Bloqueo tras 3 intentos fallidos | 3 | ✅ |
| HU-026 | Scroll automático en chat | 1 | ✅ |
| HU-027 | Rol administrador backoffice | 3 | ✅ |
| HU-028 | Prompt Vault encriptado | 5 | ✅ |
| HU-029 | Editor de prompts en backoffice | 3 | ✅ |

---

## 🚀 SPRINT 2 — Cerrado ✅

| HU | Nombre | Puntos | Estado |
|---|---|---|---|
| HU-033 | Versionado y aprobación de prompts | 8 | ✅ |
| HU-034 | Bug fix proposePrompt 500 | 3 | ✅ |
| HU-024 | Bloqueo tras 3 intentos fallidos | 3 | ✅ |

---

## 🎯 SPRINT 3 — CERRADO ✅ (36/36 puntos)

### Must Have ✅ (23/23 pts)
| HU | Nombre | Puntos | Estado |
|---|---|---|---|
| HU-037 | Refactor rutas React Router | 5 | ✅ |
| HU-036 | Landing pública estilo Muji | 8 | ✅ |
| HU-038 | SEC-001 mensaje genérico login | 2 | ✅ |
| HU-041 | Bilingüe ES/EN | 5 | ✅ |
| HU-042 | BreathingBackground fondo animado | 3 | ✅ |

### Should Have ✅ (13/13 pts)
| HU | Nombre | Puntos | Estado |
|---|---|---|---|
| HU-039 | Gestión contenido landing | 5 | ✅ |
| HU-040 | Página de precios | 3 | ✅ |
| HU-021 | Check-out de ánimo en BD | 3 | ✅ |
| HU-022 | Calificación con estrellas | 2 | ✅ |

---

## 🐛 BUGS

| Bug | Descripción | Estado |
|---|---|---|
| BUG-001 | Versiones pendientes no visibles para superadmin | ✅ Resuelto — migración BD |

---

## 🎯 SPRINT 4 — EN CURSO

### Must Have (29 puntos)
| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-044 | Refactor backoffice a rutas /admin | 8 | ✅ Completado | Layout + Sidebar + redirect por rol + 5 páginas placeholder |
| HU-045 | Gestión y creación de usuarios | 6 | 🔄 Siguiente | — |
| HU-046 | Rol therapist + dashboard básico | 5 | 📋 Documentado | — |
| HU-047 | Dashboard de métricas ejecutivas | 5 | 📋 Documentado | — |
| HU-048 | Contenido todas las páginas + precios | 5 | 📋 Documentado | — |

### Should Have (13 puntos)
| HU | Nombre | Puntos | Estado |
|---|---|---|---|
| HU-043 | Gestión de imágenes y videos en landing | 8 | 📋 Documentado |
| HU-023 | Búsqueda de reflexiones por palabra clave | 3 | 📋 Backlog |
| HU-035 | Polling automático badge superadmin | 2 | 📋 Backlog |

### Deuda técnica
| ID | Descripción | Puntos |
|---|---|---|
| DT-001 | Limpieza dependencias frontend | 3 |

### Progreso Sprint 4
- **Completado:** 8/42 puntos (19%)
- **Siguiente:** HU-045 — Gestión y creación de usuarios

---

## Lo que se construyó en HU-044

**Archivos nuevos:**
- `frontend/src/layouts/AdminLayout.tsx` — header fijo + sidebar + Outlet
- `frontend/src/components/AdminSidebar.tsx` — navegación con lógica de rol
- `frontend/src/pages/admin/AdminDashboard.tsx`
- `frontend/src/pages/admin/AdminPrompts.tsx`
- `frontend/src/pages/admin/AdminContent.tsx`
- `frontend/src/pages/admin/AdminUsers.tsx`
- `frontend/src/pages/admin/AdminMetrics.tsx`

**Archivos modificados:**
- `frontend/src/App.tsx` — rutas `/admin/*` con guards
- `frontend/src/pages/LoginPage.tsx` — redirect por rol post-login

**Comportamiento:**
- Admin/superadmin → login → `/admin/dashboard` directamente
- User → login → `/app/checkin` como siempre
- Sidebar muestra "Usuarios" solo para superadmin

---

## 📅 ROADMAP DE SPRINTS

| Sprint | Enfoque | Estado |
|---|---|---|
| Sprint 4 | Base administrativa | 🚀 EN CURSO |
| Sprint 5 | Plataforma clínica — onboarding, historia clínica, recomendaciones IA | 📋 Planificado |
| Sprint 6 | Integración — videollamadas, Google Calendar | 📋 Planificado |
| Sprint 7 | Bienestar expandido — matching usuario-terapeuta | 📋 Planificado |

---
*Actualizado: 31 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
