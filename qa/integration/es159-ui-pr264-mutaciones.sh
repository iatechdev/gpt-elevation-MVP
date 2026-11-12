#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"; export PLAYWRIGHT_BROWSERS_PATH=C:/Users/Usuario/tools/pw-browsers
SUT=/c/Users/Usuario/Documents/qa-pr-221; F=$SUT/frontend; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v264; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
AX=C:/Users/Usuario/tools/playwright/node_modules/axe-core/axe.min.js; PW=C:/Users/Usuario/tools/playwright/node_modules/playwright
cd $B; for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
cd $SUT; git checkout -q -- .; HEAD0=$(git rev-parse HEAD); echo "head local $HEAD0"
mine() { (cd /c/Users/Usuario/Documents/gpt-elevation-qa; TAG=m QA_SUT=$SUT QA159_DB=$U OUT=$V/shots-m PLAYWRIGHT_MODULE=$PW AXE_PATH=$AX timeout 900 node qa/integration/es159-ui-pr264.cjs 2>&1 | grep -E 'RESUMEN|FATAL|"ok":false' | sed -E 's/.*"id":"(H[0-9a-z]+) .*"ok":false.*/FALLA \1/' | cut -c1-40 | tr '\n' ' '); }
prscript() { node $V/serve.cjs $F/dist 4296 & S=$!; sleep 1; r=$(cd $F; ES159_URL=http://127.0.0.1:4296 PLAYWRIGHT_MODULE=$PW AXE_PATH=$AX timeout 600 node scripts/es159-check.cjs 2>&1 | tail -2 | tr '\n' ' ' | cut -c1-110); kill $S 2>/dev/null; echo "$r"; }
mut() { id=$1; file=$2; from=$3; to=$4; build=$5; git checkout -q -- .; node -e "const fs=require('fs');const p=process.argv[1];let s=fs.readFileSync(p,'utf8');const a=process.argv[2],b=process.argv[3];if(s.split(a).length!==2)throw new Error('no único: '+a);fs.writeFileSync(p,s.replace(a,()=>b))" "$file" "$from" "$to" || { echo "$id NO APLICADA"; return; }
  [ "$build" = 1 ] && (cd $F; npx vite build > /dev/null 2>&1)
  t1=$(cd $F; node --test test/es-159-hoy.test.mjs 2>&1 | grep -E '^# (fail)' | tr -d '#\n'); ps=$(prscript); echo "$id | es-159-hoy:$t1 | es159-check: $ps | mi guion: $(mine)"; git checkout -q -- .; }
mut M1 $F/src/checkin/moodLogic.ts 'body: JSON.stringify({ mood: value }),' 'body: JSON.stringify({ mood: value - 1 }),' 1
mut M2 $F/src/checkin/moodLogic.ts "if (res.ok) return 'ok'" "return 'ok'" 1
mut M3 $F/src/checkin/moodLogic.ts 'value === 1 || value === 2' 'value !== null' 1
mut M4 $F/src/checkin/SupportNotice.tsx "<p>{t('checkin.support_body')}</p>" "<p>{t('checkin.support_body')}</p><p>Línea 106</p>" 1
mut M5 $F/src/checkin/SupportNotice.tsx '<strong>{entry.name}</strong>' '<strong dangerouslySetInnerHTML={{ __html: entry.name }} />' 1
echo "M6 (backend): ánimo sin req.user.id"; git checkout -q -- .; node -e "const fs=require('fs');const p='$B/routes/mood.js';let s=fs.readFileSync(p,'utf8');const a='UserId: req.user.id, date: today, checkin_mood: mood';if(s.split(a).length!==2)throw new Error('no único');fs.writeFileSync(p,s.replace(a,'UserId: req.body.userId || req.user.id, date: today, checkin_mood: mood'))" && { r=$(cd $F; ES159_BACKEND_DIR=$B node scripts/es159-api-integration.cjs 2>&1 | tail -2 | tr '\n' ' ' | cut -c1-110); echo "M6 | es159-api-integration: $r | mi guion: $(mine)"; }
git checkout -q -- .; (cd $F; npx vite build > /dev/null 2>&1); git status --short | head -2; echo FIN
