const fs=require('fs');let s=fs.readFileSync('es216b-8190.cjs','utf8');
const a="'L'.repeat(300)); await p.getByRole('button', { name: 'Actualizar', exact: true }).click(); await sleep(1500); const row";
const b="'L'.repeat(150)); await p.getByRole('button', { name: 'Actualizar', exact: true }).click(); await sleep(1500); const row";
if(s.split(a).length!==2) throw new Error('no unico'); fs.writeFileSync('es216b-8190k5.cjs',s.replace(a,()=>b));console.log('ok');
