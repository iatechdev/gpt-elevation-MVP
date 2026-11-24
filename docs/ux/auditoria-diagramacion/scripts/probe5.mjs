import { chromium } from 'file:///C:/Users/Usuario/tools/playwright/node_modules/playwright/index.mjs'
import fs from 'fs'
const BASE='https://backend-staging-e3a6.up.railway.app'
const pw=fs.readFileSync(process.argv[2]+'-admin','utf8').trim()
const r=await fetch(BASE+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'qa-sint-ux-admin@example.test',password:pw})});const s=await r.json()
const b=await chromium.launch();const c=await b.newContext({viewport:{width:1440,height:900}})
await c.addInitScript(([s])=>{try{localStorage.setItem('elv_lang','es');localStorage.setItem('elevation_token',s.token);localStorage.setItem('elevation_role',s.role)}catch{}},[s])
const p=await c.newPage();const pend=new Map();p.on('request',q=>pend.set(q.url(),Date.now()));p.on('requestfinished',q=>pend.delete(q.url()));p.on('requestfailed',q=>pend.delete(q.url()))
await p.goto(BASE+'/admin/content',{waitUntil:'load',timeout:45000});await p.waitForTimeout(9000)
const m=await p.evaluate(()=>{const mn=document.querySelector('main');const r=mn.getBoundingClientRect();return{mainW:r.width,mainL:r.left,docH:document.documentElement.scrollHeight,h1:document.querySelector('h1')?.textContent}})
console.log(JSON.stringify({...m,pendientes:[...pend.keys()].slice(0,4)}));
await p.screenshot({path:process.argv[3]+'/r06-admin-contenido_es-light_1440.jpg',type:'jpeg',quality:55,fullPage:true});await b.close()
