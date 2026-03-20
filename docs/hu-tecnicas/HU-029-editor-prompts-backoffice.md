# HU-029 — Editor de Prompts en el Backoffice

**Épica:** EP-11 — Backoffice y Prompt Vault  
**Responsable:** Mauricio Roldán (API) + Alejo Roldán (UI/UX)  
**Story Points:** 5  
**Prioridad:** Must Have  
**Estado:** ⏳ Pendiente aprobación  
**Sprint:** Sprint 1

---

## Historia de Usuario

**Como** administrador (Alejo, Prompt Engineer),  
**quiero** editar los prompts del acompañante desde una interfaz visual en el backoffice,  
**para** iterar rápidamente sobre el comportamiento de la IA sin necesidad de modificar código ni hacer un deploy.

---

## Criterios de Aceptación

### Escenario 1: Ver prompts actuales
- **Given** que estoy en el backoffice como admin
- **When** navego a la sección "Prompt Vault"
- **Then** veo la lista de prompts disponibles (act_base, crisis_protocol, session_close, welcome) con su versión actual, estado y fecha de última modificación

### Escenario 2: Editar un prompt
- **Given** que selecciono un prompt de la lista
- **When** lo abro en el editor
- **Then** veo el texto desencriptado en un editor de texto amplio, con el historial de versiones al costado

### Escenario 3: Guardar como borrador
- **Given** que modifiqué el texto de un prompt
- **When** hago clic en "Guardar borrador"
- **Then** se crea una nueva versión con status `draft`, el prompt activo NO cambia, y veo una confirmación

### Escenario 4: Enviar a revisión
- **Given** que tengo un borrador guardado
- **When** hago clic en "Enviar a revisión"
- **Then** el status cambia a `pending_review` y el system muestra: "Cambio enviado para aprobación"

### Escenario 5: Vista previa del prompt
- **Given** que estoy editando un prompt
- **When** hago clic en "Vista previa"
- **Then** veo cómo se vería el prompt con las variables dinámicas reemplazadas por valores de ejemplo

---

## Notas Técnicas

### Endpoints tRPC (admin)
```typescript
promptVault.list()          // Lista todos los prompt keys con su versión activa
promptVault.get(key)        // Trae el contenido desencriptado del prompt activo
promptVault.saveDraft(key, content, changeNote)  // Guarda nueva versión en draft
promptVault.submitForReview(versionId)           // Cambia status a pending_review
promptVault.getHistory(key) // Lista todas las versiones de un prompt key
```

### UI del editor
```
/backoffice/prompts
├── Lista de prompt keys (sidebar)
│   ├── act_base        [v3 · active]
│   ├── crisis_protocol [v1 · active]
│   ├── session_close   [v2 · pending_review]
│   └── welcome         [v1 · active]
│
└── Editor (área principal)
    ├── Textarea grande (monospace)
    ├── Campo: Nota del cambio
    ├── Botones: [Guardar borrador] [Enviar a revisión]
    └── Historial de versiones (panel lateral)
```

---

## Definition of Done
- [ ] Endpoints tRPC del Prompt Vault implementados y protegidos con `adminProcedure`
- [ ] Página `/backoffice/prompts` implementada
- [ ] Editor con textarea, nota de cambio, botones de guardar y enviar
- [ ] Lista de prompt keys con estado visible
- [ ] Historial de versiones visible en el editor
- [ ] Tests: listar, guardar draft, enviar a revisión
- [ ] PR revisado y aprobado
