#!/bin/bash
for i in 1 2 3 4 5; do for b in pr389 main; do bash qa/qa5-run.sh qa5-389.cjs $b qa5_b ONLY=R RUNS=2 2>&1 | grep -E "^R389" | sed "s/^/v$i /"; done; done
