# HU-031 — Historial de Versiones de Prompts

**Épica:** EP-11 — Backoffice y Prompt Vault  
**Responsable:** Alejo Roldán (UI) + Mauricio Roldán (API)  
**Story Points:** 3  
**Prioridad:** Should Have  
**Estado:** ⏳ Pendiente aprobación  
**Sprint:** Sprint 2

---

## Historia de Usuario

**Como** administrador,  
**quiero** ver el historial completo de cambios de cada prompt,  
**para** entender la evolución del acompañante y poder hacer rollback si un cambio tiene problemas.

---

## Criterios de Aceptación

### Escenario 1: Ver historial de un prompt
- **Given** que selecciono un prompt en el backoffice
- **When** abro la pestaña "Historial"
- **Then** veo todas las versiones ordenadas de más reciente a más antigua, con: número de versión, fecha, quién la creó, quién la aprobó, estado, y nota del cambio

### Escenario 2: Comparar versiones
- **Given** que estoy viendo el historial
- **When** selecciono dos versiones para comparar
- **Then** veo un diff visual que resalta las líneas agregadas (verde) y eliminadas (rojo)

### Escenario 3: Rollback desde el historial
- **Given** que veo una versión anterior que funcionaba bien
- **When** hago clic en "Restaurar esta versión"
- **Then** esa versión se activa inmediatamente (pasa a `active`) y la actual pasa a `archived`

---

## Definition of Done
- [ ] Endpoint `promptVault.getHistory(key)` funcionando
- [ ] UI de historial con lista de versiones
- [ ] Diff visual entre versiones
- [ ] Botón de rollback con confirmación
- [ ] Tests: listar historial, comparar, rollback
- [ ] PR revisado y aprobado
