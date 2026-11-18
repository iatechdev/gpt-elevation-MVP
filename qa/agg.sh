#!/bin/bash
# [QA-Claude-3] Agrega un archivo de R1 (salida de qa/r1.sh) en medianas por build. Uso: qa/agg.sh <archivo>
export PATH="/c/Users/Usuario/tools/node22:$PATH"
node -e "
const fs=require('fs');const L=fs.readFileSync(process.argv[1],'utf8').split('\n').filter(l=>l.startsWith('R1 ['));const g={};
for(const l of L){const b=l.match(/^R1 \[([^\]]+)\]/)[1];const tag=(l.match(/\[(con|sin)[^\]]*\]/g)||[''])[0]||'';const k=b+' '+tag;const cls=JSON.parse(l.match(/CLS mediana [^ ]+ máx [^ ]+ (\[[^\]]*\])/)[1]);const ut=JSON.parse(l.match(/contenido útil mediana [^ ]+ (\[[^\]]*\])/)[1]);(g[k]??={cls:[],ut:[]});g[k].cls.push(...cls);g[k].ut.push(...ut)}
const med=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
for(const [k,v] of Object.entries(g)) console.log('R1 AGREGADO',k,'n='+v.cls.length,'CLS mediana',med(v.cls),'máx',Math.max(...v.cls),'| contenido útil mediana',med(v.ut),'| lista CLS',JSON.stringify(v.cls))
" "$(cygpath -m "$1")"
