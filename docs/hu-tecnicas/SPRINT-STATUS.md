# Elevation — Estado de Historias de Usuario
> Última actualización: 25 de marzo de 2026 | Entregable Sprint 2: miércoles 25 marzo

---

## 🏁 SPRINT 1 — Estado Final

| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-020 | Check-in de ánimo obligatorio (RN-004) | 5 | ✅ Desarrollado | 5 emojis en App.tsx, bloqueo hasta selección |
| HU-021 | Check-out de ánimo al finalizar | 3 | ⚠️ Parcial | UI presente, sin tabla mood_logs en BD |
| HU-022 | Calificación con estrellas (RN-009) | 2 | ❌ Pendiente | No implementado |
| HU-023 | Búsqueda de reflexiones por palabra clave | 3 | ❌ Pendiente | No implementado |
| HU-024 | Bloqueo tras 3 intentos fallidos (RN-002) | 3 | ✅ Resuelto | loginAttempts+lockedUntil en User, bloqueo 15min, botón 🔒 en frontend |
| HU-025 | Pantalla de bienvenida primer acceso | 2 | ❌ Pendiente | Must Have para entregable |
| HU-026 | Scroll automático en chat | 1 | ✅ Desarrollado | chatEndRef + smooth scroll en App.tsx |
| HU-027 | Rol administrador backoffice | 3 | ✅ Desarrollado | JWT role=admin, panel slide-in, middleware verificarAdmin |
| HU-028 | Prompt Vault encriptado | 5 | ✅ Desarrollado | AES-256-CBC, tabla PromptVaults, endpoints GET/POST |
| HU-029 | Editor de prompts en backoffice | 3 | ✅ Desarrollado | Modal en panel admin, carga y guarda prompt activo |
| HU-030 | Flujo de aprobación de prompts | 5 | ✅ Desarrollado | Reemplazado por HU-033 |
| HU-031 | Historial de versiones de prompts | 3 | ✅ Desarrollado | Incluido en HU-033 |

---

## 🚀 SPRINT 2 — Estado actual (25 marzo)

| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-033 | Versionado y aprobación de prompts | 8 | ✅ Resuelto | Bug 404 corregido — fallback isActive:true en getActivePrompt y endpoint GET |
| HU-034 | Bug fix proposePrompt 500 | 3 | ✅ Resuelto | Import corregido en server.js, proposePrompt funciona |
| HU-035 | Badge notificación superadmin | 3 | ⚠️ Parcial | Badge visible en panel, falta polling automático y diff de versiones |
| HU-024 | Bloqueo tras 3 intentos fallidos | 3 | ✅ Resuelto | 423 Locked tras 3 intentos, 15min bloqueo, botón deshabilitado en UI |
| HU-025 | Pantalla de bienvenida primer acceso | 2 | ❌ Pendiente | Must Have para entregable |
| HU-021 | Check-out de ánimo al finalizar | 3 | ❌ Pendiente | Should Have |
| HU-022 | Calificación con estrellas | 2 | ❌ Pendiente | Should Have |

---

## ✅ FUNCIONANDO EN LOCAL HOY

- 🟢 Servidor backend en puerto 8080 conectado a Cloud SQL
- 🟢 Login con roles (user / admin / superadmin)
- 🟢 Panel admin visible para admin y superadmin
- 🟢 Prompt activo visible en panel (solo lectura) — GET 200 OK ✅
- 🟢 Alejo puede proponer cambios al prompt → pending_review
- 🟢 Mauro ve badge "1 pendiente de revisión" en su panel
- 🟢 Mauro puede aprobar o rechazar versiones propuestas
- 🟢 Historial de versiones visible para superadmin
- 🟢 GET /api/admin/prompt/:key retorna 200 con fallback isActive:true
- 🟢 Bloqueo tras 3 intentos fallidos — HTTP 423, 15 min, botón 🔒

---

## 🔴 BUGS PENDIENTES

Ninguno crítico.

---

## ⚠️ HALLAZGOS DE SEGURIDAD

### SEC-001 — User Enumeration en Login
- **Severidad:** Media
- **Descripción:** El endpoint `POST /api/login` devuelve mensajes distintos según si el email existe o no (`"Usuario no encontrado"` vs `"Contraseña incorrecta"`). Esto permite a un atacante enumerar qué emails están registrados en el sistema.
- **Detectado por:** Mauro Roldán — revisión funcional HU-024 (25/03/2026)
- **Solución propuesta:** Unificar el mensaje de error en un único genérico: `"Credenciales incorrectas"`, sin revelar si el email existe o no. Evaluar impacto en UX con usuarios legítimos.
- **Trade-off UX:** El usuario que escribe mal su email no sabrá si el problema es el email o la contraseña — fricción aceptable en sistemas con datos sensibles de salud mental.
- **Estado:** Pendiente — Sprint 3

---

## 📋 PENDIENTES PARA HOY (miércoles 25 — entregable)

```
PRIORIDAD ALTA — Must Have:
1. HU-025 — Pantalla de bienvenida primer acceso
2. Deploy a producción + pruebas finales

PRIORIDAD MEDIA:
3. HU-035 — Polling automático badge + diff de versiones
4. HU-021 — Check-out de ánimo (persistir en BD)
```

---

## 🔧 ARCHIVOS MODIFICADOS (pendientes de commit/push)

- `backend/server.js` — HU-024 login bloqueado + HU-033 fallback + limpieza duplicados
- `backend/promptVault.js` — fallback isActive:true en getActivePrompt + unique:false
- `backend/User.js` — campos loginAttempts + lockedUntil
- `frontend/src/App.tsx` — estado isLocked + botón deshabilitado

---
*Actualizado: 25 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
