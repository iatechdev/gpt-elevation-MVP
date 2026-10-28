# ES-74 — Cómo vincularte y acceso

## Alcance aprobado

- Base: `8cea8e967641da60dd8384160ee2662879eeb949`, rama `ES-74-acceso-puertas`.
- Diseño S13: ES-60/10279 y ES-74/10286. Revisión de los 84 frames registrada en ES-68/10304; se revisaron de nuevo los frames 41–44 (S13 ES/EN, escritorio/móvil).
- Plan, D-09 y excepción de identidad: ES-74/10331, aprobación explícita del usuario registrada en ES-74/10332.
- Ambas puertas siguen en `/login`, sin persistencia ni envío de su elección. Crear cuenta abre `/login?mode=register`. No se introduce `returnTo`.
- Una sesión existente se verifica en servidor antes de redirigir. Alta profesional sin CTA; D-04 sigue pendiente. Pasos 3 y 4 marcados Próximamente / Coming soon.
- Reutiliza ES-61, daisyUI con prefijo `elv-`, los componentes LandingSection/Card/Label y el gestor ES-66. Nuevos textos en `landing.join.*` y `landing.access.*` con fallback ES/EN.
- Eliminar `outline: none` de los campos de acceso corrige un defecto de foco sin cambiar layout ni flujo; exento de nueva puerta de diseño.

## Seguridad y privacidad

`GET /api/session` usa `verificarToken` y los helpers existentes de sesión/revocación. Lee exclusivamente `User.findByPk(req.user.id)` con los atributos role, active y onboardingCompleted. No acepta parámetros ni IDs; responde solamente `{role,onboardingCompleted}` con `Cache-Control: no-store` y `Vary: Authorization`. Cuenta ausente/inactiva: 401; datos no reconocidos o fallo de lectura: 503. No devuelve nombre, correo, token, conversaciones, diario ni contexto profesional. No hay escrituras ni modelos/migraciones nuevos.

El cliente no decodifica JWT ni usa el rol de localStorage para decidir el destino. Verifica un contrato mínimo exacto y actualiza la caché de rol existente desde la respuesta canónica, para conservar compatibilidad con los guards actuales sin modificarlos. Un 401/403 invalida solo el token que se comprobó; una respuesta tardía no elimina una sesión nueva. Fallos de red, timeout de 8 segundos, 404/429/5xx o esquema inválido conservan el token y ofrecen reintentar, sin asumir sesión válida ni redirigir. La emisión, revocación, guards privados y permisos de Mauricio no se rediseñan.

Destinos permitidos: user sin onboarding → `/app/onboarding`; user con onboarding → `/app/dashboard`; admin/superadmin → `/admin/dashboard`; therapist → `/therapist/dashboard`; board → `/board/manifest`. Un registro 201 muestra confirmación y pide iniciar sesión; no inventa una sesión autenticada. Se mantienen bloqueo, límite, cuenta inactiva y errores del servidor, traducidos mediante claves del gestor.

## Pruebas ejecutadas (28-oct-2026)

| Verificación | Resultado real |
| --- | --- |
| `npm ci` frontend/backend | exit 0; 192/292 paquetes instalados |
| Frontend `npm run lint` | exit 0, sin errores ni advertencias |
| Frontend `npm test`, Node 24 | 43/43, 0 fallos, 0 omitidas |
| Frontend `node --test test/*.test.mjs`, Node 22 | 43/43, 0 fallos, 0 omitidas |
| Frontend `npx tsc -b` | exit 0 |
| Frontend `npm run build` | exit 0; 88 módulos, JS 575,85 kB (gzip 148,76), CSS 66,22 kB (gzip 10,81) |
| Backend `npm test` | 253/253, 0 fallos, 0 omitidas |
| Backend `node --test test/es-74-session.test.cjs` | 4/4; servidor/HTTP/JWT reales con persistencia y proveedores simulados |
| Integración `node --test test/integration/es-74-session-postgres.cjs` | 1/1 con PostgreSQL 17.10 real y base aleatoria propia en loopback; lector A/B, IDs ajenos, roles/onboarding, baja/inactividad, logout, logout-all, sesión nueva después del corte; edición CMS superadmin y lectura pública ES/EN |
| Frontend `npm audit --json` | exit 0; 0 vulnerabilidades |
| Backend `npm audit --json` | exit 1; 6 moderadas, 0 altas/críticas: storage, gaxios, retry-request, sequelize, teeny-request, uuid; lockfiles/dependencias sin cambios |

