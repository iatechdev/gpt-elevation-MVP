# Contrato de autenticación y autorización de la API: 401, 403 y 404 (ES-206, punto 5)

Decisión documentada (11-nov-2026, aceptada por Infra a propuesta de Dev-Claude; la decide Mauricio/PO si discrepa). Describe lo que hace hoy `backend/middlewares/auth.js`; no cambia el código.

## Qué responde la API

| Situación | Estado | Ejemplo de mensaje | Quién lo produce |
| --- | --- | --- | --- |
| Petición **sin** cabecera `Authorization` | **403** | «Acceso denegado. No tienes llave.» | `tokenMiddleware` (`auth.js:12`) |
| Token inválido, alterado, de otra firma o expirado | **401** | «Llave inválida o expirada.» | `tokenMiddleware` |
| Token válido pero la sesión ya no vigente (cierre de sesión, corte por administración, token anterior sin `jti`) | **401** | «Sesión cerrada o inválida…» | `sessionProblem` (ES-18) |
| No se pudo verificar la sesión (fallo del servidor) | **503** | «No se pudo verificar la sesión. Intenta de nuevo.» | `tokenMiddleware` |
| Sesión válida pero el **rol** no puede usar la ruta | **403** | «Acceso denegado. Solo administradores.» (y equivalentes) | `verificarAdmin`, `verificarSuperAdmin`, `verificarTerapeuta`, `verificarJunta`… y comprobaciones de rol dentro de cada ruta |
| Sesión válida y rol correcto pero el recurso es de **otra persona** o no existe | **404** | «No encontrado» | cada ruta (propietario verificado en el servidor en cada acceso) |

## Por qué no se unifica «sin cabecera» a 401

El punto 5 de ES-206 pedía que «sin sesión» responda 401 como un token inválido. Se **descartó** por esta evidencia (ver el comentario de ES-206 en Jira):

- El frontend envía **siempre** `Authorization: Bearer <token>`, aunque el token esté vacío. Un navegador sin sesión recibe, por tanto, **401** (token vacío = inválido). El 403 «sin cabecera» solo lo ven clientes que no mandan la cabecera (scripts, sondas).
- Cambiarlo rompe 67 de 655 pruebas unitarias del backend, las pruebas con PostgreSQL y la matriz transversal de ES-189 (`backend/test/fixtures/routes-roles.json`), que fijan este contrato, por un beneficio bajo (consistencia semántica, ningún navegador afectado).
- Riesgo: reescribir ~70 aserciones a mano puede confundir «sin sesión» (que pasaría a 401) con «rol sin permiso» (que sigue en 403) y ocultar una regresión real de control de acceso.

## Reglas para quien escriba o consuma la API

1. **El cliente trata 401 como «inicia sesión de nuevo»** (se invalida la sesión local: `invalidateStoredSession`) y **403 como «no tienes permiso»** (mensaje propio, sin «Reintentar» y sin cerrar la sesión): ES-265.
2. Un 403 sin cabecera `Authorization` no debe producirse desde el frontend; si aparece, es un cliente que no envía la cabecera.
3. Una ruta nueva que exija sesión usa `verificarToken` (o el verificador de rol que corresponda) y se **añade a `backend/test/fixtures/routes-roles.json`** (lo comprueba la matriz de ES-189).
4. Si en el futuro se decide unificar a 401, se hace en un ticket de backend dedicado, con la matriz de ES-189 como red de seguridad (estimación 0,5–1 día con QA).
