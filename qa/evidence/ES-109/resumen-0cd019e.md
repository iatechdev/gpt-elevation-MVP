# ES-109 · PR #89 · head 0cd019e · QA-Claude
Merge local con main (limpio; sin #81: crypto.js idéntico); Postgres 17 local; IA simulada; hojas de vida sintéticas.
- Backend 425/425; frontend 166/166, tsc, lint, build; pruebas Postgres del PR 8/8; ES-14 9/9, ES-23 12/12, ES-33 9/9; db:drift sin deriva; npm audit sin altos ni avisos de pdfjs; CI verde.
- es109-real-db.mjs: 35/36. Cumple: consentimiento y aislamiento, revocar borra todo (y todo o nada si falla), 18 PDF no confiables, JS en PDF no llega al proveedor, salida del modelo (inventos, contacto, decisiones prohibidas, JSON hostil), tope de 5 versiones, requestId, concurrencia, presupuesto/proveedor caído/lento, límite por hora, pool de 5 con 22 solicitudes, contexto v2, registros sin contenido, textos sin diagnóstico ni halagos.
- FALLA B1: de 55 formatos de contacto, 5 escapan a la IA: correo con arroba de ancho completo, teléfono con dígitos de ancho completo, «Carrer», «Rua» y bit.ly.
- es109-ui.cjs: 19/20 en Chromium real (aviso antes del botón, casilla desmarcada, nombre neutro cv.pdf, sin PUT hasta guardar, ES/EN, 320-1440 px, contraste, teclado, solo origen propio, historial ver/descargar/borrar/retirar). G2b (quitar/deshacer) no verificado por mi script.
- Mutaciones 5/5 detectadas (sin depuración, sin verificación literal, sin autorización, sin tope, revocar sin borrar).
Observaciones: datos personales no de contacto (fecha de nacimiento, edad, estado civil, nacionalidad) pasan a la IA; una inyección en el propio PDF puede colocar en un campo cualquier texto literal del documento (solo afecta sus propias sugerencias); el candado «un análisis a la vez» es en memoria del proceso.
No verificado: IA real, lector de pantalla, otros navegadores, Supabase real, staging.
