# HU-078 — Desbloqueo de usuario + Reset de contraseña por admin

> Sprint 10 | Must Have | 3 puntos
> Documentada: 9 de abril de 2026
> Aprobada por: Mauro Roldán
> Estado: EN PROGRESO

---

## Contexto

Los usuarios pueden quedar bloqueados por dos razones:
1. **Bloqueo por intentos fallidos** — después de 3 intentos incorrectos, `lockedUntil` se establece por 15 minutos. El bloqueo expira solo, pero el admin puede desbloquearlo manualmente.
2. **Desactivación manual** — `active: false` establecido por admin. El usuario puede reactivarse registrándose con el mismo email, O el admin puede reactivarlo directamente.

Además, cuando un usuario olvida su contraseña, el superadmin necesita poder establecer una temporal.

---

## Flujos

### Desbloqueo por admin
```
1. Admin ve en AdminUsers que el usuario tiene isLocked: true
2. Click en botón "Desbloquear"
3. PUT /api/admin/usuarios/:id/unlock
4. Backend resetea loginAttempts=0, lockedUntil=null, active=true
5. Usuario puede hacer login normalmente
```

### Reset de contraseña por superadmin
```
1. Superadmin abre panel lateral del usuario
2. Click en "Resetear contraseña"
3. Modal solicita nueva contraseña temporal
4. PUT /api/admin/usuarios/:id/reset-password
5. Backend hashea y guarda, desbloquea la cuenta
6. Admin le comunica la contraseña temporal al usuario por otro medio
```

---

## Backend

### Endpoints nuevos en `adminUsers.js`:

```
PUT /api/admin/usuarios/:id/unlock
  Auth: verificarAdmin (admin o superadmin)
  Acción: loginAttempts=0, lockedUntil=null, active=true
  Retorna: { message }

PUT /api/admin/usuarios/:id/reset-password
  Auth: verificarAdmin — solo superadmin puede ejecutarlo
  Body: { newPassword }
  Validación: mínimo 6 caracteres, no puede resetear otro superadmin
  Acción: hash password, loginAttempts=0, lockedUntil=null, active=true
  Retorna: { message }
```

### Campo nuevo en GET /api/admin/usuarios:
Se agrega `isLocked`, `lockedUntil` y `loginAttempts` al response para que el frontend pueda mostrar el estado.

---

## Frontend — AdminUsers.tsx

### Cambios en la lista de usuarios:
- Badge rojo **"🔒 Bloqueado"** visible en el card del usuario cuando `isLocked: true`
- Badge naranja **"⏸ Desactivado"** cuando `active: false`

### Cambios en el panel lateral del usuario:
- Botón **"🔓 Desbloquear cuenta"** — visible solo cuando `isLocked: true` o `active: false`
  - Disponible para admin y superadmin
- Botón **"🔑 Resetear contraseña"** — visible solo para superadmin
  - Abre modal con input de nueva contraseña
  - Mínimo 6 caracteres
  - Confirmación antes de ejecutar

---

## Permisos

| Acción | Admin | Superadmin |
|---|---|---|
| Ver estado de bloqueo | ✅ | ✅ |
| Desbloquear cuenta | ✅ | ✅ |
| Resetear contraseña | ❌ | ✅ |

---

## Criterios de aceptación

- [ ] Badge de bloqueo visible en lista de usuarios
- [ ] Admin puede desbloquear cuenta con un click
- [ ] Superadmin puede resetear contraseña con confirmación
- [ ] No se puede resetear contraseña de otro superadmin
- [ ] Al desbloquear, el usuario puede hacer login inmediatamente
- [ ] Log en backend de quién desbloqueó / reseteó

---

## Archivos modificados

- `backend/routes/adminUsers.js` — 2 endpoints nuevos ✅ COMPLETADO
- `frontend/src/pages/admin/AdminUsers.tsx` — badges + botones UI → PENDIENTE

---
*Documentada: 9 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
