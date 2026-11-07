# ES-129 · PR #121 head bce47b862b0b6c083c20d59cef07fbb92ce09e29 (QA-Claude, 1-nov-2026)
Merge local sobre main 6c2e36f; navegador real (Chromium); datos sintéticos; 0 tokens de IA.
- `salida-ui.txt` / `resultados-ui.json`: `qa/integration/es129b-ui.cjs`, 21/21 (3 modos de fallo × ES/EN × 320/1440 px, recarga con clic y con Enter, sin bucle, navegación interna, pantalla protegida, camino feliz, 500 de API). Capturas `aviso-*.png`.
- `salida-func.txt`: `es129-func.cjs`, 14/17. P5b (/app/data) difiere porque la línea base local es un main anterior a #122; P10 y P10b piden el 404 y la caché immutable de #124/#123, no de #121.
- Verificado también en local: build, `build:check` (138,0 kB gzip, límite 150), 312/312 pruebas del frontend, eslint sin errores.
