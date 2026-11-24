# Auditoría de diagramación y UX/UI — Elevation + Skill Map (ES-405)

[UX/UI-Claude] · Staging `https://backend-staging-e3a6.up.railway.app` (commit `bbd520a`, `/health` → `ok`) · 23-nov-2026 · **Solo lectura**: no se tocó `frontend/` ni `backend/`.

> **v2 (24-nov):** la visión de experiencia, el prototipo navegable y la propuesta vigente están en [`INFORME-EXPERIENCIA.md`](INFORME-EXPERIENCIA.md); este informe queda como **anexo técnico de mediciones**. La propuesta de §5 (solo diagramación) queda superada por ella.
>
> Qué es este documento: medición, no opinión. Cada cifra sale de `datos/*.json` (script en `scripts/`), cada captura está en `capturas/`. La propuesta de la sección 5 es **diseño para la puerta de diseño**; **no está implementada** y espera aprobación explícita de Mauricio o Alejo.

## 1. Resumen ejecutivo

**Veredicto:** el sitio «se ve corrido» por razones medibles, no por percepción. En 25 pantallas de persona medidas a 1440 px **no hay dos reglas de ancho iguales** y la cabecera, el cuerpo y el pie del marco no comparten bordes. Hallazgos: **19** (2 Críticos, 6 Altos, 9 Medios, 2 Bajos). Actualización 24-nov: se añadieron las pantallas de profesional, administración, superadministración y junta (cuentas sintéticas elevadas por Infra-Claude).

### Causas raíz

1. **El marco tiene tres anchos a la vez.** Cabecera y pie: 1240 px centrados (`shell.css:18,72`). Cuerpo con barra lateral: `max-width: calc(1240px + 15rem)` = 1480 px (`shell.css:172`), que **suma** la barra al ancho en vez de caber dentro. A 1440 px: marca en x=100, barra lateral en x=16, contenido hasta x=1424, menú de usuario hasta x=1340. A 1920 px: 340 / 220 / 1700 / 1580. Es la causa principal de la sensación de «corrido» (D-01).
2. **Cada pantalla decide su propio ancho.** A 1440 px la columna de contenido mide 480, 640, 653, 712, 736, 1152, 1208 o 1240 px (8 valores en 34 pantallas); en el CSS hay 13 `max-width` de página distintos (40, 40,8, 46, 56, 72 rem; 640, 720, 760, 860, 900, 1080, 1152 px). No existen «tipos de página» (D-03).
3. **Tres modelos de alineación sin regla.** Pública: columna **centrada** (login 480, manifiesto 653). Persona: o **ancho completo**, o columna de 736 **anclada a la izquierda** (deja 432 px vacíos a la derecha), o columna de 640/736/712 **centrada dentro del área** (onboarding, check-in, chat) — esta última queda 128 px a la derecha del centro de la ventana (D-03, D-04).
4. **El chat vive en otro molde.** `.chat-shell` usa `height: 100dvh` y `overflow: hidden` dentro de un marco con barra lateral «sticky» de 17 enlaces: a 1440×900 el último enlace («Revisiones profesionales») queda en y=902–942 y la página no hace scroll: **inalcanzable** (D-02). Además su cabecera/hilo usan 680/760 px y fuentes de `space.css` (Inter, no Barlow) (D-02, D-07).
5. **CSS sin orden ni capas.** Solo hay 2 bloques `@layer` (`index.css:17`, `cartografia.css:41`) en 53 hojas. Los módulos heredados (`space.css`, `facilitation.css`, `therapist.css`, `accessAdmin.css`) y Cartografía conviven sin prioridad definida; las reglas sin capa ganan a todas las utilidades de Tailwind. Ejemplo medido: `.pc-link` define `min-height` en `career.css:4` (1,5 rem) y en `pages.css:114` (`var(--cg-touch)`); gana la primera → enlaces de 26 px (D-05, D-08). Dos sistemas de tokens (`--elv-*` y `--cg-*`) más `--color-*` de daisyUI.
6. **Efectos globales de una pantalla.** `progress.css:19` pone `:root:has(.prg) { scrollbar-gutter: stable }`: solo en «Mi progreso» y «Comentarios» el contenido pierde 15 px y la marca se corre 8 px al navegar (D-06).
7. **Las escalas no se imponen.** 7–15 tamaños de letra distintos por pantalla (hay textos de 12,48 px), 11–22 valores de espaciado distintos (token: 8), barra lateral con enlaces de 40 px frente al token de 46 px, radios/casillas nativos de 24 px, y 8 tamaños de `h1` entre 16,8 y 70,4 px (D-05, D-09, D-10).
8. **El tema oscuro y la tipografía no son uniformes.** `/manifiesto` ignora el tema oscuro (captura idéntica byte a byte en claro y oscuro), y el cuerpo del documento usa Inter (`index.css:21`) mientras el marco usa Barlow (`cartografia.css:21`) (D-07, D-11).

### Lo que **QA/CI no detecta** (y esta auditoría sí)
Contraste, axe y desbordes horizontales no miden: alineación entre bloques del mismo marco, coherencia de anchos entre pantallas, alcanzabilidad de la navegación en alturas cortas, ni que dos reglas del mismo selector se pisen. Se propone (sección 5.7) una prueba de conformidad de diagramación en CI.

