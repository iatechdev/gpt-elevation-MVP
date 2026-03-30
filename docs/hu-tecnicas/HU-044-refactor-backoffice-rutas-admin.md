# HU-044 — Refactor backoffice a rutas /admin dedicadas

> Sprint 4 | Must Have | 8 puntos
> Documentada: 30 de marzo de 2026
> Aprobada por Mauro Roldán

---

## Contexto y decisiones arquitectónicas

### Decisión 1 — Admin y superadmin son usuarios administrativos, no usuarios de la plataforma
Los roles `admin` y `superadmin` NO son usuarios que vienen a chatear con Elevation ni a buscar un terapeuta. Son usuarios internos del equipo que administran la plataforma. Por lo tanto:
- Al hacer login, van directo a `/admin/dashboard` — nunca al chat
- No pasan por el check-in emocional
- No ven el chat de Elevation
- Su experiencia es completamente diferente a la del usuario regular

### Decisión 2 — Admin y superadmin ven el mismo dashboard pero con funciones diferentes

| Función | Admin | Superadmin |
|---|---|---|
| Ver métricas e informes | ✅ | ✅ |
| Ver versiones de prompts | ✅ | ✅ |
| Proponer cambios de prompt | ✅ | ✅ |
| Aprobar/rechazar prompts | ❌ | ✅ |
| Editar contenido landing | ✅ | ✅ |
| Editar precios y promociones | ✅ | ✅ |
| Crear usuarios (user/therapist) | ✅ | ✅ |
| Crear usuarios admin | ❌ | ✅ |
| Crear superadmin | ❌ | ✅ |
| Desactivar/activar usuarios | ✅ | ✅ |
| Asignar pacientes a terapeutas | ✅ | ✅ |
| Cambiar roles a admin/superadmin | ❌ | ✅ |

### Decisión 3 — Redirect automático por rol al hacer login
```
admin/superadmin → /admin/dashboard
therapist        → /therapist/dashboard  (HU-046)
user             → /app/checkin
```

### Decisión 4 — Rutas protegidas bidireccionales
- Admin/superadmin que intenta ir a `/app/chat` → redirect a `/admin/dashboard`
- User/therapist que intenta ir a `/admin/*` → redirect a `/app/checkin`

---

## Descripción

Como admin o superadmin, quiero tener un panel de administración dedicado con sus propias rutas, navegación y diseño, separado completamente de la experiencia del usuario regular. Al hacer login debo ir directo al backoffice.

---

## Rutas nuevas

```
/admin/dashboard   ← vista principal con KPIs y accesos rápidos
/admin/prompts     ← gestión de prompts
/admin/contenido   ← todas las páginas públicas editables (HU-048)
/admin/usuarios    ← gestión y creación de usuarios (HU-045)
/admin/metricas    ← dashboard de métricas detallado (HU-047)
```

---

## Layout del backoffice

```
┌─────────────────────────────────────────────────────────┐
│  ELEVATION admin    [nombre] [rol]            [Salir]  │  Header 60px
├──────────┬─────────────────────────────────────┤
│ Dashboard│                                         │
│ Prompts ⏳│   Contenido principal                   │
│ Contenido│                                         │
│ Usuarios │                                         │
│ Métricas │                                         │
│  240px   │   flex-1                                │
└──────────┴─────────────────────────────────────┘
```

**Colores backoffice:**
- Fondo: `#F5F3EF`
- Sidebar: `#EDEAE4`
- Header: `rgba(245,243,239,0.9)`

---

## Archivos nuevos

```
frontend/src/
├── layouts/
│   └── AdminLayout.tsx          ← Header + Sidebar + Outlet
├── pages/admin/
│   ├── AdminDashboard.tsx       ← KPIs + accesos rápidos
│   ├── AdminPrompts.tsx         ← gestión de prompts
│   ├── AdminContenido.tsx       ← contenido páginas (HU-048)
│   ├── AdminUsuarios.tsx        ← gestión usuarios (HU-045)
│   └── AdminMetricas.tsx        ← métricas (HU-047)
└── components/
    └── AdminSidebar.tsx         ← navegación con lógica de rol
```

## Archivos modificados

```
frontend/src/App.tsx              ← rutas /admin/* + guards
frontend/src/pages/LoginPage.tsx  ← redirect por rol post-login
frontend/src/pages/ChatPage.tsx   ← eliminar panel admin slide-in
```

---

## Lógica de redirect en LoginPage

```js
if (role === 'admin' || role === 'superadmin') {
  navigate('/admin/dashboard')
} else if (role === 'therapist') {
  navigate('/therapist/dashboard')
} else {
  navigate('/app/checkin')
}
```

---

## AdminDashboard — contenido

### Cards KPIs (todos los roles)
- Total usuarios activos
- Sesiones hoy
- Rating promedio
- % mejora emocional (checkout > checkin)

### Versiones pendientes
- Admin: las ve pero no puede aprobar
- Superadmin: puede aprobar/rechazar desde acá

### Accesos rápidos por rol
- Admin: Prompts, Contenido, Métricas
- Superadmin: todos

---

## Criterio de aceptación

- [ ] Admin login → va a `/admin/dashboard` directamente
- [ ] Superadmin login → va a `/admin/dashboard` directamente
- [ ] Usuario regular login → va a `/app/checkin` como siempre
- [ ] Admin en `/app/chat` → redirect a `/admin/dashboard`
- [ ] User en `/admin/*` → redirect a `/app/checkin`
- [ ] Sidebar muestra solo secciones permitidas por rol
- [ ] Admin NO ve botón aprobar/rechazar prompts
- [ ] Admin NO puede crear usuarios admin ni superadmin
- [ ] ChatPage.tsx sin panel admin slide-in
- [ ] Diseño del backoffice visualmente diferente al chat

---

## Orden de implementación para Claude Code

1. `AdminLayout.tsx` — header + sidebar + Outlet
2. `AdminSidebar.tsx` — navegación con lógica de rol
3. Páginas placeholder: `AdminDashboard`, `AdminPrompts`, `AdminContenido`, `AdminUsuarios`, `AdminMetricas`
4. `App.tsx` — rutas `/admin/*` con guards
5. `LoginPage.tsx` — redirect por rol
6. Migrar lógica de prompts de `ChatPage` a `AdminPrompts`
7. Limpiar `ChatPage.tsx`
8. Probar flujo con los tres roles

---
*Documentado: 30 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
