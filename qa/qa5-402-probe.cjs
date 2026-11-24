// [QA-Claude-5] sonda de #402: ¿qué se ve a 1920/1360 px y dónde queda el nav lateral?
const fs=require('fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE);const CRED=JSON.parse(fs.readFileSync(process.env.CRED,'utf8'));
(async()=>{const br=await chromium.launch();const API=process.env.API,BASE=process.env.BASE
const s=await (await fetch(API+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:CRED.persona,password:CRED.pass})})).json()
for(const w of [901,1024,1360,1920]){const ctx=await br.newContext({viewport:{width:w,height:900}});const p=await ctx.newPage();await p.addInitScript(([t,l])=>{localStorage.setItem('elevation_token',t);localStorage.setItem('elevation_role','user');localStorage.setItem('elv_lang',l)},[s.token,'es']);await p.goto(BASE+'/app/dashboard');await p.waitForTimeout(3500)
const r=await p.evaluate(()=>{const vis=e=>{const b=e.getBoundingClientRect();const cs=getComputedStyle(e);return b.width>0&&b.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'};return {url:location.pathname,navs:[...document.querySelectorAll('nav')].map(n=>({cls:n.className,vis:vis(n),rect:(()=>{const b=n.getBoundingClientRect();return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]})(),links:n.querySelectorAll('a').length})),ox:document.documentElement.scrollWidth,mainW:Math.round(document.querySelector('main')?.getBoundingClientRect().width||0)}})
console.log(w,JSON.stringify(r));await p.screenshot({path:process.env.OUT+'/probe-'+w+'.png'});await ctx.close()}
await br.close()})()
