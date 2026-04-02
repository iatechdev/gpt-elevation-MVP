# HU-052 — Panel de Reportes del Usuario

> Sprint 5 | Should Have | 5 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán

---

## Contexto

El usuario tiene derecho a ver su propio progreso. Esta HU agrega una vista donde el usuario puede ver su historial emocional, sus tendencias, sus ratings de sesión y las recomendaciones que ha recibido.

---

## Ruta nueva

```
/app/progress  ← panel de progreso del usuario
```

Accesible desde el chat con un botón o enlace en el header.

---

## Contenido del panel

### Cards resumen
- Sesiones totales
- Mood promedio (últimos 30 días)
- Rating promedio de sesiones
- Racha actual (días consecutivos con check-in)

### Gráfico de tendencia emocional
- Check-in vs checkout por día (últimos 30 días)
- Visual simple con puntos y línea de tendencia

### Últimas recomendaciones
- Las 3 más recientes
- Categoría + texto

### Historial de sesiones
- Tabla con fecha, mood check-in, mood check-out, rating
- Últimas 30 sesiones

---

## Endpoint nuevo

```
GET /api/user/progress  ← resumen de progreso del usuario logueado
```

Retorna:
- MoodLogs últimos 30 días
- SessionRatings últimos 30 días
- WellnessRecommendations últimas 5
- Stats calculados: promedio mood, promedio rating, racha

---

## Criterio de aceptación

- [ ] Usuario puede acceder a `/app/progress` desde el chat
- [ ] Ve sus cards resumen con estadísticas reales
- [ ] Ve su historial de moods de los últimos 30 días
- [ ] Ve sus últimas recomendaciones de bienestar
- [ ] El diseño es consistente con el resto de la experiencia del usuario

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
