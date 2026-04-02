# HU-061 — User Dashboard Unificado

> Sprint 6 | Must Have | 8 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán
> Referencia visual: Manus design — /dashboard

---

## Contexto

Actualmente el usuario entra al chat directamente desde el check-in. No existe un dashboard centralizado. Según el diseño de Manus, el usuario debe tener una pantalla principal que integre el chat, su estado emocional, progreso, próxima sesión y recomendaciones — todo en una sola vista.

---

## Layout

Dos columnas:
- **Columna izquierda (40%):** widgets de estado emocional, progreso semanal, próxima sesión
- **Columna derecha (60%):** chat con Elevation IA
- **Sección inferior:** recomendaciones personalizadas en cards 2x2

---

## Header

```
[Logo Elevation]          Mi progreso | Mi terapeuta | Perfil
```

- "Mi progreso" navega a /app/progress
- "Mi terapeuta" navega a /app/therapist (vista del terapeuta asignado) — Sprint 7
- "Perfil" navega a /app/profile — Sprint 7

---

## Widget 1 — Estado emocional

```
♡ Estado emocional
[😞] [😔] [😐] [🙂] [😊]
```

- Check-in rápido desde el dashboard (reemplaza /app/checkin)
- Al seleccionar emoji, guarda el mood y desbloquea el chat
- Si ya hizo check-in hoy, muestra el emoji seleccionado en verde

---

## Widget 2 — Tu progreso

```
↗ Tu progreso
Sesiones esta semana
5 de 7

Tendencia emocional
[■][■][■][□][■][■][□]  ← 7 días, coloreados según mood
```

- Sesiones realizadas esta semana vs objetivo (configurable, default 7)
- Tendencia: cuadros de 7 días coloreados según mood promedio del día
- Verde = mood >= 3.5, Amarillo = mood 2.5-3.5, Rojo = mood < 2.5, Gris = sin dato

---

## Widget 3 — Próxima sesión

```
📅 Próxima sesión
Con [Nombre terapeuta]
[Fecha y hora]
[Entrar a videollamada]
```

- Solo visible si el usuario tiene terapeuta asignado
- "Entrar a videollamada" — Sprint 7 (requiere Daily.co o Jitsi + Google Calendar API)
- Por ahora: botón visible pero con tooltip "Próximamente"
- Si no tiene terapeuta: muestra widget de matching (botón 🤝 Buscar terapeuta)

---

## Sección Recomendaciones personalizadas

```
Recomendaciones personalizadas
[Card 1: Técnica respiración]  [Card 2: Establecer límites]
[Card 3: Meditación guiada]    [Card 4: Reflexión valores]
[Explorar]
```

- Muestra las últimas 4 recomendaciones del usuario (de WellnessRecommendation)
- Botón "Explorar" en cada card — por ahora abre un modal con el contenido completo
- Si no hay recomendaciones: botón "Generar mis primeras recomendaciones"

---

## Ruta

```
/app/dashboard  → nueva ruta principal del usuario
```

**Decisión de arquitectura:** La ruta `/app/chat` queda como ruta directa al chat. `/app/dashboard` es el nuevo home del usuario. El check-in se integra en el dashboard como widget, no como página separada.

---

## Criterios de aceptación

- [ ] Usuario ve dashboard unificado al entrar
- [ ] Widget de estado emocional funciona como check-in rápido
- [ ] Widget de progreso muestra sesiones de la semana y tendencia de 7 días
- [ ] Widget de próxima sesión visible si tiene terapeuta asignado
- [ ] Recomendaciones personalizadas en grid 2x2
- [ ] Header con navegación: Mi progreso, Mi terapeuta, Perfil
- [ ] Chat embebido en columna derecha funciona igual que /app/chat

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
*Basada en diseño Manus: elevationapp-237qhhdc.manus.space/dashboard*
