# HU-062 — Therapist Dashboard Mejorado

> Sprint 6 | Must Have | 5 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán
> Referencia visual: Manus design — /therapist

---

## Contexto

El dashboard actual del terapeuta muestra cards de métricas y lista de pacientes. Según el diseño de Manus, necesita alertas inteligentes, tendencias por paciente y un panel lateral de alertas.

---

## Layout

```
Sidebar izquierdo fijo:
- Dashboard
- Mis pacientes
- Calendario (Sprint 7)
- Mi prompt
- Configuración

Contenido principal (dos columnas):
- Izquierda (70%): métricas + lista de pacientes
- Derecha (30%): panel de alertas
```

---

## Cards de métricas (ya existe, mejorar)

```
[Pacientes activos: 12]  [Sesiones esta semana: 8]  [Mood promedio: 4.2 😊]  [Rating promedio: 4.8/5 ★]
```

---

## Lista de pacientes mejorada

Cada paciente muestra:
```
[Nombre]              [Próxima sesión]   [Ver ficha]
[Emoji mood] [Badge tendencia]           
```

Badge de tendencia (calculado con últimos 7 días de MoodLog):
- 📈 **Mejorando** — mood promedio últimos 3 días > mood promedio días 4-7
- 📊 **Estable** — diferencia < 0.5
- 📉 **Decayendo** — mood promedio últimos 3 días < mood promedio días 4-7

Colores:
- Mejorando: verde `#EAF0E6`
- Estable: azul `#E0F2FE`  
- Decayendo: rojo `#FEE2E2`

---

## Panel de Alertas (nuevo)

Alerta 1 — Paciente sin actividad:
```
⚠️ [Nombre] sin actividad
No ha tenido sesiones en 7 días
```
- Se genera cuando un paciente asignado no tiene MoodLog en los últimos 7 días

Alerta 2 — Recomendación pendiente de aprobación:
```
ℹ️ Recomendación pendiente
[Nombre] tiene 1 recomendación IA esperando aprobación
```
- Sprint 7: flujo de aprobación de recomendaciones por terapeuta
- Por ahora: mostrar pero sin acción

Alerta 3 — Progreso notable:
```
✅ Progreso notable
[Nombre] ha mejorado su mood un X% esta semana
```
- Se genera cuando el mood promedio de los últimos 3 días es >= 30% mejor que la semana anterior

---

## Sidebar mejorado

Agregar al sidebar existente:
- **Calendario** — Sprint 7 (requiere Google Calendar API)
- **Configuración** — Sprint 7 (perfil del terapeuta, disponibilidad, especialidades)

Por ahora: items en sidebar con estado "Próximamente"

---

## Endpoint nuevo necesario

```
GET /api/therapist/dashboard-alerts
```

Retorna:
```json
{
  "inactivePatients": [{"userId": 1, "name": "...", "daysSinceLastSession": 8}],
  "notableProgress": [{"userId": 2, "name": "...", "improvementPercent": 40}],
  "patientTrends": [{"userId": 1, "trend": "improving" | "stable" | "declining"}]
}
```

---

## Criterios de aceptación

- [ ] Lista de pacientes muestra badge de tendencia (Mejorando/Estable/Decayendo)
- [ ] Panel de alertas visible con pacientes sin actividad
- [ ] Panel de alertas muestra progreso notable
- [ ] Sidebar tiene items de Calendario y Configuración (estado: próximamente)
- [ ] Cards de métricas actualizadas con datos reales

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
*Basada en diseño Manus: elevationapp-237qhhdc.manus.space/therapist*
