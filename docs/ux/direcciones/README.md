# ES-148 · Tres direcciones de diseño (borrador sin aprobar)

*[UX-Claude] · 4-nov-2026. Siguen a [ESTUDIO-REFERENTES.md](../ESTUDIO-REFERENTES.md). Cada una es un archivo HTML independiente, con tres pantallas: portada, inicio con sesión y conversación. Se abren con doble clic (cargan tipografías de Google Fonts; sin conexión usan una fuente de respaldo).*

| | A · Subrayado | B · Cartografía | C · Taller |
|---|---|---|---|
| Idea | Edición sobre las palabras de la persona. Lo que ella escribe va numerado y en máquina de escribir; lo que propone la plataforma va al margen, como corrección. | El relieve es el nivel. Donde la persona registra un nivel con evidencia, el terreno sube; lo demás queda plano. Cada línea gruesa es un nivel. | Cada capacidad es una ficha de trabajo con su frase de respaldo y su sello. Sin sello de la persona no se guarda nada. |
| Estructura de las pantallas con sesión | Lista numerada de frases + índice de capacidades al margen (sin tarjetas ni panel). | Mapa a pantalla casi completa con lugares seleccionables + libreta de campo al lado. | Banco de trabajo en dos columnas (esperan tu sello / selladas) + calibre de herramientas. |
| Color | Un azul de bolígrafo sobre blanco frío. El rojo solo tacha. | Hoja de mapa gris verdosa, curvas siena y una marca bermellón. | Azul de overol, negro, naranja de seguridad solo para lo que espera decisión. |
| Tipografía | Schibsted Grotesk (voz de la plataforma) + IBM Plex Mono (voz de la persona). | Barlow Condensed (rótulos) + Spectral cursiva (nombres de lugar) + Barlow. | Archivo con eje de ancho (extendida para titulares, condensada para etiquetas) + DM Mono. |
| Qué la distingue del mercado | Nadie escribe «sobre» lo que dijo la persona. | El nivel se ve como altura, sin lila ni pastel. | Marca audaz y táctil frente al lila de Selia y RumboCV. |
| Riesgo | Austera: depende de la voz y del texto. | Hay que cuidar que el relieve no parezca una puntuación o certificación. | La estética de sellos puede sonar a burocracia si se exagera. |

## Qué comparten

- Voz de Colombia (tuteo), sin lenguaje clínico ni promesas.
- «Una sugerencia, no una evaluación». «Tú decides qué guardar». «Tu nivel es el que tú registras». Sin «Validado» (H-41).
- Las 8 capacidades reales del catálogo de staging. Los ejemplos están marcados como ejemplo.
- Marcadores de fotografía real por encargar: no se genera con IA.
- Tema claro y oscuro, teclado y diseño móvil.

## Qué se verificó

- Carga y desplazamiento horizontal en 1360 y 390 px de ancho: 0 px de desborde en las tres.
- axe-core (WCAG 2 A/AA), nivel grave y crítico, en claro y oscuro: 0 hallazgos en las tres.
- Revisé las capturas de escritorio y móvil a ojo.

## No verificado

- Navegadores distintos de Chromium; lectores de pantalla reales.
- Rendimiento y carga de tipografías con conexión lenta.
- Los textos no pasaron por un redactor humano ni por un manual de voz: son una primera versión.
- No hay prueba con personas del piloto.
