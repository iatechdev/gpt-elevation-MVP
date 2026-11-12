// ES-199 (PERF-05): rendimiento en ejecución del chat. Mide, con el build de producción servido en local y CPU ×4 (móvil de gama media), cuánto tarda cada pulsación
// en el cuadro de mensaje (la entrada se procesa y React confirma el render, porque el evento `input` es discreto y se confirma de forma síncrona) con una conversación de N mensajes,
// y las tareas largas (> 50 ms) del navegador. SOLO en equipo local o de QA, NUNCA en CI; Playwright no es dependencia del repositorio. Datos sintéticos, sin servidor real.
// Uso:  npx vite build && npx vite preview --host 127.0.0.1 --port 4199 --strictPort   y luego
//   PERF_URL=http://127.0.0.1:4199 PLAYWRIGHT_MODULE=<ruta a playwright> node scripts/perf-runtime.cjs [--sizes 10,100,500,1000] [--keys 40] [--runs 3] [--json]
const assert = require('node:assert/strict');

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? fallback : process.argv[i + 1] };
const SIZES = arg('sizes', '10,100,500,1000').split(',').map(Number);
const KEYS = Number(arg('keys', 40));
const RUNS = Number(arg('runs', 3));
const median = (values) => { const s = [...values].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 };
const percentile = (values, p) => { const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] };

// Conversación sintética: mensajes de ~400 caracteres, alternando persona y asistente (sin personas reales).
const conversation = (n) => Array.from({ length: n }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'bot', text: `Mensaje sintético ${i + 1}. ` + 'Texto de relleno para medir el trabajo de pintar una conversación larga. '.repeat(5) }));

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.PERF_URL ?? 'http://127.0.0.1:4199';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  for (const size of SIZES) {
    const perRun = [];
    for (let run = 0; run < RUNS; run += 1) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CO' });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.addInitScript(() => { localStorage.setItem('elevation_token', 'sintetico'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); window.__long = []; new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__long.push(e.duration) }).observe({ type: 'longtask', buffered: true }) });
      const messages = conversation(size);
      await page.route('**/api/**', (route) => {
        const p = new URL(route.request().url()).pathname;
        if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } });
        if (p === '/api/messages') return route.fulfill({ json: messages });
        if (p === '/api/ai/usage') return route.fulfill({ json: { configured: false } });
        return route.fulfill({ json: [] });
      });
      await page.goto(base + '/app/chat', { waitUntil: 'networkidle' });
      const box = page.locator('textarea.space-message');
      await box.waitFor();
      await page.waitForFunction(() => !document.querySelector('textarea.space-message').disabled);
      const rendered = await page.locator('.chat-scroll > div > div').count();
      await page.evaluate(() => { window.__long.length = 0 });
      // Cada pulsación: se fija el valor como lo haría el teclado y se mide el evento `input` hasta que React termina de pintar el estado nuevo.
      const times = await page.evaluate(async (keys) => {
        const area = document.querySelector('textarea.space-message');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        const out = []; let text = '';
        for (let i = 0; i < keys; i += 1) {
          text += String.fromCharCode(97 + (i % 26));
          setter.call(area, text);
          const t0 = performance.now();
          area.dispatchEvent(new Event('input', { bubbles: true }));
          out.push(performance.now() - t0);
          await new Promise((resolve) => setTimeout(resolve, 40)); // cada pulsación es su propia tarea, como con un teclado real
        }
        return out;
      }, KEYS);
      const long = await page.evaluate(() => window.__long.slice());
      perRun.push({ rendered, p50: median(times), p95: percentile(times, 95), max: Math.max(...times), longTasks: long.length, longTaskMs: long.reduce((a, b) => a + b, 0) });
      await context.close();
    }
    rows.push({ size, rendered: perRun[0].rendered, p50: median(perRun.map((r) => r.p50)), p95: median(perRun.map((r) => r.p95)), max: median(perRun.map((r) => r.max)), longTasks: median(perRun.map((r) => r.longTasks)), longTaskMs: median(perRun.map((r) => r.longTaskMs)) });
  }
  await browser.close();
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ keys: KEYS, runs: RUNS, cpuThrottle: 4, rows }, null, 2)); return; }
  console.log(`Chat · pulsaciones (${KEYS} por corrida, mediana de ${RUNS} corridas, CPU ×4)`);
  for (const r of rows) console.log(`${String(r.size).padStart(5)} mensajes (${r.rendered} nodos): p50 ${r.p50.toFixed(1)} ms · p95 ${r.p95.toFixed(1)} ms · máx ${r.max.toFixed(1)} ms · tareas largas ${r.longTasks} (${r.longTaskMs.toFixed(0)} ms)`);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
