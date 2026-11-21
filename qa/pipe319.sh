#!/bin/bash
# [QA-Claude-3] #319 con /admin/prompts activada (build 319s vs main): backend nuevo (con PROMPT_ENCRYPTION_KEY sintética), F1/F2/F3/A1, tema oscuro real y CLS (con/sin fuentes, red lenta, oscuro). Salida: $QA3_DIR/out/pipe319-*.txt
Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; H="$(dirname "$0")"; D=qa3_f; export ACCTS=$Q/out/c319-accts.json MSYS_NO_PATHCONV=1; rm -f $ACCTS
bash "$H/start-backend.sh" $D > $Q/out/pipe319-be.txt 2>&1
for k in F1 F2 F3 A1; do bash "$H/run.sh" e319-guias.cjs 319s $D ONLY=$k > $Q/out/pipe319-$k.txt 2>&1; done
export ROUTES=/admin/prompts
bash "$H/run.sh" e331-marco.cjs 319s $D ONLY=T LABEL=C ACCTS=$ACCTS > $Q/out/pipe319-T.txt 2>&1
: > $Q/out/pipe319-R.txt
run() { bash "$H/run.sh" e331-marco.cjs $1 $D ONLY=R LABEL=$2 CELLS=$3 RUNS=$4 ACCTS=$ACCTS 2>&1 | grep '^R331' >> $Q/out/pipe319-R.txt; }
for t in 1 2 3 4 5; do run main A fuentes:claro 2; run 319s C fuentes:claro 2; done
for t in 1 2; do run main A sin-fuentes:claro,lenta:claro,fuentes:oscuro 2; run 319s C sin-fuentes:claro,lenta:claro,fuentes:oscuro 2; done
echo FIN > $Q/out/pipe319-fin.txt
