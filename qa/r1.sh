#!/bin/bash
# [QA-Claude-3] CLS (390 px, CPU×4) y contenido útil: PR y main INTERCALADOS (n tandas × RUNS corridas cada una). Uso: qa/r1.sh <script.cjs> <build_pr> <base> [tandas=5] [RUNS=2]
# Requiere el backend arrancado y los builds dist-<build_pr> y dist-main. Agrega las medianas al final.
Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; export PATH="/c/Users/Usuario/tools/node22:$PATH"; S=$1; B=$2; D=$3; N=${4:-5}; R=${5:-2}; O=$Q/out/r1-${S%.cjs}-$B.txt; : > $O
for i in $(seq 1 $N); do for b in $B main; do timeout 280 bash "$(dirname "$0")/run.sh" $S $b $D ONLY=R1 RUNS=$R 2>&1 | grep "^R1" | sed "s/^R1/R1 [$b]/" >> $O; done; done
node -e "
const fs=require('fs');const L=fs.readFileSync(process.argv[1],'utf8').split('\n').filter(Boolean);const g={};
for(const l of L){const b=l.match(/^R1 \[([^\]]+)\]/)[1];const tag=(l.match(/\[(con|sin)[^\]]*\]/)||[''])[0];const k=b+' '+tag;const cls=JSON.parse(l.match(/CLS mediana [^ ]+ máx [^ ]+ (\[[^\]]*\])/)[1]);const ut=JSON.parse(l.match(/contenido útil mediana [^ ]+ (\[[^\]]*\])/)[1]);(g[k]??={cls:[],ut:[]});g[k].cls.push(...cls);g[k].ut.push(...ut)}
const med=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
for(const [k,v] of Object.entries(g)) console.log('R1 AGREGADO',k,'n='+v.cls.length,'CLS mediana',med(v.cls),'máx',Math.max(...v.cls),'| contenido útil mediana',med(v.ut))
" "$(cygpath -m $O)"
