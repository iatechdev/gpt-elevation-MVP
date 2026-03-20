# HU-030 — Flujo de Aprobación de Cambios de Prompts

**Épica:** EP-11 — Backoffice y Prompt Vault  
**Responsable:** Mauricio Roldán  
**Story Points:** 5  
**Prioridad:** Must Have  
**Estado:** ⏳ Pendiente aprobación  
**Sprint:** Sprint 1

---

## Historia de Usuario

**Como** stakeholder / Tech Lead (Mauricio),  
**quiero** aprobar o rechazar los cambios de prompts antes de que lleguen a los usuarios,  
**para** garantizar que ningún cambio en el comportamiento de la IA llegue a producción sin revisión.

---

## El Flujo Completo

```
Alejo edita el prompt en el backoffice
         ↓
    [Guardar borrador]
    status: draft
         ↓
    [Enviar a revisión]
    status: pending_review
         ↓
Mauricio (o stakeholder) recibe notificación
         ↓
    Revisa el cambio en el backoffice
         ↓
    ┌────────────────────┐
    │ [Aprobar]          │ → status: active → usuarios lo reciben
    │ [Rechazar + nota]  │ → status: draft  → Alejo recibe feedback
    └────────────────────┘
```

---

## Criterios de Aceptación

### Escenario 1: Ver cambios pendientes
- **Given** que soy admin con permisos de aprobación
- **When** entro al backoffice
- **Then** veo un badge con el número de prompts `pending_review` en el menú

### Escenario 2: Aprobar un cambio
- **Given** que reviso un prompt en estado `pending_review` y estoy de acuerdo
- **When** hago clic en "Aprobar"
- **Then** esa versión pasa a `active`, la versión anterior pasa a `archived`, y el servidor usa el nuevo prompt en las próximas conversaciones

### Escenario 3: Rechazar con feedback
- **Given** que reviso un prompt y quiero cambios
- **When** hago clic en "Rechazar" y escribo una nota de feedback
- **Then** el status vuelve a `draft`, Alejo puede ver la nota del rechazo, y el prompt activo NO cambia

### Escenario 4: El cambio aprobado es inmediato
- **Given** que apruebo un cambio de prompt
- **When** un usuario inicia una nueva conversación segundos después
- **Then** esa conversación ya usa el nuevo prompt activo

### Escenario 5: Rollback a versión anterior
- **Given** que un prompt activo está causando problemas
- **When** el admin activa una versión anterior desde el historial
- **Then** esa versión anterior pasa a `active` y la problemática a `archived`, sin necesidad de deploy

---

## Notas Técnicas

### Endpoints tRPC adicionales
```typescript
promptVault.approve(versionId)              // Activa la versión, archiva la anterior
promptVault.reject(versionId, feedback)     // Regresa a draft con nota
promptVault.rollback(versionId)             // Activa una versión archivada
promptVault.listPending()                   // Lista versiones en pending_review
```

### Roles y permisos
```
rol: 'admin'  → puede editar, enviar a revisión, aprobar, rechazar, hacer rollback
               (para el MVP: Alejo y Mauricio son ambos admin con los mismos permisos)
```

### Caché del prompt activo
```typescript
// El servidor puede cachear el prompt activo en memoria por N minutos
// para no ir a BD en cada mensaje del chat.
// Al aprobar un cambio → invalida el caché → próxima lectura trae el nuevo.
```

---

## Definition of Done
- [ ] Endpoints de aprobación, rechazo y rollback implementados
- [ ] Badge de pendientes en el menú del backoffice
- [ ] Vista de revisión con diff entre versión actual y propuesta
- [ ] Caché de prompt activo con invalidación al aprobar
- [ ] Tests: aprobar, rechazar, rollback, caché invalidado
- [ ] PR revisado y aprobado
