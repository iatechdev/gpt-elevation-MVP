// [QA-Claude-5] sonda: superadmin a 390 px, Menú → «Manifiesto ético»: ¿dónde se aterriza?
const fs=require('fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE);const CRED=JSON.parse(fs.readFileSync(process.env.CRED,'utf8'))
;(async()=>{const br=await chromium.launch();const s=await (await fetch(process.env.API+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:CRED.super,password:CRED.pass})})).json()
for(const lang of ['es','en']){const ctx=await br.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message))
await p.addInitScript(([t,l])=>{localStorage.setItem('elevation_token',t);localStorage.setItem('elevation_role','superadmin');localStorage.setItem('elv_lang',l)},[s.token,lang])
await p.goto(process.env.BASE+'/admin/dashboard');await p.waitForSelector('main');await p.waitForTimeout(1200)
await p.getByRole('button',{name:lang==='es'?/Menú/:/Menu/}).first().click();await p.waitForSelector('dialog.cg-drawer[open]');await p.waitForTimeout(400)
const link=p.locator('dialog.cg-drawer[open] a[href="/manifiesto"]');console.log(lang,'enlaces /manifiesto en cajón:',await link.count(),await link.first().textContent())
await link.first().click();await p.waitForTimeout(1500);console.log(lang,'aterriza en',new URL(p.url()).pathname,'h1:',await p.locator('h1').first().textContent().catch(()=>null),'errs',errs.length)
await p.screenshot({path:process.env.OUT+'/probe403-man-'+lang+'.png'});await ctx.close()}
await br.close()})()
