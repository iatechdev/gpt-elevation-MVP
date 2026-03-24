# Elevation — Estado de Historias de Usuario
> Última actualización: 24 de marzo de 2026 | Sprint 3 INICIADO

---

## 🏁 SPRINT 1 — Estado Final

| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-020 | Check-in de ánimo obligatorio (RN-004) | 5 | ✅ Desarrollado | 5 emojis en App.tsx, bloqueo hasta selección |
| HU-021 | Check-out de ánimo al finalizar | 3 | 🔄 Sprint 3 | UI presente, tabla mood_logs pendiente |
| HU-022 | Calificación con estrellas (RN-009) | 2 | 🔄 Sprint 3 | — |
| HU-023 | Búsqueda de reflexiones por palabra clave | 3 | 🔄 Backlog | Movida post Sprint 3 |
| HU-024 | Bloqueo tras 3 intentos fallidos (RN-002) | 3 | ✅ Resuelto | loginAttempts+lockedUntil en User, bloqueo 15min |
| HU-025 | Pantalla de bienvenida primer acceso | 2 | 🔄 Sprint 3 | Integrada con landing pública |
| HU-026 | Scroll automático en chat | 1 | ✅ Desarrollado | chatEndRef + smooth scroll |
| HU-027 | Rol administrador backoffice | 3 | ✅ Desarrollado | JWT role=admin, panel slide-in |
| HU-028 | Prompt Vault encriptado | 5 | ✅ Desarrollado | AES-256-CBC, tabla PromptVaults |
| HU-029 | Editor de prompts en backoffice | 3 | ✅ Desarrollado | Modal en panel admin |
| HU-030 | Flujo de aprobación de prompts | 5 | ✅ Desarrollado | Reemplazado por HU-033 |
| HU-031 | Historial de versiones de prompts | 3 | ✅ Desarrollado | Incluido en HU-033 |

---

## 🚀 SPRINT 2 — Estado FINAL

| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-033 | Versionado y aprobación de prompts | 8 | ✅ Resuelto | Bug 404 corregido — fallback isActive:true |
| HU-034 | Bug fix proposePrompt 500 | 3 | ✅ Resuelto | Import corregido en server.js |
| HU-035 | Badge notificación superadmin | 3 | ⚠️ Parcial | Badge visible, polling → Sprint 3 backlog |
| HU-024 | Bloqueo tras 3 intentos fallidos | 3 | ✅ Resuelto | HTTP 423, 15min bloqueo |

---

## 🎯 SPRINT 3 — En progreso

### Must Have
| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-037 | Refactor rutas React Router | 5 | 📋 Documentado | Primer HU a desarrollar |
| HU-036 | Landing pública estilo Muji | 8 | 📋 Documentado | Depende de HU-037 |
| HU-038 | SEC-001 mensaje genérico login | 2 | 📋 Documentado | — |
| HU-041 | Bilingüe ES/EN | 5 | 📋 Documentado | Promovida a Must Have |
| HU-042 | BreathingBackground fondo animado | 3 | 📋 Documentado | Componente compartido todas las pantallas |

### Should Have
| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-039 | Gestión contenido landing desde backoffice | 5 | 📋 Documentado | — |
| HU-040 | Página de precios | 3 | 📋 Documentado | — |
| HU-021 | Check-out de ánimo (persistir en BD) | 3 | 📋 Documentado | — |
| HU-022 | Calificación con estrellas | 2 | 📋 Documentado | — |

### Total Sprint 3
- **Must Have:** 23 puntos
- **Should Have:** 13 puntos
- **Total:** 36 puntos

---

## ✅ FUNCIONANDO EN PRODUCCIÓN

- 🟢 Login con roles (user / admin / superadmin)
- 🟢 Bloqueo tras 3 intentos fallidos — HTTP 423, 15 min
- 🟢 Panel admin para admin y superadmin
- 🟢 Prompt activo GET 200 OK con fallback isActive:true
- 🟢 Proponer / aprobar / rechazar / rollback de prompts
- 🟢 Historial de versiones visible para superadmin
- 🟢 Check-in de ánimo obligatorio antes del chat
- 🟢 Chat encriptado AES-256-CBC con historial

---

## ⚠️ HALLAZGOS DE SEGURIDAD

### SEC-001 — User Enumeration en Login
- **Severidad:** Media
- **Estado:** En desarrollo — HU-038
- **Doc completa:** `docs/hu-tecnicas/SEC-001-user-enumeration.md`

---

## 🎯 ORDEN DE DESARROLLO SPRINT 3

```
Día 1:   HU-037 Refactor rutas + HU-042 BreathingBackground
Día 2:   HU-041 i18n ES/EN + HU-036 Landing pública
Día 3:   HU-038 SEC-001 fix
Día 4:   HU-039 Gestión contenido + HU-040 Precios
Día 5:   HU-021 Check-out + HU-022 Estrellas + QA + Deploy
```

---
*Actualizado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
