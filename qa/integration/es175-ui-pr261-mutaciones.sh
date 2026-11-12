#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
V=/c/Users/Usuario/Documents/qa13/v261; SUT=/c/Users/Usuario/Documents/qa-pr-221/frontend; cd $SUT; git checkout -q -- .; git checkout -q --detach f416f322e15fa64b5b3b487afa4c4a646fccc92f
run() { cd /c/Users/Usuario/Documents/gpt-elevation-qa; V=$V OUT=$V/shots PLAYWRIGHT_MODULE=C:/Users/Usuario/tools/playwright/node_modules/playwright PLAYWRIGHT_BROWSERS_PATH=C:/Users/Usuario/tools/pw-browsers AXE_PATH=C:/Users/Usuario/tools/playwright/node_modules/axe-core/axe.min.js timeout 900 node qa/integration/es175-ui-pr261.cjs 2>&1 | grep -E 'RESUMEN|FATAL|"ok":false' | sed -E 's/.*"id":"(P[0-9a-z]+) .*"ok":false.*/FALLA \1/' | cut -c1-60 | tr '\n' ' '; cd $SUT; }
mut() { id=$1; file=$2; from=$3; to=$4; git checkout -q -- .; node -e "const fs=require('fs');const p=process.argv[1];let s=fs.readFileSync(p,'utf8');const a=process.argv[2],b=process.argv[3];if(s.split(a).length!==2)throw new Error('no único: '+a);fs.writeFileSync(p,s.replace(a,()=>b))" "$file" "$from" "$to" || { echo "$id NO APLICADA"; return; }
  env VITE_ENABLE_FACILITATION_PREVIEW=true VITE_FACILITATION_FIXTURE_SCENARIO=normal npx vite build --outDir $V/dist-normal --emptyOutDir > /dev/null 2>&1; pr=$(PLAYWRIGHT_MODULE=C:/Users/Usuario/tools/playwright/node_modules/playwright PLAYWRIGHT_BROWSERS_PATH=C:/Users/Usuario/tools/pw-browsers AXE_PATH=C:/Users/Usuario/tools/playwright/node_modules/axe-core/axe.min.js node scripts/es175-browser.cjs 2>&1 | grep -c "^PASS"); echo "$id | script del PR: $pr PASS (de 12) hasta fallar | mi guion: $(run)"; git checkout -q -- .; }
node /c/Users/Usuario/Documents/qa13/v261/serve.cjs C:/Users/Usuario/Documents/qa13/v261/dist-normal 4290 & SRV=$!
P=src/facilitation/Pages.tsx; F=src/facilitation/FacilitationPreview.tsx
mut M1 $P '<h3 className="cg-tag">{t('"'"'observation'"'"')}</h3><p lang={r.locale} className="fac-prose">{r.observation}</p>' '<h3 className="cg-tag">{t('"'"'observation'"'"')}</h3><p lang={r.locale} className="fac-prose" dangerouslySetInnerHTML={{ __html: r.observation }} />'
mut M2 $P '        <p className="cg-small cg-muted">{t('"'"'disclaimer'"'"')}</p>
      </Card></li>' '      </Card></li>'
mut M3 $F '        <Banner title={t('"'"'preview'"'"')} />
' ''
mut M4 $P '<Chip tone="wait" symbol="○">{t('"'"'awaiting'"'"')}</Chip>' '<Chip tone="wait">{t('"'"'awaiting'"'"')}</Chip>'
mut M5 $P 'close={() => { setActive(null); requestAnimationFrame(() => openers.current[r.id]?.focus()) }}' 'close={() => { setActive(null) }}'
kill $SRV 2>/dev/null; git checkout -q -- .; env VITE_ENABLE_FACILITATION_PREVIEW=true VITE_FACILITATION_FIXTURE_SCENARIO=normal npx vite build --outDir $V/dist-normal --emptyOutDir > /dev/null 2>&1; git status --short | head -2; echo FIN
