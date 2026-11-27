#!/usr/bin/env node
// ES-410 · Uso (en backend/):
//   npm run catalog:validate -- <archivo.xlsx> [--capacidades=clave1,clave2] [--permitir-ejemplo]
//   npm run catalog:template            (regenera docs/catalogo-rutas/*.xlsx)
// No usa base de datos ni red; solo lee el archivo. Salida: 0 = listo para cargar, 1 = hay errores, 2 = no se pudo leer.
const fs = require('node:fs');
const path = require('node:path');
const { buildWorkbook, validateWorkbook } = require('./catalog.cjs');

const DOCS = path.join(__dirname, '..', '..', '..', 'docs', 'catalogo-rutas');
const OUTPUTS = {
  'plantilla-catalogo-rutas.xlsx': () => buildWorkbook(),
  'ejemplo-FICTICIO-catalogo-rutas.xlsx': () => buildWorkbook(require('./example.cjs'), { note: 'EJEMPLO FICTICIO: nada de este archivo es real. No lo cargues. / FICTITIOUS EXAMPLE: nothing here is real. Do not upload it.' }),
};

function report(result, out, exampleMode) {
  out(`Filas leídas: contextos ${result.counts.contexts}, fuentes ${result.counts.sources}, rutas ${result.counts.roles}, ofertas ${result.counts.offers}, recursos ${result.counts.resources}.`);
  for (const p of result.problems) out(`${p.level === 'error' ? 'ERROR' : 'AVISO'} · hoja «${p.sheet}»${p.row ? `, fila ${p.row}` : ''}${p.column ? `, columna «${p.column}»` : ''}: ${p.message}`);
  const errors = result.problems.filter((p) => p.level === 'error').length;
  out(errors ? `Resultado: ${errors} error(es). Corrígelos y vuelve a validar.` : exampleMode ? 'Resultado: sin errores en MODO EJEMPLO. No lo cargues: para el catálogo real valida sin --permitir-ejemplo.' : 'Resultado: sin errores. Se puede cargar en Administración.');
  out('No se escribió nada en ninguna base de datos.');
}

function main(argv, out = console.log) {
  if (argv[0] === 'template') {
    fs.mkdirSync(DOCS, { recursive: true });
    for (const [name, build] of Object.entries(OUTPUTS)) { fs.writeFileSync(path.join(DOCS, name), build()); out(`Generado docs/catalogo-rutas/${name}`); }
    return 0;
  }
  const args = argv[0] === 'validate' ? argv.slice(1) : argv;
  const file = args.find((a) => !a.startsWith('--'));
  const unknown = args.filter((a) => a.startsWith('--') && a !== '--permitir-ejemplo' && !a.startsWith('--capacidades='));
  if (!file || unknown.length) { out('Uso: npm run catalog:validate -- <archivo.xlsx> [--capacidades=clave1,clave2] [--permitir-ejemplo]'); return 2; }
  const skills = args.find((a) => a.startsWith('--capacidades='));
  let result;
  try {
    // INIT_CWD es la carpeta desde la que se llamó a npm: así las rutas relativas funcionan como se escriben.
    result = validateWorkbook(fs.readFileSync(path.resolve(process.env.INIT_CWD || process.cwd(), file)), {
      allowExample: args.includes('--permitir-ejemplo'), skillKeys: skills ? skills.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean) : null,
    });
  } catch (error) {
    out(`No se pudo leer el archivo: ${error.code === 'ENOENT' ? 'no existe.' : error.message}`);
    return 2;
  }
  report(result, out, args.includes('--permitir-ejemplo'));
  return result.ok ? 0 : 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main, OUTPUTS, DOCS };
