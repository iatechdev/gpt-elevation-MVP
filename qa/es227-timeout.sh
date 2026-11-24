#!/bin/bash
# QA-Claude-2 — ES-227 (PR #171): prueba P1-9 (backend/test/p1-9-secret.test.cjs, caso «production entrypoints … fail closed») con el timeout del hijo en 60 s.
# Uso: es227-timeout.sh <carpeta_backend> <modo> [corridas]
#   modo: reposo | carga (8 procesos de CPU) | carga16 (16 procesos) | s3 (el hijo NO falla cerrado: se le da JWT_SECRET) | s4 (el hijo se cuelga)
#   TEST=<archivo> para probar otra copia (p. ej. la prueba antigua de main). Las mutaciones editan SOLO la copia local y se restauran con git checkout.
# Sin red, sin base de datos, sin IA. Solo local, en un clon propio.
BE=$1; MODE=$2; N=${3:-10}; export PATH="/c/Users/Usuario/tools/node22:$PATH"; cd "$BE" || exit 2
PAT='production entrypoints'; TEST=${TEST:-test/p1-9-secret.test.cjs}; PIDS=()
cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done; git checkout -q -- test/p1-9-secret.test.cjs 2>/dev/null; }
trap cleanup EXIT
burn() { for i in $(seq 1 "$1"); do node -e "while(true){}" & PIDS+=($!); done; sleep 1; }
case $MODE in
  carga) burn 8 ;;
  carga16) burn 16 ;;
  s3) sed -i "s#else env.JWT_SECRET = secret;#else env.JWT_SECRET = 'x'.repeat(40);#; s#env.JWT_SECRET = secret;#env.JWT_SECRET = 'x'.repeat(40);#" "$TEST"; grep -c "repeat(40)" "$TEST" ;;
  s4) sed -i 's#require(\${JSON.stringify(target)});#while(true){}#' "$TEST"; grep -c "while(true)" "$TEST" ;;
esac
ok=0; ko=0; etimedout=0; for i in $(seq 1 "$N"); do
  node --require ./test/quiet-console.cjs --test --test-name-pattern="$PAT" "$TEST" > /tmp/es227-run.txt 2>&1
  if grep -q "^# fail 0" /tmp/es227-run.txt && grep -q "^# pass [1-9]" /tmp/es227-run.txt; then ok=$((ok+1)); else ko=$((ko+1)); grep -q "ETIMEDOUT" /tmp/es227-run.txt && etimedout=$((etimedout+1)); fi
done
echo "modo=$MODE test=$TEST corridas=$N verdes=$ok rojas=$ko (con ETIMEDOUT: $etimedout)"
