const fs=require('fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE);const tok=JSON.parse(fs.readFileSync(process.env.TOKEN_FILE,'utf8')).token;const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{const br=await chromium.launch();const p=await (await br.newContext({viewport:{width:1360,height:1400}})).newPage();const calls=[];
await p.addInitScript(([t])=>{localStorage.setItem('elevation_token',t);localStorage.setItem('elevation_role','admin');localStorage.setItem('elevation_name','Admin QA');localStorage.setItem('elv_lang','es')},[tok]);
p.on('request',r=>{if(/\/api\/admin\/pricing/.test(r.url())&&r.method()!=='GET')calls.push(r.method()+' '+new URL(r.url()).pathname+' '+(r.postData()||'').slice(0,160))});
p.on('response',async r=>{if(/\/api\/admin\/pricing/.test(r.url())&&r.request().method()!=='GET')calls.push('  -> '+r.status())});
await p.goto(process.env.BASE+'/admin/content',{waitUntil:'load'});await sleep(2500);await p.getByText('PLANES').first().click();await sleep(1500);
await p.getByRole('button',{name:/Desactivar/}).nth(0).click();await sleep(800);
console.log('botones tras clic:',JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean).slice(7))));
console.log('dialogo/alerta:',await p.evaluate(()=>[...document.querySelectorAll('[role=dialog],[role=alertdialog]')].map(e=>e.innerText.replace(/\n/g,' | ')).join(' || ').slice(0,300)));
const conf=p.locator('[role=dialog],[role=alertdialog]').getByRole('button',{name:'Desactivar'});
if(await conf.count()){const n=calls.length;await conf.click().catch(()=>{});await sleep(2000);console.log('tras confirmar:',JSON.stringify(calls.slice(n)));console.log('lista:',(await p.evaluate(()=>document.body.innerText)).split(String.fromCharCode(10)).filter(l=>/·|activo|Error/i.test(l)).join(' | ').slice(0,300))}
await br.close()})()
