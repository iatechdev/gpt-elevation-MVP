# HU-061 — User Dashboard: Layout + Check-in Integrado

> Sprint 6A | Must Have | 3 puntos
> Documentada: 3 de abril de 2026
> Aprobada por: Mauro Roldán
> Referencia visual: Manus design — /dashboard

---

## Flujo de usuario (decisión de arquitectura)

```
Login
  ↓
¿Ya hizo check-in hoy? (localStorage elevation_checkin_date)
  ├── NO → /app/dashboard (widget check-in activo, chat BLOQUEADO)
  │              ↓ usuario selecciona emoji
  │         check-in guardado → chat HABILITADO
  │              ↓ conversación
  │         Check-out modal + rating → Logout
  │
  └── SÍ → /app/dashboard (chat ya habilitado, widget muestra emoji del día)
```

**Decisiones clave:**
1. `/app/checkin` queda como ruta legacy — el check-in vive en el dashboard
2. El login siempre redirige a `/app/dashboard` — el dashboard detecta si ya hizo check-in
3. El check-out sigue viviendo en el ChatPage (modal al cerrar sesión) — no cambia
4. El chat está DESHABILITADO hasta que el usuario haga check-in del día

---

## Layout

```
Header: [Logo] ← Volver | Mi progreso | Mi terapeuta | Perfil

Body (dos columnas):
┌─────────────────────┬──────────────────────────────────┐
│ Columna izq (40%)   │ Columna der (60%)                │
│                     │                                  │
│ Widget 1:           │ Chat con Elevation IA            │
│ Estado emocional    │ (deshabilitado si no hizo        │
│                     │  check-in hoy)                   │
│ Widget 2:           │                                  │
│ Tu progreso         │ Mensaje: "Seleccioná cómo        │
│ (sesiones + 7 días) │  llegás hoy para empezar"        │
│                     │ (si no hizo check-in)            │
│ Widget 3:           │                                  │
│ Próxima sesión      │                                  │
│ (si tiene terapeuta)│                                  │
└─────────────────────┴──────────────────────────────────┘

Sección inferior:
[Recomendaciones personalizadas — grid 2x2]
```

---

## Widget 1 — Estado emocional (check-in integrado)

```
♡ Estado emocional

// Si NO hizo check-in hoy:
¿Cómo llegás hoy?
[😞] [😔] [😐] [🙂] [😊]  ← click guarda check-in y habilita chat

// Si YA hizo check-in hoy:
[😊]  ← emoji del día resaltado en verde, no editable
Ya registraste tu estado de hoy
```

**Lógica:**
- Al cargar: verificar `localStorage.getItem('elevation_checkin_date') === new Date().toDateString()`
- Al seleccionar emoji: POST /api/mood/checkin + guardar `elevation_checkin_date` en localStorage
- El chat se habilita solo después del check-in

---

## Widget 2 — Tu progreso

```
↗ Tu progreso
Sesiones esta semana: 5 de 7

Tendencia emocional (últimos 7 días):
[■][■][■][□][■][■][□]
```

**Colores de los cuadros de tendencia:**
- Verde (#6B7D5C)  = avgMood del día >= 3.5
- Amarillo (#F59E0B) = avgMood 2.5–3.5
- Rojo (#EF4444)   = avgMood < 2.5
- Gris (#E7E5E4)   = sin dato ese día

**Datos de:** GET /api/user/progress (ya existe, retorna moodLogs)

---

## Widget 3 — Próxima sesión

```
// Si tiene terapeuta asignado Y sesión agendada:
📅 Próxima sesión
Con [Nombre terapeuta]
[Fecha] — [Hora] — [duración] min
[Entrar a videollamada]  ← deshabilitado, tooltip "Próximamente"

// Si tiene terapeuta pero sin sesión agendada:
📅 Sin sesiones agendadas
Tu terapeuta aún no ha agendado una sesión.

// Si NO tiene terapeuta:
🤝 [Buscar mi terapeuta]  ← abre modal de matching
```

**Datos de:** GET /api/sessions/user/upcoming (nuevo — HU-066)

---

## Sección Recomendaciones

```
✨ Recomendaciones para vos
[Card 1]  [Card 2]
[Card 3]  [Card 4]
```

- Usa GET /api/recommendations (ya existe)
- Si no hay recomendaciones: botón "Generar mis primeras recomendaciones"
- Botón "Explorar" en cada card abre modal con contenido completo

---

## Ruta y navegación

```
/app/dashboard  ← nueva ruta principal del usuario
```

**LoginPage.tsx — redirect post-login:**
```
rol user → /app/dashboard  (siempre — el dashboard maneja el check-in)
rol therapist → /therapist/dashboard  (sin cambio)
rol admin/superadmin → /admin/dashboard  (sin cambio)
```

**App.tsx — nueva ruta:**
```tsx
<Route path="/app/dashboard" element={<UserDashboard />} />
```

---

## Criterios de aceptación

- [ ] Login redirige a /app/dashboard
- [ ] Dashboard detecta si usuario ya hizo check-in hoy
- [ ] Si no hizo check-in: chat deshabilitado, widget muestra 5 emojis
- [ ] Al seleccionar emoji: check-in guardado, chat habilitado
- [ ] Si ya hizo check-in: emoji del día visible, chat habilitado
- [ ] Widget progreso muestra sesiones de la semana + tendencia 7 días
- [ ] Widget próxima sesión visible si tiene TherapySession agendada
- [ ] Si no tiene terapeuta: botón matching visible
- [ ] Recomendaciones en grid 2x2
- [ ] Header con Mi progreso, Mi terapeuta (placeholder), Perfil (placeholder)

---
*Documentada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
