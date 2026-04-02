# HU-063 — Admin Dashboard: Panel de Alertas

> Sprint 6 | Should Have | 2 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán
> Referencia visual: Manus design — /admin (columna derecha)

---

## Contexto

Agregar panel de alertas al AdminDashboard con prompts pendientes, terapeutas pendientes y estado del Manifiesto Ético.

---

## Panel de Alertas

**Alerta 1 — Prompts pendientes:**
```
⚠️ X prompts pendientes
Esperando revisión ética
[Revisar] → /admin/prompts
```

**Alerta 2 — Terapeutas sin perfil completo:**
```
ℹ️ X terapeutas sin perfil
TherapistProfile incompleto
[Revisar] → /admin/usuarios?role=therapist
```

**Alerta 3 — Manifiesto Ético:**
```
ℹ️ Manifiesto Ético
v1.0 activo desde [fecha]
```

---

## Lista de prompts pendientes en dashboard

```
Prompts pendientes de aprobación
[Nombre terapeuta] — TCC    v2    [Rev. ética]  [Revisar]
[Nombre terapeuta] — DBT    v1    [Rev. técnica] [Revisar]
```
- Máximo 5 items, con "Ver todos" → /admin/prompts

---

## Endpoint nuevo

```
GET /api/admin/alerts
```
Retorna:
```json
{
  "pendingPrompts": 3,
  "pendingPromptsList": [{"id": 1, "therapistName": "...", "version": 2}],
  "therapistsWithoutProfile": 2,
  "manifestoVersion": "v1.0",
  "manifestoDate": "2026-04-02"
}
```

---

## Criterios de aceptación

- [ ] Panel de alertas visible en AdminDashboard
- [ ] Alerta de prompts pendientes con conteo correcto
- [ ] Lista de prompts pendientes directamente en el dashboard
- [ ] Alerta de terapeutas sin perfil completo
- [ ] Estado del Manifiesto Ético visible

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
