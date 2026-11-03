# Propuesta de diseño · Elevation + Skill Map (ES-148)

UX-Claude · 3-nov-2026 · **Estado: PROPUESTA — pasa por la puerta de diseño.** Nadie implementa nada hasta que **Mauricio o Alejo** la aprueben por escrito en el ticket. Evidencia de partida: [INFORME-AUDITORIA-UX.md](INFORME-AUDITORIA-UX.md) (hallazgos H-nn).
Maqueta navegable (ES/EN, claro/oscuro, escritorio/móvil, teclado): [maquetas/index.html](maquetas/index.html) · imágenes en `maquetas/img/`.

## 1. Principios

1. **Un espacio, una voz.** Una sola identidad visual, una cabecera, un selector de idioma, un botón principal (H-01).
2. **Una cosa por pantalla.** Cada pantalla tiene una acción principal; lo demás es secundario. Menos texto antes de actuar (H-06, H-14).
3. **Calma antes que métricas.** Lo emocional (cómo llegas hoy) va antes que lo profesional; sin barras de progreso, rachas ni urgencia.
4. **Nunca mostrar vacío cuando es error.** Cada tarjeta resuelve cuatro estados: cargando, vacío, error, éxito (H-02, H-03).
5. **Si no está listo, no se ofrece.** Nada de callejones sin salida ni jerga de desarrollo en pantalla (H-04).
6. **Honestidad del dato.** «Sin evaluar» es un estado, no un déficit; un nivel solo con evidencia (null si falta); sin porcentajes, comparaciones ni promesas de resultados o empleabilidad.
7. **Privacidad visible.** Candado y texto «privado / solo tú» donde corresponde; lo que se comparte se ve antes de compartir.
8. **Accesible y bilingüe de origen.** Teclado completo, foco visible, objetivo táctil ≥44 px, contraste AA, `h1` único; toda cadena en ES y EN con el mismo largo de diseño.
9. **Lenguaje no clínico.** Tuteo, frases cortas, sin «paciente», «terapéutico» ni «insight» (H-12).

## 2. Qué cambia frente a lo actual (resumen)

| Hoy | Propuesta |
|---|---|
| 4 identidades visuales, 5 cabeceras, 5 selectores ES/EN | 1 sistema: navegación lateral (escritorio) / barra inferior de 4 destinos (móvil); un selector ES/EN fijo |
| Panel abre con «Zona profesional / Mapa» y el asistente al final en móvil | Panel abre con «¿Cómo llegas hoy?»; mapa y uso de IA en tarjetas secundarias |
| Errores: invisible (panel) o texto suelto (diario) | Componente de alerta único con «Reintentar» y `role="alert"` |
| «Aún no disponible» sin salida | Se oculta del menú o se presenta como «Próximamente» con acción alternativa |
| Serif Playfair en muchos títulos + mono en etiquetas + Inter | Inter en todo; serif solo en el titular de página (opcional); mono solo en etiquetas de 12 px |
| Verde, dorado y negro como botón principal | Un único primario: tinta (`--elv-action`) |
| «Mis pacientes», «insight», «flujo de autorización integrado» | Glosario §5 |

## 3. Sistema visual (reutiliza tokens existentes)

**Regla de oro: no se agregan colores nuevos.** Todo sale de `frontend/src/styles/tokens.css` (ES-37) y de la landing (`docs/landing/DISENO-FASE1.md`). Lo único *nuevo* está marcado.

| Rol | Token existente | Uso |
|---|---|---|
| Fondo / superficie / tarjeta | `--elv-bg` `#FAFAF9` / `--elv-surface` `#F2F1EF` / `--elv-card` `#FFF` | |
| Texto | `--elv-text-1` `#1A1A18`, `--elv-text-2` `#6B6B67` (≥4,5:1) | Quitar el uso de grises más claros (H-10) |
| Acción primaria | `--elv-action` (tinta) | Un solo botón principal por pantalla |
| Marca | `--elv-brand` ocre `#B8963E` | **Solo decorativo** (subrayado, punto del logo, indicador activo). Texto ocre → `--elv-link` `#7D6218` |
| Voz de la IA | `--elv-ai` / `--elv-ai-bg` | Únicamente la burbuja del asistente |
| Estados | `--elv-error`, `--elv-success`, `--elv-info`, `--elv-warning` (+ `-bg`) | Alertas; nunca solo color (icono + texto) |
| Foco | `--elv-focus` `#2F6B8F` | Anillo 3 px con desfase 3 px (no recortado, H-08) |
| Espacio / radios / sombra | `--elv-s-*`, `--elv-r-*`, `--elv-shadow-card` | Base 4 px |
| Tipografía | Inter 400/600/800; escala `--elv-fs-*` | **Nuevo:** unificar tamaños (base 16 px, etiquetas 12 px mínimo); el titular serif se limita a la `h1` (decisión del PO) |
| Modo oscuro | Paleta oscura de la landing (`#151513`/`#F3F1EA`) extendida a la app | **Nuevo en app**; ya existe en landing. La maqueta lo incluye y pasa axe |

