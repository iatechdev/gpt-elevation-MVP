#!/bin/bash
# Mutaciones de #390 sobre una COPIA (tools/qa5/mut): aplica, prueba (es-110-postgres + guion QA) y revierte con git checkout.
export PATH=$QA_TOOLS/node22:$PATH
HERE=$(cd "$(dirname "$0")" && pwd); M=$QA_TOOLS/qa5/mut; PW=$(cat $QA_TOOLS/qa5/pw.txt)
export ES110_TEST_DATABASE_URL="postgres://qa5:$PW@127.0.0.1:54361/postgres" QA_PG="postgres://qa5:$PW@127.0.0.1:54361/postgres" QA_BACKEND=$M/backend
for id in "$@"; do
  git -C $M checkout -q -- backend
  node $HERE/qa5-mutate.cjs $id || continue
  (cd $M/backend && node --test test/integration/es-110-postgres.cjs >$QA_TOOLS/qa5/out/mut-$id.log 2>&1; echo "$id es-110-postgres exit=$?")
  QA_OUT=$QA_TOOLS/qa5/out/mut-$id.json node $HERE/qa5-390.cjs 2>&1 | grep -E "^FALLA|^RESUMEN" | sed "s/^/$id guion: /"
  git -C $M checkout -q -- backend
done
