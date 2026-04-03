# HU-065 — Therapist Dashboard: Panel de Alertas

> Sprint 6 | Should Have | 2 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán
> **Completada: 3 de abril de 2026**
> Referencia visual: Manus design — /therapist (columna derecha)

---

## Contexto

Agregar panel lateral de alertas al TherapistDashboard con tres tipos de alertas automáticas.

---

## Panel de Alertas

**Alerta 1 — Paciente sin actividad:**
- Se genera cuando un paciente asignado no tiene MoodLog en los últimos 7 días
- Color: amarillo (#FEF3C7 / #92400E)

**Alerta 2 — Progreso notable:**
- Se genera cuando avgMood últimos 3 días >= 30% mejor que semana anterior
- Color: verde (#EAF0E6 / #4A6741)

**Alerta 3 — Recomendación pendiente (placeholder):**
- Informativo por ahora. Flujo de aprobación en Sprint 7.
- Color: azul (#E0F2FE / #0369A1)

---

## Archivos modificados

- `backend/routes/therapistRoutes.js` — endpoint `GET /api/therapist/alerts`
- `frontend/src/pages/therapist/TherapistDashboard.tsx` — layout dos columnas + panel alertas

## Decisiones técnicas

- Layout convertido de una columna a dos columnas (lista pacientes + panel alertas)
- Panel alertas sticky en columna derecha (320px)
- Contador de alertas activas en header del panel
- Alerta 3 es placeholder — flujo real en Sprint 7
- Alertas son non-blocking: si el endpoint falla, el dashboard sigue funcionando

---

## Criterios de aceptación

- [x] Panel de alertas visible en columna derecha del dashboard
- [x] Alerta de paciente inactivo aparece correctamente
- [x] Alerta de progreso notable aparece con porcentaje calculado
- [x] Si no hay alertas: mensaje "Todo en orden 👍"

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
*Completada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