## 2. Inventario de pantallas (rutas de `frontend/src/App.tsx`)

| # | Ruta | Rol | Marco | Estado en esta auditoría |
|---|---|---|---|---|
| p01 | `/` | público | PublicFrame | capturada y medida (7 anchos, ES/EN, claro/oscuro) |
| p02 | `/login` (+ `?mode=register`) | público | PublicFrame | capturada y medida |
| p03 | `/forgot-password` | público | PublicFrame | capturada y medida |
| p04 | `/reset-password` | público | PublicFrame | capturada y medida (sin token: estado de error/vacío) |
| p05 | `/accept-invitation` | público | PublicFrame | capturada y medida (sin token) |
| p06 | `/profesionales` | público | PublicFrame | capturada y medida |
| p07 | `/manifiesto` | público (junta: BoardFrame) | PublicFrame | capturada y medida |
| p08 | `/privacidad` | público | PublicFrame | capturada (1440, sondeo aparte); medición parcial — ver D-15 |
| p09 | `/terminos` | público | PublicFrame | ídem |
| p10 | `/design-system` | público (interna) | propio `.cg-page` | capturada y medida |
| u01 | `/app/dashboard` («Mi panel») | persona | PersonLayout | capturada y medida (sesión sintética) |
| u02 | `/app/chat` | persona | PersonLayout + SpaceSession | capturada y medida (sin enviar mensajes: **0 gasto de IA**) |
| u03–u04 | `/app/diary`, `/app/diary/new` | persona | PersonLayout | capturadas y medidas |
| u05 | `/app/onboarding` («Mi contexto») | persona | PersonLayout | capturada y medida |
| u06–u07 | `/app/context/resumes`, `/app/context/resumes/update` | persona | PersonLayout | capturadas; `update` redirige a onboarding con la cuenta sintética (sin hoja de vida) |
| u08 | `/app/checkin` | persona | PersonLayout | capturada y medida |
| u09 | `/app/progress` | persona | PersonLayout | capturada y medida |
| u10–u11 | `/app/evidence`, `/app/evidence/new` | persona | PersonLayout | capturadas y medidas |
| u12 | `/app/skill-map` («Mapa») | persona | PersonLayout | capturada y medida |
| u13–u15 | `/app/next-step`, `/experiments`, `/plan` | persona | PersonLayout + CareerShell | capturadas y medidas |
| u16–u18 | `/app/exercises`, `/app/bridge`, `/app/space/tools` | persona | PersonLayout | capturadas y medidas |
| u19–u20 | `/app/data` («Mis datos»), `/app/plan` («Mi plan») | persona | PersonLayout | capturadas y medidas |
| u21–u25 | `/app/compass`, `/app/route-catalog`, `/app/professional-reviews`, `/app/feedback`, `/app/my-therapist` | persona | PersonLayout | capturadas y medidas |
| — | `/app/evidence/:id`, `/app/evidence/:id/edit`, `/app/evidence/resume-skills`, `/app/route-catalog/roles/:roleKey`, `/app/next-step/experiments/:id` | persona | PersonLayout | **capturas pendientes** (requieren datos creados; no se crearon para no gastar ni ensuciar staging) |
| — | `/app/session/:id` | persona | BareFrame | **capturas pendientes** (sala de videollamada, requiere sesión agendada) |
| r02 | `/facilitation` | profesional | sin marco (FacilitationPreview) | capturada y medida: vista preliminar deshabilitada (D-19) |
| r01 | `/therapist/dashboard` | profesional | TherapistLayout | capturada y medida (`/therapist/patient/:id` y `/therapist/session/:id`: **pendientes**, requieren una persona vinculada y una sesión) |
| r03 | `/app/data` como profesional | profesional | marco de profesional | capturada y medida |
| r04–r12 | `/admin/dashboard`, `prompts`, `content`, `users`, `metrics`, `manifest`, `route-catalog`, `skill-catalog`, `/admin/pilot-metrics` | admin | AdminFrame | medidas; **capturas retiradas del repositorio por privacidad** (los listados mostraban cuentas reales de staging); `content`: ver D-15; subrutas con id: pendientes |
| r13 | `/admin/dashboard` | superadmin | AdminFrame | medida; captura retirada por privacidad |
| r14–r15 | `/manifiesto`, `/app/data` | junta | BoardFrame | capturadas y medidas |
| — | `/pricing`, `/board/*` | — | redirigen (`/`, `/manifiesto`) | sin pantalla propia |

**Cuentas.** Con la confirmación directa de Mauricio en el chat de esta sesión se crearon en staging cuentas sintéticas `qa-sint-ux-{es,en,prof,admin,super,board}@example.test` por el endpoint público `/api/register` (rol `user`, sin gasto de IA, sin enviar mensajes). Infra-Claude elevó los roles de las cuatro últimas (therapist, admin, superadmin, board) con un `UPDATE` en transacción de recuento exacto; yo no tengo acceso a la base. Las claves viven solo en un archivo local fuera del repo. Al terminar se piden desactivadas (`active=false`), sin purga.

