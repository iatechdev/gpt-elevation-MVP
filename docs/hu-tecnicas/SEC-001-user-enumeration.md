# SEC-001 — User Enumeration en Login

> **Severidad:** Media  
> **Detectado:** 25 de marzo de 2026  
> **Detectado por:** Mauro Roldán (revisión funcional HU-024)  
> **Estado:** Pendiente — Sprint 3

---

## Descripción del problema

El endpoint `POST /api/login` en `backend/server.js` devuelve mensajes de error distintos dependiendo de si el email existe o no en la base de datos:

```
Email no registrado  → HTTP 404: "Usuario no encontrado."
Email registrado + contraseña incorrecta → HTTP 401: "Contraseña incorrecta. Intento X de 3."
```

Esto permite a un atacante realizar un **ataque de enumeración de usuarios**: probando emails sistemáticamente puede identificar cuáles están registrados en la plataforma sin necesidad de conocer contraseñas.

Dado que Elevation maneja datos sensibles de salud mental, la exposición de qué personas usan la plataforma representa un riesgo de privacidad significativo.

---

## Vector de ataque

```
POST /api/login
{ "email": "victima@ejemplo.com", "password": "cualquiera" }

→ 404: el email NO existe en el sistema
→ 401: el email SÍ existe (solo falla la contraseña)
```

Un script automatizado puede enumerar miles de emails en minutos.

---

## Solución propuesta

### Opción A — Mensaje genérico (recomendada)
Unificar todos los errores de login en un único mensaje:

```javascript
// En POST /api/login — server.js
if (!user || !validPassword) {
  return res.status(401).json({ 
    error: "Credenciales incorrectas. Verifica tu email y contraseña." 
  });
}
```

**Pro:** Elimina completamente la enumeración  
**Contra:** El usuario legítimo que escribe mal su email no sabe si el problema es el email o la contraseña

### Opción B — Rate limiting por IP (complementaria)
Limitar intentos de login por IP independientemente del email:

```javascript
// Usar express-rate-limit
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 intentos por IP cada 15 minutos
  message: { error: 'Demasiados intentos. Intenta más tarde.' }
});
app.post('/api/login', loginLimiter, async (req, res) => { ... });
```

**Pro:** Frena scripts automáticos sin cambiar la UX  
**Contra:** No elimina la enumeración, solo la ralentiza

### Recomendación final
Implementar **Opción A + Opción B** en Sprint 3. La combinación elimina la enumeración y protege contra fuerza bruta distribuida.

---

## Consideración de UX

El cambio al mensaje genérico genera fricción para usuarios legítimos. Para mitigarla se puede:

- Agregar un link `"¿Olvidaste tu contraseña?"` prominente en el formulario de login
- Implementar recuperación de contraseña por email (flujo pendiente)
- En el mensaje de error genérico, sugerir ambas opciones: *"Verifica tu email y contraseña, o recupera tu acceso"*

---

## Referencias
- [OWASP — Testing for Account Enumeration](https://owasp.org/www-project-web-security-testing-guide/)
- [CWE-204: Observable Response Discrepancy](https://cwe.mitre.org/data/definitions/204.html)
