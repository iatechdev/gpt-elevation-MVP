# Sprint 7 — Plan

> Estado: PLANIFICADO
> Foco: Ciclo completo del usuario — matching + onboarding + i18n
> Puntos estimados: 12
> Fecha inicio estimada: 4 de abril de 2026

---

## Objetivo del sprint

Cerrar el flujo completo del usuario nuevo de punta a punta:
- Un usuario nuevo llega → hace onboarding → hace matching con terapeuta → accede al dashboard
Esto hace el MVP completamente demostrable en una demo en vivo.

---

## HUs del Sprint 7

| HU | Descripción | Rol | Pts | Prioridad |
|---|---|---|---|---|
| HU-060 | Matching usuario-terapeuta (modal completo) | Usuario | 5 | Must Have |
| HU-072 | Onboarding 6 pasos usuario nuevo | Usuario | 4 | Must Have |
| DT-002 | i18n completo — backoffice y therapist views | Técnico | 3 | Should Have |

**Total: 12 puntos**

---

## Orden de implementación

```
HU-072 Onboarding        ← PRIMERO — es la puerta de entrada al producto
    ↓
HU-060 Matching          ← SEGUNDO — depende de que el usuario exista
    ↓
DT-002 i18n              ← ÚLTIMO — independiente, no bloquea nada
```

---

## Sprint 8 — Plan (después de Sprint 7)

```
HU-067 Videollamada Daily.co   [8 pts]  ← Sprint dedicado a videollamadas
HU-068 Google Calendar sync    [5 pts]  ← Depende de HU-067
```

**Total Sprint 8: 13 puntos**

---

## Deuda técnica pendiente (post Sprint 7)

- DT-003: Textos backend administrables desde CMS
- DT-004: Consolidar endpoints de métricas duplicados
- DT-005: Renombrar variables en español a inglés

---
*Documentado: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
