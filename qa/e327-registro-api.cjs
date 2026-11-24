const A='http://localhost:8090', tag=Date.now().toString(36), PASS='Qa2-'+Math.random().toString(36).slice(2)+'Aa1!'
const call=async(m,p,b,t)=>{const r=await fetch(A+p,{method:m,headers:{'content-type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:b===undefined?undefined:JSON.stringify(b)});const x=await r.text();let j=null;try{j=JSON.parse(x)}catch{}return{s:r.status,j,x}}
const reg=(i,extra)=>call('POST','/api/register',{name:'QA',email:`qa2-e327-${tag}-${i}@example.test`,password:PASS,...extra})
;(async()=>{
 const cases=[['v1',{acceptedTerms:true,termsVersion:'2026-11-v1'}],['v2',{acceptedTerms:true,termsVersion:'2026-11-v2'}],['sin versión',{acceptedTerms:true}],['sin aceptar',{termsVersion:'2026-11-v2'}],['inventada',{acceptedTerms:true,termsVersion:'2099-01-v9'}],['XSS',{acceptedTerms:true,termsVersion:'<script>alert(1)</script>'}],['objeto',{acceptedTerms:true,termsVersion:{a:1}}],['v2 con aceptar=false',{acceptedTerms:false,termsVersion:'2026-11-v2'}]]
 let i=0;for(const [n,e] of cases){const r=await reg(++i,e);console.log(n.padEnd(22),r.s,JSON.stringify(r.j||r.x).slice(0,200))}
 console.log('--- T5: cuenta con v1 en base');
 const r=await reg(100,{acceptedTerms:true,termsVersion:'2026-11-v2'});console.log('registro v2',r.s)
 console.log('EMAIL',`qa2-e327-${tag}-100@example.test`,'PASS_OK')
 require('fs').writeFileSync('C:/Users/Usuario/tools/qa2/o325/t327.env',JSON.stringify({email:`qa2-e327-${tag}-100@example.test`,pass:PASS}))
})()
