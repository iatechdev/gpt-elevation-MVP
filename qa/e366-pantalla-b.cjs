const fs=require('fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE);const tok=JSON.parse(fs.readFileSync(process.env.TOKEN_FILE,'utf8')).token;const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{const br=await chromium.launch();const p=await (await br.newContext({viewport:{width:1360,height:1400}})).newPage();const calls=[];
await p.addInitScript(([t])=>{localStorage.setItem('elevation_token',t);localStorage.setItem('elevation_role','admin');localStorage.setItem('elevation_name','Admin QA');localStorage.setItem('elv_lang','es')},[tok]);
p.on('request',r=>{if(/\/api\/admin\/pricing/.test(r.url())&&r.method()!=='GET')calls.push(r.method()+' '+new URL(r.url()).pathname+' '+(r.postData()||'').replace(/"(description|features|name|createdAt|updatedAt|isHigh)[^,]*,/g,''))});
p.on('response',async r=>{if(/\/api\/admin\/pricing/.test(r.url())&&r.request().method()!=='GET')calls.push('  -> '+r.status())});
p.on('dialog',d=>{calls.push('dialogo: '+d.message().slice(0,80));d.accept()});
const open=async()=>{await p.goto(process.env.BASE+'/admin/content',{waitUntil:'load'});await sleep(2500);await p.getByText('PLANES').first().click();await sleep(1500)};
const txt=async()=>(await p.evaluate(()=>document.body.innerText)).split(String.fromCharCode(10)).filter(l=>/·|Error|guard/i.test(l)).join(' | ').slice(0,260);
// A) solo "tocar" los desplegables: elegir otro y volver
await open();await p.getByRole('button',{name:/Editar/}).nth(1).click();await sleep(600);
await p.selectOption('#plan-currency','COP');await p.selectOption('#plan-currency','USD');await p.selectOption('#plan-period','year');await p.selectOption('#plan-period','month');
let n=calls.length;await p.getByRole('button',{name:'Actualizar'}).click();await sleep(1800);console.log('A) tocar y volver (JPY/decada):',JSON.stringify(calls.slice(n)),'|',await txt());
// B) solo la moneda tocada, periodo sin tocar (plan usd/monthly)
await open();await p.getByRole('button',{name:/Editar/}).nth(0).click();await sleep(600);
await p.selectOption('#plan-currency','COP');await p.selectOption('#plan-currency','USD');
n=calls.length;await p.getByRole('button',{name:'Actualizar'}).click();await sleep(1800);console.log('B) solo moneda tocada (usd/monthly):',JSON.stringify(calls.slice(n)),'|',await txt());
// C) desactivar un plan heredado
await open();n=calls.length;await p.getByRole('button',{name:/Desactivar/}).nth(0).click();await sleep(2000);console.log('C) Desactivar legacy-usd:',JSON.stringify(calls.slice(n)),'|',await txt());
await br.close()})()
