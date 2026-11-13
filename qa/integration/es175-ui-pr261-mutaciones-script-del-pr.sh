#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"; export PLAYWRIGHT_BROWSERS_PATH=C:/Users/Usuario/tools/pw-browsers
V=/c/Users/Usuario/Documents/qa13/v261; SUT=/c/Users/Usuario/Documents/qa-pr-221/frontend; cd $SUT; git checkout -q -- .; git checkout -q --detach f416f322e15fa64b5b3b487afa4c4a646fccc92f
P=src/facilitation/Pages.tsx; F=src/facilitation/FacilitationPreview.tsx
one() { id=$1; file=$2; from=$3; to=$4; git checkout -q -- .; node -e "const fs=require('fs');const p=process.argv[1];let s=fs.readFileSync(p,'utf8');const a=process.argv[2],b=process.argv[3];if(s.split(a).length!==2)throw new Error('no único');fs.writeFileSync(p,s.replace(a,()=>b))" "$file" "$from" "$to" || { echo "$id NO APLICADA"; return; }
  env VITE_ENABLE_FACILITATION_PREVIEW=true VITE_FACILITATION_FIXTURE_SCENARIO=normal npx vite build --outDir $V/dist-pr-$id --emptyOutDir > /dev/null 2>&1; git checkout -q -- .
  node $V/serve.cjs $V/dist-pr-$id 4295 & S=$!; sleep 1
  out=$(ES175_URL=http://127.0.0.1:4295 PLAYWRIGHT_MODULE=C:/Users/Usuario/tools/playwright/node_modules/playwright AXE_PATH=C:/Users/Usuario/tools/playwright/node_modules/axe-core/axe.min.js node scripts/es175-browser.cjs 2>&1); kill $S
  echo "$id | script del PR: $(echo "$out" | grep -c '^PASS') PASS; $(echo "$out" | grep -q 'falló' && echo 'DETECTA (falló)' || echo 'NO detecta')"; }
one M1 $P '<h3 className="cg-tag">{t('"'"'observation'"'"')}</h3><p lang={r.locale} className="fac-prose">{r.observation}</p>' '<h3 className="cg-tag">{t('"'"'observation'"'"')}</h3><p lang={r.locale} className="fac-prose" dangerouslySetInnerHTML={{ __html: r.observation }} />'
one M2 $P '        <p className="cg-small cg-muted">{t('"'"'disclaimer'"'"')}</p>
      </Card></li>' '      </Card></li>'
one M3 $F '        <Banner title={t('"'"'preview'"'"')} />
' ''
one M4 $P '<Chip tone="wait" symbol="○">{t('"'"'awaiting'"'"')}</Chip>' '<Chip tone="wait">{t('"'"'awaiting'"'"')}</Chip>'
one M5 $P 'close={() => { setActive(null); requestAnimationFrame(() => openers.current[r.id]?.focus()) }}' 'close={() => { setActive(null) }}'
git status --short | head -2; echo FIN