### Componentes (nombre → qué resuelve)

| Componente | Estados | Resuelve |
|---|---|---|
| `AppShell` (lateral / barra inferior) | activo, foco, móvil | H-01, H-07, H-21 |
| `LangSwitch` (único) | activo, foco | H-01, H-22 |
| `Button` primario / secundario / discreto | normal, foco, desactivado, cargando | H-20, H-18 |
| `Card` con `eyebrow` + `h2` | cargando, vacío, error, éxito | H-02 |
| `Alert` (info / error / éxito) | `role=alert` / `status`, con acción | H-02, H-03 |
| `EmptyState` (texto + 1 acción) | — | H-04, H-13 |
| `Skeleton` | `prefers-reduced-motion` respetado | cargando |
| `Meter` (uso de IA) | texto equivalente | transparencia ya existente |
| `MoodPicker` (5 opciones con etiqueta) | seleccionado | H-23 |
| `CapabilityRow` (4 casillas + estado) | sin evaluar / con evidencia | H-13, ES-114 |
| `Stepper` (onboarding 3 pasos) | actual, hecho | H-06 |

## 4. Flujos rediseñados

### 4.1 Primer ingreso (persona) — H-06
Hoy: Login → onboarding de 1 pantalla (PDF + 3 intenciones + 4 selectores + contexto + 3 botones) → panel.
Propuesta (3 pasos, cada uno se puede saltar y se guarda al avanzar, sin botón «Guardar» aparte):
1. **Idioma y zona** (se sugieren; «Por confirmar» pasa a «Elegir» con valor por defecto detectado).
2. **¿Por dónde quieres empezar?** (Mi espacio / Mi siguiente paso) — una pregunta.
3. **Hoja de vida (opcional)**: subir PDF o «Prefiero hacerlo a mano», con el texto de privacidad visible antes de elegir archivo.
Resultado: llega al panel «¿Cómo llegas hoy?». *Cambia:* de ~12 controles a ≤4 por paso.

### 4.2 Día a día
Inicio («¿Cómo llegas hoy?» → asistente) · Conversación · Mi mapa · Evidencias · Más (diario, siguiente paso, mi terapeuta/Puente, mis datos, cerrar sesión). Barra inferior de 4 destinos en móvil; «Más» agrupa lo secundario, y «Cerrar sesión» deja de competir con el idioma en la cabecera.

### 4.3 Errores y recuperación
Patrón único: *qué pasó* (humano) + *tus datos están a salvo* (si es cierto) + *una acción* («Reintentar»). Aplica a: carga de tarjeta, mensaje del chat sin confirmar (ya existe en ES-147; se unifica el estilo) y cuota de IA agotada («se renueva el …», ya bien resuelto).

### 4.4 Mapa y evidencia — H-13, H-14 y **ES-114**
Un solo estado vacío con un solo paso siguiente («Añadir mi primera evidencia»). La lista de capacidades muestra las 4 casillas y una etiqueta de estado. Para la decisión del PO de **ES-114** la maqueta es válida con cualquiera de las dos variantes (la decisión no está tomada; **esta propuesta no la toma**):
- **Variante A (solo estados y fuente):** la fila muestra «Sin evaluar» / «Validado», fuente («Identificado en conversación» / «Evidencia aportada») y evidencia; se retiran las casillas de nivel.
- **Variante B (estados + nivel con evidencia):** como arriba; con evidencia añade «Nivel N» y sus fuentes; sin evidencia, nada (null).
En ambas: sin porcentajes, sin comparación con otras personas, sin «déficit», sin promesa de empleabilidad.

### 4.5 Pantallas «próximamente» — H-04
Regla: si la función no está lista **no hay enlace**. Si se quiere anunciar: tarjeta «Próximamente» + una acción útil («Mientras tanto: Mis evidencias») y sin fechas inventadas. Aplica a Ejercicios, Siguiente paso y «Al Puente» desde el diario mientras no estén listos.

### 4.6 Terapeuta y administración
Mismo `AppShell` y componentes, con acento de rol (etiqueta «Profesional» / «Administración»), no paleta distinta. Lista de usuarios: **búsqueda, filtros y paginación** (H-11), selectores con nombre accesible. «Personas acompañadas» en vez de «pacientes» (H-12, decisión del PO).

## 5. Glosario de lenguaje (ES / EN) — propuesta para validar con el PO

