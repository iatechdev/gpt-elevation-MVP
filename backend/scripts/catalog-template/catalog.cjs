// ES-410 · Construye la plantilla del catálogo de rutas y valida un archivo lleno con las funciones REALES del servidor
// (normalizeItem, missingFor, crossRefs y la política de utils/routeCatalog.js). NO usa base de datos ni red y no escribe nada:
// el módulo de base de datos se sustituye por uno vacío ANTES de cargar el servidor, así que es imposible que toque una base.
const databasePath = require.resolve('../../database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { sequelize: { define: () => ({}) } } };
const server = require('../../utils/routeCatalog');
const policy = require('../../config/routeCatalogPolicy.json');
const { SHEETS, header } = require('./columns.cjs');
const { writeWorkbook, readWorkbook } = require('./xlsx.cjs');

const CHILDREN = { tasks: 'tasks', barriers: 'barriers', capabilities: 'capabilities' };
const INSTRUCTIONS = [
  ['Plantilla del catálogo de rutas / Route catalog template'],
  ['Cómo llenarla: una fila por elemento, en cada hoja, a partir de la fila 4. No cambies los nombres de las hojas ni los encabezados (fila 2). La fila 3 explica cada columna.'],
  ['How to fill it in: one row per item, starting at row 4. Do not rename sheets or headers (row 2). Row 3 explains each column.'],
  ['Orden sugerido: 1) Contextos  2) Fuentes  3) Rutas  4) Tareas, Barreras y Capacidades de cada ruta  5) Ofertas y Recursos (opcionales).'],
  ['Mínimo para publicar: 1 contexto y 1 ruta completa (con su fuente, al menos una tarea y la revisión de dominio).'],
  ['Regla de oro: no inventes nada. Si no lo sabes, usa «unknown» donde se permita o deja el elemento fuera. Cada fuente lleva quién la consultó y cuándo.'],
  ['Golden rule: do not make anything up. If you do not know, use “unknown” where allowed or leave the item out. Every source records who consulted it and when.'],
  ['No escribas datos de personas participantes. No uses porcentajes ni frases como «sin futuro» o «será reemplazado por la IA» en nombres, descripciones o notas.'],
  ['Fechas: AAAA-MM-DD. Listas en una celda: separa con ; . Sí/No: escribe SI o NO.'],
  ['Cuando termines, envía el archivo a quien lo revisa: se comprueba con el validador antes de cargarlo en Administración.'],
];

function buildWorkbook(data = {}, { note } = {}) {
  const sheets = [{ name: 'Instrucciones', rows: [...(note ? [[note]] : []), ...INSTRUCTIONS], styles: note ? [3, 3] : [3], widths: [140] }];
  for (const sheet of SHEETS) {
    const rows = [
      [sheet.title], sheet.columns.map(header),
      sheet.columns.map((col) => `${col.required ? 'Obligatorio. ' : col.requiredWhen ? 'Obligatorio en algunos casos. ' : ''}${col.help}`),
      ...(data[sheet.name] || []).map((record) => sheet.columns.map((col) => record[col.path] ?? '')),
    ];
    sheets.push({
      name: sheet.name, rows, styles: [3, 1, 2], freeze: 3, widths: sheet.columns.map(() => 28),
      validations: sheet.columns.map((col, i) => (col.options ? { col: i, from: 4, options: col.options } : null)).filter(Boolean),
    });
  }
  return writeWorkbook(sheets);
}

const setPath = (target, path, value) => {
  const parts = path.split('.'); let node = target;
  for (const part of parts.slice(0, -1)) node = (node[part] ||= {});
  node[parts.at(-1)] = value;
  return target;
};

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
function readCell(col, raw) {
  const fail = (message) => ({ error: message });
  switch (col.kind) {
    case 'list': return { value: raw.split(/[;,\n]/).map((v) => v.trim()).filter(Boolean) };
    case 'date': {
      // Excel puede guardar una fecha como número de serie.
      if (/^[3-7]\d{4}(\.0+)?$/.test(raw)) return { value: new Date(EXCEL_EPOCH + Number(raw) * 86400000).toISOString().slice(0, 10) };
      return { value: raw };
    }
    case 'yesno': {
      const v = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
      if (['SI', 'YES', 'TRUE', 'VERDADERO'].includes(v)) return { value: true };
      if (['NO', 'FALSE', 'FALSO'].includes(v)) return { value: false };
      return fail('Escribe SI o NO.');
    }
    case 'number': {
      if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) return fail('Escribe el número sin puntos ni comas de miles (por ejemplo 1500000).');
      if (!/^\d+([.,]\d+)?$/.test(raw)) return fail('Escribe solo el número, sin símbolos ni letras.');
      return { value: Number(raw.replace(',', '.')) };
    }
    case 'countryOrNa': return { value: /^no aplica$/i.test(raw) ? null : raw };
    default: return { value: raw };
  }
}

