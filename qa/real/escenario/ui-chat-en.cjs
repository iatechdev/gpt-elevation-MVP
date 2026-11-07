const fs=require('fs'),path=require('path');const {chromium}=require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const cfg=JSON.parse(fs.readFileSync('C:/Users/Usuario/Documents/gpt-elevation-qa/qa/real/escenario/credenciales-staging.json','utf8'));const a=cfg.cuentas.P4;
(async()=>{const b=await chromium.launch();const p=await(await b.newContext({viewport:{width:1440,height:900}})).newPage();await p.goto(cfg.api+'/login',{waitUntil:'networkidle'});
await p.fill('input[type=email]',a.email);await p.fill('input[type=password]',a.password);await p.keyboard.press('Enter');await p.waitForTimeout(3000);
await p.goto(cfg.api+'/app/chat',{waitUntil:'networkidle'});await p.getByRole('button',{name:'EN',exact:true}).first().click();await p.waitForTimeout(1500);
console.log((await p.innerText('body')).slice(0,1500));await p.screenshot({path:'C:/Users/Usuario/Documents/gpt-elevation-qa/qa/real/resultado/ui/en-chat-p4.png'});await b.close()})()
