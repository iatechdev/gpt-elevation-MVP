#!/bin/bash
# QA-Claude-2 — ES-226 (PR #170): estabilidad de la prueba E191-1 (backend/test/es-191-review.test.cjs, caso «tiempo lineal»).
# Uso: es226-estabilidad.sh <carpeta_backend> <modo> [corridas]
#   modo: reposo | carga (8 procesos que saturan CPU) | mut200 | mutcuad | mut100  (las mutaciones editan utils/promptReview.js en la copia y la restauran con git checkout)
# Sin red, sin base de datos, sin IA. Solo local, en un clon propio.
BE=$1; MODE=$2; N=${3:-30}; export PATH="/c/Users/Usuario/tools/node22:$PATH"; cd "$BE" || exit 2
PAT='tiempo lineal'; TEST=${TEST:-test/es-191-review.test.cjs}; SRC=utils/promptReview.js; PIDS=()
cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done; git checkout -q -- "$SRC" 2>/dev/null; }
trap cleanup EXIT
mutate() { # $1 = código a inyectar al inicio de reviewPrompt
  node -e "
const fs=require('fs');let s=fs.readFileSync('$SRC','utf8');
const m=s.match(/(function reviewPrompt\s*\([^)]*\)\s*\{|const reviewPrompt\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{)/);
if(!m){console.error('no encontré reviewPrompt');process.exit(3)}
s=s.replace(m[0],m[0]+'\n'+process.argv[1]);fs.writeFileSync('$SRC',s)" "$1" || exit 3; }
case $MODE in
  carga) for i in 1 2 3 4 5 6 7 8; do node -e "while(true){}" & PIDS+=($!); done; sleep 1 ;;
  mut200) mutate "{const t=Date.now();while(Date.now()-t<200){}}" ;;
  mut100) mutate "{const t=Date.now();while(Date.now()-t<100){}}" ;;
  mutcuad) mutate "{let a=0;const n=arguments[0]?String(arguments[0]).length:20000;for(let i=0;i<n;i++)for(let j=0;j<n*2;j++)a^=i+j;if(a===0.5)console.log(a)}" ;;
esac
ok=0; ko=0; for i in $(seq 1 "$N"); do
  if node --require ./test/quiet-console.cjs --test --test-name-pattern="$PAT" "$TEST" > /tmp/es226-run.txt 2>&1 && grep -q "^# pass 1" /tmp/es226-run.txt; then ok=$((ok+1)); else ko=$((ko+1)); fi
done
echo "modo=$MODE corridas=$N verdes=$ok rojas=$ko"