// Filas de datos de una hoja: [{ row, values: Map(path → { col, value }) }]
function readSheet(workbook, sheet, add) {
  const rows = workbook.get(sheet.name);
  if (!rows) { add('error', sheet.name, null, null, 'Falta esta hoja. Usa la plantilla sin cambiar el nombre de las hojas.'); return []; }
  const wanted = sheet.columns.map(header);
  const headerIndex = rows.findIndex((r) => r.cells.includes(wanted[0]) && r.cells.includes(wanted[1]));
  if (headerIndex < 0) { add('error', sheet.name, null, null, 'No se encontró la fila de encabezados. No la cambies ni la borres.'); return []; }
  const cells = rows[headerIndex].cells;
  const at = wanted.map((name) => cells.indexOf(name));
  at.forEach((index, i) => { if (index < 0) add('error', sheet.name, null, sheet.columns[i].es, 'Falta esta columna.'); });
  cells.forEach((name, i) => { if (name && !wanted.includes(name) && rows.slice(headerIndex + 1).some((r) => r.cells[i])) add('error', sheet.name, null, name, 'Columna desconocida con datos: el sistema no la guarda. Quítala o pasa el dato a una columna de la plantilla.'); });
  const helpCell = (col) => `${col.required ? 'Obligatorio. ' : col.requiredWhen ? 'Obligatorio en algunos casos. ' : ''}${col.help}`;
  const out = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (sheet.columns.some((col, i) => row.cells[at[i]] === helpCell(col))) continue; // fila de ayuda
    const values = new Map();
    sheet.columns.forEach((col, i) => {
      const raw = at[i] < 0 ? '' : row.cells[at[i]] || '';
      if (!raw) return;
      const parsed = readCell(col, raw);
      if (parsed.error) add('error', sheet.name, row.number, col.es, parsed.error);
      else values.set(col.path, { col, value: parsed.value });
    });
    if (values.size) out.push({ row: row.number, values });
  }
  return out;
}

const tryNormalize = (kind, item) => { try { return { ok: server.normalizeItem(kind, item) }; } catch (error) { if (error instanceof server.CatalogError) return { error }; throw error; } };
const reason = (error, col) => (error.code === 'forbidden_label'
  ? 'Texto no permitido en el catálogo: porcentajes en descripciones o frases del tipo «sin futuro» / «será reemplazado por la IA».'
  : `El servidor rechaza este valor. Qué se espera: ${col.help}`);

