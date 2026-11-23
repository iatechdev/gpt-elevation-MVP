// [QA-Claude-5] CLS de /admin/dashboard y /admin/users (superadmin), 1360 y 390 px, CPU×4, 10 ejecuciones, PR frente a main. Una sola sesión.
const fs=require('fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE);const CRED=JSON.parse(fs.readFileSync(process.env.CRED,'utf8'))
;(async()=>{const br=await chromium.launch();const s=await (await fetch(process.env.API+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:CRED.super,password:CRED.pass})})).json()
for(const route of ['/admin/dashboard','/admin/users'])for(const width of [1360,390])for(const [lab,base] of [['main',process.env.MAIN],['PR',process.env.BASE]]){const v=[]
for(let i=0;i<10;i++){const ctx=await br.newContext({viewport:{width,height:900}});const p=await ctx.newPage();const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
await p.addInitScript(([t])=>{localStorage.setItem('elevation_token',t);localStorage.setItem('elevation_role','superadmin');localStorage.setItem('elv_lang','es');window.__c=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__c+=e.value}).observe({type:'layout-shift',buffered:true})},[s.token])
await p.goto(base+route);await p.waitForSelector('main',{timeout:20000});await p.waitForTimeout(2500);v.push(await p.evaluate(()=>window.__c));await ctx.close()}
console.log(route,width,lab,'máx',Math.max(...v).toFixed(4),v.map(x=>x.toFixed(3)).join(','))}
await br.close()})()
