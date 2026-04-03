# HU-064 — User Dashboard: Widget Progreso + Próxima Sesión + Recomendaciones

> Sprint 6 | Must Have | 3 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán
> **Completada: 3 de abril de 2026**
> Referencia visual: Manus design — /dashboard (scroll)
> Depende de: HU-061

---

## Nota de implementación

Todos los widgets de esta HU fueron implementados directamente en `UserDashboard.tsx` como parte de HU-061. No requirió archivos adicionales.

---

## Widget 2 — Tu progreso

- Sesiones esta semana: conteo de MoodLogs con date >= lunes de la semana actual
- Objetivo: 7 sesiones (hardcodeado por ahora, configurable en Sprint 7)
- Tendencia: 7 cuadros coloreados por mood promedio del día
  - Verde (#6B7D5C) = avgMood >= 3.5
  - Amarillo (#F59E0B) = avgMood 2.5–3.5
  - Rojo (#EF4444) = avgMood < 2.5
  - Gris (#E7E5E4) = sin dato ese día

---

## Widget 3 — Próxima sesión

- Visible solo si el usuario tiene therapistId asignado
- Botón "Entrar a videollamada" visible pero deshabilitado — Sprint 7
- Si NO tiene terapeuta: muestra botón "🤝 Buscar mi terapeuta" que abre modal de matching

---

## Sección Recomendaciones personalizadas

- Grid 2x2 con últimas 4 recomendaciones de WellnessRecommendation
- Botón "Explorar" abre modal con contenido completo
- Si no hay recomendaciones: botón "Generar nuevas" llama POST /api/recommendations/generate

---

## Archivos modificados

- `frontend/src/pages/UserDashboard.tsx` — implementado en HU-061

---

## Criterios de aceptación

- [x] Widget progreso muestra sesiones de la semana vs objetivo
- [x] Tendencia emocional muestra 7 cuadros coloreados correctamente
- [x] Widget próxima sesión visible si tiene terapeuta, con su nombre
- [x] Widget próxima sesión muestra botón matching si no tiene terapeuta
- [x] Recomendaciones en grid 2x2 con botón Explorar
- [x] Modal de detalle de recomendación funcionando

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
*Completada: 3 de abril de 2026 — implementada dentro de HU-061*
