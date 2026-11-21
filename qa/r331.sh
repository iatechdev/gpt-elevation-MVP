#!/bin/bash
# [QA-Claude-3] CLS del marco (#331): builds A/B/C INTERCALADOS. Uso: qa/r331.sh <base> ; salida: $QA3_DIR/out/r331.txt (líneas R331 …) y agregación con qa/agg331.cjs
Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; D=$1; export ACCTS=$Q/out/marco-accts.json; O=$Q/out/r331.txt; : > $O; H="$(dirname "$0")"
run() { bash "$H/run.sh" e331-marco.cjs $1 $D ONLY=R LABEL=$1 CELLS=$2 RUNS=$3 2>&1 | grep "^R331" >> $O; }
for t in 1 2 3 4 5; do for b in A B C; do run $b fuentes:claro 2; done; done
for t in 1 2; do for b in A B C; do run $b sin-fuentes:claro,lenta:claro 2; done; done
for t in 1 2; do run C fuentes:oscuro 2; run B fuentes:oscuro 2; done
echo FIN >> $O