**Privacidad de la evidencia (24-nov).** Se retiraron del repositorio y de su historial todas las capturas de administración y superadministración (r04–r13): mostraban listados de cuentas reales de staging. De ellas solo quedan las mediciones (`datos/`, matriz §4). Las capturas que permanecen son de pantallas públicas, del prototipo y de cuentas sintéticas `qa-sint-ux-*@example.test` vacías (revisadas una a una las de profesional, junta y persona con datos personales posibles: sin nombres ni correos reales); las capturas futuras usarán solo cuentas `qa-sint-*@example.test`.

## 3. Hallazgos

Severidad: **Crítico** = bloquea o desorienta en el uso normal; **Alto** = inconsistencia visible en varias pantallas o ruptura de una regla propia del proyecto; **Medio** = deuda visible o riesgo; **Bajo** = detalle. Capturas relativas a `capturas/`; mediciones en `datos/mediciones-chromium.json` (campos `mainL`, `mainR`, `contentL/R`, `smallCount`…).

| ID | Pantalla | Rol | Ancho | Sev. | Evidencia (captura + medida) | Causa (archivo:línea) | Sugerencia |
|---|---|---|---|---|---|---|---|
| D-01 | Todas las del marco con barra lateral (u01–u25 y r01, r03–r05, r07–r15) | persona, profesional, admin, superadmin, junta (medido) | ≥ 901 (1024–1920) | **Crítico** | `u01-dashboard_es-light_1440.jpg`, `…_1920.jpg`. 1440: marca x=100, barra lateral x=16, contenido hasta x=1424, menú de usuario y pie hasta x=1340. 1920: 340 / 220 / 1700 / 1580. `chain` de `main`: `.cg-body` 1408 px (máx. 1480) dentro de `.cg-frame` de 1440 | `shell.css:18` y `:72` (cabecera y pie 1240), `:62` (cuerpo 1240), `:172` (`.cg-body--wideside` = `calc(1240px + 15rem)`), `:14` (`.cg-frame` padding 16 px) | Un único contenedor `--cg-wrap` para cabecera, cuerpo y pie; la barra lateral va dentro (§5.1) |
| D-02 | `/app/chat` | persona | 1440×900 y 1440×700 (altura ≤ ~960) | **Crítico** | `u02-chat_es-light_1440.jpg`; `datos/probe2.json`: página sin scroll (`docH` = `vh`), último enlace de la barra («Revisiones profesionales») en top 902 / bottom 942 con ventana de 900 → fuera de pantalla; en `/app/dashboard@700` sí se alcanza (la página hace scroll). La columna del chat (712 px) queda centrada en el área: centro en x=848 frente a 720 de la ventana (+128) | `space.css:52` (`.chat-shell { height: 100dvh; overflow: hidden }`; se vuelve a declarar en `:150` y `:190`), `shell.css:64` (`.cg-side { position: sticky; top: 1rem }` sin `max-height` ni `overflow`), `space.css:53` (`.chat-main` 760), `:152` (`.chat-header-in` 680) | La barra lateral debe tener `max-height` y `overflow-y:auto`; el chat debe usar el mismo contenedor que el resto (§5) |
| D-03 | u01–u25 | persona | 1440 | Alto | Columna de contenido a 1440: 1152 (u01, u03, u12–u15, u17, u18, u20, u22), 736 anclada izquierda con 432 px vacíos a la derecha (u06, u10, u11, u16, u19, u21, u23, u25, u09, u24), 736 centrada (u08), 640 centrada (u05, u07), 712 centrada (u02). Matriz completa en §4 | `pages.css:6` (`.pg-stack` 46 rem), `checkin.css:2` (`.ck` 46 rem centrado), `onboardingCartografia.css:12` (40 rem centrado), `participantContext.css:26` (640 px), `person-reviews.css:30`, `space.css:10` (860 px) | Cinco tipos de página con ancho por token (§5.2) |
| D-04 | Públicas vs persona | público/persona | ≥ 901 | Alto | Al pasar de `/manifiesto` (columna centrada de 653) a `/app/diary` (contenido anclado a la izquierda a 1152) cambian ancho, eje de alineación y posición de la marca. Login: tarjeta 480 centrada (`p02-login_es-light_1440.jpg`); persona: `u03-diario_es-light_1440.jpg` | `manifesto.css:4` y `legal.css:16` (`margin: 0 auto`, 40,8 rem), `accessCartografia.css:3` (30 rem) vs `pages.css` (sin centrar) | Una regla: contenido anclado al borde izquierdo del contenedor; solo la tarjeta de acceso se centra (§5.2) |
| D-05 | u01–u25 y públicas | persona/público | 1440 y 390 | Alto | Objetivos táctiles < 44 px: barra lateral 17 enlaces de **232×40** en las 25 pantallas de persona a ≥ 901 (17–33 por pantalla); `.pc-link` 94×26 («Ver planes →», «Mi contexto»); `.cg-linkbtn` 142×31; radios/casillas nativos 24×24 (u05, u13: 16 a 390 px; u24; u21); «Mostrar» contraseña 79×38 (`p02`, 1 a 390 y 320 px); `a` «Diario» 43×46. El token del proyecto es 46 px (`--cg-touch`) | `shell.css:167` (`min-height: 2.5rem` = 40 px); `career.css:4` pisa a `pages.css:114` (`min-height: 1.5rem` frente a `var(--cg-touch)`); controles nativos sin envoltorio | Todo control ≥ 46 px alto y ≥ 44 ancho; casillas dentro de filas de 46 px |
| D-06 | `/app/progress`, `/app/feedback` | persona | 1440 (con barra clásica) | Alto | `u09-progreso_es-light_1440.jpg`: franja vacía de 15 px a la derecha, marca en x=93 en vez de 100, `main` de 1137 px (1152 en las demás); `datos/probe2.json`: `scrollbar-gutter: stable` en `html` solo en esas dos rutas. El desfase aparece y desaparece al navegar | `progress.css:19` (`:root:has(.prg){scrollbar-gutter:stable}`) | Aplicar el reservado de scrollbar de forma global y única en el marco, o en ninguna pantalla |
| D-07 | `/app/chat` | persona | todos | Alto | `u02-chat_es-light_1440.jpg`: caja de texto y botón «Enviar» con estilo Inter/daisyUI, no Cartografía (botones en Barlow, mayúsculas); `h1` «CONVERSACIÓN» de **16,8 px** frente a 44,8 px en las demás; línea de 90 caracteres; `.chat-lang` 32 px | `space.css:10–60` (`.space-scope`: Inter 16 px/1,65; `.elv-btn`), `:155` (`.chat-header` 60 px propio), `:152` | Migrar cabecera y compositor del chat a piezas `cg-*` (otro ticket tras aprobar §5) |
| D-08 | Transversal | todos | todos | Alto | CSS: 53 hojas, 2 `@layer`; `index.css:17` solo envuelve `body`. Dos sistemas de tokens (`--elv-*` en `tokens.css`, `--cg-*` en `cartografia.css`) + `--color-*` (daisyUI) + `@theme` de Tailwind. Mismo selector en dos módulos: `.pc-link` (career.css:4 / pages.css:114), `.ac-actions` (accessCartografia.css:52 / adminContent.css:10), `.skill-map-dot.dot-level` (mapCartografia.css:76 / skillMap.css:47) — `scripts/dups.mjs`. Probado: gana `career.css` en dos recorridos distintos (directo y SPA) → 26 px en ambos (`datos/probe4.json`); la dependencia del orden de carga de los chunks **no se demostró**, queda como riesgo | `index.css:1–5` (imports sin capa), `cartografia.css:41` | Orden de capas (§5.6) y regla «solo `cg-frame` fija ancho y márgenes de página» |
| D-09 | `/` y todas | todos | 1440 | Medio | Tamaños de letra distintos por pantalla: 6 (login) a 15 (portada); textos de **12,48 px** (15 en la portada, 6 en el panel, 5 en el chat) y 12,8 px (10 en el panel) | `cartografia.css:51,136` (`.cg-tag`, `.cg-card dt`: `.78rem` = 12,48 px), `shell.css:30` (`.cg-role`), `pages.css:140`, `bridge.css:25` | Mínimo 13 px; escala tipográfica de 6 pasos (§5.4) |
| D-10 | Todas | todos | 1440 | Medio | `h1` de 8 tamaños distintos: 16,8 / 38,4 / 41,6 / 44,8 / 48 / 54,4 / 64 / 70,4 px (chat, acceso, profesionales, persona, onboarding/check-in, mapa, manifiesto, portada) | `pages.css:4` (`.pg-title`), `cartografia.css:48` (`.cg-h1`), `manifesto.css`, `space.css:15` (`2rem`) | Un `h1` por tipo de pantalla con `clamp` único |
| D-11 | Todas | todos | 1440 | Medio | Espaciados distintos por pantalla: 11 a 22 valores (token: 8). Valores fuera de múltiplos de 4: 5, 6, 10, 13, 18, 19 px | `--cg-s3: 0.8rem` (12,8 px) en `cartografia.css:17`; márgenes sueltos en cada módulo | Escala 4·8·12·16·24·32·48·64 (§5.3) |
| D-12 | `/manifiesto` | público | todos (oscuro) | Medio | `p07-manifiesto_es-light_1440.jpg` y `…_es-dark_1440.jpg` son **idénticas byte a byte**; con `prefers-color-scheme: dark` y `elv_theme=dark` el marco sigue claro (luminancia 235 frente a 20 en las demás públicas, `datos/probe3.json`). Página de 13 045 px de alto | `ManifestoPage.tsx:48` (`PublicFrame` sin `migrated` → `frames.tsx:37` fija tema claro) | Pasar `migrated`; revisar longitud/estructura del texto con el PO |
| D-13 | `/` (portada) | público | 1440 | Medio | Bloques con anchos distintos bajo el mismo marco de 1240: héroe 1240, contenido de «landing» 1080 (`landing-container`), pie de landing 1080 a x=180 (con `max-width` 1280), frente a x=100 de la cabecera (`datos/probe4.json`) | `landingScope.css:21,60,72,83,114,161,185,207` (1080/1280/1050/650/530 px) | Todos los bloques de la portada dentro de `--cg-wrap` |
| D-14 | Marcos de profesional, administración y junta | profesional/admin/junta | ≥ 901 | Medio | Medido (`datos/mediciones-roles.json`, `datos/matriz-roles.md`): **repiten D-01 exacto** (main L272/R16 a 1440; 736 a 1024); barra lateral de administración con 9 enlaces de 40 px en cada pantalla (`r04…r13`, 9 controles < 44 px); `/admin/manifest` 896 px centrado (L272/R272, `boardManifest.css:2`); `/admin/users` termina en R44 (otra regla); `/manifiesto` como junta: 653 px centrado en el área (L522/R266, +128 de desfase); `/app/data` como profesional/junta: 736 anclado (432 px vacíos). Foco `#0369A1` 2 px en `therapist.css:6` frente a 3 px `--cg-mark` (solo CSS) | los mismos que D-01/D-03/D-05 | Se corrigen con el mismo sistema (§5) |
| D-15 | `/privacidad`, `/terminos`, `/admin/content` | público, admin | todos | Medio (colateral, no es de diagramación) | La carga con `networkidle` agota 45 s en las tres: queda sin terminar una petición (`/api/legal/privacy?lang=es` y `/api/junta/pending` en `/admin/content`, `datos/probe2.json`, medición 9 s con `probe5.mjs`). Con `curl`, `/api/legal/privacy` responde 404 en 0,26 s. Las páginas sí pintan. **Causa no verificada** (¿reintentos del cliente, petición larga?) | no investigado | Pasar a Dev para revisar |
| D-16 | `/app/*` entre 901 y 1100 px | persona | 901–1100 | Medio | A 1024 la barra lateral (232 px) deja 736 px de contenido: `u01-dashboard_es-light_1024.jpg`, tarjetas de ~360 px en 2 columnas; a 1360 son 1072 px | `shell.css:172` (`14.5rem` + `1.5rem`) | Barra colapsable entre 901 y 1100 o cajón desde 1100 (decisión de diseño) |
| D-19 | `/facilitation` | profesional | todos | Medio | `r02-prof-facilitacion_es-light_1440.jpg`: pantalla «Consola de facilitación» sin cabecera, sin barra ni pie del marco, con tipografía serif Playfair + Inter y contenedor de 1088 px centrado (L176/R176); a 1024 px ocupa 960 con 0 de margen del marco; es otro lenguaje visual. Hoy es una vista preliminar deshabilitada («La vista preliminar no está habilitada»), pero la ruta sigue enlazada | `facilitation.css:27–28` (1152 centrado), `FacilitationPreview` sin `Frame` | Retirar la ruta o llevarla al marco |
| D-17 | `/design-system` | público (interna) | ≥ 1240 | Bajo | `main#cg-main` con 1208 px a x=116 (otro contenedor `.cg-page`, no el marco) | `cartografia.css:173` | Documentarlo como excepción o usar el marco |
| D-18 | `/app/chat` | persona | 1440 | Bajo | Ancho de línea mediano/máximo 90 caracteres (ideal 45–90: en el límite) | `space.css:53` | Subsana con el tipo «Sala» (48 rem) |

