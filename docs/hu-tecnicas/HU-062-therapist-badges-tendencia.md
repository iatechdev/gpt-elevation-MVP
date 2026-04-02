# HU-062 — Therapist Dashboard: Badges de Tendencia por Paciente

> Sprint 6 | Must Have | 2 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán
> Referencia visual: Manus design — /therapist

---

## Contexto

Agregar a cada paciente en el TherapistDashboard un badge que muestre su tendencia emocional reciente: Mejorando, Estable o Decayendo.

---

## Lógica de tendencia

Calculada con los MoodLogs del paciente:
- **Mejorando** 📈: avgMood últimos 3 días > avgMood días 4–7 (diferencia > 0.5)
- **Estable** 📊: diferencia entre períodos <= 0.5
- **Decayendo** 📉: avgMood últimos 3 días < avgMood días 4–7 (diferencia > 0.5)
- **Sin datos**: si tiene menos de 3 sesiones no se muestra badge

---

## UI por paciente

```
[Nombre paciente]              [Próxima sesión]  [Ver ficha]
[Emoji mood] [Badge tendencia]
```

Badge colores:
- Mejorando: fondo #EAF0E6, texto #4A6741
- Estable: fondo #E0F2FE, texto #0369A1
- Decayendo: fondo #FEE2E2, texto #DC2626

---

## Endpoint a modificar

`GET /api/therapist/pacientes` — agregar campo `trend: 'improving' | 'stable' | 'declining' | null` a cada paciente.

---

## Criterios de aceptación

- [ ] Cada paciente en el dashboard muestra su badge de tendencia
- [ ] Badge correctamente coloreado según estado
- [ ] Pacientes sin suficientes datos no muestran badge
- [ ] Cálculo correcto: últimos 3 días vs días 4-7

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
