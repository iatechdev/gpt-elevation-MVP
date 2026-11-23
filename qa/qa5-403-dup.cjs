const fs=require('fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE);const CRED=JSON.parse(fs.readFileSync(process.env.CRED,'utf8'))
;(async()=>{const br=await chromium.launch();const s=await (await fetch(process.env.API+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:CRED.super,password:CRED.pass})})).json()
for(const [w,lang] of [[390,"es"],[1360,"es"],[390,"en"],[1360,"en"]]){const ctx=await br.newContext({viewport:{width:w,height:844}});const p=await ctx.newPage()
await p.addInitScript(([t,l])=>{localStorage.setItem('elevation_token',t);localStorage.setItem('elevation_role','superadmin');localStorage.setItem('elv_lang',l)},[s.token,lang])
await p.goto(process.env.BASE+'/admin/dashboard');await p.waitForSelector('main');await p.waitForTimeout(1200)
if(w<901){await p.getByRole('button',{name:lang==='es'?/Menú/:/Menu/}).first().click();await p.waitForSelector('dialog.cg-drawer[open]')}else{await p.locator('.cg-usermenu__button').click()}
await p.waitForTimeout(1500);console.log(w,lang,JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('dialog.cg-drawer[open] a, .cg-usermenu__list a, nav.cg-side a')].filter(a=>{const b=a.getBoundingClientRect();return b.width>0}).filter(a=>/manifest/i.test(a.textContent)||/manifest/.test(a.getAttribute('href'))).map(a=>a.textContent.trim()+' → '+new URL(a.href).pathname))));await ctx.close()}
await br.close()})()
