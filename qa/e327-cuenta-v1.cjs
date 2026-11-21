const {createRequire}=require('module');const {Client}=createRequire('C:/Users/Usuario/tools/qa2/t2/backend/package.json')('pg');const fs=require('fs')
const A='http://localhost:8090';const e=JSON.parse(fs.readFileSync('C:/Users/Usuario/tools/qa2/o325/t327.env','utf8'))
const call=async(m,p,b,t)=>{const r=await fetch(A+p,{method:m,headers:{'content-type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:b===undefined?undefined:JSON.stringify(b)});const x=await r.text();let j=null;try{j=JSON.parse(x)}catch{}return{s:r.status,j,x}}
;(async()=>{const c=new Client({connectionString:'postgres://elevation:elevation_local@127.0.0.1:54331/qa2_e327'});await c.connect()
 const bad=await call('POST','/api/register',{name:'x',email:'z@example.test',password:'Qa2-abcdefAa1!',acceptedTerms:true,termsVersion:'2026-11-v1'});console.log('currentVersion en el 400:',bad.j.currentVersion)
 let u=(await c.query('SELECT id,"termsVersion","acceptedAt" FROM "Users" WHERE email=$1',[e.email])).rows[0];console.log('guardado tras registro v2:',u.termsVersion,'fecha servidor:',!!u.acceptedAt)
 await c.query('UPDATE "Users" SET "termsVersion"=$2, "onboardingCompleted"=true WHERE id=$1',[u.id,'2026-11-v1'])
 const l=await call('POST','/api/login',{email:e.email,password:e.pass});console.log('T5 login con cuenta v1:',l.s,l.j&&Object.keys(l.j).join(','))
 const t=l.j&&l.j.token;for(const p of ['/api/diary','/api/messages','/api/user/context','/api/auth/me','/api/session']){const r=await call('GET',p,undefined,t);console.log('  GET',p,r.s)}
 console.log('  ¿algún campo de re-aceptación en la respuesta del login?',/terms|accept/i.test(l.x))
 await c.end()})()
