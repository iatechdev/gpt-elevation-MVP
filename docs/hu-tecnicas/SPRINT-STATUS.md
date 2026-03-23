# Elevation — Estado de Historias de Usuario
> Última actualización: 23 de marzo de 2026 | Entregable Sprint 2: miércoles 25 marzo

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
| HU-030 | Flujo de aprobación de prompts | 5 | ❌ Pendiente | Documentado, no desarrollado |
| HU-031 | Historial de versiones de prompts | 3 | ❌ Pendiente | Documentado, no desarrollado |

**Sprint 1 — Completado:** 6/12 HUs | 17/38 puntos

---

## 🚀 SPRINT 2 — Backlog (Entregable: miércoles 25 marzo)

### 🔴 MUST HAVE — Crítico para el entregable

| HU | Nombre | Puntos | Estado | Prioridad |
|---|---|---|---|---|
| HU-033 | Versionado y aprobación de prompts (superadmin) | 8 | 🔲 Pendiente | Alta |
| HU-020-BD | Persistir mood_logs en PostgreSQL | 3 | 🔲 Pendiente | Alta |
| HU-024 | Bloqueo tras 3 intentos fallidos | 3 | 🔲 Pendiente | Alta |
| HU-025 | Pantalla de bienvenida primer acceso | 2 | 🔲 Pendiente | Alta |

### 🟡 SHOULD HAVE — Importante pero no bloqueante

| HU | Nombre | Puntos | Estado | Prioridad |
|---|---|---|---|---|
| HU-021 | Check-out de ánimo al finalizar | 3 | ⚠️ Completar | Media |
| HU-022 | Calificación con estrellas | 2 | 🔲 Pendiente | Media |

### 🟢 NICE TO HAVE — Si hay tiempo

| HU | Nombre | Puntos | Estado | Prioridad |
|---|---|---|---|---|
| HU-023 | Búsqueda de reflexiones | 3 | 🔲 Pendiente | Baja |

---

## ✅ LO QUE ESTÁ FUNCIONANDO EN PRODUCCIÓN HOY

- 🟢 App desplegada en Cloud Run: https://elevation-ia-747531656650.us-central1.run.app
- 🟢 PostgreSQL conectado via socket Unix en Cloud Run
- 🟢 Login/Registro con JWT (role: user/admin)
- 🟢 Encriptación AES-256-CBC de mensajes
- 🟢 Chat con Claude claude-3-haiku-20240307
- 🟢 Indicador "Elevation está reflexionando..."
- 🟢 Scroll automático al último mensaje
- 🟢 Check-in emocional con 5 emojis (UI funcional)
- 🟢 Panel admin (slide-in desde derecha, solo role=admin)
- 🟢 Prompt Vault encriptado con editor en backoffice

---

## ⏳ PENDIENTES TÉCNICOS BLOQUEANTES

1. **Rol superadmin:** Ejecutar `UPDATE "Users" SET role = 'superadmin' WHERE email = 'mauricio.roldan@iatech.com.co';` en Cloud SQL
2. **Tabla mood_logs:** Crear en PostgreSQL para persistir check-ins
3. **System prompt:** Alejo debe cargar el prompt real de Elevation desde el panel admin en producción

---

## 📋 ORDEN DE DESARROLLO RECOMENDADO (Sprint 2)

```
Día 1 (hoy lunes):
  1. HU-033 — Versionado de prompts (superadmin) → backend + frontend
  2. HU-020-BD — Persistir mood_logs en PostgreSQL

Día 2 (martes):
  3. HU-024 — Bloqueo tras 3 intentos fallidos
  4. HU-025 — Pantalla de bienvenida primer acceso
  5. HU-021 — Completar check-out de ánimo

Día 3 (miércoles — entregable):
  6. HU-022 — Calificación con estrellas
  7. Deploy final + pruebas + revisión
```

---
*Generado por Claude (Tech Lead AI) — 23 marzo 2026*
