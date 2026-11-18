#!/bin/bash
# [QA-Claude-3] #321 con la ruta añadida (build 321r vs main): e321 F1/F4/S/A1, tema oscuro real, CLS (R1 e321 + celdas del marco) y script es187 del PR. Salida: $QA3_DIR/out/pipe321-*.txt
Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; H="$(dirname "$0")"; D=qa3_c; export ACCTS=$Q/out/c321-accts.json; rm -f $ACCTS
bash "$H/start-backend.sh" $D > $Q/out/pipe321-be.txt 2>&1
for k in F1 F4 S A1; do bash "$H/run.sh" e321-catalogo.cjs 321r $D ONLY=$k > $Q/out/pipe321-$k.txt 2>&1; done
export ROUTES=/admin/route-catalog
bash "$H/run.sh" e331-marco.cjs 321r $D ONLY=T LABEL=C ACCTS=$ACCTS > $Q/out/pipe321-T.txt 2>&1
: > $Q/out/pipe321-R.txt
run() { bash "$H/run.sh" e331-marco.cjs $1 $D ONLY=R LABEL=$2 CELLS=$3 RUNS=$4 ACCTS=$ACCTS 2>&1 | grep '^R331' >> $Q/out/pipe321-R.txt; }
for t in 1 2 3 4 5; do run main A fuentes:claro 2; run 321r C fuentes:claro 2; done
for t in 1 2; do run main A sin-fuentes:claro,lenta:claro,fuentes:oscuro 2; run 321r C sin-fuentes:claro,lenta:claro,fuentes:oscuro 2; done
echo FIN > $Q/out/pipe321-fin.txt
