# BUG-001 — Versiones pendientes de prompt no visibles para superadmin

> Reportado: 28 de marzo de 2026
> Estado: ✅ RESUELTO — 30 de marzo de 2026
> Prioridad: Alta

---

## Descripción

Cuando un usuario con rol `admin` propone un cambio en el prompt de Elevation, el proceso aparenta completarse exitosamente. Sin embargo, el `superadmin` no veía ninguna versión pendiente ni notificación al abrir el panel.

---

## Causa raíz identificada

Los registros de `PromptVaults` creados antes de implementar el campo `status` tenían `isActive: true` pero `status: NULL` o vacío. La lógica nueva de `proposePrompt()` calcula el `nextVersion` buscando el máximo en la BD, y el query de versiones del superadmin filtra por `status`, por lo que los registros viejos sin `status` corrompían el flujo.

---

## Solución aplicada

Migración directa en BD — UPDATE de registros existentes para alinear el campo `status` con la lógica nueva:

```sql
UPDATE "PromptVaults"
SET status = 'active'
WHERE "isActive" = true
AND (status IS NULL OR status = '' OR status != 'pending_review');
```

Ejecutado como script Node.js una sola vez sobre la BD de producción en PostgreSQL (Cloud SQL).

**Decisión arquitectónica:** No se modificó la lógica del código nuevo (`promptVault.js` ni `server.js`) ya que estaba correctamente implementada. La solución más limpia y segura fue migrar los datos viejos para que cumplan el contrato esperado por el código nuevo.

---

## Criterio de aceptación ✅

- [x] Admin propone cambio → versión guardada en BD con `status: 'pending_review'`
- [x] Superadmin abre panel → badge muestra número de versiones pendientes
- [x] Superadmin ve la versión en la lista con botones Aprobar / Rechazar
- [x] Al aprobar → versión pasa a `status: 'active'` y badge desaparece
- [x] Al rechazar → versión pasa a `status: 'rejected'` y badge desaparece

---

*Reportado: 28 de marzo de 2026 — Mauro Roldán*
*Resuelto: 30 de marzo de 2026 — Mauro Roldán*
