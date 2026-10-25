# Diseño aprobado · Landing pública · Fase 1 (ES-61 a ES-64)

Aprobado por Mauricio Roldán (Tech Lead) el 25-oct-2026. Registro: comentario 10042 de ES-60.
Maqueta abrible: `docs/landing/diseno-fase1.html` (abrir en el navegador; tiene conmutadores de escritorio/móvil, claro/oscuro y ES/EN). Es la fuente visual; este documento fija lo que no se ve en la maqueta.

Fuera de esta fase: S3 a S15 (ES-65, ES-68 a ES-74). Fuera de alcance siempre: `/app/*`, `/therapist/*`, chat y backoffice.

## 1. Tokens (ES-61)

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| paper | `#FAFAF9` | `#151513` | fondo |
| ink | `#1A1A18` | `#F3F1EA` | texto y botón principal |
| mute | `#5E5E5A` | `#A9A79F` | texto secundario |
| line | `#E4E2DC` | `#34332F` | divisores |
| soft | `#F2EFE7` | `#222119` | fondo de hover y franja de ejemplo |
| ocre | `#B8963E` | `#C9A64B` | solo decorativo: subrayado, punto del logo, anillo de foco |
| ocre-text | `#7D6218` | `#D9B861` | ocre cuando va como texto |

- El ocre `#B8963E` sobre papel da unos 2,9:1: no se usa para texto. `ocre-text` da aprox. 5,5:1 (cifra estimada: verificar con una herramienta de contraste antes de entregar).
- Tipografía: Inter 400/500/600/800 (texto y titulares) y JetBrains Mono 400/500 (etiquetas en mayúsculas, letter-spacing .12em, 12 px). Si se prefiere Cascadia Code como en la referencia, se cambia el token, no el diseño.
- Tema daisyUI propio con estos valores (`light` y `dark`). Los tokens de `frontend/src/index.css` (`--color-bg-primary: #FAFAF9`, acento `#B8963E`) ya coinciden con el tema claro.

## 2. Cabecera (ES-62)

- Izquierda: logotipo `elevation` (800, 20 px) con punto ocre de 7 px. Enlaza a `/`.
- Centro: navegación (`Cómo funciona`, `Skill Map`, `Para psicólogos`, `Planes`). **Se ocultan** hasta que existan esas secciones (fase 2). En móvil la navegación va oculta; el menú llega en fase 2.
- Derecha: selector ES/EN (dos botones `aria-pressed`, el idioma activo en tinta invertida) y botón secundario `Ingresar` → `/login`.
- Al cambiar de idioma se actualiza `document.documentElement.lang` y se conserva la elección.
- Daisy: `navbar`, `join` para el selector, `btn btn-outline`.

## 3. Héroe y dos puertas (ES-63)

- Etiqueta (mono, mayúsculas): ES `Acompañamiento + exploración profesional` · EN `Support + career exploration`.
- Titular (800, mayúsculas, `letter-spacing -.03em`, `line-height .98`, tamaño fluido `clamp(40px, 8vw, 84px)`, `text-wrap: balance`): ES `Lo que has vivido cuenta.` · EN `What you have lived counts.` La última palabra lleva subrayado ocre de 6 px.
- Subtítulo (19 px, mute, máx. 56 caracteres de ancho): ES `Hay cosas que necesitas poner en palabras. Y otras que todavía no has reconocido en ti. Podemos empezar por cualquiera.` · EN `Some things you need to put into words. Others you have not yet recognised in yourself. We can start with either.`
- Dos puertas en dos columnas (una columna en menos de 640 px), separadas por línea. Cada una es **un solo enlace** con nombre accesible completo:
  - 01 · `Hacer espacio` / `Make space` · título `Ordenar lo que estoy viviendo` / `Sort out what I am going through` · texto `Una conversación con ritmo propio, sin diagnóstico y sin prisa.` / `A conversation at its own pace, without diagnosis and without hurry.`
  - 02 · `Mirar otra vez` / `Look again` · título `Reconocer lo que puedo aportar` / `Recognise what I can contribute` · texto `Convierte tu experiencia en capacidades con evidencia que tú revisas.` / `Turn your experience into capabilities with evidence that you review.`
  - Pie de cada puerta: `Empezar →` / `Start →` en mono con `ocre-text`.
- Destino de ambas puertas: **`/login`** hasta que ES-74 defina el alta. Una persona con sesión iniciada va a `/app`. No se piden datos en la landing.
- Estados: reposo; hover con fondo `soft`; foco con anillo ocre de 3 px y offset 3 px; activo.

## 4. Franja de ejemplo (ES-64)

- Fondo `soft`, borde superior de línea. Etiqueta tipo `badge` con borde `ocre-text`: ES `Ejemplo ilustrativo · caso ficticio · docencia` · EN `Illustrative example · fictional case · teaching`.
- Línea fuerte: ES `Acciones → posibles capacidades` · EN `Actions → possible capabilities`.
- Texto: ES `Son hipótesis que tú puedes revisar, corregir o descartar. No es un diagnóstico ni una promesa de empleo.` · EN `These are hypotheses you can review, correct or discard. Not a diagnosis, not a job promise.`
- No se inventan casos, testimonios ni métricas. El texto final del ejemplo lo revisa el especialista (D-07) antes de publicar.

## 5. Contenido editable (ES-66)

Claves nuevas, sin reutilizar las viejas (`hero_title`, `step1_title`, etc.): `landing.nav.*`, `landing.hero.{label,title,subtitle}`, `landing.doors.{1.label,1.title,1.desc,2.label,2.title,2.desc,go}`, `landing.example.{label,title,flow}`, `landing.header.login`. Si el contenido editable no carga, se muestran los textos por defecto de este documento (ES y EN). Nunca pantalla vacía.

## 6. Accesibilidad y responsive

- Enlace `Saltar al contenido` como primer elemento enfocable.
- Orden de tabulación: logotipo, navegación, idioma, Ingresar, puerta 1, puerta 2.
- Foco visible en todo control. Navegable con teclado y lector de pantalla (rol y nombre de cada puerta).
- Sin scroll horizontal desde 360 hasta 1440 px. Gutter mínimo de 16 px.
- `prefers-reduced-motion`: sin transiciones.
- Tema claro y oscuro según el sistema.

## 7. Qué cambia respecto a hoy

Se reemplaza el héroe de `frontend/src/pages/LandingPage.tsx` (serif Playfair, tres pasos, sección verde `#6B7D5C`, CTA final). Hasta la fase 2 el resto de la landing actual puede quedar debajo de la franja de ejemplo sin cambios, o retirarse si Mauricio lo indica en el PR.

## 8. Pendiente (no bloquea la fase 1)

- Titular y puertas de la referencia frente a S1 y S2 de `ARQUITECTURA-Y-TEXTOS-LANDING.md`.
- Si la segunda puerta es la de profesionales (D-09, ES-74).
- Esfuerzo de Dev: sin estimar; lo propone Dev.
