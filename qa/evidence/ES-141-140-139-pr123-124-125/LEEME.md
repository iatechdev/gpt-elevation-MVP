# ES-141 / ES-140 (servidor) / ES-139 — PR #123, #124, #125 (QA-Claude, 1-nov-2026)
Servidor real (Express, backend de cada PR) con el build de frontend/dist; datos sintéticos; 0 tokens de IA.
- `resultados-{main,141,140,139}.json`: casos por versión (script `qa/integration/es141-140-139.cjs`). Los casos de una versión posterior fallan en versiones anteriores por diseño (p. ej. gzip en 141).
- `rendimiento-login-fast3g.json`: `/login` en Fast 3G (CDP), caché fría, mediana de 5, main vs #125 (`qa/integration/es139-perf.cjs`).
- Limitación: la prueba se ejecutó en Windows (sistema de archivos que no distingue mayúsculas); `/assets/INDEX-….CSS` sirve el archivo real aquí, en Linux (Railway) daría 404. No verificable en este equipo.
