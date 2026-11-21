#!/bin/bash
# [QA-Claude-3] #321: parte T (tema oscuro real) y CLS de pipe321.sh (ROUTES con MSYS_NO_PATHCONV). Backend y cuentas ya creados por pipe321.sh.
Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; H="$(dirname "$0")"; D=qa3_c; export ACCTS=$Q/out/c321-accts.json MSYS_NO_PATHCONV=1 ROUTES=/admin/route-catalog
bash "$H/run.sh" e331-marco.cjs 321r $D ONLY=T LABEL=C ACCTS=$ACCTS > $Q/out/pipe321-T.txt 2>&1
: > $Q/out/pipe321-R.txt
run() { bash "$H/run.sh" e331-marco.cjs $1 $D ONLY=R LABEL=$2 CELLS=$3 RUNS=$4 ACCTS=$ACCTS 2>&1 | grep '^R331' >> $Q/out/pipe321-R.txt; }
for t in 1 2 3 4 5; do run main A fuentes:claro 2; run 321r C fuentes:claro 2; done
for t in 1 2; do run main A sin-fuentes:claro,lenta:claro,fuentes:oscuro 2; run 321r C sin-fuentes:claro,lenta:claro,fuentes:oscuro 2; done
echo FIN > $Q/out/pipe321b-fin.txt