**Conteo:** Crítico 2 · Alto 6 · Medio 9 (D-09 a D-16 y D-19) · Bajo 2 · **Total 19**.

### Otras mediciones sin hallazgo
- **Desbordes horizontales:** 0 en 385 combinaciones de pantalla/ancho/idioma/tema salvo el campo trampa fuera de pantalla de `/profesionales` (`.pa-trap` a −10000 px, intencional: anti-bots) y los −15 px de D-06.
- **Ancho de línea** (mediana de párrafos): 27–72 caracteres en las pantallas con párrafos largos; manifiesto 61–68; ninguna supera 90 salvo el chat (90).
- **Móvil (390/320 px):** una columna y márgenes de 16 px simétricos en todas las pantallas (0 desfase); a 320 px no hay desbordes. Fallos solo de tamaño táctil (D-05).
- **z-index:** solo `a.cg-skip = 100` y, en la portada, 1–2 en el héroe; el menú de usuario usa 20 (`shell.css:45`). No se vieron solapamientos.
- **Motores:** Firefox y WebKit (motores de Playwright en Windows) dan las **mismas medidas** de `main` y contenido en 7 pantallas a 1440 y 390 px (`datos/mediciones-firefox.json`, `…-webkit.json`).

## 4. Matriz comparativa de estructura de página (a 1440 px; columna de contenido = envolvente de los elementos visibles de `main`)

