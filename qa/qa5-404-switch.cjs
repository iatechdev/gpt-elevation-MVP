// [QA-Claude-5] #404: estado del interruptor de la fuente tras el aviso «permiso retirado» (¿sigue mostrando «Autorizado»?). Backend real; propuesta de IA simulada.
const fs=require('fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE);const BASE=process.env.BASE,API=process.env.API,CRED=JSON.parse(fs.readFileSync(process.env.CRED,'utf8'))
;(async()=>{const s=await(await fetch(API+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:CRED.persona,password:CRED.pass})})).json();const T=s.token
const api=(m,p,b)=>fetch(API+p,{method:m,headers:{'content-type':'application/json',Authorization:'Bearer '+T},body:b?JSON.stringify(b):undefined}).then(r=>r.json().catch(()=>null))
const d=await api('POST','/api/diary',{date:'2026-10-02',content:'otra entrada sintética'});await api('PUT','/api/consents/professional_bridge',{status:'granted'});await api('PUT','/api/consents/insights_diary',{status:'granted'})
const br=await chromium.launch();const ctx=await br.newContext({viewport:{width:1360,height:900}});const page=await ctx.newPage()
await page.addInitScript(([t,r])=>{localStorage.setItem('elevation_token',t);localStorage.setItem('elevation_role',r);localStorage.setItem('elv_lang','es')},[T,s.role||'user'])
await page.route('**/api/insights/proposals',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({insights:[{key:'values',text:'Valoro la autonomía.',origins:[{type:'diary_entry',id:d.id,quote:'q'}]}]})}))
await page.goto(BASE+'/app/bridge');await page.waitForSelector('main');await page.waitForTimeout(900);await page.getByRole('button',{name:/Analizar mi diario/}).first().click();await page.waitForTimeout(800)
await page.route('**/api/career-context/confirm',async r=>{await api('PUT','/api/consents/insights_diary',{status:'revoked'});await r.continue()})
await page.getByRole('button',{name:/Autorizar cruce/}).first().click();await page.waitForTimeout(300);await page.getByRole('button',{name:/^Confirmar$/}).first().click();await page.waitForTimeout(1500)
const st=await page.evaluate(()=>({alert:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent.trim()).join('|').slice(0,80),sw:[...document.querySelectorAll('[data-source=diary]')].map(e=>e.getAttribute('aria-checked')||e.getAttribute('aria-pressed')||e.checked)}))
console.log('tras «permiso retirado»:',JSON.stringify(st));await br.close()})()
