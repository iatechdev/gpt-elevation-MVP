#!/bin/bash
# [QA-Claude-3] #318 (cabeza rebasada con la corrección de CLS): e318 F1-F6/S/A1 + tema y CLS de panel y métricas, build 318t vs main.
Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; H="$(dirname "$0")"; D=qa3_f; export ACCTS=$Q/out/c319-accts.json MSYS_NO_PATHCONV=1; 

for k in F1 F2 F3 F4 F6 S A1; do bash "$H/run.sh" e318-panel.cjs 318t $D ONLY=$k > $Q/out/pipe318t-$k.txt 2>&1; done
export ROUTES=/admin/dashboard,/admin/metrics
bash "$H/run.sh" e331-marco.cjs 318t $D ONLY=T LABEL=C ACCTS=$ACCTS > $Q/out/pipe318t-T.txt 2>&1
: > $Q/out/pipe318t-R.txt
run() { bash "$H/run.sh" e331-marco.cjs $1 $D ONLY=R LABEL=$2 CELLS=$3 RUNS=$4 ACCTS=$ACCTS 2>&1 | grep '^R331' >> $Q/out/pipe318t-R.txt; }
for t in 1 2 3 4 5; do run main A fuentes:claro 2; run 318t C fuentes:claro 2; done
for t in 1 2; do run main A sin-fuentes:claro,lenta:claro,fuentes:oscuro 2; run 318t C sin-fuentes:claro,lenta:claro,fuentes:oscuro 2; done
echo FIN > $Q/out/pipe318t-fin.txt