| Pantalla | Ruta | Columna de contenido a 1440 | a 1024 | a 390 | Desfase a 1440 (px) | Ancho de línea (car.) | Origen del ancho |
|---|---|---|---|---|---|---|---|
| p01-portada | / | 1240px (izq 100 / der 100) | 992px (izq 16 / der 16) | 358px (izq 16 / der 16) | 0 | 41 / 96 | Marco público; hero a 1240; resto 1080/1280 (landingScope.css:21,83) |
| p02-login | /login | 480px (izq 480 / der 480) | 480px (izq 272 / der 272) | 358px (izq 16 / der 16) | 0 | — / — | .ac-card 30rem (accessCartografia.css:3) |
| p03-olvide | /forgot-password | 480px (izq 480 / der 480) | 480px (izq 272 / der 272) | 358px (izq 16 / der 16) | 0 | 45 / 45 | .ac-card 30rem |
| p04-reset | /reset-password | 480px (izq 480 / der 480) | 480px (izq 272 / der 272) | 358px (izq 16 / der 16) | 0 | — / — | .ac-card 30rem |
| p05-invitacion | /accept-invitation | 480px (izq 480 / der 480) | 480px (izq 272 / der 272) | 358px (izq 16 / der 16) | 0 | 27 / 27 | .ac-card 30rem |
| p06-profesionales | /profesionales | n/d (campo trampa fuera de pantalla) | n/d (campo trampa fuera de pantalla) | n/d (campo trampa fuera de pantalla) | 0 | 64 / 64 | .pa 46rem (applicationCartografia.css:2) |
| p07-manifiesto | /manifiesto | 653px (izq 394 / der 394) | 653px (izq 186 / der 186) | 358px (izq 16 / der 16) | 0 | 61 / 68 | .manifesto 40,8rem (manifesto.css:4) |
| p10-design-system | /design-system | 1208px (izq 116 / der 116) | 992px (izq 16 / der 16) | 358px (izq 16 / der 16) | 0 | 28 / 28 | .cg-page 1240 propio (cartografia.css:173) |
| u01-dashboard | /app/dashboard | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 128 | 72 / 72 | sin max-width: ocupa todo |
| u02-chat | /app/chat | 712px (izq 492 / der 236) | 688px (izq 296 / der 40) | 326px (izq 32 / der 32) | 128 | 90 / 90 | .chat-main 760 (space.css:53) + .chat-header-in 680 (space.css:152) |
| u03-diario | /app/diary | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 128 | 41 / 41 | .pg sin tope |
| u04-diario-nuevo | /app/diary/new | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 128 | 41 / 41 | .pg sin tope |
| u05-onboarding | /app/onboarding | 640px (izq 528 / der 272) | 640px (izq 320 / der 64) | 358px (izq 16 / der 16) | 128 | 56 / 58 | .cg-onboarding 40rem centrado (onboardingCartografia.css:12) |
| u06-hojas-vida | /app/context/resumes | 736px (izq 272 / der 432) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | -80 | — / — | .pg-stack 46rem (pages.css:6) |
| u07-hoja-actualizar | /app/onboarding | 640px (izq 528 / der 272) | 640px (izq 320 / der 64) | 358px (izq 16 / der 16) | 128 | 56 / 58 | redirige a onboarding |
| u08-checkin | /app/checkin | 736px (izq 480 / der 224) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 128 | 57 / 57 | .ck 46rem centrado (checkin.css:2) |
| u09-progreso | /app/progress | 736px (izq 272 / der 432) | 721px (izq 272 / der 31) | 343px (izq 16 / der 31) | -80 | — / — | .prg ~46rem + gutter (progress.css:19) |
| u10-evidencias | /app/evidence | 736px (izq 272 / der 432) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | -80 | — / — | .pg-stack 46rem |
| u11-evidencia-nueva | /app/evidence/new | 736px (izq 272 / der 432) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | -80 | — / — | .pg-stack 46rem |
| u12-mapa | /app/skill-map | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 128 | 43 / 87 | sin tope |
| u13-rutas | /app/next-step | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 128 | — / — | sin tope |
| u14-experimentos | /app/next-step/experiments | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 128 | — / — | sin tope |
| u15-plan-carrera | /app/next-step/plan | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 128 | — / — | sin tope |
| u16-ejercicios | /app/exercises | 736px (izq 272 / der 432) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | -80 | — / — | .pg-stack 46rem |
| u17-puente | /app/bridge | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 128 | 49 / 81 | sin tope |
| u18-herramientas | /app/space/tools | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 128 | 23 / 23 | sin tope |
| u19-mis-datos | /app/data | 736px (izq 272 / der 432) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | -80 | 57 / 57 | .pg-stack 46rem |
| u20-mi-plan | /app/plan | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 128 | 37 / 37 | sin tope |
| u21-brujula | /app/compass | 736px (izq 272 / der 432) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | -80 | 53 / 53 | .pg-stack 46rem |
| u22-catalogo-rutas | /app/route-catalog | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 128 | 33 / 33 | sin tope (.rc 72rem en gestor) |
| u23-revisiones | /app/professional-reviews | 736px (izq 272 / der 432) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | -80 | — / — | .rv-stack 46rem (person-reviews.css:30) |
| u24-feedback | /app/feedback | 736px (izq 272 / der 432) | 721px (izq 272 / der 31) | 343px (izq 16 / der 31) | -80 | 65 / 88 | .prg ~46rem + gutter |
| u25-mi-profesional | /app/my-therapist | 736px (izq 272 / der 432) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | -80 | — / — | .pg-stack 46rem |

