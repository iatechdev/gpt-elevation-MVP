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
El dashboard es el mismo visualmente para ambos roles. La diferencia está en qué pueden hacer:

| Función | Admin | Superadmin |
|---|---|---|
| Ver métricas e informes | ✅ | ✅ |
| Ver versiones de prompts | ✅ | ✅ |
| Proponer cambios de prompt | ✅ | ✅ |
| Aprobar/rechazar prompts | ❌ | ✅ |
| Editar contenido landing | ❌ | ✅ |
| Gestionar usuarios | ❌ | ✅ |
| Cambiar roles de usuarios | ❌ | ✅ |
| Asignar pacientes a terapeutas | ❌ | ✅ |

La lógica de ocultamiento va en el frontend — si el rol es `admin`, ciertos botones y secciones no se muestran.

### Decisión 3 — Rutas protegidas por rol desde el router
El router de React debe redirigir automáticamente:
- Si el usuario tiene rol `admin` o `superadmin` y va a `/login` → redirect a `/admin/dashboard`
- Si el usuario tiene rol `user` o `therapist` y trata de acceder a `/admin/*` → redirect a `/app/checkin`
- Si no hay token → redirect a `/login`

---

## Descripción

Como admin o superadmin, quiero tener un panel de administración dedicado con sus propias rutas, navegación y diseño — separado completamente de la experiencia del usuario regular. Al hacer login debo ir directo al backoffice sin pasar por el chat ni el check-in emocional.

---

## Rutas nuevas

```
/admin/dashboard   ← vista principal con KPIs y accesos rápidos
/admin/prompts     ← gestión de prompts (proponer, aprobar, historial)
/admin/contenido   ← edición de textos de la landing ES/EN
/admin/usuarios    ← gestión de usuarios (solo superadmin)
/admin/metricas    ← dashboard de métricas detallado
```

---

## Layout del backoffice

```
┌─────────────────────────────────────────────────────────────┐
│  ELEVATION admin    [nombre usuario] [rol]        [Salir]   │  Header 60px fijo
├──────────┬──────────────────────────────────────────────────┤
│          │                                                   │
│ Dashboard│   Contenido principal de cada sección            │
│ Prompts  │                                                   │
│ Contenido│                                                   │
│ Usuarios │                                                   │
│ Métricas │                                                   │
│          │                                                   │
│ (sidebar │                                                   │
│  240px)  │                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

**Colores del backoffice** (diferentes al chat para distinguirlos visualmente):
- Fondo: `#F5F3EF` (más warm que el `#f9f9f7` del chat)
- Sidebar: `#EDEAE4`
- Header: `rgba(245,243,239,0.9)`

---

## Archivos nuevos a crear

```
frontend/src/
├── layouts/
│   └── AdminLayout.tsx          ← Header + Sidebar + Outlet
├── pages/admin/
│   ├── AdminDashboard.tsx       ← /admin/dashboard
│   ├── AdminPrompts.tsx         ← /admin/prompts
│   ├── AdminContenido.tsx       ← /admin/contenido
│   ├── AdminUsuarios.tsx        ← /admin/usuarios
│   └── AdminMetricas.tsx        ← /admin/metricas
└── components/
    └── AdminSidebar.tsx         ← navegación lateral
```

---

## Archivos modificados

```
frontend/src/App.tsx             ← nuevas rutas /admin/* + redirect por rol
frontend/src/pages/LoginPage.tsx ← redirect a /admin/dashboard si es admin/superadmin
frontend/src/components/AdminRoute.tsx ← actualizar guard para nuevas rutas
```

---

## Lógica de redirect en Login

Después del login exitoso, según el rol:
```js
if (role === 'admin' || role === 'superadmin') {
  navigate('/admin/dashboard')
} else if (role === 'therapist') {
  navigate('/therapist/dashboard')  // Sprint 4 HU-046
} else {
  navigate('/app/checkin')
}
```

---

## Contenido del AdminDashboard (vista inicial)

### Cards de KPIs (todos los roles)
- Total usuarios activos
- Sesiones hoy
- Rating promedio de sesiones
- Indicador de mejora emocional (checkout_mood > checkin_mood en %)

### Versiones pendientes de aprobación
- Lista de versiones con status `pending_review`
- Admin: solo puede verlas
- Superadmin: puede aprobar/rechazar desde acá

### Accesos rápidos
- Admin: ir a Prompts, ver Métricas
- Superadmin: ir a Prompts, Contenido, Usuarios, Métricas

---

## Contenido del AdminSidebar

```
ELEVATION admin
─────────────
📊 Dashboard
🧠 Prompts          ← badge si hay pendientes
📝 Contenido        ← solo superadmin
👥 Usuarios         ← solo superadmin
📈 Métricas
─────────────
[Salir]
```

El sidebar oculta las secciones que el rol no puede ver.

---

## Qué pasa con ChatPage.tsx

El panel admin que hoy existe como slide-in en `ChatPage.tsx` se elimina completamente. `ChatPage.tsx` queda limpio — solo el chat para usuarios regulares. Los admins y superadmins nunca llegan a esa pantalla.

---

## Criterio de aceptación

- [ ] Admin hace login → va directo a `/admin/dashboard`
- [ ] Superadmin hace login → va directo a `/admin/dashboard`
- [ ] Usuario regular hace login → va a `/app/checkin` como siempre
- [ ] Admin intenta acceder a `/app/chat` → redirect a `/admin/dashboard`
- [ ] Usuario regular intenta acceder a `/admin/*` → redirect a `/app/checkin`
- [ ] Sidebar muestra solo las secciones permitidas según el rol
- [ ] Admin NO ve botones de aprobar/rechazar prompts
- [ ] Admin NO ve sección Usuarios ni Contenido en sidebar
- [ ] Superadmin ve todas las secciones y funciones
- [ ] El diseño del backoffice es visualmente diferente al chat
- [ ] ChatPage.tsx ya no tiene el panel admin slide-in

---

## Orden de implementación sugerido para Claude Code

1. Crear `AdminLayout.tsx` con header + sidebar + Outlet
2. Crear `AdminSidebar.tsx` con navegación y lógica de rol
3. Crear páginas vacías: `AdminDashboard`, `AdminPrompts`, `AdminContenido`, `AdminUsuarios`, `AdminMetricas`
4. Actualizar `App.tsx` con las nuevas rutas
5. Actualizar `LoginPage.tsx` con el redirect por rol
6. Migrar contenido del panel admin de `ChatPage.tsx` a las nuevas páginas
7. Limpiar `ChatPage.tsx` eliminando el panel admin
8. Probar flujo completo con los tres roles

---
*Documentado: 30 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
