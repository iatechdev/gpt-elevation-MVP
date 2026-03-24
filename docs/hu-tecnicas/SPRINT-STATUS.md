# Elevation — Estado de Historias de Usuario
> Última actualización: 25 de marzo de 2026 | Sprint 2 CERRADO

---

## 🏁 SPRINT 1 — Estado Final

| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-020 | Check-in de ánimo obligatorio (RN-004) | 5 | ✅ Desarrollado | 5 emojis en App.tsx, bloqueo hasta selección |
| HU-021 | Check-out de ánimo al finalizar | 3 | ⚠️ Parcial | UI presente, sin tabla mood_logs en BD |
| HU-022 | Calificación con estrellas (RN-009) | 2 | ❌ Pendiente | Movida a Sprint 3 |
| HU-023 | Búsqueda de reflexiones por palabra clave | 3 | ❌ Pendiente | Movida a Sprint 3 |
| HU-024 | Bloqueo tras 3 intentos fallidos (RN-002) | 3 | ✅ Resuelto | loginAttempts+lockedUntil en User, bloqueo 15min, botón 🔒 en frontend |
| HU-025 | Pantalla de bienvenida primer acceso | 2 | 🔄 Movida a Sprint 3 | Decisión: se integra con rediseño estilo japonés + landing pública |
| HU-026 | Scroll automático en chat | 1 | ✅ Desarrollado | chatEndRef + smooth scroll en App.tsx |
| HU-027 | Rol administrador backoffice | 3 | ✅ Desarrollado | JWT role=admin, panel slide-in, middleware verificarAdmin |
| HU-028 | Prompt Vault encriptado | 5 | ✅ Desarrollado | AES-256-CBC, tabla PromptVaults, endpoints GET/POST |
| HU-029 | Editor de prompts en backoffice | 3 | ✅ Desarrollado | Modal en panel admin, carga y guarda prompt activo |
| HU-030 | Flujo de aprobación de prompts | 5 | ✅ Desarrollado | Reemplazado por HU-033 |
| HU-031 | Historial de versiones de prompts | 3 | ✅ Desarrollado | Incluido en HU-033 |

---

## 🚀 SPRINT 2 — Estado FINAL (25 marzo)

| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-033 | Versionado y aprobación de prompts | 8 | ✅ Resuelto | Bug 404 corregido — fallback isActive:true |
| HU-034 | Bug fix proposePrompt 500 | 3 | ✅ Resuelto | Import corregido en server.js |
| HU-035 | Badge notificación superadmin | 3 | ⚠️ Parcial | Badge visible, polling → Sprint 3 |
| HU-024 | Bloqueo tras 3 intentos fallidos | 3 | ✅ Resuelto | HTTP 423, 15min bloqueo, botón 🔒 |
| HU-025 | Pantalla de bienvenida primer acceso | 2 | 🔄 Sprint 3 | Se rediseña junto con landing pública estilo japonés |
| HU-021 | Check-out de ánimo al finalizar | 3 | 🔄 Sprint 3 | Pendiente persistencia BD |
| HU-022 | Calificación con estrellas | 2 | 🔄 Sprint 3 | — |

---

## ✅ FUNCIONANDO EN PRODUCCIÓN (deploy pendiente)

- 🟢 Login con roles (user / admin / superadmin)
- 🟢 Bloqueo tras 3 intentos fallidos — HTTP 423, 15 min, botón 🔒
- 🟢 Panel admin visible para admin y superadmin
- 🟢 Prompt activo GET 200 OK con fallback isActive:true
- 🟢 Proponer / aprobar / rechazar / rollback de prompts
- 🟢 Historial de versiones visible para superadmin
- 🟢 Check-in de ánimo obligatorio antes del chat
- 🟢 Chat encriptado AES-256-CBC con historial

---

## ⚠️ HALLAZGOS DE SEGURIDAD

### SEC-001 — User Enumeration en Login
- **Severidad:** Media
- **Estado:** Pendiente Sprint 3
- **Doc completa:** `docs/hu-tecnicas/SEC-001-user-enumeration.md`

---

## 🔧 ARCHIVOS MODIFICADOS (pendientes de commit a feature/mvp-elevation)

- `backend/server.js` — HU-024 + HU-033 fallback + limpieza duplicados
- `backend/promptVault.js` — fallback isActive:true + unique:false
- `backend/User.js` — campos loginAttempts + lockedUntil
- `frontend/src/App.tsx` — estado isLocked + botón deshabilitado

---

## 🎯 SIGUIENTE PASO INMEDIATO

**Deploy a producción** en Cloud Run con los cambios del Sprint 2.

---
*Actualizado: 25 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
