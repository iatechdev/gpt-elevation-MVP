# HU-028 — Prompt Vault: Guardar Prompts Encriptados en BD

**Épica:** EP-11 — Backoffice y Prompt Vault  
**Responsable:** Mauricio Roldán  
**Story Points:** 8  
**Prioridad:** Must Have  
**Estado:** ⏳ Pendiente aprobación  
**Sprint:** Sprint 1

---

## Historia de Usuario

**Como** sistema de Elevation,  
**quiero** guardar todos los prompts del acompañante IA encriptados en la base de datos,  
**para** que nunca estén expuestos en el código fuente ni en el repositorio, aunque este sea público.

---

## Criterios de Aceptación

### Escenario 1: Prompt guardado encriptado
- **Given** que el admin guarda un prompt desde el backoffice
- **When** el dato se persiste en la BD
- **Then** el campo `content_encrypted` contiene el texto encriptado con AES-256-GCM — nunca el texto plano

### Escenario 2: Servidor desencripta en memoria
- **Given** que el servidor inicia una conversación de chat
- **When** necesita el system prompt del acompañante
- **Then** lee el prompt activo de la BD, lo desencripta en memoria usando `PROMPT_ENCRYPTION_KEY` del entorno, y lo usa — sin escribirlo en logs ni en disco

### Escenario 3: Clave de encriptación ausente
- **Given** que la variable `PROMPT_ENCRYPTION_KEY` no está configurada en el entorno
- **When** el servidor intenta iniciar
- **Then** el servidor falla con un error claro: "PROMPT_ENCRYPTION_KEY no configurada" y no arranca

### Escenario 4: Migración del prompt actual
- **Given** que existe el prompt en `elevation-act-prompt.ts`
- **When** se ejecuta el script de migración
- **Then** el prompt se guarda en BD encriptado y el archivo `.ts` queda como solo referencia de respaldo (no se usa en producción)

---

## Notas Técnicas

### Esquema de BD (Drizzle)
```typescript
// Tabla: prompt_versions
export const promptVersions = pgTable('prompt_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  promptKey: text('prompt_key').notNull(),
  // Ej: 'act_base', 'crisis_protocol', 'session_close', 'welcome'
  contentEncrypted: text('content_encrypted').notNull(),
  // AES-256-GCM: iv:authTag:ciphertext (base64)
  version: integer('version').notNull().default(1),
  status: text('status').notNull().default('draft'),
  // 'draft' | 'pending_review' | 'active' | 'archived'
  createdBy: uuid('created_by').references(() => users.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  approvedAt: timestamp('approved_at'),
  changeNote: text('change_note'), // descripción del cambio
});
```

### Servicio de encriptación de prompts
```typescript
// platform/server/infrastructure/PromptVaultService.ts
// Extiende el patrón de EmailEncryption ya existente
// encrypt(plainText: string): string — retorna iv:authTag:cipher
// decrypt(encrypted: string): string — retorna texto plano en memoria
```

### Claves por prompt
```
act_base          → System prompt ACT principal (Hexaflex)
crisis_protocol   → Protocolo de detección de crisis
session_close     → Prompt de cierre ritual de sesión
welcome           → Mensaje de bienvenida primer acceso
```

### Variable de entorno
```
PROMPT_ENCRYPTION_KEY=<clave de 32 bytes en hex — generada con crypto.randomBytes(32)>
```

---

## Definition of Done
- [ ] Tabla `prompt_versions` con migración Drizzle aplicada
- [ ] `PromptVaultService` con encrypt/decrypt usando AES-256-GCM
- [ ] El servidor lee prompt activo de BD en lugar de leer el archivo `.ts`
- [ ] Validación al arranque: falla si `PROMPT_ENCRYPTION_KEY` no está configurada
- [ ] Script de migración del prompt existente a BD
- [ ] Tests: encriptación/desencriptación correcta, fallo si clave ausente
- [ ] PR revisado y aprobado
