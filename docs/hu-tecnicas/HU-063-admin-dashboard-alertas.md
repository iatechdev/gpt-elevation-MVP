# HU-063 — Admin Dashboard con Alertas

> Sprint 6 | Should Have | 3 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán
> Referencia visual: Manus design — /admin

---

## Contexto

El dashboard admin actual tiene métricas y gráfico de barras. Según el diseño de Manus, necesita un panel de alertas y la lista de prompts pendientes directamente en el dashboard.

---

## Panel de Alertas (nuevo)

Tres tipos de alertas:

**Alerta 1 — Prompts pendientes:**
```
⚠️ X prompts pendientes
Esperando revisión ética
[Revisar] → navega a /admin/prompts
```
- Usa los datos de PromptVault con status 'pending_review'

**Alerta 2 — Terapeutas pendientes:**
```
ℹ️ X terapeutas pendientes
Validación académica
[Revisar] → navega a /admin/usuarios?role=therapist
```
- Sprint 7: flujo de validación académica de terapeutas
- Por ahora: terapeutas creados pero sin TherapistProfile completado

**Alerta 3 — Manifiesto Ético:**
```
ℹ️ Manifiesto Ético
v1.2 activo desde [fecha]
```
- Informativo — muestra versión activa del manifiesto

---

## Sección Prompts pendientes de aprobación

Lista directamente en el dashboard (no solo en /admin/prompts):
```
[Nombre terapeuta] — [Tipo de prompt]
v[número]                    [Badge: Rev. ética | Rev. técnica]  [Revisar]
```

- Máximo 5 items visibles, con "Ver todos" que navega a /admin/prompts
- Badge de tipo de revisión pendiente

---

## Sidebar mejorado

Agregar secciones:
```
PRINCIPAL
- Dashboard
- Usuarios
- Métricas
- Contenido
- Prompts

VALIDACIÓN (nueva sección)
- Terapeutas
- Manifiesto Ético
```

---

## Endpoint nuevo necesario

```
GET /api/admin/alerts
```

Retorna:
```json
{
  "pendingPrompts": 3,
  "pendingTherapists": 2,
  "manifestoVersion": "v1.0",
  "manifestoDate": "2026-04-02",
  "pendingPromptsList": [
    {"id": 1, "therapistName": "...", "promptType": "TCC", "version": 2}
  ]
}
```

---

## Criterios de aceptación

- [ ] Panel de alertas visible en el dashboard con prompts pendientes
- [ ] Panel de alertas muestra terapeutas pendientes de validación
- [ ] Panel de alertas muestra versión activa del Manifiesto Ético
- [ ] Lista de prompts pendientes directamente en el dashboard
- [ ] Sidebar tiene sección VALIDACIÓN con Terapeutas y Manifiesto Ético

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
*Basada en diseño Manus: elevationapp-237qhhdc.manus.space/admin*
