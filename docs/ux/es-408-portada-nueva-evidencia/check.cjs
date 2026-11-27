// Comprobación del prototipo ES-408 (requiere Playwright; PW_PATH = carpeta del paquete playwright). Uso: node check.cjs [carpeta-capturas]
const path = require('path'); const fs = require('fs')
const { chromium } = require(process.env.PW_PATH || 'playwright')
let AxeBuilder = null; try { const m = require(process.env.AXE_PATH || '@axe-core/playwright'); AxeBuilder = m.default || m.AxeBuilder || m } catch (e) {}
const url = 'file:///' + path.join(__dirname, 'elevation-es408.html').split(path.sep).join('/')
const out = process.argv[2]; if (out) fs.mkdirSync(out, { recursive: true })
const fails = []; let scenes = 0, axeRuns = 0
const ok = (c, m) => { if (!c) fails.push(m) }
;(async () => {
  const b = await chromium.launch()
  for (const w of [1440, 1024, 390, 320]) for (const lang of ['es', 'en']) for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 500 ? 780 : 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
    await p.addInitScript(l => { try { localStorage.setItem('es408_lang', l) } catch (e) {} }, lang)
    await p.goto(url); await p.click(`[data-set="theme:${theme}"]`)
    const list = [['portada', 'sample'], ['portada', 'none'], ['cv', 'cv']].concat(['vacio', 'errores', 'guardando', 'error', 'borrador', 'revisar', 'exito'].map(s => ['evidencia', s]))
    for (const [view, v] of list) {
      await p.click(`[data-set="view:${view}"]`)
      if (view === 'portada') await p.click(`[data-set="catalog:${v}"]`); else if (view === 'evidencia') await p.click(`[data-set="state:${v}"]`)
      scenes++
      const m = await p.evaluate(() => {
        const vw = document.documentElement.clientWidth
        const small = [...document.querySelectorAll('#app a, #app button, #app input, #app select, #app textarea, #app summary, #bar button')].filter(e => { const r = e.getBoundingClientRect(); if (!r.width || ['radio', 'checkbox'].includes(e.type)) return false; if (e.closest('details:not([open])') && e.tagName !== 'SUMMARY') return false; if (getComputedStyle(e).display === 'inline') return false; return r.height < 43.5 || r.width < 43.5 }).map(e => e.tagName + ' ' + (e.textContent || e.id).trim().slice(0, 22) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))
        const text = document.body.innerText
        return { ov: document.documentElement.scrollWidth - vw, small: small.slice(0, 4), missing: text.includes('⚠landing') || text.includes('⚠evidence') || text.includes('⚠html'), h1: document.querySelectorAll('#app h1').length, pct: /\d\s?%/.test(document.querySelector('#app').innerText), tiny: [...document.querySelectorAll('#app *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 13 && e.getBoundingClientRect().width && !e.closest('svg')).length }
      })
      const id = `${w} ${lang} ${theme} ${view} ${v}`
      ok(m.ov <= 0, id + ' desborde ' + m.ov); ok(!m.small.length, id + ' pequeños ' + m.small.join('; ')); ok(!m.missing, id + ' clave sin texto'); ok(m.h1 === 1 || v === 'xx', id + ' h1=' + m.h1); ok(!m.pct, id + ' hay un porcentaje en pantalla'); ok(!m.tiny, id + ' texto < 13px: ' + m.tiny)
      if (AxeBuilder && (w === 1440 || w === 390) && lang === 'es') { axeRuns++; const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).include('#app').analyze(); ok(!r.violations.length, id + ' axe ' + r.violations.map(x => x.id + 'x' + x.nodes.length + ' ' + x.nodes[0].target.join(' ')).join(', ')) }
      if (out && ((lang === 'es' && theme === 'light') || (w === 390 && lang === 'en' && theme === 'dark')) && ['sample', 'none', 'cv', 'vacio', 'errores', 'revisar'].includes(v)) await p.screenshot({ path: path.join(out, `${view}-${v}_${lang}-${theme}_${w}.jpg`), type: 'jpeg', quality: 55, fullPage: true })
    }
    ok(!errs.length, `${w} ${lang} ${theme} errores JS ${errs.join("|")}`); await ctx.close()
  }
  /* flujos con teclado y reglas del servidor */
  const p = await b.newPage({ viewport: { width: 1024, height: 800 } }); await p.addInitScript(() => localStorage.setItem('es408_lang', 'es')); await p.goto(url); await p.click('[data-set="view:portada"]'); const home = (await p.textContent('#app')).toLowerCase(); ok(home.includes('reconoce tu camino'), 'promesa'); ok(home.includes('mayores de 18'), '18+ en portada'); ok(!/\b(16|70)\b|\d+\s*a\s*\d+\s*años/.test(home), 'la portada no menciona 16, 70 ni rangos'); ok(!/consigue (un )?(trabajo|empleo)|conseguir(ás)? trabajo/.test(home.split('no garantizan').join('')), 'sin promesa de empleo')
  await p.click('[data-set="view:evidencia"]')
  const txt = () => p.textContent('#app')
  await p.fill('#title', 'Prueba'); await p.click('[data-act="draft"]'); ok((await txt()).includes('Un borrador necesita'), 'borrador con solo título debe fallar')
  await p.click('[data-act="review"]'); ok((await p.locator('#summary li').count()) === 5, 'confirmar con solo título debe pedir 5 campos: ' + await p.locator('#summary li').count())
  await p.focus('#summary a >> nth=0'); await p.keyboard.press('Enter'); ok((await p.evaluate(() => document.activeElement.id)) === 'situation', 'el enlace del resumen lleva el foco al campo')
  await p.fill('#situation', 'Algo pasó'); await p.click('[data-act="draft"]'); await p.waitForTimeout(1500); ok((await txt()).includes('Borrador guardado'), 'borrador con título + otro campo')
  await p.fill('#situation', ''); await p.click('[data-guide="situation"]'); ok((await p.inputValue('#situation')).includes('Qué pasaba:'), 'la guía se inserta en campo vacío'); ok(await p.isDisabled('[data-guide="situation"]'), 'la guía no pisa texto')
  await p.fill('#responsibility', 'r'); await p.fill('#actions-0', 'a'); await p.fill('#delivered', 'd'); await p.focus('#eff-unknown'); await p.keyboard.press('Space')
  await p.click('[data-act="review"]'); ok((await txt()).includes('líneas de la guía'), 'las líneas sin completar bloquean')
  await p.fill('#situation', 'Texto propio'); await p.click('[data-act="review"]'); ok((await txt()).includes('He revisado'), 'pasa a revisión'); ok(await p.isDisabled('[data-act="confirm"]'), 'confirmar deshabilitado sin casilla')
  await p.focus('[data-reviewed]'); await p.keyboard.press('Space'); await p.click('[data-act="confirm"]'); ok((await txt()).includes('Evidencia confirmada'), 'éxito'); ok((await p.evaluate(() => document.activeElement.id)) === 'done', 'foco en el mensaje de éxito')
  await p.click('[data-set="state:error"]'); const before = await p.inputValue('#situation'); await p.click('[data-act="retry"]'); await p.waitForTimeout(1500); ok(before === await p.inputValue('#situation') && before.length > 0, 'reintentar conserva el texto')
  await p.click('[data-set="state:vacio"]'); await p.keyboard.press('Tab'); await p.focus('.examples summary'); await p.keyboard.press('Enter'); ok(await p.locator('.ex').first().isVisible(), 'ejemplos se abren con teclado'); ok((await txt()).includes('Ejemplo ficticio') || (await txt()).includes('EJEMPLO FICTICIO'), 'ejemplos marcados como ficticios')
  await b.close()
  console.log(`escenas ${scenes} · axe en ${axeRuns} · fallos ${fails.length}`); fails.slice(0, 25).forEach(f => console.log(' -', f)); process.exit(fails.length ? 1 : 0)
})()