**Pantallas de profesional (r01–r03), administración (r04–r13) y junta (r14–r15):**

| Pantalla | Ruta | Columna a 1440 | a 1024 | a 390 | Táct. <44 px a 1440 | Origen |
|---|---|---|---|---|---|---|
| r01-prof-panel | /therapist/dashboard | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 3 | TherapistLayout (marco con barra), sin max-width |
| r02-prof-facilitacion | /facilitation | 1088px (izq 176 / der 176) | 960px (izq 32 / der 32) | 358px (izq 16 / der 16) | 0 | .fac-main 1152 centrado, SIN marco (facilitation.css:28) |
| r03-prof-misdatos | /app/data | 736px (izq 272 / der 432) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 3 | .pg-stack 46rem |
| r04-admin-resumen | /admin/dashboard | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 9 |  |
| r05-admin-prompts | /admin/prompts | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 9 |  |
| r07-admin-usuarios | /admin/users | 1124px (izq 272 / der 44) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 9 |  |
| r08-admin-metricas | /admin/metrics | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 9 |  |
| r09-admin-manifiesto | /admin/manifest | 896px (izq 272 / der 272) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 9 | .bm 56rem centrado (boardManifest.css:2) |
| r10-admin-rutas | /admin/route-catalog | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 9 |  |
| r11-admin-habilidades | /admin/skill-catalog | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 9 |  |
| r12-admin-piloto | /admin/pilot-metrics | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 9 |  |
| r13-super-resumen | /admin/dashboard | 1152px (izq 272 / der 16) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 9 |  |
| r14-board-manifiesto | /manifiesto | 653px (izq 522 / der 266) | 653px (izq 314 / der 58) | 326px (izq 32 / der 32) | 1 | .manifesto 40,8rem centrado |
| r15-board-misdatos | /app/data | 736px (izq 272 / der 432) | 736px (izq 272 / der 16) | 358px (izq 16 / der 16) | 1 |  |

