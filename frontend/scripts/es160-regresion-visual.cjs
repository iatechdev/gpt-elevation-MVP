// ES-160 (salvaguarda de Infra): las rutas de /app/* que NO cambian se ven IGUAL antes (main) y después (esta rama). Captura cada ruta a 390 y 1360 px, con la misma API simulada, y compara las imágenes
// píxel a píxel por huella (sha256). Una diferencia se reporta con la ruta y el tamaño. No corre en CI. Uso:
//   BEFORE_URL=http://127.0.0.1:4161 AFTER_URL=http://127.0.0.1:4160 PLAYWRIGHT_MODULE=<playwright> [SHOTS_DIR=<carpeta>] node scripts/es160-regresion-visual.cjs
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// /app/checkin queda fuera: su captura NO es determinista ni en main (tres capturas seguidas de main dieron tres huellas distintas); no hay cambios de código en esa ruta.
const ROUTES = ['/app/dashboard', '/app/chat', '/app/evidence', '/app/diary', '/app/progress', '/app/plan', '/app/my-therapist', '/app/next-step', '/app/bridge', '/app/data', '/app/context/resumes', '/app/feedback', '/app/compass', '/app/space/tools'];

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const urls = { antes: process.env.BEFORE_URL, despues: process.env.AFTER_URL };
  const browser = await chromium.launch({ headless: true });
  let different = 0; let compared = 0;
  async function shoot(base, route, width, lang) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', colorScheme: 'light', locale: lang === 'es' ? 'es-CO' : 'en-US', timezoneId: 'America/Bogota' });
    const page = await context.newPage();
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', (r) => { const p = new URL(r.request().url()).pathname; return r.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : p === '/api/consents' ? { consents: [] } : [] }); });
    await page.goto(base + route, { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(400);
    const buffer = await page.screenshot({ fullPage: true, animations: 'disabled' });
    const finalPath = new URL(page.url()).pathname;
    await context.close();
    return { hash: crypto.createHash('sha256').update(buffer).digest('hex'), buffer, finalPath };
  }
  for (const route of ROUTES) for (const width of [390, 1360]) for (const lang of ['es', 'en']) {
    const a = await shoot(urls.antes, route, width, lang); const b = await shoot(urls.despues, route, width, lang);
    compared += 1;
    const same = a.hash === b.hash && a.finalPath === b.finalPath;
    if (!same) { different += 1; if (process.env.SHOTS_DIR) { fs.mkdirSync(process.env.SHOTS_DIR, { recursive: true }); const slug = `${route.replace(/\W+/g, '_')}-${width}-${lang}`; fs.writeFileSync(path.join(process.env.SHOTS_DIR, `${slug}-antes.png`), a.buffer); fs.writeFileSync(path.join(process.env.SHOTS_DIR, `${slug}-despues.png`), b.buffer); } }
    console.log(`${same ? 'IGUAL    ' : 'DIFERENTE'} ${route} ${width}px ${lang}${a.finalPath !== route ? ` (→ ${a.finalPath})` : ''}`);
  }
  console.log(`\n${compared} comparaciones: ${compared - different} iguales, ${different} diferentes`);
  await browser.close();
  process.exit(different ? 1 : 0);
})().catch((e) => { console.error('FAIL', e.message); process.exit(2); });
