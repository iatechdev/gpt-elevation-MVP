# HU-051 — Recomendaciones IA de Bienestar

> Sprint 5 | Must Have | 5 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán

---

## Contexto

La IA de Elevation tiene acceso al historial emocional del usuario. Con esa información puede generar recomendaciones de bienestar personalizadas: ejercicios, hábitos, reflexiones, recursos. Estas recomendaciones son visibles tanto para el usuario como para su terapeuta.

---

## Modelo nuevo — WellnessRecommendation

```js
WellnessRecommendation: {
  id:        INTEGER (PK)
  UserId:    INTEGER (FK → User)
  content:   TEXT (encriptado AES-256)
  category:  STRING — 'mindfulness' | 'habit' | 'reflection' | 'resource'
  generatedAt: DATE
  seenByUser: BOOLEAN (default false)
  seenByTherapist: BOOLEAN (default false)
}
```

---

## Endpoints nuevos

```
POST /api/recommendations/generate     ← generar recomendaciones para el usuario logueado
GET  /api/recommendations              ← obtener recomendaciones del usuario
PUT  /api/recommendations/:id/seen     ← marcar como vista
GET  /api/therapist/pacientes/:id/recommendations ← recomendaciones del paciente
```

### POST /api/recommendations/generate
- Toma los últimos 7 MoodLogs del usuario
- Llama a Claude API con un prompt de análisis
- Genera 3 recomendaciones personalizadas
- Las guarda encriptadas en BD
- Retorna las recomendaciones al usuario

---

## Frontend

### En `/app/chat` — sección de recomendaciones
```
✨ Recomendaciones de hoy

🧘 Mindfulness
"Dedica 5 minutos esta tarde a..."

📓 Reflexión
"¿Qué momento de hoy te generó más calma?"

🌿 Hábito
"Intenta salir a caminar 15 minutos mañana..."

[Generar nuevas recomendaciones]
```

### En `/therapist/patient/:id` — sección de recomendaciones del paciente
- Lista de recomendaciones recientes
- Indicador de si el usuario las vio

---

## Criterio de aceptación

- [ ] Usuario puede generar recomendaciones de bienestar desde el chat
- [ ] Las recomendaciones se generan basadas en el historial emocional reciente
- [ ] Las recomendaciones se guardan encriptadas en BD
- [ ] Terapeuta puede ver las recomendaciones de sus pacientes
- [ ] Las recomendaciones tienen categoría visible (mindfulness, hábito, reflexión)

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
