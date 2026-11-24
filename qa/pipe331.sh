#!/bin/bash
# [QA-Claude-3] Pipeline completo del QA del marco (#331) tras reconstruir los builds A/B/C: H(A), H(B), T y S (C), A1 (C) y CLS intercalado. Salida: $QA3_DIR/out/pipe331-*.txt
Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; H="$(dirname "$0")"; D=qa3_b; export ACCTS=$Q/out/marco-accts.json; rm -f $ACCTS $Q/out/m331-H-*.json
for b in A B; do bash "$H/run.sh" e331-marco.cjs $b $D ONLY=H OUT=$Q/out/m331 ACCTS=$ACCTS LABEL=$b > $Q/out/pipe331-H-$b.txt 2>&1; done
for k in T S; do bash "$H/run.sh" e331-marco.cjs C $D ONLY=$k > $Q/out/pipe331-$k.txt 2>&1; done
bash "$H/run.sh" e331-marco.cjs C $D ONLY=A1 > $Q/out/pipe331-A1.txt 2>&1
bash "$H/r331.sh" $D
echo FIN > $Q/out/pipe331-fin.txt
