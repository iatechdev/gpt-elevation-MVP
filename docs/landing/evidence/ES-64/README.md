# ES-64 · Evidencia

Base: main 417e49b. Diseño: ES-60 (comentario 10042), DISENO-FASE1.md §4. Entorno: Windows, Node 24.14.0, Vite dev server local, **sin backend** (respaldos del catálogo).

## Decisión de publicación
El texto aún no está revisado por el especialista (D-07/ES-17). La franja se publica solo con la variable de compilación `VITE_LANDING_EXAMPLE_APPROVED=true`; sin ella queda oculta y el resto de la landing no cambia. Propuesta pendiente de confirmación de Mauricio o Alejo (ver ES-64).

## Resultados reales
- `npm test` (frontend): 8/8 (6 nuevas de ES-64 + 2 existentes). `npm run lint` sin errores, `tsc -b` sin errores, `npm run build` correcto.
- Navegador, 390 px claro, bandera encendida: etiqueta "Ejemplo ilustrativo · caso ficticio · docencia", línea "Acciones → posibles capacidades" (nombre accesible "Acciones, posibles capacidades"), texto de hipótesis; fondo `soft` rgb(242,239,231), borde superior de 1 px, etiqueta con borde ocre de texto, sin scroll horizontal, `aria-labelledby` correcto.
- Navegador, bandera apagada: sin `.landing-example`, el texto no aparece en la página y el resto (héroe, proceso) sigue presente.

## Capturas
- `strip-390-light-es.jpg` (bandera encendida).

## No verificado
- Revisión del texto por el especialista y aprobación de Mauricio/Alejo: pendiente; no se declara publicable.
- Edición real del contenido contra backend/base, lector de pantalla real, EN en navegador, tema oscuro y 768/1440 px de la franja.
- Variable `VITE_LANDING_EXAMPLE_APPROVED` en Railway: Infra debe cargarla al aprobar; no se probó el despliegue.
