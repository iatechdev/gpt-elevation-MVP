# HU-065 — Therapist Dashboard: Panel de Alertas

> Sprint 6 | Should Have | 2 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán
> Referencia visual: Manus design — /therapist (columna derecha)

---

## Contexto

Agregar panel lateral de alertas al TherapistDashboard con tres tipos de alertas automáticas.

---

## Panel de Alertas

**Alerta 1 — Paciente sin actividad:**
```
⚠️ [Nombre] sin actividad
No ha tenido sesiones en 7 días
```
- Se genera cuando un paciente asignado no tiene MoodLog en los últimos 7 días

**Alerta 2 — Progreso notable:**
```
✅ Progreso notable
[Nombre] ha mejorado su mood un X% esta semana
```
- Se genera cuando avgMood últimos 3 días >= 30% mejor que semana anterior

**Alerta 3 — Recomendación pendiente (placeholder):**
```
ℹ️ Recomendación pendiente
[Nombre] tiene 1 recomendación IA
```
- Por ahora: informativo. Flujo de aprobación en Sprint 7.

---

## Endpoint nuevo

```
GET /api/therapist/alerts
```
Retorna:
```json
{
  "inactivePatients": [{"userId": 1, "name": "...", "daysSinceLastSession": 8}],
  "notableProgress": [{"userId": 2, "name": "...", "improvementPercent": 40}]
}
```

---

## Criterios de aceptación

- [ ] Panel de alertas visible en columna derecha del dashboard
- [ ] Alerta de paciente inactivo aparece correctamente
- [ ] Alerta de progreso notable aparece con porcentaje calculado
- [ ] Si no hay alertas: mensaje "Todo en orden 👍"

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
