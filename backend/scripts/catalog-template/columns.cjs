// ES-410 · Hojas y columnas de la plantilla del catálogo de rutas. Cada columna apunta a UN campo que el servidor valida (utils/routeCatalog.js).
// No define reglas propias: los valores permitidos y los límites que aquí se explican se comprueban llamando al validador REAL del servidor.
// `path`: campo del elemento (p. ej. 'labels.es', 'review.by'). `kind`: cómo se lee la celda. `help`: lo que ve quien llena.

const c = (path, es, en, help, extra = {}) => ({ path, es, en, help, kind: 'text', ...extra });
const list = (path, es, en, help, extra = {}) => c(path, es, en, help, { ...extra, kind: 'list' });
const date = (path, es, en, help, extra = {}) => c(path, es, en, help, { ...extra, kind: 'date' });
const yesno = (path, es, en, help, extra = {}) => c(path, es, en, help, { ...extra, kind: 'yesno', options: ['SI', 'NO'] });
const pick = (path, es, en, options, help, extra = {}) => c(path, es, en, help, { ...extra, options });
const num = (path, es, en, help, extra = {}) => c(path, es, en, help, { ...extra, kind: 'number' });

const KEY_HELP = 'Nombre corto que TÚ inventas para esta fila: minúsculas, números y _ ; empieza con letra; 3 a 48 caracteres; sin tildes ni espacios. No lo cambies después.';
const key = (es, en, extra = {}) => c('$key', es, en, KEY_HELP, { required: true, ...extra });
const text = (max) => `Texto de 1 a ${max} caracteres.`;
const noPercent = ' No se admiten porcentajes (70 %) ni frases como «sin futuro» o «será reemplazado por la IA».';
const pair = (base, es, en, max, extra = {}) => ['es', 'en'].map((lang) => c(`${base}.${lang}`, `${es} (${lang === 'es' ? 'español' : 'inglés'})`, `${en} (${lang === 'es' ? 'Spanish' : 'English'})`, text(max) + noPercent, extra));
const URL_HELP = 'Dirección completa que empieza por https:// (máximo 500 caracteres). El sistema NO la abre ni la comprueba: la persona que la anota debe haberla visto.';
const DATE_HELP = 'Fecha AAAA-MM-DD (por ejemplo 2026-11-27). No puede ser futura. Escribe solo fechas de consultas o revisiones que una persona haya hecho de verdad.';
const COUNTRY_HELP = 'Código de país de dos letras MAYÚSCULAS (CO, DK, ES…).';
const LANG_HELP = 'Código de idioma de dos letras minúsculas (es, en, da…).';
const MODALITY = ['onsite', 'hybrid', 'remote', 'unknown'];
const MODALITY_HELP = 'onsite = presencial, hybrid = híbrida, remote = remota, unknown = por confirmar.';
const WHO = 'Nombre de la persona que lo hizo (1 a 120 caracteres). No se muestra a participantes.';
const REF_ROLE = 'Escribe la «clave» exactamente como está en la hoja «Rutas».';

