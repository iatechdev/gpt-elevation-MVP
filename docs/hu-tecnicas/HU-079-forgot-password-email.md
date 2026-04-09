# HU-079 — Flujo "Olvidé mi contraseña" con email

> Sprint 10 | Must Have | 5 puntos
> Documentada: 9 de abril de 2026
> Aprobada por: Mauro Roldán
> Estado: PENDIENTE
> Depende de: configuración de email (SMTP/Resend)

---

## Contexto

El usuario no recuerda su contraseña y necesita recuperarla de forma autónoma, sin depender del admin. El flujo estándar es: solicitar reset por email → recibir link con token temporal → crear nueva contraseña.

---

## Flujo completo

```
1. Usuario en LoginPage hace click en "¿Olvidaste tu contraseña?"
2. Navega a /forgot-password
3. Ingresa su email
4. POST /api/forgot-password
   - Backend genera token UUID (expira en 1 hora)
   - Guarda en PasswordResetToken
   - Envía email con link: https://elevation-ia.com/reset-password?token=xxx
5. Usuario recibe el email, hace click en el link
6. Navega a /reset-password?token=xxx
7. Ingresa nueva contraseña (mínimo 8 caracteres)
8. POST /api/reset-password
   - Backend valida token (existe + no expirado + no usado)
   - Hashea y guarda nueva contraseña
   - Marca token como usado
   - Desbloquea cuenta (loginAttempts=0, lockedUntil=null)
9. Redirige a /login con mensaje de éxito
```

---

## Backend

### Modelo nuevo: `PasswordResetToken.js`
```js
{
  userId:    INTEGER — FK Users
  token:     STRING — UUID v4, único
  expiresAt: DATE — now + 1 hora
  usedAt:    DATE — null hasta que se use
}
```

### Endpoints nuevos en `auth.js` (rutas públicas):
```
POST /api/forgot-password
  Body: { email }
  Acción:
    1. Buscar usuario por email (silent fail si no existe — evitar enumeración)
    2. Generar token UUID
    3. Guardar en PasswordResetToken con expiresAt = now + 1h
    4. Enviar email via servicio de notificaciones
  Retorna: { message: 'Si el email existe recibirás un link en breve.' }
  Rate limit: 3 requests / 15 min por IP

POST /api/reset-password
  Body: { token, newPassword }
  Validación:
    1. Token existe en BD
    2. No está expirado (expiresAt > now)
    3. No fue usado (usedAt === null)
    4. newPassword mínimo 8 caracteres
  Acción:
    1. Hash nueva contraseña
    2. Actualizar usuario
    3. Desbloquear cuenta
    4. Marcar token como usado (usedAt = now)
  Retorna: { message: 'Contraseña actualizada correctamente.' }
```

### Servicio de email: `utils/mailer.js`
```js
// Configuración via variables de entorno
EMAIL_HOST=smtp.gmail.com      // o smtp.resend.com
EMAIL_PORT=587
EMAIL_USER=noreply@elevation-ia.com
EMAIL_PASS=tu_app_password
EMAIL_FROM=Elevation <noreply@elevation-ia.com>
```

Template del email de reset:
- Asunto: "Restablece tu contraseña de Elevation"
- Cuerpo: HTML simple con el link de reset
- El link expira en 1 hora
- Si no solicitaste esto, ignorar el email

---

## Frontend

### Páginas nuevas:
- `frontend/src/pages/ForgotPassword.tsx` — formulario con input de email
- `frontend/src/pages/ResetPassword.tsx` — formulario con nueva contraseña (lee ?token= de la URL)

### Cambio en LoginPage.tsx:
- Link "¿Olvidaste tu contraseña?" → navega a /forgot-password

### Rutas nuevas en App.tsx:
```
/forgot-password  → ForgotPassword (pública)
/reset-password   → ResetPassword  (pública)
```

---

## Variables de entorno necesarias

```
EMAIL_HOST=        # servidor SMTP
EMAIL_PORT=587     # puerto SMTP
EMAIL_USER=        # usuario/email remitente
EMAIL_PASS=        # contraseña o app password
EMAIL_FROM=        # nombre y email de display
FRONTEND_URL=      # ya existe — para construir el link del email
```

---

## Criterios de aceptación

- [ ] Usuario puede solicitar reset desde LoginPage
- [ ] Email llega en menos de 2 minutos
- [ ] El link expira en 1 hora
- [ ] El link solo se puede usar una vez
- [ ] Si el email no existe, no se revela esa información (silent fail)
- [ ] La cuenta queda desbloqueada después del reset exitoso
- [ ] Rate limit: máximo 3 solicitudes por 15 min por IP

---

## Dependencias de infraestructura

- Configurar cuenta de email (Gmail con App Password, o Resend, o SendGrid)
- Configurar variables de entorno en Cloud Run
- Verificar dominio `elevation-ia.com` para evitar spam (SPF, DKIM)

---
*Documentada: 9 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
