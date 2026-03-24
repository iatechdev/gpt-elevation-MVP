# HU-034 — Bug Fix: Error 500 al Proponer Cambio de Prompt

**Tipo:** Bug Fix  
**Épica:** EP-11 — Backoffice y Prompt Vault  
**Responsable:** Mauricio Roldán  
**Story Points:** 3  
**Prioridad:** Alta — Bloquea HU-033  
**Estado:** 🔴 Bug identificado  
**Sprint:** 2

---

## Descripción del Bug

Al intentar proponer un cambio de prompt desde el panel admin (rol `admin`), el backend retorna `500 Internal Server Error`.

**Endpoint afectado:**
```
POST http://localhost:8080/api/admin/prompt/propose
```

**Comportamiento esperado:** Crear una nueva versión con `status: pending_review` sin tocar la versión activa.

**Comportamiento actual:** Error 500 — la función `proposePrompt` falla al intentar buscar la versión activa para calcular el número de versión siguiente.

---

## Causa probable

La función `proposePrompt` en `promptVault.js` busca la versión activa así:

```javascript
const active = await PromptVault.findOne({ where: { key: promptKey, status: 'active' } });
```

El problema es que el `key` que envía el frontend es `elevation_system_prompt` pero puede haber un desajuste con el `key` almacenado en la BD, o la primera vez que se llama no existe una versión `active` con ese key exacto y el código falla al intentar hacer `.version + 1` sobre `null`.

---

## Fix propuesto

En `backend/promptVault.js`, función `proposePrompt`, agregar guard clause:

```javascript
const proposePrompt = async (promptKey, plainText, adminEmail) => {
  const encrypted = encryptPrompt(plainText);
  const active = await PromptVault.findOne({ where: { key: promptKey, status: 'active' } });
  
  // FIX: si no hay versión activa, nextVersion = 2 (asumimos que hay una v1)
  const nextVersion = active ? active.version + 1 : 2;

  await PromptVault.create({
    key: promptKey,
    contentEncrypted: encrypted,
    version: nextVersion,
    status: 'pending_review',
    isActive: false,
    proposed_by: adminEmail,
    updatedBy: adminEmail
  });
};
```

---

## Pasos para reproducir

1. Entrar con usuario `admin` (Alejo)
2. Abrir panel de administración
3. Hacer clic en "Proponer cambio"
4. Escribir cualquier texto en el textarea
5. Hacer clic en "Enviar para aprobación"
6. **Resultado:** Error 500 en consola, no se crea la versión pendiente

---

## Definition of Done
- [ ] `proposePrompt` no falla cuando existe o no existe versión activa previa
- [ ] La versión `pending_review` se crea correctamente en la tabla `PromptVaults`
- [ ] El superadmin ve el badge "⏳ 1 pendiente de revisión" en su panel
- [ ] El flujo completo propuesta → aprobación → activo funciona end-to-end

---
*Creada: 23 de marzo de 2026*  
*Autor: Claude (Tech Lead AI) + Mauricio Roldán*
