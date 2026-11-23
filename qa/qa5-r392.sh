#!/bin/bash
# CLS intercalado PR/main (5 vueltas x 2 corridas = 10 por build y escenario)
for i in 1 2 3 4 5; do for b in pr392 main; do bash qa/qa5-run.sh qa5-392.cjs $b qa5_a ONLY=R RUNS=2 2>&1 | grep -E "^R392|^U392" | sed "s/^/v$i /"; done; done
