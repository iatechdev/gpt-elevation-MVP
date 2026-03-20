# HU-027 — Rol de Administrador y Acceso al Backoffice

**Épica:** EP-11 — Backoffice y Prompt Vault  
**Responsable:** Mauricio Roldán (backend) + Alejo Roldán (UI)  
**Story Points:** 5  
**Prioridad:** Must Have  
**Estado:** ⏳ Pendiente aprobación  
**Sprint:** Sprint 1  
**Issue GitHub:** Por crear

---

## Historia de Usuario

**Como** administrador de Elevation (Alejo),  
**quiero** tener un rol diferenciado del usuario normal que me dé acceso a una sección privada de administración,  
**para** gestionar la configuración de la plataforma sin afectar la experiencia de los usuarios finales.

---

## Criterios de Aceptación

### Escenario 1: Login como admin
- **Given** que tengo una cuenta con rol `admin` en la BD
- **When** inicio sesión con mis credenciales
- **Then** veo en el menú una opción "Backoffice" que los usuarios normales no ven

### Escenario 2: Acceso directo protegido
- **Given** que soy un usuario con rol `user` (no admin)
- **When** intento acceder directamente a `/backoffice` en la URL
- **Then** recibo un error 403 y soy redirigido a `/chat`

### Escenario 3: Protección a nivel de API
- **Given** que cualquier petición llega a los endpoints de backoffice
- **When** el token de sesión no tiene rol `admin`
- **Then** el servidor responde 403 sin ejecutar ninguna operación

### Escenario 4: Seed del primer admin
- **Given** que la BD está vacía (primer deploy)
- **When** se ejecuta el script de seed
- **Then** se crea un usuario admin con email y contraseña configurados en variables de entorno (nunca en código)

---

## Notas Técnicas

### Cambios en BD
```sql
-- Agregar columna role a la tabla users
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
-- Valores posibles: 'user' | 'admin'
```

### Middleware de protección (servidor)
```typescript
// platform/server/infrastructure/adminGuard.ts
export const adminGuard = t.middleware(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

export const adminProcedure = t.procedure.use(adminGuard);
```

### Ruta protegida (frontend)
```typescript
// platform/client/src/components/AdminRoute.tsx
// Wrapper de ruta que verifica rol admin antes de renderizar
// Redirige a /chat si el usuario no es admin
```

### Variables de entorno necesarias
```
ADMIN_SEED_EMAIL=alejo@elevation.app
ADMIN_SEED_PASSWORD=<contraseña segura generada>
```

---

## Definition of Done
- [ ] Columna `role` en tabla `users` con migración Drizzle
- [ ] Middleware `adminGuard` en servidor
- [ ] `AdminRoute` component en frontend
- [ ] Ruta `/backoffice` registrada en App.tsx con protección
- [ ] Script de seed para crear primer admin
- [ ] Tests: acceso denegado a usuario sin rol admin (3 escenarios)
- [ ] PR revisado y aprobado
