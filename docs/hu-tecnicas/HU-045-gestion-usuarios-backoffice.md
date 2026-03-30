# HU-045 — Gestión de usuarios desde backoffice

> Sprint 4 | Must Have | 6 puntos
> Documentada: 30 de marzo de 2026
> Aprobada por Mauro Roldán

---

## Contexto y decisiones

### ¿Quién puede crear qué tipo de usuario?

| Tipo de usuario a crear | Admin | Superadmin |
|---|---|---|
| user | ✅ | ✅ |
| therapist | ✅ | ✅ |
| admin | ❌ | ✅ |
| superadmin | ❌ | ✅ |

### ¿Quién puede hacer qué acción?

| Acción | Admin | Superadmin |
|---|---|---|
| Crear usuarios (user/therapist) | ✅ | ✅ |
| Crear usuarios admin/superadmin | ❌ | ✅ |
| Ver lista de todos los usuarios | ✅ | ✅ |
| Desactivar/activar usuarios | ✅ | ✅ |
| Cambiar rol a admin/superadmin | ❌ | ✅ |
| Asignar pacientes a terapeutas | ✅ | ✅ |
| Ver estadísticas por usuario | ✅ | ✅ |

---

## Descripción

Como admin o superadmin, quiero poder crear usuarios, asignar roles y gestionar el acceso a la plataforma directamente desde el backoffice, sin necesidad de registrarse por el flujo público.

---

## Cambios en el modelo User

Agregar campo `active` para desactivar usuarios sin borrarlos:

```js
active: {
  type: DataTypes.BOOLEAN,
  defaultValue: true,
  allowNull: false
}
```

Agregar campo `therapistId` para la asignación de pacientes:
```js
therapistId: {
  type: DataTypes.INTEGER,
  allowNull: true,
  references: { model: 'Users', key: 'id' }
}
```

---

## Endpoints nuevos

```
POST /api/admin/usuarios          ← crear usuario (admin crea user/therapist, superadmin cualquiera)
GET  /api/admin/usuarios          ← listar todos con filtros
PUT  /api/admin/usuarios/:id      ← editar rol, activar/desactivar
PUT  /api/admin/usuarios/:id/asignar-terapeuta  ← asignar paciente a terapeuta
GET  /api/admin/usuarios/:id/stats ← estadísticas de un usuario
```

### POST /api/admin/usuarios
Body:
```json
{
  "name": "Ana García",
  "email": "ana@example.com",
  "password": "temporal123",
  "role": "therapist"
}
```
- Admin: puede crear `user` y `therapist`. Si intenta crear `admin` → 403
- Superadmin: puede crear cualquier rol
- El usuario creado recibe una contraseña temporal que debe cambiar en su primer login (Sprint futuro)

### GET /api/admin/usuarios
Retorna lista con:
- id, name, email, role, active, createdAt, lastLogin (si existe), sesionesCont, moodPromedio, ratingPromedio

Filtros opcionales por query param:
- `?role=user` → filtrar por rol
- `?active=true` → filtrar por estado
- `?therapistId=5` → pacientes de un terapeuta específico

### PUT /api/admin/usuarios/:id
Body:
```json
{
  "role": "therapist",
  "active": false
}
```
- Admin: no puede cambiar role a `admin` ni `superadmin` → 403
- Superadmin: puede cambiar cualquier rol

---

## Frontend — AdminUsuarios.tsx

### Vista de lista
```
[Crear usuario +]   [Filtrar por rol ▼]  [Estado: Todos ▼]

┌─────────────┬─────────────┬──────────┬─────────┬───────┐
│ Usuario      │ Rol          │ Sesiones  │ Estado   │ Acción │
├─────────────┼─────────────┼──────────┼─────────┼───────┤
│ Ana García   │ user         │ 12        │ Activo   │ [···]  │
│ Carlos M.    │ therapist    │ -         │ Activo   │ [···]  │
└─────────────┴─────────────┴──────────┴─────────┴───────┘
```

### Panel lateral al hacer click en [···]
- Nombre y email del usuario
- Cambiar rol (con restricciones por rol del admin)
- Activar/desactivar
- Ver estadísticas: sesiones totales, mood promedio, rating promedio
- Si es user: asignarle un terapeuta (dropdown de terapeutas activos)

### Modal de creación de usuario
```
[Nombre completo]
[Email]
[Contraseña temporal]
[Rol: user | therapist | admin* | superadmin*]  (* solo visible para superadmin)
[Crear usuario]
```

---

## Seguridad

- El endpoint valida el rol del token antes de permitir crear roles privilegiados
- No se puede desactivar al propio usuario autenticado
- No se puede cambiar el rol del propio usuario autenticado
- Las contraseñas se hashean con bcrypt antes de guardar (igual que el registro público)

---

## Criterio de aceptación

- [ ] Admin crea usuario con rol `user` → usuario creado exitosamente
- [ ] Admin crea usuario con rol `therapist` → usuario creado exitosamente
- [ ] Admin intenta crear usuario con rol `admin` → opción no disponible en el formulario
- [ ] Superadmin crea usuario con cualquier rol → usuario creado exitosamente
- [ ] Admin desactiva usuario → usuario no puede hacer login
- [ ] Admin reactiva usuario → usuario puede hacer login nuevamente
- [ ] Admin asigna paciente a terapeuta → terapeuta ve al paciente en su dashboard
- [ ] Admin intenta desactivarse a sí mismo → error claro
- [ ] Lista de usuarios muestra rol, estado y estadísticas básicas

---
*Documentado: 30 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
