# ES-61 · Base visual de la landing

Implementación de la base aprobada en ES-60, comentario 10042, y maqueta `docs/landing/diseno-fase1.html` (tokens definitivos en `DISENO-FASE1.md`). Cabecera, nuevas puertas, nuevo héroe y ejemplo se entregan por separado en ES-62/63/64; contenido editable por claves en ES-66. S3–S15 nuevos no se implementan aquí.

## Dependencias fijadas

- daisyUI **5.7.50**, compatible con Tailwind 4 existente, como dependencia de desarrollo que genera CSS estático. Sin CDN ni JavaScript de daisyUI en producción.
- `@fontsource-variable/inter` **5.3.0**: justificada para autoalojar Inter variable (peso 100–900, incluido 800) con CSP `font-src 'self'`. Se incluye únicamente el archivo latino necesario para ES/EN (48.25 kB en el build). Familia local `Elevation Landing Inter`, diferente de `Inter` del resto de la aplicación. Licencia OFL en `frontend/public/fonts/OFL-Inter.txt`.

## Aislamiento

`frontend/src/index.css` importa `components/landing/landing.css` para compilar los plugins con Tailwind. Los tokens globales y las reglas originales del body no cambian.

El plugin tiene `themes: false`, prefijo **elv-**, módulos limitados a los componentes de la landing y raíz `.landing-scope`. Los temas propios **elevation-landing-light** y **elevation-landing-dark** no son defaults globales. `LandingSurface` aplica el tema al contenedor y reacciona a `prefers-color-scheme`; no escribe un tema en html/body ni altera preferencias del resto de la app.

El selector manual de tema no está añadido: la especificación exige claro/oscuro, sin aprobar un control visible nuevo. Ambos siguen la preferencia del sistema.

## Tokens

| Uso | Claro | Oscuro |
|---|---|---|
| Papel/base-100 | #FAFAF9 | #151513 |
| Superficie/base-200 | #F2EFE7 | #222119 |
| Tinta/base-content | #1A1A18 | #F3F1EA |
| Gris/neutral | #5E5E5A | #A9A79F |
| Ocre decorativo/accent | #B8963E | #C9A64B |
| Ocre de texto/secondary | #7D6218 | #D9B861 |
| Borde/base-300 | #E4E2DC | #34332F |
| Error | #7A3030 | #F1ABAB |
| Éxito | #325D40 | #A1D5AC |

CTA principal: tinta/papel invertidos. El ocre decorativo es para subrayados/puntos sin significado exclusivo; no usarlo como color de texto. Foco: anillo de 3 px del ocre de texto, separado 3 px. Sin depender solo del color.

Contraste calculado con luminancia relativa sRGB/WCAG en `frontend/test/landing-theme.test.mjs`: **5.54:1** (#7D6218 sobre #FAFAF9) y **2.69:1** (#B8963E sobre #FAFAF9, insuficiente para texto). El test verifica además al menos 4.5:1 para texto, gris, ocre de texto y estados en ambos temas y sobre superficies base-100/base-200. No se afirma que el borde decorativo cumpla el contraste de un control interactivo.

Inter para texto y títulos; título fluido `clamp(40px, 8vw, 84px)`, peso 800 y mayúsculas. El héroe legado conserva un tamaño provisional menor hasta su reemplazo en ES-63. Etiquetas: Cascadia Code/SFMono-Regular/Consolas/monospace, sin otra descarga. Rejilla reutilizable: una columna y dos desde 40 rem; ancho máximo 1080 px, márgenes de 1 a 4 rem y secciones de 2.5 a 6 rem. Elementos interactivos de al menos 44 px. Movimiento y transiciones se desactivan dentro de la landing con `prefers-reduced-motion`.

## Componentes base

Importar `LandingSurface` y los exports de `LandingPrimitives.tsx` solo en la landing:

- `LandingSurface`: div que delimita tema, familia tipográfica y reglas de acceso.
- `LandingButton`: button nativo con tipo button por defecto y clase elv-btn; conserva disabled y todos los atributos nativos.
- `LandingCard`: div elv-card/elv-card-border; no añade rol de enlace ni tabindex. La puerta enlazable se construirá semánticamente en ES-63.
- `LandingLabel`: span elv-badge/elv-badge-outline, monoespaciado y en mayúsculas.
- `LandingSection`: section con espaciado fluido; el consumidor debe darle un encabezado o nombre accesible.
- `LandingLink`: anchor elv-link, subrayado y foco visible. El consumidor aporta href real.

No se añaden nuevas cadenas visibles en estas primitivas. Los consumidores de las secciones nuevas deben obtenerlas de claves landing.* y sus defaults ES/EN de ES-66. La adaptación de esta base conserva el contenido legado; no lo acredita como contenido final de fase 1.

## Verificación

Comandos: `npm ci --legacy-peer-deps`, `npm test`, `npx tsc -b`, `npm run build`, `npm run lint`. Lint completo de main ya falla en archivos de /app y /board excluidos expresamente; el cambio no silencia reglas ni modifica esas rutas. Se reporta aparte el lint del alcance.

La comparación de navegador usa copias locales antes/después, datos sintéticos y API simulada: no acredita autenticación ni backend real. Las capturas locales, comprobaciones y salida real se enlazan en la entrega. No afirmar QA aprobado ni funcionamiento de contenidos editables por estas comprobaciones.
