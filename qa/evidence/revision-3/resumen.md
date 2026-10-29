# Revisión de los PR rebasados · 28-oct-2026 · merge local de cada head con main 13a0f9f

| PR | head | Resultado |
|---|---|---|
| #37 ES-26 | 0938b77 | lint 0 avisos, tipos ok, frontend 104/104, backend 334/334, audit 0; JS 709.461 B / CSS 95.237 B (deuda de peso aceptada). Script de navegador de Dev 13/13; integración real con Postgres 6/6 (vista previa exacta, dueño B no usa el token de A, idempotencia, cifrado v2, retirada, JWT revocado → 401). |
| #38 ES-31 | 7590c4a | frontend 108/108, backend 334/334, audit 0; JS 729.177 B / CSS 96.796 B. Integración real con Postgres 12/12 (borrador, editores completos, 422, publicación inmutable, rol falso sin efecto, JWT revocado). |
| #23 ES-81 | 2ccaf7d | backend 334/334; `npm run test:db` 13/13 cuatro veces; se niega con NODE_ENV=production, host remoto, host «127.0.0.1.evil.test» y solo DATABASE_URL; limpieza de huérfanas: borra `es_harness_*` sin conexión y conserva la que tiene conexión viva y los nombres parecidos; 0 bases restantes. Diff contra main: 4 archivos (una línea de package.json). QA-81-01 y QA-81-02 corregidos. |
| #41 ES-44 | 217c5c5 | código de evaluación idéntico al que aprobé (diff 0); backend 350/350; validate 30; mock 30 simuladas; integration 15 pasan / 15 pendientes y 58 llamadas simuladas; provider sale 1; 0 llamadas reales; puerta bloqueada; reportes ignorados por Git; job de CI offline sin secretos. |
| #42 ES-36 | 7a802e4 | frontend 102/102, audit 0; JS 709.489 B / CSS 95.394 B; script de Dev 9 grupos PASS en 8 builds; las clases daisyUI que usa (radio, checkbox, fieldset, alert) existen en el CSS construido. |
| #46 ES-35 | 62c7d86 | frontend 116/116, audit 0; JS 718.890 B / CSS 97.180 B; script de Dev 13/13 en 8 builds (flujo completo, lost-ack, conflicto, fallos cerrados, 0 escrituras). |

Fusión acumulada (orden #37, #38, #42, #46, #23, #41) sobre main: #37 limpio; #38 conflicta con #37 en App.tsx, landing.css, i18n ES/EN, main.tsx y UserDashboard.tsx; #42 y #46 conflictan con lo anterior en App.tsx y landing.css; #23 limpio; #41 conflicta con #23 en backend/package.json. Cada PR necesita rebase después de fusionar el anterior y su aprobación vuelve a valer solo con una pasada corta sobre el head nuevo.
No repetido por mí en esta pasada: medición propia de contraste y objetivos táctiles en #37, #38, #42 y #46 (lo cubren los scripts de Dev y mis revisiones de heads anteriores).

## Pasada corta tras la fusión en cadena (29-oct) · main 2f237a4 (con #54, #64, #23 y #37)
- #38 ES-31 head 39b1696 (contiene main): lint 0 avisos, tipos, frontend 121/121, backend 342/342, audit 0, JS 751.605 B / CSS 101.965 B (deuda). Integración real ES-31 12/12; con #37 ya en main: navegador ES-26 13/13 e integración real ES-26 6/6.
- #41 ES-44 head 3d9ddeb (contiene main): código de evaluación idéntico (diff 0), backend 358/358, audit 0; validate 30, mock 30, integration 15 pasan / 15 pendientes, provider sale 1, 0 llamadas reales, puerta bloqueada; `test:db` de #23 13/13 (package.json conserva los scripts de ambos).
