// [QA-Claude-3] M5–M7 de #392 (continuación de mut392.cjs)
const fs=require('fs'),cp=require('child_process');const F='C:/Users/Usuario/tools/qa3/wt/frontend/src/pages/LoginPage.tsx',W='C:/Users/Usuario/tools/qa3/wt/frontend'
const M=[['M5 «Seguir» lleva a «/»',s=>s.replace('<Link className="ac-ghost" to={destination}>','<Link className="ac-ghost" to="/">')],['M6 nombre sin recorte a 80',s=>s.replace('.trim().slice(0, 80)','.trim()')],['M7 botón sin bloqueo',s=>s.replace('disabled={leaving} ','')]]
const o0=fs.readFileSync(F,'utf8')
for(const[n,f]of M){const m=f(o0);if(m===o0){console.log('SIN EFECTO',n);continue}fs.writeFileSync(F,m);const r=cp.spawnSync('npm',['test'],{cwd:W,encoding:'utf8',shell:true});fs.writeFileSync(F,o0);const o=(r.stdout||'')+(r.stderr||'');console.log(((o.match(/# fail (\d+)/)||[])[1]>0)?'DETECTADA':'NO DETECTADA','|',n,'|',(o.match(/# pass (\d+)/)||[])[1],(o.match(/# fail (\d+)/)||[])[1])}
fs.writeFileSync(F,o0)
