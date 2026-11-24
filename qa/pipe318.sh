#!/bin/bash
# [QA-Claude-3] #318: tema oscuro real y CLS de /admin/dashboard y /admin/metrics (build 318r vs main), celdas con/sin fuentes, red lenta y oscuro.
Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; H="$(dirname "$0")"; D=qa3_c; export ACCTS=$Q/out/c321-accts.json MSYS_NO_PATHCONV=1 ROUTES=/admin/dashboard,/admin/metrics
bash "$H/run.sh" e331-marco.cjs 318r $D ONLY=T LABEL=C ACCTS=$ACCTS > $Q/out/pipe318-T.txt 2>&1
: > $Q/out/pipe318-R.txt
run() { bash "$H/run.sh" e331-marco.cjs $1 $D ONLY=R LABEL=$2 CELLS=$3 RUNS=$4 ACCTS=$ACCTS 2>&1 | grep '^R331' >> $Q/out/pipe318-R.txt; }
for t in 1 2 3 4 5; do run main A fuentes:claro 2; run 318r C fuentes:claro 2; done
for t in 1 2; do run main A sin-fuentes:claro,lenta:claro,fuentes:oscuro 2; run 318r C sin-fuentes:claro,lenta:claro,fuentes:oscuro 2; done
echo FIN > $Q/out/pipe318b-fin.txt
