const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright'); const PR='http://127.0.0.1:8127';
(async()=>{const email=`qa136s-${Date.now()}@example.test`,password='Contraseña-QA136s-1aA!';
await fetch(PR+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Skip',email,password})});
const r=await(await fetch(PR+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})})).json();
const b=await chromium.launch();
for(const lang of ['es','en']){const ctx=await b.newContext({viewport:{width:1280,height:800}});
await ctx.addInitScript(([l,s])=>{try{localStorage.setItem('elv_lang',l);if(!sessionStorage.getItem('i')){localStorage.setItem('elevation_token',s.token);localStorage.setItem('elevation_role',s.role);localStorage.setItem('elevation_name',s.name||'');sessionStorage.setItem('i','1')}}catch{}},[lang,r]);
const p=await ctx.newPage();const lg=[];p.on('request',q=>{if(/\/api\/logout$/.test(q.url()))lg.push(q.method())});
await p.goto(PR+'/app/dashboard',{waitUntil:'load'});await p.waitForTimeout(2000);
const md=await p.getByRole('link',{name:/Mis datos|My data/}).count()+await p.getByRole('button',{name:/Mis datos|My data/}).count();
await p.getByRole('button',{name:lang==='es'?'Cerrar sesión':'Sign out',exact:true}).first().click();await p.waitForTimeout(800);
const skip=p.getByRole('button',{name:lang==='es'?'Saltar':/Skip/});console.log(lang,'misdatos',md,'skip',await skip.count());
if(await skip.count()){await skip.first().click();await p.waitForTimeout(2500);}
console.log(lang,'url',new URL(p.url()).pathname,'logout',lg.join(','),'token',await p.evaluate(()=>!!localStorage.getItem('elevation_token')).catch(()=>'n/a'));await ctx.close();}
await b.close()})()
