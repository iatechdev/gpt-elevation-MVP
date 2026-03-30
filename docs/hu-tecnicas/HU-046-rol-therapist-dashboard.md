# HU-046 — Rol Therapist y Dashboard de Pacientes

> Sprint 4 | Must Have | 5 puntos
> Documentada: 30 de marzo de 2026
> Aprobada por Mauro Roldán

---

## Contexto

El terapeuta es un rol especializado de Elevation. No es un usuario de la plataforma ni un administrador técnico. Es un profesional de salud mental que:
- Acompaña a usuarios asignados
- Tiene su propia corriente terapéutica
- Puede definir su propio prompt (con aprobación del superadmin)
- Ve el progreso emocional de sus pacientes

**Alcance Sprint 4:** Dashboard básico con lista de pacientes e historial emocional.
Las funcionalidades clínicas avanzadas (historia clínica completa, recomendaciones, calendario) van en Sprint 5 y 6.

---

## Flujo de login del terapeuta

```
Login → role === 'therapist' → redirect a /therapist/dashboard
```

El terapeuta nunca ve el chat de Elevation ni el backoffice de admin.

---

## Rutas del terapeuta

```
/therapist/dashboard     ← vista principal con lista de pacientes
/therapist/paciente/:id  ← detalle del paciente (historial emocional)
```

---

## Layout del terapeuta

Diseño similar al backoffice pero con identidad propia:
- Header: `ELEVATION` + nombre terapeuta + especialidad + logout
- Sin sidebar — navegación simple por ahora
- Fondo: `#f9f9f7` (igual al chat — es una experiencia más cercana al usuario que al admin)

---

## TherapistDashboard — contenido Sprint 4

### Cards resumen
- Total pacientes asignados
- Pacientes activos esta semana
- Promedio de mood de sus pacientes
- Rating promedio de sesiones de sus pacientes

### Lista de pacientes
```
┌──────────────────────────────────────────────────────┐
│ 👤 Ana García                                         │
│ Último mood: 🙂  Hace 2 días  Tendencia: ↑ mejorando  │
│ 12 sesiones · Rating prom: ★★★★☆                       │
│ [Ver historial]                                      │
└──────────────────────────────────────────────────────┘
```

### Detalle del paciente (/therapist/paciente/:id)
- Nombre y fecha de ingreso
- Gráfico de tendencia emocional (check-in vs checkout por día)
- Historial de MoodLogs con emojis y fechas
- Historial de SessionRatings
- Notas del terapeuta (campo de texto libre — Sprint 5 formalmente)

---

## Endpoints nuevos

```
GET /api/therapist/pacientes              ← lista de pacientes asignados al terapeuta
GET /api/therapist/pacientes/:id/historial ← MoodLogs + SessionRatings del paciente
```

### GET /api/therapist/pacientes
- Solo funciona si el token tiene `role: 'therapist'`
- Retorna usuarios donde `therapistId === req.user.id`
- Incluye último MoodLog y promedio de ratings

### GET /api/therapist/pacientes/:id/historial
- Verifica que el paciente esté asignado al terapeuta del token
- Retorna MoodLogs últimos 30 días + SessionRatings

---

## Archivos nuevos

```
frontend/src/
├── layouts/
│   └── TherapistLayout.tsx       ← header simple + Outlet
├── pages/therapist/
│   ├── TherapistDashboard.tsx    ← /therapist/dashboard
│   └── TherapistPaciente.tsx     ← /therapist/paciente/:id
└── components/
    └── TherapistRoute.tsx        ← guard para rutas /therapist/*
```

---

## App.tsx — nuevas rutas

```tsx
<Route element={<TherapistRoute />}>
  <Route path="/therapist/dashboard"    element={<TherapistDashboard />} />
  <Route path="/therapist/paciente/:id" element={<TherapistPaciente />} />
</Route>
```

---

## Criterio de aceptación Sprint 4

- [ ] Terapeuta hace login → va a `/therapist/dashboard`
- [ ] Terapeuta ve lista de sus pacientes asignados
- [ ] Terapeuta ve último mood y tendencia de cada paciente
- [ ] Terapeuta hace click en paciente → ve historial emocional completo
- [ ] Terapeuta NO puede acceder a `/admin/*`
- [ ] Usuario regular NO puede acceder a `/therapist/*`
- [ ] Admin puede asignar pacientes a terapeutas desde `/admin/usuarios`

---

## Lo que viene en Sprint 5 para el terapeuta
- Su propio prompt terapéutico (proponer + aprobación superadmin)
- Historia clínica completa con documentos
- Recomendaciones de la IA para sus pacientes
- Notas clínicas formales
- Ver pacientes reasignados con historia clínica previa

---
*Documentado: 30 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
