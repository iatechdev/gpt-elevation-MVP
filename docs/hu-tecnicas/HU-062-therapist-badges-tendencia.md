# HU-062 — Therapist Dashboard: Badges de Tendencia por Paciente

> Sprint 6 | Must Have | 2 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán
> Referencia visual: Manus design — /therapist
> **Completada: 3 de abril de 2026**

---

## Contexto

Agregar a cada paciente en el TherapistDashboard un badge que muestre su tendencia emocional reciente: Mejorando, Estable o Decayendo.

---

## Lógica de tendencia

Calculada con los MoodLogs del paciente:
- **Mejorando** 📈: avgMood últimos 3 días > avgMood días 4–7 (diferencia > 0.5)
- **Estable** 📊: diferencia entre períodos <= 0.5
- **Decayendo** 📉: avgMood últimos 3 días < avgMood días 4–7 (diferencia > 0.5)
- **Sin datos**: si tiene menos de 3 registros en los últimos 7 días no se muestra badge

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

## Archivos modificados

- `backend/routes/therapistRoutes.js` — función `calculateTrend()` + campo `trend` en respuesta de `/api/therapist/pacientes`
- `frontend/src/pages/therapist/TherapistDashboard.tsx` — interface `Patient` + `TREND_BADGE` config + badge visual

## Decisiones técnicas

- Se agregó `trend` como campo **nuevo** independiente de `moodTrend` (que ya existía) para no romper lógica existente
- `moodTrend` compara solo últimas 2 sesiones — `trend` compara ventanas de 7 días (más robusto clínicamente)
- `calculateTrend()` usa promedio de `checkin_mood` y `checkout_mood` por día para mayor precisión

---

## Criterios de aceptación

- [x] Cada paciente en el dashboard muestra su badge de tendencia
- [x] Badge correctamente coloreado según estado
- [x] Pacientes sin suficientes datos no muestran badge
- [x] Cálculo correcto: últimos 3 días vs días 4-7

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
*Completada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
