// [QA-Claude-3] Mutaciones de #409 sobre wt (main+#409): frontend `npm test` y prueba PG del PR; revierte cada mutación.
const fs=require('fs'),cp=require('child_process');const Q='C:/Users/Usuario/tools/qa3/wt';const FR=Q+'/frontend',BA=Q+'/backend'
const MP=FR+'/src/pages/ManifestoPage.tsx',BR=BA+'/routes/board.js'
const M=[
 ['F1 sin aviso en inglés sin versión','f',MP,s=>s.replace('{fallback && <Banner','{false && <Banner')],
 ['F2 sin lang="es" en el cuerpo de respaldo','f',MP,s=>s.replace("lang={fallback ? 'es' : undefined}",'')],
 ['F3 en inglés muestra siempre el español','f',MP,s=>s.replace("(lang === 'en' && state.manifesto.contentEn ? state.manifesto.contentEn : state.manifesto.content)","state.manifesto.content")],
 ['B1 contentEn sin cifrar','b',BR,s=>s.replace('contentEn: english ? encriptar(english) : null','contentEn: english || null')],
 ['B2 /active no devuelve contentEn','b',BR,s=>s.replace("contentEn: active.contentEn ? desencriptar(active.contentEn) : null,","")],
 ['B3 sin mínimo de 50 en el inglés','b',BR,s=>s.replace('if (english && english.length < 50)','if (false)')],
 ['B4 /active filtra la nota','b',BR,s=>s.replace('publishedAt: active.updatedAt','note: active.note, publishedAt: active.updatedAt')],
]
const run=(k)=>{const r=k==='f'?cp.spawnSync('npm',['test'],{cwd:FR,encoding:'utf8',shell:true}):cp.spawnSync('node',['--test','test/integration/es-182-manifest-en-postgres.cjs'],{cwd:BA,encoding:'utf8',shell:true,env:{...process.env,ES182EN_TEST_DATABASE_URL:'postgres://elevation:elevation_local@127.0.0.1:54341/postgres'}});const o=(r.stdout||'')+(r.stderr||'');return{p:(o.match(/# pass (\d+)/)||[])[1],f:(o.match(/# fail (\d+)/)||[])[1]}}
for(const[n,k,file,fn]of M){const o0=fs.readFileSync(file,'utf8');const m=fn(o0);if(m===o0){console.log('SIN EFECTO',n);continue}fs.writeFileSync(file,m);const r=run(k);fs.writeFileSync(file,o0);console.log(Number(r.f)>0?'DETECTADA':'NO DETECTADA','|',n,'|',r.p,r.f)}
