# ES-63 · Evidencia

Base: main 417e49b. Diseño: ES-60 (comentario 10042), DISENO-FASE1.md §3. Entorno: Windows, Node 24.14.0, Vite dev server local, **sin backend** (la API de contenido falla y se muestran los respaldos del catálogo).

## Resultados reales
- `npm test` (frontend): 10/10 (8 nuevas de ES-63 + 2 existentes).
- `npm run lint`: sin errores. `tsc -b`: sin errores. `npm run build`: correcto (aviso conocido de chunk > 500 kB).
- Navegador (DOM y capturas):
  - 1440 px claro, EN: titular 84 px con "counts." subrayado, dos columnas, sin scroll horizontal, enlaces a `/login`.
  - 360 px oscuro, ES: titular 40 px, una columna, sin scroll horizontal (scrollWidth 360), puertas de ~244 px de alto, tema oscuro aplicado.
  - Teclado: con Tab se llega a cada puerta con anillo de 3 px ocre (`outline: solid 3px`, offset -3 px, `:focus-visible` verdadero).
  - Cambio ES → EN actualiza titular, etiqueta y puertas con los textos del diseño.

## Capturas
- `hero-1440-light-en.jpg`, `hero-360-dark-es.jpg`.

## No verificado
- Contenido editado desde el editor (ES-66) contra backend y base reales: no se probó; solo el respaldo del catálogo.
- Sesión iniciada en el navegador (destino por rol): cubierto con pruebas unitarias del helper, no con login real.
- Lector de pantalla real (NVDA/VoiceOver), 768 px y tema claro en móvil: no se ejecutaron; se revisó la estructura (enlace único por puerta, h1/h2, grupo con nombre).
- `document.documentElement.lang` sigue en `es` al cambiar a EN: lo resuelve ES-62 (LanguageProvider).
- Contraste: las pruebas existentes de ES-61 cubren los tokens; ocre de texto 5,54:1 sobre papel claro.
