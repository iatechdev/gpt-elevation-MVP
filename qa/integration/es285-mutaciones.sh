#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
export PLAYWRIGHT_BROWSERS_PATH=C:/Users/Usuario/tools/pw-browsers PLAYWRIGHT_MODULE=C:/Users/Usuario/tools/playwright/node_modules/playwright AXE_PATH=C:/Users/Usuario/tools/playwright/node_modules/axe-core/axe.min.js
SUT=/c/Users/Usuario/Documents/qa-pr-221; F=$SUT/frontend; V=/c/Users/Usuario/Documents/qa13/v285; QA=/c/Users/Usuario/Documents/gpt-elevation-qa
cd $F
mut() { # nombre archivo viejo nuevo
  git checkout -q -- src
  if node /c/Users/Usuario/Documents/qa13/v239/mutate.cjs "$2" "$3" "$4" > $V/m.$1.apply 2>&1; then
    npx vite build > /dev/null 2>&1
    u=$(node --test test/es-285-401-guia-validacion.test.mjs 2>&1 | grep -E '^# fail' | tr -d '\n')
    d=$(ES285_URL=http://127.0.0.1:4285 node scripts/es285-check.cjs > $V/m.$1.dev.log 2>&1; echo "exit=$?")
    (cd $QA && QA_MODE=head QA_CORE=1 QA_OUT=$V node qa/integration/es285-real-e2e.cjs > $V/m.$1.core.log 2>&1); c=$(grep -E 'RESUMEN-CONTROL' $V/m.$1.core.log)
    echo "$1 | prueba unitaria del PR: $u | es285-check del PR: $d | mi E2E real núcleo: $c"
  else echo "$1 | NO APLICADA: $(cat $V/m.$1.apply)"; fi
  git checkout -q -- src
}
mut M1-guia-sin-401 src/pages/therapist/GuideBlock.tsx "if (res.status === 401) setError({ key: 'session_expired_guide', reasons: [], enter: true }) // ES-285" "if (res.status === 499) setError({ key: 'session_expired_guide', reasons: [], enter: true }) // ES-285"
mut M2-validacion-sin-401 src/pages/therapist/ValidationBlock.tsx "if (res.status === 401) { setMessage({ text: t('session_expired_file')" "if (res.status === 499) { setMessage({ text: t('session_expired_file')"
mut M3-guia-sin-boton-entrar src/pages/therapist/GuideBlock.tsx "{error.enter && <button" "{false && error.enter && <button"
mut M4-guia-token-distinto src/pages/therapist/GuideBlock.tsx "invalidateStoredSession(usedToken.current)" "invalidateStoredSession('otro')"
mut M5-guia-sin-403 src/pages/therapist/GuideBlock.tsx "else if (res.status === 403) setError" "else if (res.status === 499) setError"
mut M6-validacion-sin-403 src/pages/therapist/ValidationBlock.tsx "if (res.status === 403) { setMessage" "if (res.status === 499) { setMessage"
npx vite build > /dev/null 2>&1; git status --short | head -2; echo FIN
