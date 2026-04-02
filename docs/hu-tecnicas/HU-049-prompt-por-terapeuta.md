# HU-049 — Prompt por Terapeuta

> Sprint 5 | Must Have | 8 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán

---

## Contexto

Actualmente la IA de Elevation usa un único prompt global (`elevation_system_prompt`). El sistema de PromptVault ya existe y funciona con versionado y aprobación. El objetivo de esta HU es extenderlo para que cada terapeuta tenga su propio prompt que define su corriente terapéutica, y que la IA lo use automáticamente cuando atiende a un paciente de ese terapeuta.

---

## Arquitectura de prompts

```
Usuario sin terapeuta → usa elevation_system_prompt (prompt general)
Usuario con terapeuta → usa therapist_prompt_{therapistId} (prompt del terapeuta)
Fallback: si el terapeuta no tiene prompt aprobado → usa elevation_system_prompt
```

---

## Cambios en backend

### `/api/chat` — determinar qué prompt usar

```js
const user = await User.findByPk(userId)
let systemPrompt

if (user.therapistId) {
  systemPrompt = await getActivePrompt(`therapist_prompt_${user.therapistId}`)
}

if (!systemPrompt) {
  systemPrompt = await getActivePrompt('elevation_system_prompt')
}
```

### Endpoints nuevos

```
GET  /api/therapist/prompt              ← obtener prompt activo del terapeuta logueado
POST /api/therapist/prompt/propose      ← proponer nueva versión del prompt
GET  /api/therapist/prompt/versions     ← historial de versiones
```

---

## Frontend — TherapistDashboard

Agregar sección en el dashboard del terapeuta:

```
[Mi Prompt Terapéutico]

Versión activa: v2 — Aprobada el 15 mar 2026
[Ver contenido actual]

[Proponer nueva versión]
```

### Modal de propuesta de prompt
- Textarea con el contenido del prompt
- Botón "Enviar para aprobación"
- Estado visible: pendiente / aprobado / rechazado
- Nota de rechazo visible si aplica

---

## Flujo de aprobación

```
Terapeuta propone prompt
  → Estado: pending
  → Superadmin ve badge en backoffice
  → Superadmin aprueba o rechaza
  → Si aprueba → se activa para todos los pacientes del terapeuta
  → Si rechaza → terapeuta ve nota y puede proponer ajuste
```

Este flujo reutiliza exactamente el sistema de PromptVault existente. La key del prompt es `therapist_prompt_{therapistId}`.

---

## Criterio de aceptación

- [ ] Terapeuta puede ver su prompt activo desde `/therapist/dashboard`
- [ ] Terapeuta puede proponer una nueva versión de su prompt
- [ ] Superadmin puede ver prompts pendientes de terapeutas y aprobarlos/rechazarlos
- [ ] Cuando un usuario con terapeuta chatea, la IA usa el prompt del terapeuta
- [ ] Si el terapeuta no tiene prompt aprobado, se usa el prompt general
- [ ] El historial de versiones del prompt es visible para el terapeuta

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
