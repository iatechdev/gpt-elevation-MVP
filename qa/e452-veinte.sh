#!/bin/bash
# [QA-Claude-3] ES-383 (#452): npm test del backend completo ×N consecutivas con 4 procesos de CPU en paralelo. Uso: qa/e452-veinte.sh <dir_backend> <dir_salida_nueva> [N=20]
export PATH="/c/Users/Usuario/tools/node22:$PATH"; B=$1; O=$2; N=${3:-20}; mkdir -p "$O"; PIDS=()
for i in 1 2 3 4; do node -e "for(;;){}" & PIDS+=($!); done
cd "$B"; ok=0; bad=0
for r in $(seq 1 $N); do s=$(date +%s); npm test > "$O/run$r.log" 2>&1; rc=$?; e=$(( $(date +%s) - s )); t=$(grep -E '^# tests ' "$O/run$r.log" | tail -1); f=$(grep -E '^# fail ' "$O/run$r.log" | tail -1); echo "run $r rc=$rc ${e}s $t $f" | tee -a "$O/resumen.txt"; if [ $rc -eq 0 ]; then ok=$((ok+1)); else bad=$((bad+1)); fi; done
for p in "${PIDS[@]}"; do kill $p 2>/dev/null; done
echo "FIN ok=$ok bad=$bad" | tee -a "$O/resumen.txt"
