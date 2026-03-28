# BUG-001 — Versiones pendientes de prompt no visibles para superadmin

> Reportado: 28 de marzo de 2026  
> Prioridad: Alta  
> Estado: Pendiente  
> Asignado a: Claude Code — Sprint 4

---

## Descripción

Cuando un usuario con rol `admin` propone un cambio en el prompt de Elevation y confirma la acción, el proceso aparenta completarse exitosamente desde su vista. Sin embargo, cuando el `superadmin` accede al panel de administración, no aparece ninguna notificación de versión pendiente ni la versión propuesta para revisar y aprobar.

---

## Pasos para reproducir

1. Iniciar sesión con una cuenta de rol `admin`
2. Abrir el panel admin (ícono de llave en el header del chat)
3. Modificar el contenido del prompt en el textarea
4. Hacer click en **"Proponer cambio"** / **"Enviar"**
5. El sistema muestra mensaje de éxito ✓
6. Cerrar sesión e iniciar con cuenta `superadmin`
7. Abrir el panel admin
8. **Resultado esperado:** Badge con número de versiones pendientes + versión en lista para aprobar/rechazar
9. **Resultado actual:** No aparece badge, no aparece versión pendiente, la lista de pendientes muestra "Sin versiones pendientes"

---

## Hipótesis del problema

### Hipótesis 1 — Error silencioso en el endpoint de propuesta
El endpoint `POST /api/admin/prompt/propose` puede estar fallando internamente pero retornando un 200 igualmente, lo que hace que el frontend muestre éxito sin que realmente se haya guardado la versión.

### Hipótesis 2 — Problema en el query de versiones pendientes
El endpoint `GET /api/superadmin/prompt/:key/versions` puede estar filtrando incorrectamente por `status === 'pending_review'` y no retornar las versiones recién creadas.

### Hipótesis 3 — Campo `status` no se guarda correctamente
Al crear una nueva versión con `proposePrompt()` en `promptVault.js`, el campo `status` puede no estar seteándose como `'pending_review'` correctamente en la BD.

### Hipótesis 4 — Problema de key del prompt
El `key` que usa el admin para proponer (`elevation_system_prompt`) puede no coincidir exactamente con el que usa el superadmin para consultar las versiones.

---

## Archivos a revisar

```
backend/promptVault.js        ← función proposePrompt() y query de versiones
backend/server.js             ← endpoints POST /propose y GET /versions
frontend/src/pages/ChatPage.tsx ← loadVersions() y filtro pending_review
```

---

## Verificaciones sugeridas para Claude Code

1. Agregar `console.log` en `proposePrompt()` para verificar que la versión se crea con `status: 'pending_review'`
2. Consultar directamente la BD después de proponer: `SELECT * FROM PromptVaults WHERE status = 'pending_review'`
3. Verificar que el endpoint GET `/versions` no tiene un WHERE que excluya las versiones pending
4. Revisar si hay un bug de timing — quizás el superadmin carga las versiones antes de que se complete el write en BD
5. Verificar que `proposePrompt` hace commit de la transacción correctamente

---

## Criterio de aceptación

- [ ] Admin propone cambio → versión guardada en BD con `status: 'pending_review'`
- [ ] Superadmin abre panel → badge muestra número de versiones pendientes
- [ ] Superadmin ve la versión en la lista con botones Aprobar / Rechazar
- [ ] Al aprobar → versión pasa a `status: 'active'` y badge desaparece
- [ ] Al rechazar → versión pasa a `status: 'rejected'` y badge desaparece

---
*Reportado: 28 de marzo de 2026 — Mauro Roldán*