const SHEETS = [
  {
    name: 'Contextos', kind: 'contexts', title: 'Contextos del piloto (máximo 6). Cada ruta pertenece al menos a uno.',
    columns: [
      key('Clave del contexto', 'Context key'),
      ...pair('labels', 'Nombre del contexto', 'Context name', 80, { required: true }),
      ...pair('note', 'Nota (opcional)', 'Note (optional)', 300),
    ],
  },
  {
    name: 'Fuentes', kind: 'sources', title: 'Fuentes que alguien consultó. Cada ruta necesita al menos una.',
    columns: [
      key('Clave de la fuente', 'Source key'),
      pick('type', 'Tipo de fuente', 'Source type', ['official', 'institutional', 'market_report', 'offer_page', 'course_provider', 'other'], 'official = oficial; institutional = institucional; market_report = informe de mercado; offer_page = página de oferta; course_provider = proveedor de cursos; other = otra.', { required: true }),
      c('title', 'Título original', 'Original title', text(200), { required: true }),
      c('url', 'Dirección web (URL)', 'Web address (URL)', URL_HELP, { required: true, kind: 'url' }),
      c('country', 'País de la fuente', 'Source country', `${COUNTRY_HELP} Si la fuente no es de un país, escribe NO APLICA.`, { required: true, kind: 'countryOrNa' }),
      c('language', 'Idioma de la fuente', 'Source language', LANG_HELP, { required: true }),
      date('publishedAt', 'Fecha de publicación (opcional)', 'Publication date (optional)', DATE_HELP),
      date('consultedAt', 'Fecha en que se consultó', 'Date consulted', `${DATE_HELP} Una consulta de más de 180 días se muestra como «desactualizada».`, { required: true }),
      c('consultedBy', 'Quién la consultó', 'Consulted by', WHO, { required: true }),
      yesno('accessible', '¿La página abre hoy?', 'Does the page open today?', 'SI o NO. Con NO se muestra como «desactualizada».', { required: true }),
    ],
  },
  {
    name: 'Rutas', kind: 'roles', title: 'Rutas (roles). Una fila por rol y por país. Sus tareas, barreras y capacidades van en las hojas siguientes.',
    columns: [
      key('Clave de la ruta', 'Route key'),
      ...pair('labels', 'Nombre del rol', 'Role name', 100, { required: true }),
      ...pair('industry', 'Industria', 'Industry', 100, { required: true }),
      c('market', 'Mercado (país)', 'Market (country)', `${COUNTRY_HELP} Colombia y Dinamarca van en filas separadas.`, { required: true }),
      list('languagesRequired', 'Idiomas exigidos', 'Required languages', 'Códigos separados por ; (ejemplo: es; en). Usa unknown si no lo sabes. De 1 a 4.', { required: true }),
      list('modality', 'Modalidades', 'Work arrangements', `Separadas por ; (de 1 a 4). ${MODALITY_HELP}`, { required: true }),
      list('contexts', 'Contextos a los que pertenece', 'Contexts', 'Claves de la hoja «Contextos», separadas por ; (de 1 a 6).', { required: true }),
      list('sourceKeys', 'Fuentes de esta ruta', 'Sources for this route', 'Claves de la hoja «Fuentes», separadas por ; (de 1 a 12).', { required: true }),
      c('review.by', 'Revisión de dominio: quién', 'Domain review: by', WHO, { required: true }),
      date('review.at', 'Revisión de dominio: fecha', 'Domain review: date', DATE_HELP, { required: true }),
      yesno('regulated.isRegulated', '¿Es una profesión regulada?', 'Is it a regulated profession?', 'SI o NO.', { required: true }),
      ...pair('regulated.note', 'Si es regulada: qué habilitación falta comprobar', 'If regulated: licensing note', 300, { requiredWhen: 'regulated.isRegulated' }),
      c('regulated.sourceKey', 'Si es regulada: clave de la fuente (opcional)', 'If regulated: source key (optional)', 'Clave de la hoja «Fuentes».'),
    ],
  },
  {
    name: 'Tareas', kind: 'tasks', title: 'Tareas habituales de cada ruta (de 1 a 12 por ruta).',
    columns: [
      c('$parent', 'Clave de la ruta', 'Route key', REF_ROLE, { required: true }),
      ...pair('text', 'Tarea', 'Task', 200, { required: true }),
      pick('aiExposure.status', 'Exposición a la IA: en qué se basa', 'AI exposure: basis', ['sourced', 'hypothesis', 'unknown'], 'sourced = lo dice una fuente (pon su clave); hypothesis = es una hipótesis del equipo; unknown = no se sabe.', { required: true }),
      c('aiExposure.sourceKey', 'Fuente de esa afirmación', 'Source for that statement', 'Obligatoria si elegiste «sourced». Clave de la hoja «Fuentes».', { requiredWhen: 'sourced' }),
      ...pair('aiExposure.note', 'Nota sobre la IA (opcional)', 'AI note (optional)', 300),
    ],
  },
  {
    name: 'Barreras', kind: 'barriers', title: 'Barreras de entrada (de 0 a 8 por ruta). Si una ruta no tiene, no escribas filas.',
    columns: [
      c('$parent', 'Clave de la ruta', 'Route key', REF_ROLE, { required: true }),
      ...pair('$self', 'Barrera', 'Barrier', 200, { required: true }),
    ],
  },
  {
    name: 'Capacidades', kind: 'capabilities', title: 'Capacidades que pide cada ruta (de 0 a 12 por ruta).',
    columns: [
      c('$parent', 'Clave de la ruta', 'Route key', REF_ROLE, { required: true }),
      c('skillKey', 'Clave de la capacidad', 'Skill key', 'Debe ser una clave del catálogo de habilidades PUBLICADO (míralo en Administración → catálogo de habilidades). Si no coincide, la persona la verá como «capacidad por confirmar».', { required: true }),
      pick('importance', 'Importancia', 'Importance', ['essential', 'optional'], 'essential = esencial; optional = opcional.', { required: true }),
    ],
  },
  {
    name: 'Ofertas', kind: 'offers', title: 'Ofertas verificadas a mano (opcional; máximo 10 por ruta y 60 en total). No copies bases de vacantes.',
    columns: [
      key('Clave de la oferta', 'Vacancy key'),
      c('title', 'Título original', 'Original title', text(200), { required: true }),
      c('organization', 'Organización', 'Organization', text(200), { required: true }),
      c('roleKey', 'Clave de la ruta', 'Route key', REF_ROLE, { required: true }),
      c('url', 'Dirección de la página oficial', 'Official page address', URL_HELP, { required: true, kind: 'url' }),
      c('market', 'Mercado (país)', 'Market (country)', COUNTRY_HELP, { required: true }),
      c('language', 'Idioma de la oferta', 'Vacancy language', LANG_HELP, { required: true }),
      pick('modality', 'Modalidad', 'Work arrangement', MODALITY, MODALITY_HELP, { required: true }),
      date('postedAt', 'Fecha de publicación (opcional)', 'Posting date (optional)', DATE_HELP),
      date('checkedAt', 'Fecha en que se comprobó la página', 'Date the page was checked', DATE_HELP, { required: true }),
      yesno('salary.published', '¿La oferta publica salario?', 'Is a salary published?', 'SI o NO. Con NO se muestra «no publicado»; no estimes nada.', { required: true }),
      c('salary.text', 'Salario tal como aparece', 'Salary as published', `${text(100)} Obligatorio si pusiste SI.`, { requiredWhen: 'salary.published' }),
      c('verification.by', 'Verificada por', 'Verified by', WHO, { required: true }),
      date('verification.at', 'Fecha de la verificación', 'Verification date', `${DATE_HELP} Solo se muestra como vigente durante 14 días.`, { required: true }),
      c('extract', 'Extracto (opcional)', 'Excerpt (optional)', text(300)),
    ],
  },
  {
    name: 'Recursos', kind: 'resources', title: 'Cursos y lecturas (opcional). Cada uno cubre una capacidad concreta.',
    columns: [
      key('Clave del recurso', 'Resource key'),
      pick('kind', 'Tipo', 'Type', ['course', 'reading'], 'course = curso; reading = lectura.', { required: true }),
      c('title', 'Título original', 'Original title', text(200), { required: true }),
      c('url', 'Dirección web (URL)', 'Web address (URL)', URL_HELP, { required: true, kind: 'url' }),
      c('provider', 'Proveedor', 'Provider', text(120), { required: true }),
      ...pair('purpose', 'Para qué sirve', 'Purpose', 300, { required: true }),
      c('language', 'Idioma del recurso', 'Resource language', LANG_HELP, { required: true }),
      pick('level', 'Nivel', 'Level', ['introductory', 'intermediate', 'advanced'], 'introductory = inicial; intermediate = intermedio; advanced = avanzado.', { required: true }),
      num('duration.minutes', 'Duración en minutos', 'Duration in minutes', 'Número entero. Llena esta o la siguiente (o las dos).'),
      c('duration.text', 'Duración tal como la publica', 'Duration as published', `${text(100)} Llena esta o la anterior.`),
      yesno('price.published', '¿Publica precio?', 'Is a price published?', 'SI o NO. Con NO se muestra «por confirmar».', { required: true }),
      num('price.amount', 'Importe', 'Amount', 'Solo número, sin puntos de miles. 0 si es gratis. Obligatorio si pusiste SI.', { requiredWhen: 'price.published' }),
      c('price.currency', 'Moneda', 'Currency', 'Tres letras MAYÚSCULAS (COP, DKK, USD). Obligatoria si pusiste SI.', { requiredWhen: 'price.published' }),
      c('linkedSkillKey', 'Capacidad que cubre', 'Linked skill', 'Clave del catálogo de habilidades publicado.', { required: true }),
      ...pair('exercise', 'Ejercicio que mostrará lo aprendido', 'Exercise showing learning', 300, { required: true }),
      list('roleKeys', 'Rutas donde se ofrece', 'Routes where it is offered', 'Claves de la hoja «Rutas», separadas por ; (de 1 a 12). OBLIGATORIO: un recurso sin ruta provoca hoy un error al calcular las rutas.', { required: true }),
      c('sourceKey', 'Fuente del recurso (opcional)', 'Resource source (optional)', 'Clave de la hoja «Fuentes».'),
    ],
  },
];

// Encabezado visible de una columna: es lo que el lector usa para reconocerla (resiste que se reordenen columnas).
const header = (col) => `${col.es} / ${col.en}`;

module.exports = { SHEETS, header };
