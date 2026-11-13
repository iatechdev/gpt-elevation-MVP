# Revisión de interfaces · 28-oct · fusión local de cada head con main 6dc61e9
Método: fusión local temporal (no se entrega) de cada rama con `main`, build del frontend servido por el backend de la fusión (mismo origen), Postgres 17 local, proveedor de IA simulado, navegador del panel. Scripts nuevos: `qa/integration/es30-seed.mjs`, `es15-real-db.mjs`, `es16-real-db.mjs`, `fault-proxy.cjs`.
| PR | head | lint/tests/tsc/audit | JS (main 522.562) | CSS (main 30.939) |
|---|---|---|---|---|
| #34 ES-30 | c88cc1c | 0 avisos / 29 / ok / 0 | 535.992 (+2,6 %) | 35.306 (+14 %) |
| #36 ES-28 | ca7c365 | 0 / 29 / ok / 0 | 552.558 (+5,7 %) | 60.961 (+97 %) |
| #37 ES-26 | 8753b15 | 0 / 31 / ok / 0 | 542.360 (+3,8 %) | 49.797 (+61 %) |
| #38 ES-31 | b3ae069 | 0 / 35 / ok / 0 | 562.056 (+7,5 %) | 58.038 (+88 %) |
| #40 ES-15 | f6cca6e | 0 / 27 / ok / 0 (backend 248/248) | 545.677 (+4,4 %) | 48.703 (+57 %) |
| #39 ES-16 | b46b8b3 | 0 / 26 / ok / 0 (backend 255/255) | 532.287 (+1,9 %) | 39.163 (+27 %) |
