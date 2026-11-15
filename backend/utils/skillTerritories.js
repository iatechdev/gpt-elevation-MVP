// ES-188 (E217-1): los territorios del mapa salen de DATOS (shared/skill-territories.json), no de una lista fija en el código.
// Añadir un territorio es agregar una entrada al archivo (status «in_definition» mientras no se defina, luego «defined»); la validación del catálogo lo acepta sin tocar código.
// Falla cerrado: un archivo ilegible, vacío o con ids repetidos/mal formados NO deja pasar territorios (el catálogo deja de aceptar territorios hasta arreglarlo).
// `SKILL_TERRITORIES_FILE` (solo pruebas) apunta a otro archivo. Se vuelve a leer si cambia (fecha de modificación), así no hace falta reiniciar para leer un cambio.
const fs = require('fs');
const path = require('path');

const STATUSES = ['defined', 'in_definition'];
const ID_RE = /^[a-z][a-z0-9_]{1,15}$/;
const fileOf = () => process.env.SKILL_TERRITORIES_FILE || path.join(__dirname, '..', '..', 'shared', 'skill-territories.json');
let cache = { file: null, mtime: 0, list: null };

function parse(raw) {
  const list = Array.isArray(raw && raw.territories) ? raw.territories : null;
  if (!list || !list.length) throw new Error('skill territories: lista vacía o ausente');
  const seen = new Set();
  return Object.freeze(list.map((entry) => {
    if (!entry || typeof entry.id !== 'string' || !ID_RE.test(entry.id) || seen.has(entry.id) || !STATUSES.includes(entry.status)) throw new Error('skill territories: entrada inválida');
    seen.add(entry.id);
    return Object.freeze({ id: entry.id, status: entry.status });
  }));
}

function territories() {
  const file = fileOf();
  const { mtimeMs } = fs.statSync(file);
  if (cache.file === file && cache.mtime === mtimeMs && cache.list) return cache.list;
  const list = parse(JSON.parse(fs.readFileSync(file, 'utf8')));
  cache = { file, mtime: mtimeMs, list };
  return list;
}

const territoryIds = () => territories().map((t) => t.id);

module.exports = { territories, territoryIds, STATUSES };