| Hoy | Propuesta ES | Propuesta EN |
|---|---|---|
| Mis pacientes | Personas que acompaño | People I support |
| Historia del paciente | Contexto compartido | Shared context |
| Mi prompt terapéutico | Mi guía para la IA | My guidance for the AI |
| Insight | Idea | Idea |
| Zona de autorización explícita | Tú decides qué se comparte | You decide what is shared |
| Nuevo contexto directo | Añadir algo a mano | Add something by hand |
| Rechazar este campo | Quitar | Remove |
| Consola de facilitación | (no se muestra a personas) | (not shown to people) |
| Por confirmar | Elegir | Choose |
| El Puente estará disponible cuando su flujo de autorización esté integrado | (se retira; ver §4.5) | (removed) |

Sin diagnóstico, sin prescripción y sin promesas: toda cadena nueva pasa por QA con la guía Brújula.

## 6. Pantallas clave en la maqueta

| Pantalla | Qué demuestra | Imagen (ES, escritorio) | Imagen (EN, móvil) |
|---|---|---|---|
| Inicio | «¿Cómo llegas hoy?» primero; mapa y uso de IA secundarios; aviso no clínico | `maquetas/img/home-es-escritorio.png` | `maquetas/img/home-en-movil.png` |
| Conversación | Burbuja de IA, error recuperable, barra de uso | `chat-es-escritorio.png` | `chat-en-movil.png` |
| Mi mapa | Vacío con una acción; filas «Sin evaluar»; sin números | `map-es-escritorio.png` | `map-en-movil.png` |
| Evidencias | Vacío y éxito | `evidence-es-escritorio.png` | `evidence-en-movil.png` |
| Estados | Cargando / vacío / error / éxito | `states-es-escritorio.png` | `states-en-movil.png` |

Todas las pantallas se verifican automáticamente (`e2e/tests/maquetas.spec.ts`): sin violaciones axe graves/críticas en ES y EN, claro y oscuro, escritorio y móvil, y primer Tab con foco visible.

## 7. Responsive y teclado

- Puntos de quiebre: móvil <700 px (barra inferior, una columna), escritorio ≥700 px (lateral 15 rem + contenido). Sin desborde horizontal; objetivo táctil ≥44 px.
- Teclado: enlace «Saltar al contenido», orden de tabulación = orden visual, pestañas con flechas, foco visible 3 px, `h1` único, regiones con nombre, `role=alert/status` en estados.
- Movimiento: `prefers-reduced-motion` desactiva el brillo del esqueleto. Sin animaciones obligatorias.
- ES/EN: el cambio de idioma es inmediato, no recarga, no pierde lo escrito y actualiza `lang`; ninguna cadena en la maqueta depende de un ancho fijo.

## 8. Plan de adopción (para decidir; no se implementa sin aprobación)

| Fase | Alcance | Riesgo | Depende de |
|---|---|---|---|
| 0 | Correcciones exentas de puerta de diseño: contraste de grises, `h1` faltantes, `select-name`, nombres accesibles de iconos | Bajo | Mauricio (QA revisa) |
| 1 | `AppShell`, `LangSwitch`, `Alert`, `EmptyState`, `Button` (componentes) sobre tokens existentes | Medio (toca todas las pantallas) | Aprobación del diseño |
| 2 | Panel, chat, mapa, evidencias con los 4 estados | Medio | Fase 1 + decisión ES-114 |
| 3 | Onboarding en 3 pasos, ocultar «próximamente» | Medio | Aprobación |
| 4 | Terapeuta y administración (paginación) | Medio | Fase 1 |

Cada fase = un ticket = una rama = un PR, con QA entre fases. No estimo horas: no tengo base de velocidad del equipo (no verificado).

## 9. Decisiones que necesito de Mauricio / Alejo

1. ¿Se aprueba el principio «un sistema, una cabecera» y los componentes de §3 como base de las fases 1–4?
2. **ES-114:** A o B (§4.4). La maqueta soporta ambas.
3. ¿Se retira la serif de los titulares (solo Inter) o se conserva solo en la `h1`?
4. ¿Se aprueba el glosario de §5 (en especial «paciente»)? Es decisión de producto.
5. ¿La landing del piloto se reduce y se quitan las etiquetas «(sintético)»? (H-15)
6. ¿Se activa el modo oscuro en la app (ya existe en landing)?
7. ¿Se autoriza un gasto limitado de IA (3–5 llamadas) para auditar respuestas del asistente?

## 10. Límites de esta propuesta (no verificado)

- Las maquetas son HTML estático con **texto propuesto**: no usan componentes reales del repo ni datos de staging; el aspecto final puede variar con daisyUI/Tailwind.
- No se probó con personas reales ni con lector de pantalla; solo axe y revisión por teclado automática.
- Contrastes de modo oscuro de la maqueta medidos por axe; los valores `--ai`/`--success` del oscuro son *nuevos* y deben validarse con la herramienta de contraste del equipo.
- No se diseñaron las salas de videollamada, el detalle de personas del terapeuta con datos compartidos ni los catálogos de administración (sin datos para auditarlos).
