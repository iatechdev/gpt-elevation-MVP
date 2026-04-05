# Sprint 9 — Plan de Videollamadas + Planes + Limitación de usuarios

> Estado: PLANIFICADO
> Fecha inicio: Por definir
> Documentado por: Claude (Tech Lead AI) + Mauro Roldán

---

## Contexto

Sprint 8 cerrado con 17/20 puntos (DT-002 en progreso con Alejo).

Las grandes features pendientes son:
1. Videollamadas con Daily.co
2. Google Calendar sync
3. Sistema de planes y limitación de usuarios por plan
4. Modal matching completo

---

## HUs del Sprint 9

| HU | Descripción | Pts | Prioridad |
|---|---|---|---|
| HU-077 | Sistema de planes y limitación de usuarios | 5 | 🔴 Crítico |
| HU-067 | Videollamada Daily.co integrada | 8 | 🟡 Alto |
| HU-068 | Google Calendar sync | 5 | 🟡 Alto |
| HU-073 | Modal matching completo | 2 | 🟢 Normal |

---

## HU-077 — Sistema de planes y limitación de usuarios (NUEVO — prioridad 1)

### Problema actual
Los `PricingPlan` existen en BD y se muestran en la página pública, pero:
- Los usuarios no tienen un plan asignado
- No hay limitación de funcionalidades por plan
- No hay forma de saber si un usuario es Free, Pro, etc.

### Lo que hay que construir

**Backend:**
- Campo `planId` en modelo `User` (FK a `PricingPlan`)
- Campo `planExpiresAt` en modelo `User` (para planes con período)
- Middleware `verificarPlan(feature)` que valida si el usuario tiene acceso
- Endpoint `GET /api/user/plan` — retorna el plan activo del usuario
- Endpoint `POST /api/admin/users/:id/assign-plan` — admin asigna plan a usuario
- Lógica de límites por plan (ej: Free = 10 chats/mes, Pro = ilimitado)

**Frontend:**
- Widget "Mi plan" en UserDashboard mostrando plan activo
- Bloqueo suave cuando el usuario alcanza el límite (mensaje + CTA a upgrade)
- Vista de upgrade en PricingPage con CTA que lleva al usuario a contactar admin

### Decisiones a tomar en la sesión
- ¿Cómo se asigna el plan? ¿Manual por admin o automático?
- ¿Qué features limita cada plan? (chats, sesiones, terapeutas, etc.)
- ¿Hay período de gracia o bloqueo inmediato al llegar al límite?

---

## HU-067 — Videollamada Daily.co

Ver doc existente: `docs/hu-tecnicas/HU-067-videollamada-daily.md`

### Decisión de arquitectura ya tomada
- Daily.co como proveedor (no Google Meet — bloquea iframes)
- Integración via iframe embebido en la plataforma
- El link de la sala se guarda en `TherapySession.meetingUrl`

### Lo que falta
- Configurar cuenta Daily.co y API key
- Backend: crear sala automáticamente al agendar sesión
- Frontend: vista `VideoSession.tsx` con iframe de Daily.co
- Flujo: terapeuta agenda → se crea sala → usuario y terapeuta ven el link

---

## HU-068 — Google Calendar sync

Ver doc existente: `docs/hu-tecnicas/HU-068-google-calendar.md`

### Lo que falta
- OAuth con Google Calendar API
- Sincronizar sesiones agendadas con el calendario del terapeuta
- Enviar invitación al paciente

---

## HU-073 — Modal matching completo

El `MatchingModal.tsx` existe pero el flujo no está completo.
- El usuario llena el cuestionario
- La IA sugiere terapeutas
- El usuario elige
- El admin confirma

Falta pulir el flujo end-to-end y el estado en el dashboard.

---

## Lo que queda del Sprint 8

- **DT-002** — i18n backoffice + therapist (Alejo lo está trabajando)
  - Ver `docs/hu-tecnicas/DT-002-TAREA-ALEJO.md`
  - Mauro revisa antes de hacer push

---

*Documentado: 5 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
