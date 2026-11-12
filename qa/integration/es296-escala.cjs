const path=require('path'),crypto=require('crypto');const SUT='C:/Users/Usuario/Documents/qa-pr-253/backend';const {startRealApi}=require(SUT+'/test/support/realApi.cjs');process.chdir(SUT);
const hooks=[];const t={after:(f)=>hooks.push(f)};
(async()=>{const {q,mkUser,http,provider}=await startRealApi(t,{envVar:'QA296_DB',prefix:'qa296d'});
const ChatTurn=require(SUT+'/ChatTurn');const {encriptarV2}=require(SUT+'/utils/crypto');const grant=(w,p,s='granted')=>http(w,'PUT','/api/consents/'+p,{status:s});const rid=()=>crypto.randomBytes(10).toString('hex');
const pl=(x)=>({title:x,situation:'S',responsibility:{text:'R'},actions:[{text:'A'}],delivered:{text:'D'},observedEffect:{known:false},autonomy:'autonomous'});
for(const N of [0,10,50,200]){const u=await mkUser('user');await grant(u,'professional_bridge');await grant(u,'insights_chat');const tid=(await ChatTurn.create({UserId:u.id,requestId:'qa-'+rid(),status:'completed',userContent:encriptarV2('Coordiné el proyecto'),replyContent:encriptarV2('r')})).id;
for(let i=0;i<N;i++)await http(u,'POST','/api/evidence',{payload:pl('e'+i),status:'confirmed',requestId:rid(),origins:[{type:'chat_turn',id:tid,quote:'Coordiné'}]});
const s=performance.now();const r=await grant(u,'insights_chat','revoked');console.log('N='+N,'retirar',(performance.now()-s).toFixed(0),'ms',r.status);
const u2=await mkUser('user');await grant(u2,'professional_bridge');await grant(u2,'insights_chat');}
const u=await mkUser('user');await grant(u,'professional_bridge');await grant(u,'insights_chat');await mkUser('user');
// prompt de la propuesta con IA
const levels=Object.fromEntries([1,2,3,4].map(n=>[n,{es:'n'+n,en:'l'+n}]));const catalog=require(SUT+'/utils/skillCatalog');const d=await catalog.createDraft();await catalog.upsertSkill(d.id,'comunicacion',{type:'transversal',labels:{es:'c',en:'c'},rubric:{levels,source:'s',verifiedBy:'r',verifiedAt:'2026-10-01'}});try{await catalog.publish(d.id,1)}catch{await catalog.publish(d.id,2)}
const tid=(await ChatTurn.create({UserId:u.id,requestId:'qa-'+rid(),status:'completed',userContent:encriptarV2('Coordiné el proyecto'),replyContent:encriptarV2('r')})).id;
const a=(await http(u,'POST','/api/evidence',{payload:pl('MARCADA-CHAT'),status:'confirmed',requestId:rid(),origins:[{type:'chat_turn',id:tid,quote:'Coordiné'}]})).body.id;const b=(await http(u,'POST','/api/evidence',{payload:pl('DIRECTA-OK'),status:'confirmed',requestId:rid()})).body.id;
await grant(u,'insights_chat','revoked');const c0=provider.requests.length;const pr=await http(u,'POST','/api/skill-map/proposals',{skillKeys:['comunicacion'],locale:'es'});const req=provider.requests.slice(c0).join(' ');
console.log('propuesta',pr.status,JSON.stringify(pr.body).slice(0,120),'| prompt MARCADA',req.includes('MARCADA-CHAT'),'DIRECTA',req.includes('DIRECTA-OK'));
const mp=await http(u,'GET','/api/skill-map');const txt=JSON.stringify(mp.body);for(const k of ['sourceRevokedAt','source_revoked','reviewReason','needsReview','origins'])console.log('mapa contiene',k,txt.includes(k));
const ex=await http(u,'POST','/api/exports/preview',{type:'personal',locale:'es'});console.log('export',ex.status,JSON.stringify(ex.body).slice(0,300));
for(const h of hooks.reverse())await h();process.exit(0)})().catch(e=>{console.error('FATAL',e.stack);process.exit(1)});
