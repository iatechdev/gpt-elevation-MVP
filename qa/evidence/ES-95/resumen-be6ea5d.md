# ES-95 · PR #70 · solicitud pública de profesionales con hoja de vida PDF · head be6ea5d

[QA-Claude] · 29-oct-2026. Merge local con main 2f237a4, Postgres 17 real, tres servidores del merge (sin límite práctico, límite por defecto sin proxy y con TRUST_PROXY_HOPS=1), Chromium, datos sintéticos.

| Bloque | Resultado |
|---|---|
| backend / frontend / audit / build | 355/355 y 114/114; lint 0 avisos; tipos ok; audit 0; JS 730.393 B, CSS 98.245 B (deuda de peso) |
| API (`es95-api.mjs`, `api-run2-be6ea5d.jsonl`) | 41 ok / 2 fallos (S04d, R02) / 6 informativos |
| Interfaz real (`es95-ui.cjs`, `ui-run5-be6ea5d.jsonl`) | 23 ok / 2 fallos (responsive 320-375) |
| Script de Dev (`es95-browser.cjs`) | 9/9 |
| Migración | `db:drift`: SIN DERIVA, también tras deshacer y reaplicar; `down` con guarda |
| Regresión | landing S7 14/14, S9 12/14 (conocidas), S11 14/14, S13 14/14; chips 10/10; CMS 8/8; ES-18/19 20/20; sesión 25/25; navegador es74 23/23; ES-93 sin cambios; panel ES-90 en 4 tarjetas (mi script de 5 tarjetas ya no aplica) |

## Re-revisión · heads 44b2740 y 5b54d25 (fusión con main a23c31a, ya con #72, #75 y #77)
| Bloque | Resultado |
|---|---|
| backend / frontend / audit / build | 383/383 y 128/128; lint 0 avisos; tipos ok; audit 0; db:drift SIN DERIVA con el índice único parcial |
| API (`api-run3-44b2740.jsonl`, `api-run4-5b54d25.jsonl`) | M2 corregido: 10 envíos simultáneos y 4 rondas de 12 → 1 solicitud, 1 hoja de vida, todas 201; el índice `professional_applications_email_open_unique` existe (solo pendientes y aprobadas). Fallan solo R02 (M3, ticket aparte) y A05 en la corrida final por datos de mi propia carga XSS de corridas previas en la base (no por el PR) |
| Interfaz (`ui-run7-44b2740.jsonl`) | 25/25: sin desplazamiento a 320, 375, 768 y 1440 px en ES y EN (M1 corregido); la trampa se llama `bot_trap`; «Crear cuenta» sin datos en la URL; con #77 el panel de pendientes de ES-90 queda oculto (0 tarjetas) |
| Script de Dev (`es95-browser.cjs`) | 10/10 (incluye el nuevo de responsive) |
| Prueba de carrera de Dev (`test:pro-applications:pg`) | 5/5 |
| Regresión | landing S7/S11/S13 14/14, S9 12/14 (conocidas), ES-94 13/14 (C03 conocido), CMS 8/8, chips 10/10, ES-18/19 20/20, sesión 25/25, navegador es74 23/23 |
| **CI del PR** | **no corre**: los dos últimos pushes (44b2740 y 5b54d25) fallan en 0 s con «workflow file issue»: `.github/workflows/ci.yml` es YAML inválido (js-yaml: «bad indentation of a mapping entry», línea 154): el nombre del paso nuevo «ES-95 solicitudes de profesionales: carrera…» lleva «: » sin comillas. |
