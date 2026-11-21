#!/bin/bash
# [QA-Claude-3] Corre varias secciones (ONLY) de un script contra un build, una tras otra, guardando la salida en $QA3_DIR/out/<build>-<script>-<sección>.txt
# Uso: qa/batch.sh <script.cjs> <build> <base> F8 F9 ...
Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; mkdir -p $Q/out; S=$1; B=$2; D=$3; shift 3
for k in "$@"; do timeout 280 bash "$(dirname "$0")/run.sh" $S $B $D ONLY=$k OUT=$Q/out/$B-${S%.cjs}-$k > $Q/out/$B-${S%.cjs}-$k.txt 2>&1; echo "== $k: $(grep -c '^OK' $Q/out/$B-${S%.cjs}-$k.txt) OK, $(grep -c '^FALLA' $Q/out/$B-${S%.cjs}-$k.txt) FALLA, exc=$(grep -c EXCEPCION $Q/out/$B-${S%.cjs}-$k.txt)"; done