Lectura de la matriz: «Desfase» = (margen izquierdo − margen derecho)/2 del contenido respecto al centro de la ventana; en persona con barra lateral es +128 (columna completa o centrada en el área) o −80 (columna de 736 anclada a la izquierda), nunca 0: la barra lateral y la elección de cada pantalla desplazan el centro visual. En públicas es 0 (centradas). La fila `u07` redirige a onboarding con la cuenta sintética y la fila `p06` tiene un campo trampa fuera de pantalla que impide medir la columna.

## 5. Propuesta de sistema de diagramación único (para la puerta de diseño — NO implementada)

Maqueta estática con ES/EN, claro/oscuro, estados y responsive: [`maqueta/index.html`](maqueta/index.html) (capturas: `maqueta/maqueta_1440_es-light.jpg`, `maqueta/maqueta_390_en-dark.jpg`).

### 5.1 Contenedor único
`--cg-wrap: 1240px` y `--cg-gutter: clamp(1rem, 2.5vw, 2rem)`. Cabecera, cuerpo y pie usan **la misma** clase de contenedor. La barra lateral (`--cg-side: 14.5rem`, `--cg-gap: 1.5rem`) va **dentro** de los 1240 px (hoy se suma: `shell.css:172`). Resultado a 1440 px: marca, barra, contenido, menú y pie comparten x=100 y x=1340. La barra lateral lleva `max-height: calc(100dvh − 2rem); overflow-y: auto` (arregla D-02).

### 5.2 Cinco tipos de página (ancho por token, alineación al borde izquierdo)
| Tipo | Ancho | Alineación | Pantallas |
|---|---|---|---|
| Panel | 100 % del contenido; 1 col. < 768, 2 col. 768–1240, 3 col. ≥ 1240 | borde izq. | Mi panel, Mapa, Rutas, Experimentos, Plan, Mi plan, Puente, Herramientas, Catálogo, tablas de administración |
| Formulario / flujo | `--cg-w-form` 40 rem | izquierda | Mi contexto, Check-in, Evidencia nueva, Hojas de vida, Mis datos, Brújula, Mi profesional, Revisiones, Ejercicios |
| Lectura | `--cg-w-read` 44 rem (≈ 70 car.) | izquierda | Manifiesto, Privacidad, Términos, Mi progreso, Solicitud profesional |
| Tarjeta de acceso | `--cg-w-card` 30 rem | centrada (única excepción) | Entrar, Olvidé, Restablecer, Invitación |
| Sala | cabecera y barra al 100 %; hilo `--cg-w-room` 48 rem | izquierda del contenido (decisión D-A) | Conversación |

Reemplaza los 13 anchos actuales. Cada pantalla declara su tipo con una clase (`cg-page--panel|form|read|card|room`); **no** fija `width`, `max-width` ni `margin-inline` en su raíz.

### 5.3 Espaciado
Escala única `4·8·12·16·24·32·48·64 px` (`--cg-s1…s16`). Se corrige `--cg-s3` (12,8 → 12 px) y se añaden `s12`, `s16`. Prohibido espaciado fuera de la escala en el CSS nuevo.

### 5.4 Jerarquía tipográfica
Cuerpo 17 px/1,55 (ya es el de `.cg`); `h1` `clamp(2rem, 4.6vw, 2.8rem)` en toda pantalla (el `h1` del chat deja de ser de 16,8 px); `h2` 1,5 rem; `h3` 1,15 rem; mínimo absoluto 13 px (hoy 12,48 px en `.cg-tag`, `.cg-role`, `.cg-card dt`…); una sola familia de cuerpo (Barlow) en toda la aplicación, no Inter + Barlow. Línea de lectura 45–75 caracteres.

### 5.5 Objetivos táctiles, foco y tema
Todo control ≥ 46 px de alto y ≥ 44 de ancho (barra lateral 40 → 46; `.pc-link` 26 → 46; casillas y radios en filas de 46 px). Un solo anillo de foco (3 px `--cg-mark`, desfase 3 px). `/manifiesto` y los marcos heredados adoptan el tema oscuro del sistema.

