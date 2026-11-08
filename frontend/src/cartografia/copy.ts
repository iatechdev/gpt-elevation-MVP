// ES-152: textos de la página interna de componentes. Fuente: docs/ux/plataforma/p-sistema.js (rama ES-148); el inglés es borrador.
// Los componentes del sistema no traen texto propio; cada pantalla pasa el suyo (ES-154 los centraliza desde textos.json).
export type CgLang = 'es' | 'en'

const es = {
  title: 'Sistema de diseño',
  intro: 'Tokens y componentes de Elevation. Todo lo que se ve en la plataforma sale de aquí. Los contrastes se calculan con los valores reales, en el tema que tengas activo.',
  skip: 'Saltar al contenido', language: 'Idioma', theme: 'Tema', themeSystem: 'Sistema', themeLight: 'Claro', themeDark: 'Oscuro',
  colour: 'Color', colourIntro: 'La marca es un azul de tinta de plano. El rojo existe solo para errores. Las curvas siena son el relieve del mapa.',
  token: 'Token', use: 'Uso', ratio: 'Contraste sobre el fondo', tokens: 'Tokens de color', ratioNA: 'No aplica',
  ground: 'Fondo de la hoja', panel: 'Paneles y tarjetas', ink: 'Texto y trazos principales', muted: 'Texto de apoyo', mark: 'Marca: enlaces, foco, pistas, selección',
  err: 'Errores y acciones destructivas', good: 'Confirmado', contour: 'Curvas de nivel del mapa', line: 'Líneas finas',
  typography: 'Tipografía', ty1: 'Rótulos y títulos: Barlow Condensed, mayúsculas', ty2: 'Nombres de capacidades y voz de la plataforma: Spectral cursiva',
  ty3: 'Texto corrido: Barlow, 17 px, interlínea 1,55', tyLicence: 'Las tres familias se sirven desde el propio dominio con licencia SIL Open Font License 1.1 (consta en el paquete). Revisión legal: no verificada.',
  buttons: 'Botones', primary: 'Primario', secondary: 'Secundario', danger: 'Destructivo', disabled: 'Deshabilitado', actionLink: 'Enlace de acción',
  buttonsNote: 'Un solo botón primario por vista. Los botones dicen lo que pasa. Altura mínima 46 px.',
  fields: 'Campos', fText: 'Texto', fTextPlaceholder: 'Escribe aquí', fTextHint: 'Una ayuda corta debajo del campo.', fError: 'Con error', fErrorMsg: 'Este campo es obligatorio.',
  fArea: 'Área de texto', fSelect: 'Selección', fOpt1: 'Primera opción', fOpt2: 'Segunda opción', fCheck: 'Casilla', fScale: 'Escala de niveles', fScaleHint: 'Se elige con las flechas.',
  pieces: 'Piezas', chips: 'Chips de estado', cDraft: 'Borrador', cDone: 'Confirmada', cNone: 'Sin evaluar', cError: 'Con error', cSample: 'Ejemplo',
  notices: 'Avisos', noteTitle: 'Aviso informativo', noteBody: 'Para decir qué pasó o qué sigue.', errorTitle: 'Aviso de error', errorBody: 'Dice qué pasó, qué se conservó y qué hacer.',
  hintLabel: 'Pista con su frase', hintBody: 'Se apoya en «reorganicé la entrega». Es una sugerencia, no una evaluación.', hintTag: 'Para pensar',
  reqs: 'Lista de requisitos', reqMet: 'Cumple', reqUnmet: 'Falta', req1: 'Al menos 12 caracteres', req2: 'Una letra mayúscula', req3: 'Un número',
  list: 'Lista de ítems', item1: 'Entrega del análisis de ventas', item1b: 'Resumen de una página con tres conclusiones.', item2: 'Reflexión sobre el proceso', item2b: 'Qué me costó y qué haría distinto.',
  table: 'Tabla (en pantallas angostas pasa a tarjetas)', tName: 'Nombre', tState: 'Estado', tWhen: 'Fecha', tRow1: 'Análisis de ventas', tRow2: 'Reflexión', tD1: '3 nov', tD2: '5 nov',
  tabs: 'Pestañas', tabsLabel: 'Secciones del ejemplo', tab1: 'Resumen', tab2: 'Detalle', tab3: 'Historial', panel1: 'Contenido de la primera pestaña.', panel2: 'Contenido de la segunda pestaña.', panel3: 'Contenido de la tercera pestaña.',
  dialog: 'Diálogo modal', dialogOpen: 'Abrir diálogo', dialogTitle: '¿Retirar este permiso?', dialogBody: 'El foco entra al abrir, queda atrapado, Escape cierra y vuelve a este botón.', dialogCancel: 'Cancelar', dialogConfirm: 'Retirar',
  figures: 'Cifras y barras', figA: 'Evidencias', figB: 'Niveles registrados', figC: 'Días con registro', barsLabel: 'Registros por día en los últimos siete días: 1, 3, 2, 5, 4, 6, 3.', barsTable: 'Los mismos datos en tabla', barsDay: 'Día', barsCount: 'Registros',
  relief: 'Relieve', reliefIntro: 'Cada línea gruesa es un nivel registrado por la persona. Lo que no tiene evidencia queda plano.', reliefLabel: 'Relieve de ejemplo con tres capacidades en nivel 2, 3 y 1', reliefLoading: 'Cargando el relieve', reliefFlat: 'Sin evidencia: relieve plano',
  a11y: 'Accesibilidad', a1: 'Foco visible en todo control: contorno de 3 px con el color de marca.', a2: 'Objetivos táctiles de 46 px o más.', a3: 'El color nunca es la única señal: siempre hay texto o forma.', a4: 'Respeta «reducir movimiento»: sin animaciones si el sistema lo pide.', a5: 'Textos en ES y EN con la misma estructura. El inglés es borrador.',
}

