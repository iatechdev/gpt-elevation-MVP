# Elevation — Estado de Historias de Usuario
> Última actualización: 25 de marzo de 2026 | Sprint 3 CASI COMPLETO

---

## 🏁 SPRINT 1 — Estado Final

| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-020 | Check-in de ánimo obligatorio (RN-004) | 5 | ✅ Completado | 5 emojis, bloqueo hasta selección |
| HU-021 | Check-out de ánimo al finalizar | 3 | ✅ Completado | Modal checkout + MoodLog en BD |
| HU-022 | Calificación con estrellas (RN-009) | 2 | 🔄 En progreso | Sprint 3 — en desarrollo |
| HU-023 | Búsqueda de reflexiones por palabra clave | 3 | 🔄 Backlog | Movida post Sprint 3 |
| HU-024 | Bloqueo tras 3 intentos fallidos (RN-002) | 3 | ✅ Completado | loginAttempts+lockedUntil, bloqueo 15min |
| HU-025 | Pantalla de bienvenida primer acceso | 2 | ✅ Completado | Integrada con landing pública HU-036 |
| HU-026 | Scroll automático en chat | 1 | ✅ Completado | chatEndRef + smooth scroll |
| HU-027 | Rol administrador backoffice | 3 | ✅ Completado | JWT role=admin, panel slide-in |
| HU-028 | Prompt Vault encriptado | 5 | ✅ Completado | AES-256-CBC, tabla PromptVaults |
| HU-029 | Editor de prompts en backoffice | 3 | ✅ Completado | Modal en panel admin |
| HU-030 | Flujo de aprobación de prompts | 5 | ✅ Completado | Reemplazado por HU-033 |
| HU-031 | Historial de versiones de prompts | 3 | ✅ Completado | Incluido en HU-033 |

---

## 🚀 SPRINT 2 — Estado FINAL

| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-033 | Versionado y aprobación de prompts | 8 | ✅ Completado | Bug 404 corregido — fallback isActive:true |
| HU-034 | Bug fix proposePrompt 500 | 3 | ✅ Completado | Import corregido en server.js |
| HU-035 | Badge notificación superadmin | 3 | ⚠️ Parcial | Badge visible, polling → Sprint 4 backlog |
| HU-024 | Bloqueo tras 3 intentos fallidos | 3 | ✅ Completado | HTTP 423, 15min bloqueo |

---

## 🎯 SPRINT 3 — Estado actual

### Must Have ✅ COMPLETADO (23/23 puntos)
| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-037 | Refactor rutas React Router | 5 | ✅ Completado | BrowserRouter + ProtectedRoute + AdminRoute |
| HU-036 | Landing pública estilo Muji | 8 | ✅ Completado | Hero + proceso + beneficios + CTA + footer |
| HU-038 | SEC-001 mensaje genérico login | 2 | ✅ Completado | Mensaje unificado + rate limiting 10/min por IP |
| HU-041 | Bilingüe ES/EN | 5 | ✅ Completado | LanguageProvider + useLanguage + es.ts + en.ts |
| HU-042 | BreathingBackground fondo animado | 3 | ✅ Completado | Canvas API — círculos que respiran, todas las pantallas |

### Should Have (11/13 puntos completados)
| HU | Nombre | Puntos | Estado | Notas |
|---|---|---|---|---|
| HU-039 | Gestión contenido landing desde backoffice | 5 | ✅ Completado | Textos ES/EN editables desde panel superadmin |
| HU-040 | Página de precios | 3 | ✅ Completado | /precios y /pricing con planes Free y Pro |
| HU-021 | Check-out de ánimo (persistir en BD) | 3 | ✅ Completado | Modal checkout + tabla MoodLogs en PostgreSQL |
| HU-022 | Calificación con estrellas | 2 | 🔄 En progreso | Integrada en modal checkout — en desarrollo |

### Progreso Sprint 3
- **Must Have:** 23/23 puntos ✅
- **Should Have:** 11/13 puntos
- **Total completado:** 34 de 36 puntos (94%)

---

## ✅ FUNCIONANDO EN LOCAL (pendiente deploy)

- 🟢 Login con roles (user / admin / superadmin)
- 🟢 Bloqueo tras 3 intentos fallidos — HTTP 423, 15 min
- 🟢 Rate limiting login — 10 intentos/min por IP
- 🟢 Mensaje genérico login — sin user enumeration
- 🟢 Panel admin para admin y superadmin
- 🟢 Prompt activo GET 200 OK con fallback isActive:true
- 🟢 Proponer / aprobar / rechazar / rollback de prompts
- 🟢 Historial de versiones visible para superadmin
- 🟢 Check-in de ánimo obligatorio antes del chat — persiste en BD
- 🟢 Check-out de ánimo al cerrar sesión — persiste en BD
- 🟢 Chat encriptado AES-256-CBC con historial
- 🟢 Landing pública estilo Muji con fondo animado
- 🟢 Rutas separadas / /login /app/checkin /app/chat /admin
- 🟢 Bilingüe ES/EN con switcher en todas las pantallas
- 🟢 Gestión de textos landing desde backoffice (superadmin)
- 🟢 Página de precios /precios y /pricing

---

## ⚠️ HALLAZGOS DE SEGURIDAD

### SEC-001 — User Enumeration en Login
- **Severidad:** Media
- **Estado:** ✅ Resuelto — HU-038
- **Solución:** Mensaje genérico + rate limiting por IP + delay 200ms

---

## 🔧 DEUDA TÉCNICA DOCUMENTADA

### DT-001 — Conflictos de dependencias frontend
- **Estado:** Documentado — resolver Sprint 4
- **Doc:** `docs/hu-tecnicas/DEUDA-TECNICA-001-dependencias.md`

---

## 🎯 SIGUIENTE — Completar Sprint 3 y Deploy

```
Hoy:     HU-022 Calificación con estrellas
Hoy:     Deploy a Cloud Run — Sprint 3 completo
Sprint 4: HU-043 Gestión medios landing
          HU-023 Búsqueda reflexiones
          HU-035 Polling badge superadmin
          DT-001 Limpieza dependencias
```

---
*Actualizado: 25 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