### 5.6 Capas de CSS
`@layer theme, base, cg-tokens, legacy, cg-frame, cg-components, cg-screens, utilities;` Los módulos heredados se importan con `layer(legacy)` y se vacían pantalla a pantalla; `cg-frame` es el **único** dueño de ancho y márgenes de página; Tailwind `utilities` queda al final como salida de emergencia. Se elimina `scrollbar-gutter` por pantalla (`progress.css:19`) y se decide una vez en el marco.

### 5.7 Prueba de conformidad de diagramación en CI (para no volver a esto)
El script `scripts/measure.mjs` ya mide lo necesario. Propuesta: un test que, por pantalla y ancho (1440, 1024, 390), falle si (a) el borde izquierdo de `main` ≠ borde izquierdo de la marca ±1 px; (b) hay desbordes; (c) algún control < 44 px; (d) un texto < 13 px; (e) el ancho de la columna no es uno de los 5 tokens. Costo estimado ~2 min de CI con cuentas sintéticas sembradas; **no** gasta IA (no se envían mensajes).

### 5.8 Qué cambia respecto a lo actual
- Panel a 1440 px: 1152 → **984 px** útiles (la barra deja de sumarse). Decisión D-B (¿subir `--cg-wrap` a 1320?).
- Chat: columna centrada de 712 → hilo de 768 px a la izquierda del contenido (decisión D-A).
- Formularios anclados a 736 o centrados a 640 → 640 anclados a la izquierda.
- Barra lateral: 40 → 46 px por enlace (17 enlaces: 782 px frente a 680); necesita scroll interno en ventanas bajas.
- Tokens reutilizados: `--cg-ground/panel/ink/muted/line/mark`, `--cg-touch`, `--cg-s1…s8`, clases `.cg-*`. Nuevos: `--cg-wrap`, `--cg-gutter`, `--cg-side`, `--cg-gap`, `--cg-w-*`, `--cg-s12`, `--cg-s16`.
- Orden sugerido (D-C): PR 1 marco + capas (D-01, D-02, D-06, D-08); PR 2 tipos de página en persona; PR 3 chat; PR 4 públicas y portada; PR 5 profesional/administración/junta (tras capturarlas).

**Decisiones que pido a Mauricio o Alejo:** D-A (chat izquierda/centrado), D-B (984 vs 1320 px), D-C (orden de migración), y aprobar el diseño antes de abrir tickets de implementación.

## 6. Lo que NO se verificó (honestidad)
- **Salas de videollamada** (`/app/session/:id`, `/therapist/session/:id`), **detalle de persona** (`/therapist/patient/:id`) y las **subrutas con id** del catálogo: sin capturas (requieren datos/sesión). Profesional, administración, superadmin y junta: capturadas y medidas con cuentas vacías (14 pantallas; `admin/content` sin errores de carga pero con petición pendiente, D-15).
- **Pantallas con datos:** detalle de evidencia, editar evidencia, resumen de hoja de vida, experimento por id, catálogo por rol: no se crearon datos. Las medidas de `/app/*` son de **cuenta vacía**; con datos reales (listas largas, tablas) pueden aparecer otros desbordes.
- **Safari/iOS, navegadores móviles reales y táctil real:** no. WebKit y Firefox de Playwright (escritorio, Windows) solo en 7 pantallas a 1440 y 390 px; Chromium en las 35. El emulado de 390/320 px es una ventana angosta, no un teléfono.
- **Lector de pantalla, orden de Tab y operación por teclado:** no se probaron (solo se midió tamaño y DOM). Contraste y axe: no se repiten (ya los cubre CI).
- **Zoom 200 %, texto ampliado, `prefers-reduced-motion`, impresión, modo de contraste forzado:** no.
- **Barra de desplazamiento clásica frente a superpuesta:** Chromium headless usa la clásica (15 px) donde hay `scrollbar-gutter`; en macOS o móvil (superpuesta) D-06 no se vería igual.
- **Orden de carga de los chunks de CSS** como causa de colisiones: probado en 2 recorridos, mismo resultado; no demostrado (D-08).
- **D-15** (404 de `/api/legal/*` y petición sin terminar): causa no investigada.
- **Idioma EN y oscuro:** capturados y medidos a 1440 y 390 px en todas las pantallas. No se revisó la calidad de los textos EN.
- **Estados** (cargando/vacío/error/éxito) de cada pantalla: solo los que salen con cuenta vacía; los de error/guardado no se provocaron.
- Las cifras son de **Chromium con ventana de 900 px de alto**; la altura corta (700 px) solo se midió en 4 combinaciones (`datos/probe2.json`).

## 7. Reproducir
Node 22 portable + Playwright (`C:\Users\Usuario\tools`). Script: `scripts/measure.mjs <salida> <archivo-con-clave> scripts/screens.json` (la clave de las cuentas sintéticas **no** se versiona; se pasa por archivo local). `ENGINE=firefox|webkit`, `WIDTHS=1440,390` para limitar. `scripts/probe2.mjs` a `probe4.mjs`: sondeos puntuales (privacidad, gutter, alcanzabilidad de la barra, tema oscuro, orden de CSS). `scripts/dups.mjs`: selectores repetidos entre hojas. `scripts/matriz.cjs`: genera `datos/matriz.md`.

Capturas incluidas: `capturas/` (144 de ~460; el conjunto completo —todas las pantallas a 7 anchos, ES/EN/oscuro— queda fuera del repositorio por peso, en la carpeta de notas compartidas de la sesión).
