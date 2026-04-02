# HU-064 — User Dashboard: Widget Progreso + Próxima Sesión + Recomendaciones

> Sprint 6 | Must Have | 3 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán
> Referencia visual: Manus design — /dashboard (scroll)
> Depende de: HU-061

---

## Widget 2 — Tu progreso

```
↗ Tu progreso
Sesiones esta semana
5 de 7

Tendencia emocional
[■][■][■][□][■][■][□]  ← 7 días
```

- Sesiones esta semana: conteo de MoodLogs con date >= lunes de la semana actual
- Objetivo: 7 sesiones (hardcodeado por ahora, configurable en Sprint 7)
- Tendencia: 7 cuadros coloreados por mood promedio del día
  - Verde (#6B7D5C) = avgMood >= 3.5
  - Amarillo (#F59E0B) = avgMood 2.5–3.5
  - Rojo (#EF4444) = avgMood < 2.5
  - Gris (#E7E5E4) = sin dato ese día

---

## Widget 3 — Próxima sesión

```
📅 Próxima sesión
Con [Nombre terapeuta]
[Entrar a videollamada]  ← deshabilitado con tooltip "Próximamente"
```

- Visible solo si el usuario tiene therapistId asignado
- Obtiene el nombre del terapeuta via GET /api/user/therapist-info (endpoint nuevo)
- Botón "Entrar a videollamada" visible pero deshabilitado — Sprint 7
- Si NO tiene terapeuta: muestra botón "🤝 Buscar terapeuta" que abre modal de matching

---

## Sección Recomendaciones personalizadas

```
Recomendaciones personalizadas
[Card: ícono + título + descripción corta + Explorar]
```

- Grid 2x2 con últimas 4 recomendaciones de WellnessRecommendation
- Botón "Explorar" abre modal con contenido completo de la recomendación
- Si no hay recomendaciones: botón "Generar mis primeras recomendaciones" llama POST /api/recommendations/generate

---

## Endpoint nuevo

```
GET /api/user/therapist-info
```
Retorna: `{ therapistId, therapistName }` o `null` si no tiene terapeuta asignado.

---

## Criterios de aceptación

- [ ] Widget progreso muestra sesiones de la semana vs objetivo
- [ ] Tendencia emocional muestra 7 cuadros coloreados correctamente
- [ ] Widget próxima sesión visible si tiene terapeuta, con su nombre
- [ ] Widget próxima sesión muestra botón matching si no tiene terapeuta
- [ ] Recomendaciones en grid 2x2 con botón Explorar
- [ ] Modal de detalle de recomendación funcionando

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
