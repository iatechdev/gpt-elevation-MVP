// Explicit local browser preview: static compiled app + simulated CMS, no DB or providers.
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { catalog } = require('../../content/landingDefaults');
const servers = [];
for (const [mode, folder] of [['default', 'dist'], ['review', 'dist/es71-review']]) {
  const root = path.resolve(__dirname, '../../../frontend', folder);
  if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Build both default and review first');
  const app = express();
  let writes = 0;
  app.get('/__es71/cms/:scenario', (req, res) => {
    if (!['normal', 'offline', 'empty', 'malformed', 'partial', 'long'].includes(req.params.scenario)) return res.status(400).end();
    res.setHeader('Set-Cookie', 'es71cms=' + req.params.scenario + '; SameSite=Strict; Path=/');
    res.redirect('/');
  });
  app.get('/api/landing-content', (req, res) => {
    const scenario = req.headers.cookie?.match(/(?:^|; )es71cms=(\w+)/)?.[1];
    const lang = req.query.lang === 'en' ? 'en' : 'es';
    if (scenario === 'offline') return res.status(503).json({});
    if (scenario === 'empty') return res.json({});
    if (scenario === 'malformed') return res.json([]);
    const values = Object.fromEntries(catalog.map(entry => [entry.key, entry[lang]]));
    if (scenario === 'partial') return res.json({ 'landing.pros.title': lang === 'es' ? 'Pregunta sintética' : 'Synthetic question' });
    if (scenario === 'long') {
      values['landing.pros.title'] = 'SyntheticLongWord'.repeat(15);
      values['landing.pros.3.body'] = '<img src=x onerror="alert(1)"> ' + 'SyntheticLongWord'.repeat(30);
      values['landing.pros.2.body'] = 'SyntheticLongWord'.repeat(30);
    }
    res.json(values);
  });
  app.get('/__es71/metrics', (_req, res) => res.json({ mode, writes }));
  app.get(['/__es71/dark', '/__es71/text-zoom'], (req, res) => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    if (req.path.endsWith('text-zoom')) return res.type('html').send(html.replace('</head>', '<style>html{font-size:200%}</style></head>'));
    res.type('html').send(html.replace('</head>', "<script>const mm=window.matchMedia.bind(window);window.matchMedia=q=>q==='(prefers-color-scheme: dark)'?{matches:true,media:q,addEventListener(){},removeEventListener(){}}:mm(q);history.replaceState(null,'','/');</script></head>"));
  });
  app.post('/__es71/stop', (_req, res) => { res.end(); setImmediate(stop); });
  app.use('/api', (req, res) => { if (req.method !== 'GET') writes++; res.status(404).json({ code: 'preview_unavailable' }); });
  app.use(express.static(root, { dotfiles: 'allow' }));
  app.get(/^\/(pricing|login|profesionales)?$/, (_req, res) => res.sendFile(path.join(root, 'index.html'), { dotfiles: 'allow' }));
  servers.push(app.listen(0, '127.0.0.1', function () { console.log('ES-71 ' + mode + ': http://127.0.0.1:' + this.address().port); }));
}
function stop() { for (const server of servers) { server.close(); server.closeAllConnections(); } }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
