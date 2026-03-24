# Elevation — Estado de Historias de Usuario
> Última actualización: 24 de marzo de 2026 | Entregable Sprint 2: miércoles 25 marzo

---

## 🏁 SPRINT 1 — Estado Final

| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-020 | Check-in de ánimo obligatorio (RN-004) | 5 | ✅ Desarrollado | 5 emojis en App.tsx, bloqueo hasta selección |
| HU-021 | Check-out de ánimo al finalizar | 3 | ⚠️ Parcial | UI presente, sin tabla mood_logs en BD |
| HU-022 | Calificación con estrellas (RN-009) | 2 | ❌ Pendiente | No implementado |
| HU-023 | Búsqueda de reflexiones por palabra clave | 3 | ❌ Pendiente | No implementado |
| HU-024 | Bloqueo tras 3 intentos fallidos (RN-002) | 3 | ❌ Pendiente | No implementado |
| HU-025 | Pantalla de bienvenida primer acceso | 2 | ❌ Pendiente | No implementado |
| HU-026 | Scroll automático en chat | 1 | ✅ Desarrollado | chatEndRef + smooth scroll en App.tsx |
| HU-027 | Rol administrador backoffice | 3 | ✅ Desarrollado | JWT role=admin, panel slide-in, middleware verificarAdmin |
| HU-028 | Prompt Vault encriptado | 5 | ✅ Desarrollado | AES-256-CBC, tabla PromptVaults, endpoints GET/POST |
| HU-029 | Editor de prompts en backoffice | 3 | ✅ Desarrollado | Modal en panel admin, carga y guarda prompt activo |
| HU-030 | Flujo de aprobación de prompts | 5 | ✅ Desarrollado | Reemplazado por HU-033 |
| HU-031 | Historial de versiones de prompts | 3 | ✅ Desarrollado | Incluido en HU-033 |

---

## 🚀 SPRINT 2 — Estado actual (24 marzo)

| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-033 | Versionado y aprobación de prompts | 8 | ⚠️ Parcial | Flujo core funciona, bug 404 en GET prompt activo pendiente |
| HU-034 | Bug fix proposePrompt 500 | 3 | ✅ Resuelto | Import corregido en server.js, proposePrompt funciona |
| HU-035 | Badge notificación superadmin | 3 | ⚠️ Parcial | Badge visible en panel, falta polling automático y diff de versiones |
| HU-024 | Bloqueo tras 3 intentos fallidos | 3 | ❌ Pendiente | Must Have para entregable |
| HU-025 | Pantalla de bienvenida primer acceso | 2 | ❌ Pendiente | Must Have para entregable |
| HU-021 | Check-out de ánimo al finalizar | 3 | ❌ Pendiente | Should Have |
| HU-022 | Calificación con estrellas | 2 | ❌ Pendiente | Should Have |

---

## ✅ FUNCIONANDO EN LOCAL HOY

- 🟢 Servidor backend en puerto 8080 conectado a Cloud SQL
- 🟢 Login con roles (user / admin / superadmin)
- 🟢 Panel admin visible para admin y superadmin
- 🟢 Prompt activo visible en panel (solo lectura)
- 🟢 Alejo puede proponer cambios al prompt → pending_review
- 🟢 Mauro ve badge "1 pendiente de revisión" en su panel
- 🟢 Mauro puede aprobar o rechazar versiones propuestas
- 🟢 Historial de versiones visible para superadmin
- 🟡 GET /api/admin/prompt/:key retorna 404 — bug pendiente

---

## 🔴 BUGS PENDIENTES

### Bug principal — GET prompt activo retorna 404
- **Endpoint:** GET /api/admin/prompt/elevation_system_prompt
- **Causa probable:** El primer prompt se guardó con `savePrompt` que usa `unique:true` en el campo `key`. Al quitar el `unique:true` en el modelo, Sequelize puede haber perdido el registro o no sincronizó bien.
- **Fix propuesto:** Verificar en Cloud SQL que exista un registro con `status='active'` y `key='elevation_system_prompt'`. Si no existe, el endpoint `POST /api/admin/prompt` con `savePrompt` debe crearlo correctamente ahora que los imports están corregidos.
- **Siguiente paso:** Probar `POST /api/admin/prompt` desde Postman o desde el flujo de Alejo para insertar el primer prompt activo.

---

## 📋 PENDIENTES PARA HOY (martes 24)

```
PRIORIDAD ALTA — Must Have para el entregable:
1. Fix Bug 404 GET prompt activo — completar HU-033
2. HU-024 — Bloqueo tras 3 intentos fallidos
3. HU-025 — Pantalla de bienvenida primer acceso

PRIORIDAD MEDIA:
4. HU-035 — Polling automático badge + diff de versiones
5. HU-021 — Check-out de ánimo (persistir en BD)

PARA EL MIÉRCOLES:
6. HU-022 — Calificación con estrellas
7. Deploy a producción + pruebas finales
```

---

## 🔧 ARCHIVOS MODIFICADOS (pendientes de commit/push)

- `backend/server.js` — imports corregidos (línea 11)
- `backend/promptVault.js` — unique:true removido, fix nextVersion

---
*Actualizado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauricio Roldán*
