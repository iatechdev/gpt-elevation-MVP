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
