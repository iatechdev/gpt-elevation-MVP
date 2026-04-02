# HU-060 — Matching Usuario-Terapeuta

> Sprint 5 | Should Have | 8 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán

---

## Contexto

Actualmente un admin asigna manualmente un terapeuta a un usuario desde el backoffice. Esta HU agrega inteligencia al proceso: el usuario puede indicar sus necesidades y la IA sugiere los terapeutas más afines. El admin confirma la asignación.

---

## Flujo completo

```
1. Usuario sin terapeuta ve sugerencia en el chat o en /app/progress
2. Usuario responde cuestionario breve (3-5 preguntas)
3. IA analiza respuestas + perfil emocional del usuario
4. Sistema sugiere top 3 terapeutas con justificación
5. Usuario elige su preferido o solicita ver más
6. Admin recibe notificación y confirma la asignación
7. Terapeuta es notificado del nuevo paciente
```

---

## Modelo nuevo — TherapistProfile

```js
TherapistProfile: {
  id:            INTEGER (PK)
  UserId:        INTEGER (FK → User, role: therapist)
  specialties:   TEXT (JSON array) — ['mindfulness', 'ansiedad', 'pareja']
  approach:      TEXT — descripción de su corriente terapéutica
  languages:     TEXT (JSON array) — ['es', 'en']
  bio:           TEXT — presentación para usuarios
  maxPatients:   INTEGER (default 20)
  currentPatients: INTEGER (virtual, calculado)
  acceptingNew:  BOOLEAN (default true)
}
```

---

## Modelo nuevo — MatchingRequest

```js
MatchingRequest: {
  id:           INTEGER (PK)
  UserId:       INTEGER (FK → User)
  answers:      TEXT (JSON — respuestas al cuestionario)
  suggestions:  TEXT (JSON — top 3 terapeutas sugeridos con scores)
  chosenTherapistId: INTEGER (FK → User, nullable)
  status:       STRING — 'pending' | 'confirmed' | 'rejected'
  createdAt:    DATE
}
```

---

## Endpoints nuevos

```
POST /api/matching/request           ← usuario envía cuestionario
GET  /api/matching/suggestions       ← obtener sugerencias IA
POST /api/matching/choose            ← usuario elige terapeuta
GET  /api/admin/matching/pending     ← admin ve solicitudes pendientes
POST /api/admin/matching/:id/confirm ← admin confirma asignación
```

---

## Cuestionario de matching (3 preguntas)

1. ¿Qué área quieres trabajar principalmente? (ansiedad / depresión / relaciones / crecimiento personal / otro)
2. ¿Qué estilo de acompañamiento prefieres? (reflexivo y exploratorio / estructurado y con metas / empático y de escucha / cualquiera)
3. ¿En qué idioma prefieres tus sesiones? (Español / Inglés / Sin preferencia)

---

## Algoritmo de matching (IA)

```
Inputs:
- Respuestas del cuestionario
- Últimos 14 MoodLogs del usuario (tendencia emocional)
- Lista de terapeutas disponibles con sus perfiles

Proceso:
- Llamada a Claude API con prompt de matching
- El prompt recibe: perfil del usuario + respuestas + lista de terapeutas
- Claude retorna: top 3 con score 1-10 + justificación por cada uno

Output:
[
  { therapistId: 3, score: 9.2, reason: "Su especialidad en ansiedad y enfoque mindfulness..." },
  { therapistId: 7, score: 8.1, reason: "Su corriente cognitivo-conductual es ideal para..." },
  { therapistId: 1, score: 7.4, reason: "Aunque su enfoque es más exploratorio..." }
]
```

---

## Frontend

### Para el usuario — en `/app/progress` o `/app/chat`
```
💡 ¿Querés trabajar con un terapeuta?
[Encontrar mi terapeuta ideal]
```

Modal con el cuestionario → resultados con cards de terapeutas → botón "Solicitar este terapeuta".

### Para el admin — en `/admin/usuarios`
- Badge con número de solicitudes de matching pendientes
- Lista de solicitudes con el terapeuta sugerido y botón de confirmar

---

## Criterio de aceptación

- [ ] Usuario sin terapeuta puede iniciar el proceso de matching
- [ ] Cuestionario de 3 preguntas funcional
- [ ] IA genera sugerencia de top 3 terapeutas con justificación
- [ ] Usuario puede elegir su terapeuta preferido
- [ ] Admin recibe la solicitud y puede confirmar la asignación
- [ ] Al confirmar, el `therapistId` del usuario se actualiza en BD
- [ ] Terapeuta ve al nuevo paciente en su dashboard
- [ ] TherapistProfile permite que cada terapeuta defina sus especialidades

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
