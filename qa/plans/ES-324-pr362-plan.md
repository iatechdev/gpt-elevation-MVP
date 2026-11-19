[QA-Claude] PLAN DE PRUEBAS CORTO — PR #362 (ES-324 / E305-2: `name` de `POST /api/register` con tope de 100 caracteres y sin controles → 400 `invalid_name`, no 500)

Cabeza leída: d984cde96786ee00283d65bc49dbe30dba6da0c6 (CI 4/4 verde al leer). Diff: `backend/routes/auth.js` (+6), prueba PG `es-324-postgres.cjs` (+57), `package.json` (+1), `ci.yml` (+4). Solo servidor, sin pantallas. **0 IA, 0 costo, datos sintéticos `@example.invalid`, PostgreSQL desechable local con migraciones reales y `server.js` real; nada contra staging ni producción.** Ejecuto cuando Infra escriba «Ejecuta», con la cabeza fusionada con main y CI 4/4 + CLEAN reverificados (también antes de publicar).

| ID | Caso | Cómo | Esperado |
|---|---|---|---|
| N1 | Límites exactos | 99 / 100 / 101 caracteres con `N`, `ñ`, emoji simple, emoji ZWJ (familia = 5 puntos de código: 20 entran, 21 no), `é` en NFD (2 puntos de código), espacios a los lados (no cuentan), 100 + espacios interiores | 100 → 201, 101 → 400 `invalid_name`; se cuenta en puntos de código (lo documento: no es por «letra visible») |
| N2 | NUL y controles | U+0000, U+0001–U+001F uno a uno, U+007F, U+0080–U+009F, `\n \r \t`, NUL al principio/medio/fin, NUL escapado en JSON (`\u0000`) | todos 400 estable; ninguno 201 ni 500 |
| N3 | Unicode en el borde | solo espacios Unicode (NBSP, U+3000, U+2003), solo invisibles (U+200B, U+200D, U+3164, U+2800), U+2028/U+2029, bidi U+202E, ZWNJ persa, combinantes sueltos, surrogate suelto en JSON | los que el PR declara legítimos entran; los demás: informo qué pasa (un nombre de solo invisibles o con U+2028 que se acepta = Observación/Bajo, no se pide rechazo salvo que rompa la salida) |
| N4 | Tipos y forma | `name` ausente, `null`, número, booleano, objeto, array, array de texto, `{toString}`, `__proto__`, texto de 10 MB (cuerpo grande), 100.000 caracteres | 400/413 estable (`invalid_name`/`invalid_input`/límite del cuerpo), **0 × 500**, sin repetir lo recibido en la respuesta |
| N5 | Nada queda tras un rechazo | tras cada rechazo de N1–N4: filas en `Users` (y en tablas hijas: consentimientos/aceptación de términos/tokens), correos enviados (proveedor simulado), `lastLogin`; ninguno | 0 filas, 0 correos |
| N6 | Orden y sin oráculo | `invalid_name` antes de consultar la base: con un correo ya registrado y con uno nuevo, mismo cuerpo y cabeceras; el rechazo no depende de si el correo existe | sin enumeración; sin escritura |
| N7 | Contador de la IP | los rechazos por nombre cuentan contra el cupo de 30/h como cualquier petición (ES-221), la 31 = 429 | igual que antes |
| N8 | Lo aceptado se guarda bien | nombres legítimos (María José, Núñez-Peña, O'Brien, Zoë, cirílico, griego, árabe, ZWNJ persa) → 201 y el nombre guardado/`GET /api/me` coincide (recortado), se cifra/guarda sin truncar | sin pérdida ni corrupción |
| N9 | Mutaciones (6) | quitar `typeof`; quitar el tope; `≤` → `<`; contar `.length` UTF-16; quitar `\p{Cc}`; mover la validación DESPUÉS de consultar la base | cada una la detecta la prueba del PR o mi guion |
| N10 | Regresión | backend `npm test`; PG real: es-324, es-221, es-259, es-301, es-306 | verdes |
| N11 | Observación fuera de alcance | otros endpoints que guardan `name` (perfil, solicitud profesional, invitaciones) con 5.000 caracteres, solo para informar si hay otros 500 (el ticket no los incluye) | informado, no condiciona |

**Fuera de alcance / no verificable:** pantalla (sin cambios; el formulario no tiene `maxLength`, lo anoto como sugerencia); personas ya registradas con nombres largos (no se tocan); Railway/staging; más de una réplica.
**Criterio de salida:** un 500, un 201 con control/NUL, un rechazo que deje fila o correo, o un oráculo de correo = CAMBIOS REQUERIDOS. Lo demás de N3 y N11 = observación.
