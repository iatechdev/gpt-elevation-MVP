#!/bin/bash
# Uso: run-fake.sh <script> ; ejecuta cada caso con un npm falso y muestra exit
export PATH="/c/Users/Usuario/Documents/qa13/v312/fakebin:/c/Users/Usuario/tools/node22:$PATH"
cd /c/Users/Usuario/Documents/qa-pr-test/frontend
SCRIPT=${1:-scripts/audit-gate.cjs}
NOW=${NOW:-2026-11-17T12:00:00Z}
for c in ok otro_alto otro_critico mismo_paquete_otro_ghsa por_cadena origen_desconocido moderada limpio mezcla_permitida_y_otra_misma_cadena texto vacio objeto_vacio arreglo error null vuln_null alta_sin_via; do
  for e in 0 1; do
    out=$(FAKE_OUT=$c FAKE_EXIT=$e AUDIT_GATE_NOW=$NOW timeout 60 node $SCRIPT 2>&1); code=$?
    printf "%-40s npm_exit=%s -> gate_exit=%s | %s\n" "$c" "$e" "$code" "$(echo "$out" | tail -1 | cut -c1-70)"
  done
done
