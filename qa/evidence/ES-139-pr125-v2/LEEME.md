# ES-139 · PR #125 head 43ec5bfa42dd2a3a01d87b85430278b011610e7b (QA-Claude, 1-nov-2026)
Segunda ronda tras corregir QA-139-01 (el diff frente a la ronda anterior es solo package.json y package-lock.json del backend).
- `npm-audit.txt`: `npm audit --omit=dev --audit-level=high` sale con 0 (compression 1.8.2); quedan 11 avisos moderados preexistentes (también en main).
- `resultados-139.json` / `salida-139.txt`: C1–C7, 10/11. El único «fallo» es `/assets` sin barra final: 301 a `/assets/` y ahí 404, comportamiento normal de express.static.
- `rendimiento-login-fast3g.json`: `/login` en Fast 3G (CDP), caché fría, mediana de 5, mismo build en ambos servidores (frontend de #121): main cbfc362 3,44 s / 535 KB frente a #125 1,51 s / 159 KB; la diferencia es solo la compresión.