// Prueba UN campo con el validador real, acompañado de los hermanos mínimos que el servidor exige para aceptarlo.
function probe(kind, path, value) {
  if (kind === 'tasks') {
    const task = setPath(path.startsWith('aiExposure.') && path !== 'aiExposure.status' ? { aiExposure: { status: 'unknown' } } : {}, path, value);
    return tryNormalize('roles', { tasks: [task] });
  }
  if (kind === 'barriers') return tryNormalize('roles', { barriers: [setPath({}, path.replace('$self.', ''), value)] });
  if (kind === 'capabilities') return tryNormalize('roles', { capabilities: [{ skillKey: 'clave_valida', importance: 'optional', [path]: value }] });
  const base = {};
  if (path === 'salary.text') base.salary = { published: true };
  if (path === 'price.amount' || path === 'price.currency') base.price = { published: true };
  return tryNormalize(kind, setPath(base, path, value));
}

const MISSING_LABEL = {
  labels: 'el nombre en español y en inglés', industry: 'la industria en español y en inglés', note: 'la nota', purpose: 'el propósito en español y en inglés',
  exercise: 'el ejercicio en español y en inglés', review: 'quién hizo la revisión de dominio y su fecha', verification: 'quién verificó la oferta y la fecha',
  duration: 'la duración (minutos o texto)', price: 'si publica precio (SI o NO)', 'price.amount': 'el importe y la moneda', salary: 'si publica salario (SI o NO)',
  'salary.text': 'el salario tal como aparece', tasks: 'al menos una tarea en la hoja «Tareas»', contexts: 'al menos un contexto', sourceKeys: 'al menos una fuente',
  regulated: 'si es una profesión regulada (SI o NO)', 'regulated.note': 'la nota de habilitación en español y en inglés', accessible: 'si la página abre (SI o NO)',
};
const sheetOfKind = (kind) => SHEETS.find((s) => s.kind === kind);
const labelOf = (kind, field) => MISSING_LABEL[field] || sheetOfKind(kind).columns.find((col) => col.path === field)?.es || field;

const EXAMPLE_HOST = /(^|\.)(example\.(com|org|net)|example|test|invalid|localhost)$/i;
const EXAMPLE_TEXT = /ficticio|ficticia|fictitious|sintetic|synthetic/i;

