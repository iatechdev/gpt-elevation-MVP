[QA-Claude] QA aprobado — head 27dbebdaa0ae379cf35efc0b041793a45f8d4f94

**Veredicto: APROBADO** — PR #394 (ES-342 Parte B: menú del chat B1 + barra superior B2). Plan corto M1–M11 publicado en ES-342 (comentario 12766) y en el PR, que cubre el listado de Infra. Cabeza exacta (ls-remote), CI 5/5 y CLEAN verificados antes de ejecutar y justo antes de publicar. Probé la cabeza fusionada con main, con **build FRESCO** (PR y main por separado) servido con proxy /api hacia el backend REAL + PostgreSQL desechable local (migraciones reales), personas sintéticas `@example.invalid` (usuario y superadmin) registradas por la API, 0 IA, sin staging ni producción. Chromium + axe 2.2 AA. Control = el mismo guion contra main.

| Caso | Resultado |
|---|---|
| M1 orden y agrupación | **Cumple** en 16 combinaciones (claro/oscuro × ES/EN × 1360×900, 390×800, 320×568; superadmin en 390 y 320): cabecera «Menú» + «Cerrar» arriba; Conversación → Principal → Preferencias; pie «Cerrar sesión» fijo y dentro de pantalla; «Menú de usuario» plegado al abrir (`aria-expanded=false`) y de nuevo plegado al reabrir |
| M2 sin duplicados ni huérfanos | **Cumple.** «Mi progreso» 1 vez (main: 2); Recomendaciones, nota de uso y «Enter envía» presentes; «Administración» solo con rol superadmin; **16 controles cerrado (17 con superadmin) y 26 (27) desplegado**; idioma y tema solo dentro de «Preferencias» (0 sueltos en la barra). Paridad con main en las 16 combinaciones: **ningún control de main falta**; lo nuevo es solo el botón «Menú de usuario» y, a ≥ 901 px, la navegación que antes se ocultaba |
| M3 posición | **Cumple.** Hoja anclada abajo a ≤ 900 px y centrada a ≥ 901; sin desborde horizontal con el menú abierto |
| M4 teclado y foco | **Cumple.** El foco entra al abrir; Tab atrapado y cíclico; Shift+Tab desde el primero va a «Cerrar sesión»; Esc cierra y devuelve el foco al botón «Menú». Orden de Tab medido: Cerrar → Mi progreso → Recomendaciones → Enter envía → Mapa → Conversación → Evidencias → Diario → Siguiente paso → Menú de usuario → ES → EN → Auto → Claro → Oscuro → Cerrar sesión (= el pedido) |
| M5 barra B2 | **Cumple.** Un solo h1 visible «Conversación» (700, Barlow Condensed, ≈ 1,05 rem); ☰ ≥ 46×46 con nombre accesible «Menú» (palabra visible solo a ≥ 901); «Pausar» = `cg-btn--ghost` ≥ 46 px sin monoespaciada; barra de uso = `--cg-mark` (azul claro `rgb(29,79,145)`, oscuro `rgb(127,176,232)`); texto de uso en sans, sin mayúsculas forzadas |
| M6 ES/EN y sin textos nuevos | **Cumple.** Todo el guion en ES y EN; el diff no añade literales de usuario (todo sale de copy existente) |
| M7 Dialog compartido | **Cumple por análisis** (no lo ejercité en ejecución): `headerAction` es opcional y toda regla CSS nueva va acotada a `.cg-dialog[data-sheet][data-fixed]`, atributo que solo existe con `headerAction`; sin él el DOM es idéntico. Mutación m10 (quitar `data-fixed`) detectada |
| M8 Parte A | **Sin regresión.** Hilo (% del viewport) PR = main en 390×844 (69 %), 320×568 (51 %), 1024×768 (55 %), 1360×900 (63 %) y 900×800 (72 %); 1280×720 60 % frente a 61 % (−1 punto, ver E394-1); «Enviar» vacío idéntico (claro `rgb(71,85,80)` sobre `rgb(242,245,242)`, oscuro igual) y 0 desborde en 12 filas |
| M9 calidad | **Cumple.** axe 2.2 AA = 0 con el menú desplegado y cerrado-despliegue en todas las combinaciones; CLS ≤ 0,1 a 390 px con CPU×4 al abrir y desplegar (ES y EN); presupuestos del build FRESCO: JS inicial **135,17 kB gz** (main 135,10; límite 150) y CSS inicial **18,49 kB gz** (igual que main; límite 20) |
| M10 pruebas y mutaciones | **Cumple.** `npm test` frontend **977/977**; `tsc` 0 errores; **12/12 mutaciones detectadas** (11 por las pruebas del PR; m11 «quitar la etiqueta visible “Idioma” de Preferencias» solo la detecta mi guion, ver E394-2): despliegue sin `hidden`, «Mi progreso» duplicado, sin `aria-expanded`, sin «Cerrar» arriba, pie sin variante de peligro, ☰ sin nombre, h1→h2, «Pausar» sin ghost, barra sin `--cg-mark`, Dialog sin `data-fixed`, h1 duplicado |
| M11 resto de pantallas | **No ejecutado en navegador.** El CSS nuevo está acotado a `.chat-shell`, `.chat-menu*` y `[data-fixed]`; el único archivo compartido tocado es `Dialog` (aditivo). Lo declaro como no verificado en ejecución |

Entrada: 466/466 comprobaciones de mi guion `qa/e2e/es342b-menu-barra.cjs` sobre el PR (0 fallan); control en main: 34/34 (solo mide lo que existe allí).

**Hallazgos (ninguno bloquea)**
| ID | Sev. | Evidencia | Sugerencia |
|---|---|---|---|
| E394-1 | Bajo | A 1280×720 el hilo baja de 61 % a 60 % (la barra con ☰ de 46 px y título condensado ocupa algo más); sigue ≥ 50 % | ninguna |
| E394-2 | Bajo | La etiqueta visible «Idioma»/«Tema» del grupo Preferencias no la cubre ninguna prueba del PR (m11 sobrevive a sus 16 pruebas) | añadir una aserción a `es-342b-chat-menu.test.mjs`; mi guion `es342b-etiquetas-preferencias.cjs` ya la cubre |
| E394-3 | Observación | A ≥ 901 px el marco de persona sigue dibujando idioma y tema en su cabecera hasta el PR 1 de Dev-Claude-6: hay duplicado de idioma/tema (cabecera + menú del chat). Declarado en el PR | se resuelve con el PR 1 del marco |
| E394-4 | Observación | Con el menú desplegado, a 390×800 y 320×568 el cuerpo se desplaza (límite declarado por el diseño); cabecera y pie quedan fijos | ninguna |

**No verificado:** lector de pantalla real y teclado físico iOS/Android; Firefox y Safari; staging con sesión; M7 y M11 solo por análisis, sin navegador; la apariencia con la fuente real en dispositivos.

Evidencia: PR de QA #6, `qa/e2e/es342b-menu-barra.cjs`, `es342b-parte-a.cjs`, `es342b-mutaciones.cjs`, `es342b-etiquetas-preferencias.cjs` y `qa/evidence/ES-342-pr394-cabeza-27dbebda/`. **Puedes fusionar con CI 5/5 y CLEAN.** Cualquier cambio de head anula esta aprobación.
