// [QA-Claude] Vuelca las rutas que registra la prueba permanente del PR #239 (routesOf sobre el server.js real) y las compara con las de mi sonda.
const fs = require('fs');
const SUT = 'C:/Users/Usuario/Documents/qa-pr-221/backend';
const { startRealApi } = require(SUT + '/test/support/realApi.cjs');
const { routesOf } = require(SUT + '/test/support/realServer.cjs');
process.chdir(SUT);
const hooks = [];
const t = { after: (fn) => hooks.push(fn) };
(async () => {
  const { MOUNTS, api } = await startRealApi(t, { envVar: 'QA239_DB', prefix: 'qa239' });
  const { routes, nested } = routesOf(MOUNTS, api);
  const norm = (p) => p.replace(/:[A-Za-z]+/g, ':p');
  const theirs = new Set(routes.map(([m, p]) => `${m} ${norm(p)}`));
  const snap = require('C:/Users/Usuario/Documents/qa13/v239/ES-280-contrato-pr239.json');
  const mine = new Set(Object.keys(snap).map((k) => { const [m, p] = k.split(' '); return `${m} ${norm(p)}`; }));
  const onlyTheirs = [...theirs].filter((x) => !mine.has(x));
  const onlyMine = [...mine].filter((x) => !theirs.has(x));
  const out = { theirs: theirs.size, mine: mine.size, nested, onlyTheirs, onlyMine, withParamTheirs: [...theirs].filter((x) => x.includes(':p')).length, withParamMine: [...mine].filter((x) => x.includes(':p')).length };
  fs.writeFileSync('C:/Users/Usuario/Documents/qa13/v239/routes-compare.json', JSON.stringify(out, null, 1));
  fs.writeFileSync('C:/Users/Usuario/Documents/qa13/v239/routes-theirs.json', JSON.stringify([...theirs].sort(), null, 1));
  console.log(JSON.stringify({ ...out, onlyTheirs: out.onlyTheirs.length, onlyMine: out.onlyMine.length }));
  for (const h of hooks.reverse()) await h();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
