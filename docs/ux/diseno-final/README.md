# Diseño final propuesto · «Cuaderno» (ES-148)

Prototipo interactivo en HTML/CSS/JS sin dependencias. **Abrir `index.html` en el navegador** (funciona desde el disco; no necesita servidor ni red).

## Cómo recorrerlo
- Barra negra de arriba: **pantalla** (32 vistas, incluidos los paneles y los estados de error), **escenario** (cuenta nueva · conversación en curso · con evidencias · con nivel y solicitud), **móvil/escritorio**, **ES/EN** y **claro/oscuro**.
- Se opera de verdad: escribe un mensaje y recibes una respuesta de muestra; «Guardar como evidencia» abre un borrador de 3 pasos; «Mi mapa» → elige una capacidad (radar o teclado) → «Registrar mi nivel» o «Pedir propuesta de la IA»; «Mi plan» → «Solicitar este plan». Crear cuenta valida las reglas de contraseña en vivo. Esc cierra los paneles.

## Qué es real y qué es de ejemplo
- **Real:** las tres respuestas del asistente de la conversación de muestra son respuestas **reales** capturadas en staging con una cuenta sintética el 3-nov-2026 (la versión EN de esas tres es una traducción del prototipo). Las reglas de contraseña, los pasos del registro de nivel, los textos del análisis con IA y las reglas de honestidad vienen de `frontend/src`.
- **De ejemplo (marcado en pantalla):** cifras de uso, planes «Nombre del plan A/B», filas de administración, la propuesta de nivel de la IA y el texto de los criterios de cada nivel (el real está en el catálogo).
- **Propuesta nueva (marcado «propuesta: hoy no existe»):** la casilla de consentimiento en el registro.

## Archivos
| Archivo | Qué contiene |
|---|---|
| `index.html`, `app.js`, `style.css`, `tokens.css` | Prototipo y sistema visual |
| `copy.js`, `copy-extra.js` | **Todos los textos ES/EN** (fuente única; con su origen). `node e2e/scripts/generar-textos.mjs` genera [../TEXTOS-FINALES-ES-EN.md](../TEXTOS-FINALES-ES-EN.md) |
| `fonts/` | Playfair Display y Noto Serif (ya incluidas en el repo, licencia OFL con su texto). Inter se usa si está instalada; si no, cae a la del sistema |
| `img/` | Imagen de cada pantalla, ES/EN × escritorio/móvil |

## Verificación automática
`e2e/tests/diseno-final.spec.ts`: sin claves de texto faltantes, sin desborde horizontal, axe sin violaciones graves o críticas (claro y oscuro, ES y EN, escritorio y móvil) y un flujo de punta a punta (crear cuenta → conversación → evidencia desde el chat → nivel en el mapa → solicitud de plan). No sustituye pruebas con personas ni con lector de pantalla.
