const {createRequire}=require('module');const {Client}=createRequire(process.env.BACKEND+'/package.json')('pg');const API='http://localhost:8090';
const call=async(m,p,t,b)=>{const r=await fetch(API+p,{method:m,headers:{'content-type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:b?JSON.stringify(b):undefined});return {s:r.status,j:await r.json().catch(()=>null)}};
(async()=>{const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();const email='qa2-rep207-'+Date.now()+'@example.test',pw='Sint3tica-QA-pass1!';
await call('POST','/api/register',null,{name:'rep',email,password:pw});await db.query('UPDATE "Users" SET role=$1 WHERE email=$2',['admin',email]);await new Promise(r=>setTimeout(r,800));
const tk=(await call('POST','/api/login',null,{email,password:pw})).j.token;
const v=await call('POST','/api/manifest/manifest',tk,{content:'Texto de reproducción QA2'});console.log('POST ->',v.s,JSON.stringify(v.j).slice(0,120));const id=v.j.id??(await db.query('SELECT id FROM "EthicManifests" WHERE "isActive"=true ORDER BY id DESC LIMIT 1')).rows[0].id;
const a1=(await call('GET','/api/manifest/active')).j;console.log('1) tras publicar v'+id+':',a1.version||a1);
const r=await call('PUT','/api/manifest/manifest/'+id+'/activate',tk);console.log('2) PUT activar la versión YA activa →',r.s);
const a2=(await call('GET','/api/manifest/active')).j;console.log('3) GET /active ->',JSON.stringify(a2).slice(0,80));
const rows=(await db.query('SELECT id,version,"isActive" FROM "EthicManifests" ORDER BY id')).rows;console.log('4) filas con isActive:',rows.filter(x=>x.isActive).length,'de',rows.length);
await db.end()})()
