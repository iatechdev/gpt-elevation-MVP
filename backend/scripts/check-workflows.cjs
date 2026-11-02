'use strict';
// ES-108 · Guarda de los workflows de GitHub Actions. Un `ci.yml` con YAML inválido (p. ej. un nombre de paso con «: » sin comillas)
// hace que GitHub falle el workflow en 0 s SIN correr ninguna prueba, y un paso dentro del mismo workflow no puede detectarlo:
// por eso esta comprobación corre en `npm test` y a mano (`npm run check:workflows`), antes de empujar.
// Sin red ni secretos: solo lee `.github/workflows/*.yml` y los package.json del repo.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');

// «./frontend», «frontend/», «./frontend/» y «frontend» son el mismo directorio; «.», «./» y vacío son la raíz.
const normalizeDir = (value) => String(value ?? '').trim().replace(/^(?:\.\/)+/, '').replace(/\/+$/, '').replace(/^\.$/, '');

function scriptsOf(dir) {
  try { return new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, dir, 'package.json'), 'utf8')).scripts ?? {})); } catch { return new Set(); }
}

// -> lista de problemas (texto con archivo y, si se sabe, línea). Vacía = válido.
function checkWorkflow(text, file = 'workflow.yml', scripts = { backend: scriptsOf('backend'), frontend: scriptsOf('frontend'), '': scriptsOf('') }) {
  let doc;
  try { doc = yaml.load(text); } catch (error) {
    const line = error.mark ? error.mark.line + 1 : '?';
    return [`${file}:${line}: YAML inválido (${error.reason ?? error.message}). Si es un nombre de paso con «: », ponlo entre comillas.`];
  }
  const problems = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return [`${file}: el documento no es un mapa de workflow.`];
  if (!doc.jobs || typeof doc.jobs !== 'object') return [`${file}: falta el bloque «jobs».`];
  for (const [jobName, job] of Object.entries(doc.jobs)) {
    if (!job || typeof job !== 'object') { problems.push(`${file}: el job «${jobName}» no es un mapa.`); continue; }
    if (job.uses) continue; // workflow reutilizable: sin pasos propios
    if (!Array.isArray(job.steps) || !job.steps.length) { problems.push(`${file}: el job «${jobName}» no tiene pasos.`); continue; }
    const dir = normalizeDir(job.defaults?.run?.['working-directory']);
    job.steps.forEach((step, index) => {
      const where = `${file}: job «${jobName}», paso ${index + 1}${step && step.name ? ` («${step.name}»)` : ''}`;
      if (!step || typeof step !== 'object' || Array.isArray(step)) { problems.push(`${where}: no es un mapa.`); return; }
      // `run: 123` o `run: true` se leen como número o booleano: GitHub los trata como texto y casi siempre es un descuido de comillas.
      if (step.run !== undefined && typeof step.run !== 'string') { problems.push(`${where}: «run» debe ser texto (¿faltan comillas?).`); return; }
      if (Boolean(step.run) === Boolean(step.uses)) { problems.push(`${where}: debe tener exactamente uno de «run» o «uses».`); return; }
      if (step.name !== undefined && typeof step.name !== 'string') problems.push(`${where}: «name» debe ser texto.`);
      if (typeof step.run !== 'string') return;
      const known = scripts[step['working-directory'] === undefined ? dir : normalizeDir(step['working-directory'])] ?? scripts[dir];
      for (const match of step.run.matchAll(/\bnpm run ([A-Za-z0-9:_-]+)/g)) {
        if (known && known.size && !known.has(match[1])) problems.push(`${where}: «npm run ${match[1]}» no existe en el package.json de «${dir || '.'}».`);
      }
    });
  }
  return problems;
}

function checkAll() {
  const files = fs.existsSync(WORKFLOWS) ? fs.readdirSync(WORKFLOWS).filter(name => /\.ya?ml$/.test(name)).sort() : [];
  return { files, problems: files.flatMap(name => checkWorkflow(fs.readFileSync(path.join(WORKFLOWS, name), 'utf8'), `.github/workflows/${name}`)) };
}

if (require.main === module) {
  const { files, problems } = checkAll();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`Workflows válidos: ${files.length} archivo(s).`);
}

module.exports = { checkWorkflow, checkAll };