function validateWorkbook(buffer, { allowExample = false, skillKeys = null, now = new Date() } = {}) {
  const problems = [];
  const add = (level, sheet, row, column, message) => problems.push({ level, sheet, row, column, message });
  const workbook = readWorkbook(buffer);
  const items = Object.fromEntries(server.KINDS.map((k) => [k, new Map()])); // clave → { row, raw, cols }
  const exampleRows = [];
  const noteExample = (sheet, row, values) => {
    for (const { col, value } of values.values()) {
      const all = [value].flat().filter((v) => typeof v === 'string');
      const isExample = col.kind === 'url' ? all.some((v) => { try { return EXAMPLE_HOST.test(new URL(v).hostname); } catch { return false; } }) : all.some((v) => EXAMPLE_TEXT.test(v.normalize('NFD').replace(/[̀-ͯ]/g, '')));
      if (isExample) { exampleRows.push({ sheet, row, column: col.es }); return; }
    }
  };

  // 1) Hojas principales.
  for (const sheet of SHEETS.filter((s) => !CHILDREN[s.kind])) {
    for (const { row, values } of readSheet(workbook, sheet, add)) {
      noteExample(sheet.name, row, values);
      const keyCell = values.get('$key')?.value;
      if (!keyCell) { add('error', sheet.name, row, sheet.columns[0].es, 'Falta la clave de la fila.'); continue; }
      if (!server.KEY_RE.test(keyCell)) { add('error', sheet.name, row, sheet.columns[0].es, `La clave «${keyCell}» no sirve. ${sheet.columns[0].help}`); continue; }
      if (items[sheet.kind].has(keyCell)) { add('error', sheet.name, row, sheet.columns[0].es, `La clave «${keyCell}» está repetida (fila ${items[sheet.kind].get(keyCell).row}).`); continue; }
      const raw = {}; const failed = new Set();
      for (const [path, { col, value }] of values) {
        if (path === '$key') continue;
        const result = probe(sheet.kind, path, value);
        if (result.error) { add('error', sheet.name, row, col.es, reason(result.error, col)); failed.add(path.split('.')[0]); } else setPath(raw, path, value);
      }
      items[sheet.kind].set(keyCell, { row, raw, failed, children: { tasks: [], barriers: [], capabilities: [] } });
    }
  }

  // 2) Hojas que cuelgan de una ruta.
  for (const sheet of SHEETS.filter((s) => CHILDREN[s.kind])) {
    for (const { row, values } of readSheet(workbook, sheet, add)) {
      noteExample(sheet.name, row, values);
      const parent = values.get('$parent')?.value;
      const role = items.roles.get(parent);
      if (!role) { add('error', sheet.name, row, sheet.columns[0].es, parent ? `No hay ninguna ruta con la clave «${parent}» en la hoja «Rutas».` : 'Falta la clave de la ruta.'); continue; }
      const entry = {}; let ok = true;
      for (const [path, { col, value }] of values) {
        if (path === '$parent') continue;
        const result = probe(sheet.kind, path, value);
        if (result.error) { add('error', sheet.name, row, col.es, reason(result.error, col)); ok = false; } else setPath(entry, path.replace('$self.', ''), value);
      }
      for (const col of sheet.columns.filter((x) => x.required && x.path !== '$parent')) if (!values.has(col.path)) { add('error', sheet.name, row, col.es, 'Falta este dato.'); ok = false; }
      if (sheet.kind === 'tasks' && entry.aiExposure?.status === 'sourced' && !entry.aiExposure.sourceKey) { add('error', sheet.name, row, 'Fuente de esa afirmación', 'Si elegiste «sourced», escribe la clave de la fuente.'); ok = false; }
      role.children[sheet.kind].push({ row, entry, ok });
    }
  }

  // 3) Cada elemento completo, con las funciones del servidor.
  const normalized = Object.fromEntries(server.KINDS.map((k) => [k, new Map()]));
  for (const kind of server.KINDS) {
    const sheet = sheetOfKind(kind);
    for (const [key, item] of items[kind]) {
      const raw = { ...item.raw };
      if (kind === 'roles') {
        for (const child of ['tasks', 'barriers', 'capabilities']) raw[child] = item.children[child].filter((x) => x.ok).map((x) => x.entry);
        if (!raw.tasks.length) { delete raw.tasks; }
        for (const [child, max, what] of [['tasks', 12, 'tareas'], ['barriers', 8, 'barreras'], ['capabilities', 12, 'capacidades']]) {
          if ((raw[child]?.length || 0) > max) { add('error', sheet.name, item.row, null, `La ruta «${key}» tiene más de ${max} ${what}.`); raw[child] = raw[child].slice(0, max); }
        }
        const seen = new Set();
        for (const x of item.children.capabilities) { if (x.entry.skillKey && seen.has(x.entry.skillKey)) add('error', 'Capacidades', x.row, 'Clave de la capacidad', `La capacidad «${x.entry.skillKey}» está repetida en la ruta «${key}».`); seen.add(x.entry.skillKey); }
      }
      const result = tryNormalize(kind, raw);
      if (result.error) { add('error', sheet.name, item.row, null, `El servidor rechaza el elemento «${key}»: ${result.error.message}`); continue; }
      normalized[kind].set(key, result.ok);
      const hasBadChild = kind === 'roles' && item.children.tasks.some((x) => !x.ok);
      for (const missing of server.missingFor(kind, result.ok)) {
        const field = missing.split('.')[0];
        if (item.failed.has(field) || (field === 'tasks' && hasBadChild)) continue;
        add('error', sheet.name, item.row, null, `A «${key}» le falta ${labelOf(kind, missing === 'price.amount' || missing === 'salary.text' || missing === 'regulated.note' ? missing : field)} para poder publicar.`);
      }
      // El servidor hoy deja publicar un recurso sin rutas, pero luego falla al calcular las rutas de las personas: aquí es obligatorio.
      if (kind === 'resources' && !result.ok.roleKeys?.length && !item.failed.has('roleKeys')) add('error', sheet.name, item.row, 'Rutas donde se ofrece', `El recurso «${key}» necesita al menos una ruta: sin ella el cálculo de rutas falla.`);
    }
  }

  // 4) Referencias entre hojas y topes (los mismos que al publicar).
  for (const [ref, whats] of Object.entries(server.crossRefs(normalized, policy))) {
    const [kind, key] = ref.split('/');
    for (const what of whats) {
      add('error', sheetOfKind(kind).name, items[kind].get(key)?.row ?? null, null, what.startsWith('offers_over_')
        ? `La ruta «${key}» tiene más de ${policy.maxOffersPerRole} ofertas.`
        : `«${key}» menciona una clave que no existe en el archivo (${what}).`);
    }
  }
  if (!items.contexts.size) add('error', 'Contextos', null, null, 'Para publicar hace falta al menos un contexto.');
  if (!items.roles.size) add('error', 'Rutas', null, null, 'Para publicar hace falta al menos una ruta.');
  if (items.contexts.size > policy.maxContexts) add('error', 'Contextos', null, null, `Máximo ${policy.maxContexts} contextos.`);
  if (items.offers.size > policy.maxOffersTotal) add('error', 'Ofertas', null, null, `Máximo ${policy.maxOffersTotal} ofertas en total.`);
  for (const kind of server.KINDS) if (items[kind].size > server.DRAFT_CAPS[kind]) add('error', sheetOfKind(kind).name, null, null, `Máximo ${server.DRAFT_CAPS[kind]} filas.`);

  if (!allowExample) for (const x of exampleRows) add('error', x.sheet, x.row, x.column, 'Parece contenido de ejemplo o de prueba (dominio de ejemplo o la palabra «ficticio/sintético»). El catálogo real no puede llevarlo.');

  // 5) Avisos: no impiden publicar.
  const days = (iso) => Math.floor((Date.parse(now.toISOString().slice(0, 10)) - Date.parse(iso)) / 86400000);
  for (const [key, s] of normalized.sources) if (s.accessible === false || (s.consultedAt && days(s.consultedAt) > policy.sourceStaleDays)) add('aviso', 'Fuentes', items.sources.get(key).row, null, `La fuente «${key}» se mostrará como desactualizada (no abre o se consultó hace más de ${policy.sourceStaleDays} días).`);
  for (const [key, o] of normalized.offers) if (o.verification?.at && days(o.verification.at) > policy.offerVerificationDays) add('aviso', 'Ofertas', items.offers.get(key).row, null, `La oferta «${key}» se mostrará como vencida: se verificó hace más de ${policy.offerVerificationDays} días.`);
  const usedSkills = [...new Set([...[...normalized.roles.values()].flatMap((r) => (r.capabilities || []).map((x) => x.skillKey)), ...[...normalized.resources.values()].map((r) => r.linkedSkillKey)].filter(Boolean))].sort();
  if (usedSkills.length) {
    if (!skillKeys) add('aviso', 'Capacidades', null, null, `Confirma que estas claves existen en el catálogo de habilidades publicado (el servidor no lo comprueba): ${usedSkills.join(', ')}.`);
    else for (const skill of usedSkills.filter((s) => !skillKeys.includes(s))) add('aviso', 'Capacidades', null, null, `La clave «${skill}» no está en la lista de capacidades que indicaste.`);
  }

  const order = (p) => `${p.level === 'error' ? 0 : 1}`;
  problems.sort((a, b) => order(a).localeCompare(order(b)));
  return {
    ok: !problems.some((p) => p.level === 'error'),
    counts: Object.fromEntries(server.KINDS.map((k) => [k, items[k].size])),
    problems,
    items: normalized,
  };
}

module.exports = { buildWorkbook, validateWorkbook, SHEETS, header, INSTRUCTIONS };
