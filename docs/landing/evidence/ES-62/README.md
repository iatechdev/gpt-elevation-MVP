# ES-62 · Evidencia

Base: main 417e49b. Diseño: ES-60 (comentario 10042), DISENO-FASE1.md §2. Entorno: Windows, Node 24.14.0, Vite dev server local, **sin backend** (respaldos del catálogo).

## Resultados reales
- `npm test` (frontend): 8/8 (6 nuevas de ES-62 + 2 existentes). `npm run lint` y `tsc -b` sin errores; `npm run build` correcto.
- Navegador (DOM, teclado y capturas):
  - Primer Tab: enlace "Saltar al contenido" visible (a 8 px del borde) con anillo de 3 px; Enter mueve el foco a `MAIN#contenido`.
  - Orden de tabulación: salto, logotipo, ES, EN, Ingresar.
  - Objetivos: logotipo 44 px de alto, ES/EN 44×45 px, Ingresar 48 px de alto.
  - Cambiar a EN con teclado: `html lang` pasa a `en`, `aria-pressed` pasa a EN, textos de cabecera en inglés, `elv_lang=en` guardado; tras recargar se conserva (`en`).
  - 320 px oscuro: sin scroll horizontal (scrollWidth 320), cabecera de 81 px con logotipo, selector e Ingresar en una línea.
  - Navegación de fase 2: no se renderiza ningún enlace; solo existen `/` y `/login`.

## Capturas
- `header-1440-light-en.jpg`, `header-320-dark-en.jpg`.

## No verificado
- Idioma inicial según el navegador: cubierto con pruebas unitarias de `resolveInitialLang`, no con un navegador configurado en inglés.
- Lector de pantalla real, 768 px, tema claro en móvil, y contraste de la cabecera más allá de las pruebas de tokens de ES-61.
- Contenido editado desde el editor (ES-66) contra backend y base reales: solo respaldos del catálogo.
- La etiqueta "PROTOTIPO / DATOS FICTICIOS" de la referencia no existe en el código (verificado por búsqueda); no hay forma de que aparezca.
