# EP-11 — Backoffice y Prompt Vault

**Product Owner:** Alejo Roldán  
**Tech Lead:** Mauricio Roldán  
**Prioridad:** Must Have — MVP 2  
**Estado:** 🔵 Aprobación pendiente de Product Owner

---

## Problema que resuelve

Actualmente los prompts del acompañante IA están escritos directamente en el código (`elevation-act-prompt.ts`). Esto genera tres riesgos críticos:

1. **Seguridad:** Si el repositorio se vuelve público, los prompts quedan expuestos.
2. **Operación:** Cambiar un prompt requiere un deploy completo de la aplicación.
3. **Control:** No hay flujo de aprobación — cualquier cambio va directo a producción sin revisión.

## Solución propuesta

Un **Backoffice seguro** con un **Prompt Vault encriptado** que permite:
- Guardar todos los prompts en base de datos con encriptación AES-256-GCM
- Editar prompts desde una interfaz visual sin tocar el código
- Versionar cada cambio con historial completo
- Flujo de aprobación: `draft → pending_review → active`
- Rol `admin` separado del rol de usuario normal

## Arquitectura del Prompt Vault

```
Backoffice (solo admin)
    │
    ▼
Prompt Editor UI
    │
    ▼
tRPC: promptVault.save() → estado: draft
    │
    ▼
BD: tabla `prompt_versions`
    │  - id, prompt_key, content_encrypted (AES-256-GCM)
    │  - version, status (draft/pending/active)
    │  - created_by, approved_by, timestamps
    │
    ▼
Flujo de aprobación
    │  draft → [Alejo edita] → pending_review
    │  pending_review → [Mauricio/Stakeholder aprueba] → active
    │
    ▼
Servidor: al iniciar conversación
    │  lee prompt_versions WHERE key='act_base' AND status='active'
    │  desencripta en memoria con PROMPT_ENCRYPTION_KEY
    │  usa el prompt — nunca sale del servidor
```

## HU incluidas en esta épica

| ID | Título | Puntos | Prioridad |
|----|--------|--------|-----------|
| HU-027 | Rol de administrador y acceso al backoffice | 5 | Must Have |
| HU-028 | Prompt Vault — guardar prompts encriptados en BD | 8 | Must Have |
| HU-029 | Editor de prompts en el backoffice | 5 | Must Have |
| HU-030 | Flujo de aprobación de cambios de prompts | 5 | Must Have |
| HU-031 | Historial de versiones de prompts | 3 | Should Have |

**Total story points:** 26

---

## Decisión técnica: ¿Por qué BD encriptada y no variables de entorno?

Las variables de entorno (`.env`) son una opción válida para una sola versión del prompt, pero tienen limitaciones importantes para Elevation:

| Criterio | Variables de entorno | Prompt Vault en BD |
|----------|---------------------|--------------------|
| Edición sin deploy | ❌ Requiere redeploy | ✅ Instantáneo |
| Historial de versiones | ❌ No existe | ✅ Completo |
| Flujo de aprobación | ❌ No existe | ✅ Draft → Active |
| Múltiples prompts | ⚠️ Se vuelve complejo | ✅ Escalable |
| Seguridad | ⚠️ En texto plano en servidor | ✅ Encriptado en BD |

**Conclusión:** Para el MVP 2 de Elevation, el Prompt Vault en BD es la arquitectura correcta.
