# HU-033 — Versionado y Aprobación de Prompts en Backoffice

**Épica:** EP-11 — Backoffice y Prompt Vault  
**Responsable:** Mauricio Roldán  
**Story Points:** 8  
**Prioridad:** Must Have  
**Estado:** 🔲 Pendiente desarrollo  
**Sprint:** Sprint 2

---

## Historia de Usuario

**Como** Alejo (admin de contenido),  
**quiero** proponer cambios al system prompt y enviarlos a revisión,  
**para** mejorar el comportamiento de Elevation sin afectar a los usuarios hasta que el superadmin los apruebe.

**Como** Mauricio (superadmin),  
**quiero** ver el historial completo de versiones, aprobar o rechazar propuestas, y hacer rollback a cualquier versión anterior,  
**para** tener control total sobre el comportamiento de la IA en producción.

---

## Contexto y Problema

En Sprint 1 se implementó el Prompt Vault con encriptación AES-256. Sin embargo, el flujo actual permite que el admin edite y active el prompt directamente sin revisión, lo que representa un riesgo operativo: un cambio incorrecto afecta a todos los usuarios en producción de inmediato.

**Lo que se construye en Sprint 2:**  
Sistema completo de versionado con flujo de propuesta → revisión → aprobación/rechazo, diferenciando el rol `admin` (Alejo) del rol `superadmin` (Mauricio).

---

## El Flujo Completo

```
Alejo ve prompt activo (solo lectura)
         ↓
  [Activar modo edición → edita el texto]
         ↓
  [Proponer cambio]
  status: pending_review
         ↓
Mauricio ve badge de "1 versión pendiente"
         ↓
  Revisa diff: versión activa vs. propuesta
         ↓
  ┌──────────────────────────────────┐
  │ [Aprobar]                        │ → status: active → producción actualizada
  │ [Rechazar + nota opcional]       │ → status: rejected → Alejo notificado
  └──────────────────────────────────┘
         ↓
  Historial completo accesible para superadmin
  [Rollback] a cualquier versión anterior
```

---

## Criterios de Aceptación

### CA-1 — Ver prompt activo (Admin)
- **Given** que soy Alejo (admin) y abro el panel de backoffice
- **When** navego a la sección de prompts
- **Then** veo el contenido del prompt activo desencriptado, en modo solo lectura
- **And** veo: número de versión, fecha de activación y quién lo aprobó

### CA-2 — Proponer nueva versión (Admin)
- **Given** que soy Alejo y quiero modificar el prompt
- **When** activo el modo edición, realizo cambios y hago clic en "Proponer cambio"
- **Then** se crea una nueva versión con status `pending_review`
- **And** el prompt activo en producción NO cambia
- **And** veo el mensaje: "Tu propuesta fue enviada al superadmin para revisión"

### CA-3 — Ver versiones pendientes (Superadmin)
- **Given** que soy Mauricio (superadmin) y hay versiones pendientes
- **When** entro al backoffice
- **Then** veo un badge con el número de propuestas en `pending_review`

### CA-4 — Aprobar propuesta (Superadmin)
- **Given** que reviso una propuesta y estoy de acuerdo con los cambios
- **When** hago clic en "Aprobar"
- **Then** esa versión pasa a `active` y se usa en producción inmediatamente
- **And** la versión anterior pasa a `approved` (histórico)

### CA-5 — Rechazar propuesta (Superadmin)
- **Given** que reviso una propuesta y quiero cambios
- **When** hago clic en "Rechazar" (con nota opcional)
- **Then** la versión queda en status `rejected`
- **And** el prompt activo en producción NO cambia
- **And** Alejo puede ver la nota de rechazo en su próximo acceso

### CA-6 — Historial de versiones (Superadmin)
- **Given** que soy Mauricio y quiero ver el historial
- **When** abro la vista de historial
- **Then** veo TODAS las versiones con: número, status, autor, fecha, quién aprobó/rechazó
- **And** puedo hacer rollback a cualquier versión anterior con confirmación previa

### CA-7 — Rollback (Superadmin)
- **Given** que el prompt activo actual tiene problemas
- **When** selecciono una versión anterior y confirmo el rollback
- **Then** esa versión pasa a `active` en menos de 5 segundos
- **And** la versión problemática queda en `archived`
- **And** no se requiere ningún redeploy

---

## Estados del Prompt

| Status | Descripción |
|---|---|
| `active` | Versión en producción actualmente |
| `pending_review` | Propuesta enviada, esperando aprobación del superadmin |
| `approved` | Fue aprobada y activada (registro histórico) |
| `rejected` | Fue rechazada por el superadmin |
| `archived` | Versión anterior reemplazada por una más reciente |

---

## Diseño Técnico

### Nuevo rol: `superadmin`
```sql
-- Agregar superadmin como valor válido en la tabla Users
-- role: 'user' | 'admin' | 'superadmin'
UPDATE "Users" SET role = 'superadmin' WHERE email = 'mauricio.roldan@iatech.com.co';
```

### Cambios en tabla `PromptVaults`
```sql
ALTER TABLE "PromptVaults"
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS proposed_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS rejected_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS rejection_note TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;
```

### Endpoints backend
```
GET    /api/admin/prompt/:key                → Prompt activo desencriptado (admin)
GET    /api/superadmin/prompt/:key/versions  → Todas las versiones (solo superadmin)
POST   /api/admin/prompt/propose             → Proponer nueva versión (admin)
POST   /api/superadmin/prompt/:id/approve    → Aprobar versión (solo superadmin)
POST   /api/superadmin/prompt/:id/reject     → Rechazar versión (solo superadmin)
POST   /api/superadmin/prompt/:id/rollback   → Activar versión anterior (solo superadmin)
```

### Middleware de roles
```javascript
// Existente
const verificarAdmin = (req, res, next) => { /* role: admin || superadmin */ }

// Nuevo
const verificarSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso exclusivo para superadmin' });
  }
  next();
}
```

### Lógica de aprobación
```javascript
// Al aprobar: marcar anterior como 'approved', activar la propuesta
async function aprobarVersion(id, aprobadoPor) {
  await PromptVault.update({ status: 'approved' }, { where: { status: 'active', key: prompt.key } });
  await PromptVault.update(
    { status: 'active', approved_by: aprobadoPor, approved_at: new Date() },
    { where: { id } }
  );
}
```

---

## Relación con HUs existentes

- Extiende: **HU-028** (Prompt Vault encriptado) y **HU-029** (Editor de prompts)
- Reemplaza y amplía: **HU-030** (Flujo de aprobación — MVP) y **HU-031** (Historial de versiones)
- Requiere nuevo rol `superadmin` (extensión de HU-027)

---

## Definition of Done
- [ ] Rol `superadmin` implementado con middleware dedicado
- [ ] Alejo NO puede activar prompts directamente — solo proponer
- [ ] Mauricio puede ver diff claro entre versión activa y propuesta
- [ ] Historial completo visible para superadmin
- [ ] Rollback funciona en menos de 5 segundos sin redeploy
- [ ] Badge de versiones pendientes visible en panel superadmin
- [ ] Todos los estados son auditables (quién, cuándo, qué)
- [ ] El prompt en producción nunca queda en blanco durante transiciones
- [ ] PR revisado y aprobado en `feature/mvp-elevation`

---

*Creada: 23 de marzo de 2026*  
*Autor: Claude (Tech Lead AI) + Mauricio Roldán (PM)*  
*Sprint: 2 — Backoffice Avanzado*