const en: typeof es = {
  title: 'Design system',
  intro: 'Elevation tokens and components. Everything in the platform comes from here. Contrast ratios are computed from the real values in the theme you have active.',
  skip: 'Skip to content', language: 'Language', theme: 'Theme', themeSystem: 'System', themeLight: 'Light', themeDark: 'Dark',
  colour: 'Colour', colourIntro: 'The brand is a survey-ink blue. Red exists only for errors. Sienna contours are the map relief.',
  token: 'Token', use: 'Use', ratio: 'Contrast on the ground', tokens: 'Colour tokens', ratioNA: 'Not applicable',
  ground: 'Sheet ground', panel: 'Panels and cards', ink: 'Main text and strokes', muted: 'Supporting text', mark: 'Brand: links, focus, hints, selection',
  err: 'Errors and destructive actions', good: 'Confirmed', contour: 'Map contour lines', line: 'Hairlines',
  typography: 'Typography', ty1: 'Labels and titles: Barlow Condensed, caps', ty2: 'Capability names and platform voice: Spectral italic',
  ty3: 'Body text: Barlow, 17 px, line height 1.55', tyLicence: 'The three families are served from our own domain under the SIL Open Font License 1.1 (stated in the package). Legal review: not verified.',
  buttons: 'Buttons', primary: 'Primary', secondary: 'Secondary', danger: 'Destructive', disabled: 'Disabled', actionLink: 'Action link',
  buttonsNote: 'One primary button per view. Buttons say what happens. Minimum height 46 px.',
  fields: 'Fields', fText: 'Text', fTextPlaceholder: 'Type here', fTextHint: 'A short help line below the field.', fError: 'With error', fErrorMsg: 'This field is required.',
  fArea: 'Text area', fSelect: 'Select', fOpt1: 'First option', fOpt2: 'Second option', fCheck: 'Checkbox', fScale: 'Level scale', fScaleHint: 'Choose with the arrow keys.',
  pieces: 'Pieces', chips: 'Status chips', cDraft: 'Draft', cDone: 'Confirmed', cNone: 'Not assessed', cError: 'Has an error', cSample: 'Sample',
  notices: 'Notices', noteTitle: 'Information notice', noteBody: 'To say what happened or what comes next.', errorTitle: 'Error notice', errorBody: 'Says what happened, what was kept and what to do.',
  hintLabel: 'Hint with its phrase', hintBody: 'It rests on “rearranged the delivery”. It is a suggestion, not an assessment.', hintTag: 'To think about',
  reqs: 'Requirements list', reqMet: 'Met', reqUnmet: 'Missing', req1: 'At least 12 characters', req2: 'One capital letter', req3: 'One number',
  list: 'Item list', item1: 'Sales analysis delivery', item1b: 'One-page summary with three conclusions.', item2: 'Reflection on the process', item2b: 'What was hard and what I would do differently.',
  table: 'Table (becomes cards on narrow screens)', tName: 'Name', tState: 'Status', tWhen: 'Date', tRow1: 'Sales analysis', tRow2: 'Reflection', tD1: 'Nov 3', tD2: 'Nov 5',
  tabs: 'Tabs', tabsLabel: 'Example sections', tab1: 'Summary', tab2: 'Detail', tab3: 'History', panel1: 'Content of the first tab.', panel2: 'Content of the second tab.', panel3: 'Content of the third tab.',
  dialog: 'Modal dialog', dialogOpen: 'Open dialog', dialogTitle: 'Withdraw this permission?', dialogBody: 'Focus enters on open, stays trapped, Escape closes and returns to this button.', dialogCancel: 'Cancel', dialogConfirm: 'Withdraw',
  figures: 'Figures and bars', figA: 'Evidence items', figB: 'Levels recorded', figC: 'Days with a record', barsLabel: 'Records per day over the last seven days: 1, 3, 2, 5, 4, 6, 3.', barsTable: 'The same data as a table', barsDay: 'Day', barsCount: 'Records',
  relief: 'Relief', reliefIntro: 'Each thick line is a level the person recorded. What has no evidence stays flat.', reliefLabel: 'Sample relief with three capabilities at level 2, 3 and 1', reliefLoading: 'Loading the relief', reliefFlat: 'No evidence: flat relief',
  a11y: 'Accessibility', a1: 'Visible focus on every control: 3 px outline in the brand colour.', a2: 'Touch targets of 46 px or more.', a3: 'Colour is never the only signal: there is always text or shape.', a4: 'Respects reduced motion: no animation if the system asks.', a5: 'ES and EN texts with the same structure. The English is a draft.',
}

export const cgCopy: Record<CgLang, typeof es> = { es, en }
export type CgCopy = typeof es
