# ES-73 · PR #76 · head 5c80460d546b9a2c9b55c08a7a133f0f9023e4ad — evidencia [QA-Claude]
Entorno: merge local con main, Postgres embebido (qa76, base nueva), servidor real, Chromium; datos sintéticos. Frontend 197/197, backend 451/451, tsc, lint y build limpios.
- `ui-5c80460.jsonl`: es73-ui.cjs, 36 correctas / 2 con hallazgo. Mutaciones: sin comprobar claves extra → falla S2; sin 409 de solicitud pendiente → falla S3; «Gratis» siempre → falla F2; sin comprobar el plan de la respuesta → fallan las pruebas del PR (196/197). 4/4 detectadas.
- Cumple: catálogo desde la base (precio, orden, destacado, moneda, periodo; XSS como texto), «Gratis»/subtítulo solo con plan cero, estados (vacío, cargando, error con reintento, catálogo malformado, plan retirado), flujo anónimo→registro sin redirección abierta, 0 POST hasta pulsar, solicitud con solo planId, respuesta perdida sin repetir el POST, plan retirado al solicitar, aislamiento A/B, 14 entradas hostiles sin 5xx, 6 POST simultáneos → 1 pendiente, textos sin promesas, herramienta dry-run/apply, texto antiguo del seed → texto aprobado y ediciones respetadas, 320–1440 px (1/2/4 columnas), contraste AA, teclado.
## Hallazgos (Bajo/Medio; ninguno bloquea)
| ID | Sev. | Qué pasa |
|---|---|---|
| ES73-QA-01 | Medio (accesibilidad) | Al volver a la ventana (evento `focus`) `usePlans` recarga el catálogo y las tarjetas se desmontan: con una API lenta la lista desaparece mostrando «Cargando planes…» y el botón enfocado pierde el foco (queda en `<body>`). Medido: 150 ms con API rápida (foco perdido), 3 tarjetas ausentes con API de 700 ms. |
| ES73-QA-02 | Bajo | Enlaces del encabezado de la landing miden 26 px de alto («Planes» 50×26, «Plans» 41×26) y el salto al contenido 42 px: por debajo de 44 px. |
| ES73-QA-03 | Bajo (observación) | El 409 del backend usa voseo («Ya tenés… Esperá…») mientras el producto usa «tú»; la pantalla no lo muestra (usa sus propios textos), pero queda en la API. |
| ES73-QA-04 | Observación | No existe tema oscuro: con `prefers-color-scheme: dark` la página sigue clara (body rgb 249,249,247); el contraste oscuro del plan no aplica. |
## No verificado
Contenido aprobado por el PO (los textos están pendientes), cobro (no existe), producción, lectores de pantalla.
