const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const U=process.env.U||'http://localhost:5180'
let f=0;const ck=(n,ok,x='')=>{if(!ok)f++;console.log((ok?'OK   ':'FALLA ')+n,x)}
;(async()=>{const b=await chromium.launch()
for(const [lang,w] of [['es',390],['en',390],['es',1440],['en',360]]){const c=await b.newContext({viewport:{width:w,height:844},isMobile:w<500});await c.addInitScript(l=>{if(!localStorage.getItem('elv_lang'))localStorage.setItem('elv_lang',l)},lang);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(U+'/',{waitUntil:'networkidle'});await p.waitForTimeout(1200)
await p.keyboard.press('Tab');const sk=await p.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect(),cs=getComputedStyle(e);return{t:e.innerText.trim(),w:Math.round(r.width),h:Math.round(r.height),inView:r.left>=0&&r.top>=0,out:cs.outlineStyle+' '+cs.outlineWidth}})
ck(`L-R04 ${lang} ${w}px: «${sk.t}» mide ${sk.w}x${sk.h} (≥ 44 px de alto), visible y con foco`,/Saltar|Skip/.test(sk.t)&&sk.h>=44&&sk.inView&&sk.out.startsWith('solid'),JSON.stringify(sk))
await p.keyboard.press('Enter');await p.waitForTimeout(200);ck(`${lang} ${w}px Enter en «saltar» lleva el foco a #contenido`,(await p.evaluate(()=>document.activeElement.id))==='contenido')
if(w<500){const mb=p.locator('button[aria-controls=landing-navigation]');await mb.click();await p.waitForTimeout(300)}
const sel=await p.evaluate(()=>[...document.querySelectorAll('.landing-lang')].map(e=>({t:e.innerText.trim(),a:e.getAttribute('aria-label'),p:e.getAttribute('aria-pressed'),l:e.getAttribute('lang')})))
ck(`L-A05 ${lang} ${w}px: selector con nombre «Español»/«English», aria-pressed y lang`,sel.length===2&&sel[0].a==='Español'&&sel[1].a==='English'&&sel.every(x=>x.p!==null&&x.l),JSON.stringify(sel))
ck(`L-A05 ${lang} ${w}px: el nombre accesible contiene el texto visible (WCAG 2.5.3)`,sel.every(x=>x.a.toLowerCase().includes(x.t.toLowerCase())))
const t=await p.evaluate(()=>[...document.querySelectorAll('a,button')].filter(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width&&r.height&&r.left>-100&&cs.visibility!=='hidden'&&cs.display!=='none'&&r.height<44}).map(e=>(e.innerText||e.getAttribute('aria-label')).trim().slice(0,22)+' '+Math.round(e.getBoundingClientRect().height)+' en '+e.closest('header,nav,main,footer')?.tagName))
console.log('      objetivos < 44 px visibles:',t.join(' | ')||'ninguno')
const m=await p.evaluate(()=>({s:document.documentElement.scrollWidth,i:innerWidth}));ck(`${lang} ${w}px sin desplazamiento horizontal`,m.s<=m.i,`${m.s}/${m.i}`);ck(`${lang} ${w}px sin errores de página`,errs.length===0,errs.join('|'))
await p.getByRole('button',{name:lang==='es'?'English':'Español',exact:true}).click();await p.waitForTimeout(500);const l2=await p.evaluate(()=>({lang:document.documentElement.lang,pr:[...document.querySelectorAll('.landing-lang')].map(e=>e.getAttribute('aria-pressed')).join(',')}));ck(`${lang} ${w}px cambiar idioma por su nombre accesible funciona`,l2.lang===(lang==='es'?'en':'es'),JSON.stringify(l2));await c.close()}
await b.close();console.log(f?'FALLAS '+f:'TODO OK')})()
