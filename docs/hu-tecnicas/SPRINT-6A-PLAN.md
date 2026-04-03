# Sprint 6A — Plan Detallado

> Estado: PLANIFICADO
> Foco: Base clínica — TherapySession + dashboards
> Puntos estimados: 19

---

## Orden de implementación (con dependencias)

```
HU-066 TherapySession base     [5 pts]  ← PRIMERO — prerequisito de todo
    ↓
HU-061 User Dashboard layout   [3 pts]  ← Puede ir en paralelo con HU-062
HU-062 Therapist badges        [2 pts]  ← Puede ir en paralelo con HU-061
    ↓
HU-064 User widgets            [3 pts]  ← Depende de HU-061 + HU-066
HU-065 Therapist alertas       [2 pts]  ← Depende de HU-062 + HU-066
    ↓
HU-071 Vista Mi terapeuta      [3 pts]  ← Depende de HU-061 + HU-066
HU-063 Admin alertas           [2 pts]  ← Independiente, puede ir al final
```

**Total Sprint 6A: 20 puntos**

---

## Sprint 6B — Plan (después de 6A)

```
HU-067 Videollamada Daily.co   [8 pts]  ← Depende de HU-066
HU-068 Google Calendar sync    [5 pts]  ← Depende de HU-066
```

**Total Sprint 6B: 13 puntos**

---

## HUs del usuario en Sprint 6A

| HU | Descripción | Para quién | Pts |
|---|---|---|---|
| HU-061 | Dashboard unificado + check-in integrado | Usuario | 3 |
| HU-064 | Widget progreso + próxima sesión + recomendaciones | Usuario | 3 |
| HU-071 | Vista "Mi terapeuta" | Usuario | 3 |

## HUs del terapeuta en Sprint 6A

| HU | Descripción | Para quién | Pts |
|---|---|---|---|
| HU-066 | TherapySession base (modelo + endpoints) | Backend | 5 |
| HU-062 | Badges tendencia por paciente | Terapeuta | 2 |
| HU-065 | Panel de alertas | Terapeuta | 2 |

## HUs del admin en Sprint 6A

| HU | Descripción | Para quién | Pts |
|---|---|---|---|
| HU-063 | Panel de alertas en dashboard | Admin | 2 |

---

## Deuda técnica (sprint dedicado pre-producción)

- DT-002: i18n completo — backoffice y therapist views
- DT-003: Textos backend administrables desde CMS
- DT-004: Consolidar endpoints de métricas duplicados
- DT-005: Renombrar variables en español a inglés

---
*Documentado: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
