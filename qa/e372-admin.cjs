const fs=require('fs');const {chromium}=require('C:/Users/Usuario/tools/playwright/node_modules/playwright');const tok=JSON.parse(fs.readFileSync('C:/Users/Usuario/tools/qa2/o366-tok.json','utf8')).token;const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{const br=await chromium.launch();const p=await br.newPage();await p.addInitScript(([t])=>{localStorage.setItem('elevation_token',t);localStorage.setItem('elevation_role','admin');localStorage.setItem('elevation_name','Admin QA');localStorage.setItem('elv_lang','es')},[tok]);
const calls=[];p.on('response',async r=>{if(/api\/admin\/pricing/.test(r.url())&&r.request().method()!=='GET')calls.push(r.request().method()+' '+r.status()+' '+(r.request().postData()||'').replace(/"(description|features|name|createdAt|updatedAt)[^,]*,/g,'').slice(0,120))});
await p.goto('http://localhost:4361/admin/content',{waitUntil:'load'});await sleep(2500);await p.getByText('PLANES').first().click();await sleep(1500);
await p.getByRole('button',{name:'+ Nuevo plan'}).click();await sleep(700);
console.log('opciones de período en «Nuevo plan»:',JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#plan-period option')].map(o=>o.value+'='+o.textContent))));
console.log('«Para siempre» en la pantalla:',(await p.evaluate(()=>document.body.innerText)).includes('Para siempre'));
await p.getByRole('button',{name:'Cancelar'}).first().click().catch(()=>{});await sleep(400);
await p.getByRole('button',{name:/Editar/}).first().click();await sleep(700);console.log('Editar un plan forever heredado → período mostrado:',await p.evaluate(()=>document.querySelector('#plan-period').value),'(opciones:',await p.evaluate(()=>[...document.querySelectorAll('#plan-period option')].map(o=>o.value).join(',')),')');
await br.close()})()