El primer build detectó dos TS2339 al estrechar el tipo de login; se corrigieron y el build final pasó. Vite mantiene el aviso de chunk mayor de 500 kB. La suite de backend imprime errores esperados de casos negativos (incluido el fallback de SPA); el resultado final es 253 aprobadas. No se silencian reglas ni advertencias.

Las pruebas unitarias de acceso verifican contrato HTTP, timeout/error/malformed, destinos permitidos, ausencia de retorno arbitrario, traducciones y protección contra invalidación tardía. Las pruebas SSR renderizan el componente S13 real y prueban claves editadas, fallback y escape HTML. La prueba CMS de la suite usa persistencia simulada para cubrir todas las claves nuevas, roles y validaciones. La integración PostgreSQL adicional prueba persistencia real de una clave; no pretende ser una prueba de todas las migraciones: crea una base de pruebas vacía con los modelos existentes mediante sync.

## Navegador local

Aplicación compilada real y endpoints Express de registro/login/sesión con PostgreSQL real, personas sintéticas y credenciales exclusivas de pruebas. Anthropic y almacenamiento externo sustituidos por dobles que rechazan llamadas. No se usan `.env`, producción ni datos de las seis personas.

| Recorrido | Resultado observado |
| --- | --- |
| Anónimo ES/EN: puerta 1, puerta 2, Ingresar, CTA final | Los cuatro llevan al formulario de `/login` |
| Anónimo ES/EN: Crear cuenta S13 | `/login?mode=register`, campo nombre y formulario de alta |
| Sesión participante completada ES/EN: las cinco entradas | `/app/dashboard`, sin nuevo registro |
| Sesión participante nueva | Estado Verificando sesión sin formulario, después `/app/onboarding` |
| admin, superadmin, therapist y board | Destinos existentes indicados arriba; también con caché local deliberadamente desactualizada |
| Registro real sintético + login | Alta confirmada en `/login`, luego primer ingreso a `/app/onboarding` |
| Registro duplicado EN | Error traducido, sin éxito ni redirección |
| Credenciales incorrectas EN → ES | Error conservado y traducido al cambiar de idioma |
| Anchos 320, 375, 390, 768, 1024 y 1440 | Sin desbordamiento horizontal; cuatro tarjetas en 1/2/4 columnas |
| CMS 503, vacío, editado y palabra extensa/HTML | Fallback, cuatro pasos, edición visible y HTML como texto; sin imágenes inyectadas ni desbordamiento |
| Tema oscuro y ES/EN | Tema `elevation-landing-dark` y contenido correcto; preferencia del sistema simulada solo en el arnés |
| Teclado en acceso | Tab enfoca el campo con contorno visible después de retirar outline none |

El arnés `backend/test/support/es74-preview.cjs` es solo local, exige URL PostgreSQL de loopback, crea su propia base aleatoria y dispone de cierre que la elimina. Su excepción de `sendFile` para permitir dotfiles resuelve la ubicación del worktree dentro de `.codex`; no modifica el servidor de producto ni demuestra el routing de Railway/Vercel.

## Límites y condiciones de publicación

- D-04 y el alta profesional completa siguen pendientes; no se presentan como flujo entregado.
- Los mensajes antiguos de la landing (TCC/DBT, 24/7, AES-256) siguen en esta base. Su retirada aprobada corresponde a ES-68/PR 51: integrar y verificar esa retirada antes de publicar la landing conjunta. No se duplicó su cambio aquí.
- Verificar composición final de las secciones con los PR de landing abiertos al integrar; este PR no los fusiona.
- No se probó despliegue, correo real, navegación con lector de pantalla ni zoom nativo al 200 %. No se midió rendimiento de producción.
- Estados de expiración, revocación, fallo de red/timeout y acceso a IDs ajenos cubiertos con pruebas automatizadas; no se afirma recorrido manual de todos esos estados en el navegador.
- Sin nuevas animaciones; se conserva la política de movimiento reducido existente. El tema del formulario de login previo permanece; el tema claro/oscuro de S13 usa el ámbito de landing.
- Mauricio debe revisar el lector mínimo de identidad antes del veredicto de QA. QA resuelve sus hilos; Dev no fusiona.
