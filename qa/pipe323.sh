#!/bin/bash
# [QA-Claude-3] #323 con /admin/users activada (build 323s vs main): S (403 de admin), F1/F4/F5/F8, A1, tema oscuro real y CLS (celdas con/sin fuentes, red lenta, oscuro). Salida: $QA3_DIR/out/pipe323-*.txt
Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; H="$(dirname "$0")"; D=qa3_c; export ACCTS=$Q/out/c321-accts.json MSYS_NO_PATHCONV=1
for k in S F1 F4 F5 F8 A1; do bash "$H/run.sh" e323-personas.cjs 323s $D ONLY=$k > $Q/out/pipe323-$k.txt 2>&1; done
export ROUTES=/admin/users
bash "$H/run.sh" e331-marco.cjs 323s $D ONLY=T LABEL=C ACCTS=$ACCTS > $Q/out/pipe323-T.txt 2>&1
: > $Q/out/pipe323-R.txt
run() { bash "$H/run.sh" e331-marco.cjs $1 $D ONLY=R LABEL=$2 CELLS=$3 RUNS=$4 ACCTS=$ACCTS 2>&1 | grep '^R331' >> $Q/out/pipe323-R.txt; }
for t in 1 2 3 4 5; do run main A fuentes:claro 2; run 323s C fuentes:claro 2; done
for t in 1 2; do run main A sin-fuentes:claro,lenta:claro,fuentes:oscuro 2; run 323s C sin-fuentes:claro,lenta:claro,fuentes:oscuro 2; done
echo FIN > $Q/out/pipe323-fin.txt
