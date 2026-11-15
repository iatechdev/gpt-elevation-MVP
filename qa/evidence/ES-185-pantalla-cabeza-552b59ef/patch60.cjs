const fs=require('fs');let s=fs.readFileSync('es216b-8190.cjs','utf8');
const a="await p.locator('#plan-name-en').fill('N'); await p.locator('#plan-price').fill('12'); await dlg.getByRole('button', { name: l.create, exact: true }).click(); await sleep(400); const eLong";
const b="await p.locator('#plan-name-en').fill('N'); await p.locator('#plan-price').fill(''); await dlg.getByRole('button', { name: l.create, exact: true }).click(); await sleep(400); await p.locator('#plan-price').fill('12'); const eLong";
if(s.split(a).length!==2) throw new Error('no unico');
fs.writeFileSync('es216b-8190.cjs',s.replace(a,()=>b));console.log('ok');
