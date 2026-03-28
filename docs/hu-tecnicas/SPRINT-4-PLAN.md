# Elevation — Plan Sprint 4
> Documentado: 28 de marzo de 2026 | Claude (Tech Lead AI) + Mauro Roldán

---

## Contexto y decisiones arquitectónicas

### Backoffice — decisión tomada
El backoffice de Elevation será la **misma app con rutas `/admin` dedicadas y diseño diferente**, controlado por roles (`admin` y `superadmin`). Esta decisión es correcta porque:
- Evita duplicar autenticación y lógica de negocio
- Mantiene un solo deploy en Cloud Run
- Permite separar dominios por rol sin crear deuda técnica
- Es el paso natural previo a extraer microservicios reales cuando el producto escale

### Nuevo rol — `therapist` (terapeuta)
Se agrega un tercer tipo de usuario con funcionalidades propias de Elevation:
- Puede ver el historial emocional de sus pacientes (usuarios asignados)
- Tiene un dashboard de seguimiento de progreso
- No tiene acceso al panel de administración técnica
- Genera reportes de tendencias emocionales de sus pacientes

---

## Must Have (23 puntos)

### HU-044 — Refactor backoffice a rutas /admin dedicadas (8 pts)
Mover el panel admin del slide-in en ChatPage a rutas propias con diseño diferente.
- Nueva ruta `/admin/dashboard`
- Nueva ruta `/admin/prompts`
- Nueva ruta `/admin/contenido`
- Nueva ruta `/admin/usuarios`
- Layout admin separado: sidebar + header diferente al chat
- Solo accesible para `admin` y `superadmin`

### HU-045 — Gestión de usuarios desde backoffice (5 pts)
Panel de administración de usuarios.
- Listar todos los usuarios con rol, fecha de registro, última sesión
- Cambiar rol de usuario (user → therapist, user → admin)
- Desactivar/activar usuarios
- Ver estadísticas básicas por usuario (sesiones, mood promedio, rating promedio)
- Solo `superadmin` puede cambiar roles y desactivar

### HU-046 — Rol therapist y dashboard de pacientes (5 pts)
Nuevo rol con funcionalidades propias de Elevation.
- Nuevo rol `therapist` en el sistema de autenticación
- Vista `/therapist/dashboard` con lista de pacientes asignados
- Ver historial emocional (MoodLogs) de cada paciente
- Ver calificaciones de sesión (SessionRatings) de cada paciente
- Asignar/desasignar pacientes desde backoffice (solo superadmin)

### HU-047 — Dashboard de métricas ejecutivas (5 pts)
Panel de métricas para superadmin.
- Total usuarios activos / nuevos esta semana
- Promedio de rating de sesiones (global y por período)
- Distribución de mood check-in vs check-out (¿mejoran después de chatear?)
- Sesiones por día (gráfico)
- Top 5 usuarios más activos

---

## Should Have (13 puntos)

### HU-043 — Gestión de imágenes y videos en landing (8 pts)
Sistema de upload de medios para la landing pública.
- Decisión pendiente: Cloudinary vs Google Cloud Storage
- Upload de imagen hero desde backoffice
- Preview inmediato en admin antes de publicar
- Fallback a URL Unsplash si no hay imagen en BD
- Ver doc: `HU-043-gestion-medios-landing.md`

### HU-023 — Búsqueda de reflexiones por palabra clave (3 pts)
Búsqueda en el historial de chat del usuario.
- Input de búsqueda en ChatPage
- Busca en mensajes propios del usuario (desencriptados)
- Resalta coincidencias en el historial
- Solo busca en mensajes del usuario autenticado

### HU-035 — Polling automático badge superadmin (2 pts)
Notificación en tiempo real de versiones pendientes.
- Polling cada 30 segundos al endpoint de versiones pendientes
- Badge rojo con número en el ícono de admin si hay pendientes
- Sin librerías de WebSockets — polling simple con setInterval

---

## Deuda técnica (3 puntos)

### DT-001 — Limpieza de dependencias frontend (3 pts)
- Resolver conflicto `vite@8` vs `@tailwindcss/vite@4.2.1`
- Registrar `react-router-dom` formalmente en `package.json`
- Eliminar `--legacy-peer-deps` del flujo normal
- Documentar versiones fijas

---

## Total Sprint 4
| Categoría | Puntos |
|---|---|
| Must Have | 23 |
| Should Have | 13 |
| Deuda técnica | 3 |
| **Total** | **39** |

---

## Orden de desarrollo recomendado
```
Semana 1: DT-001 + HU-044 (base del backoffice)
Semana 2: HU-045 + HU-046 (usuarios + terapeuta)
Semana 3: HU-047 + HU-043 (métricas + medios)
Semana 4: HU-023 + HU-035 + QA + Deploy
```

---
*Documentado: 28 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
