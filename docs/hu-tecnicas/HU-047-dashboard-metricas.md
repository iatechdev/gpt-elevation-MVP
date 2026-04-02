# HU-047 — Dashboard de Métricas Ejecutivas

> Sprint 5 | Should Have | 5 puntos
> Documentada: 2 de abril de 2026 (arrastre Sprint 4)
> Aprobada por Mauro Roldán

---

## Contexto

El admin y superadmin necesitan una vista ejecutiva del estado de la plataforma. El `AdminDashboard.tsx` existe como placeholder. Esta HU lo convierte en funcional.

---

## Métricas a mostrar

### Cards principales
- Total usuarios activos
- Total terapeutas activos
- Sesiones totales (MoodLogs)
- Rating promedio global
- Mood promedio global
- Usuarios con checkin esta semana

### Gráfico de actividad
- Sesiones por día (últimos 30 días)
- Usuarios nuevos por semana

### Top terapeutas
- Por número de pacientes asignados
- Por rating promedio de sus pacientes

---

## Endpoint nuevo

```
GET /api/admin/metrics  ← métricas globales (solo admin/superadmin)
```

Retorna:
```json
{
  "totalUsers": 45,
  "activeUsers": 38,
  "totalTherapists": 6,
  "totalSessions": 312,
  "avgMood": 3.7,
  "avgRating": 4.1,
  "activeThisWeek": 22,
  "sessionsByDay": [...],
  "topTherapists": [...]
}
```

---

## Frontend — AdminDashboard.tsx (reemplazar placeholder)

- 6 cards resumen en grid
- Gráfico de actividad (puede ser SVG simple o recharts)
- Tabla de top terapeutas
- Diseño consistente con el design system del backoffice

---

## Criterio de aceptación

- [ ] AdminDashboard muestra métricas reales desde la BD
- [ ] Cards con totales de usuarios, terapeutas, sesiones, promedios
- [ ] Gráfico de actividad de los últimos 30 días
- [ ] Tabla de top terapeutas
- [ ] Solo accesible para admin y superadmin

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
