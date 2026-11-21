#!/usr/bin/env bash
# QA-Claude-2 — PR #379 (ES-194): ejecuta los 6 pasos de docs/DESPLIEGUE-RAILWAY.md «Publicar los ejercicios de acompañamiento» TAL CUAL (curl con BASE y TOKEN), contra un servidor REAL local + PostgreSQL.
# Uso: BASE=http://localhost:8090 TOKENS=<json con superadmin/admin/user> bash qa/e379-runbook.sh   (el token de superadmin se lee del archivo y no se imprime)
set -u
BASE="${BASE:-http://localhost:8090}"
tok() { node -e "console.log(require(process.env.TOKENS).$1.token)"; }
TOKEN="$(tok superadmin)"; ADMIN="$(tok admin)"; PERSONA="$(tok user)"
ok=0; bad=0
check() { if [ "$2" = "1" ]; then ok=$((ok+1)); else bad=$((bad+1)); echo "FALLA: $1 ${3:-}"; fi; }
j() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);console.log(eval(process.argv[1]))}catch(e){console.log('ERR')}})" "$1"; }
reset_db() { node -e "
const {Client}=require('C:/Users/Usuario/tools/qa2/t2/backend/node_modules/pg');(async()=>{const c=new Client('postgres://elevation:elevation_local@127.0.0.1:54331/qa2_e346');await c.connect();await c.query('DELETE FROM \"ExerciseAudits\"');await c.query('DELETE FROM \"Exercises\"');await c.end()})()"; }
reset_db
echo "== punto de partida: la persona no ve ninguno"
N0=$(curl -sS "$BASE/api/exercises" -H "Authorization: Bearer $PERSONA" | j 'o.length'); check "persona ve 0 al inicio" "$([ "$N0" = 0 ] && echo 1 || echo 0)" "$N0"

echo "== Paso 1 · Importar (siempre como borrador, con revisión pendiente)"
R1=$(curl -sS -X POST "$BASE/api/admin/exercises/import-catalog" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}')
echo "$R1" | cut -c1-200; C1=$(echo "$R1" | j 'o.created.length'); S1=$(echo "$R1" | j 'o.skipped.length'); check "paso 1: created=3 skipped=0" "$([ "$C1,$S1" = "3,0" ] && echo 1 || echo 0)" "$C1,$S1"
check "importar NO publica: la persona sigue sin ver ninguno" "$([ "$(curl -sS "$BASE/api/exercises" -H "Authorization: Bearer $PERSONA" | j 'o.length')" = 0 ] && echo 1 || echo 0)"

echo "== Paso 2 · Listar y anotar id y version (status draft, complete true)"
L2=$(curl -sS "$BASE/api/admin/exercises" -H "Authorization: Bearer $TOKEN")
echo "$L2" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{for(const e of JSON.parse(s))console.log(' ',e.id,e.key,'v'+e.version,e.status,'complete='+e.complete,'review='+e.reviewStatus)})"
IDS=$(echo "$L2" | j 'o.map(e=>e.id+":"+e.version).join(" ")'); ALLDRAFT=$(echo "$L2" | j 'o.every(e=>e.status==="draft"&&e.complete===true&&e.reviewStatus==="pending")'); check "paso 2: todos draft, complete y pending" "$([ "$ALLDRAFT" = true ] && echo 1 || echo 0)"

echo "== Paso 3 · Publicar cada uno con la versión que se vio"
for pair in $IDS; do id=${pair%%:*}; ver=${pair##*:}
  R=$(curl -sS -X POST "$BASE/api/admin/exercises/$id/publish" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"confirm\":true,\"expectedVersion\":$ver}"); st=$(echo "$R" | j 'o.status'); check "paso 3: publicar $id → published" "$([ "$st" = published ] && echo 1 || echo 0)" "$(echo "$R" | cut -c1-120)"
done
echo "  (409 con una versión que no es la vista:)"; id1=${IDS%%:*}
R409=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/exercises/$id1/publish" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"confirm":true,"expectedVersion":999}'); check "publicar con versión equivocada → 409" "$([ "$R409" = 409 ] && echo 1 || echo 0)" "$R409"
R400=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/exercises/$id1/publish" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'); echo "  publicar sin confirm ni versión → $R400"; check "publicar sin confirmar → 4xx" "$([ "$R400" -ge 400 ] && [ "$R400" -lt 500 ] && echo 1 || echo 0)" "$R400"

echo "== Paso 4 · Comprobar como persona"
P4=$(curl -sS "$BASE/api/exercises" -H "Authorization: Bearer $PERSONA"); echo "$P4" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{for(const e of JSON.parse(s))console.log(' ',e.key,'review='+e.reviewStatus)})"
check "paso 4: la persona ve los 3, todos con reviewStatus pending" "$([ "$(echo "$P4" | j 'o.length+":"+o.every(e=>e.reviewStatus==="pending")')" = "3:true" ] && echo 1 || echo 0)"
check "paso 4: la persona recibe SOLO key, minutes, es, en, reviewStatus y version (sin auditoría, autores ni correos)" "$([ "$(echo "$P4" | j 'o.every(e=>Object.keys(e).sort().join()==="en,es,key,minutes,reviewStatus,version")')" = true ] && echo 1 || echo 0)"

echo "== Paso 5 · Registrar la revisión del especialista (solo cuando ocurrió)"
for pair in $IDS; do id=${pair%%:*}; ver=${pair##*:}
  R=$(curl -sS -X POST "$BASE/api/admin/exercises/$id/review" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"reviewStatus\":\"done\",\"confirm\":true,\"expectedVersion\":$ver}"); rs=$(echo "$R" | j 'o.reviewStatus+":"+o.status'); check "paso 5: revisión $id → done sin cambiar la publicación" "$([ "$rs" = done:published ] && echo 1 || echo 0)" "$(echo "$R" | cut -c1-120)"
done
check "paso 5: la persona ve ahora todos «done»" "$([ "$(curl -sS "$BASE/api/exercises" -H "Authorization: Bearer $PERSONA" | j 'o.every(e=>e.reviewStatus==="done")')" = true ] && echo 1 || echo 0)"
RB=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/exercises/$id1/review" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"reviewStatus":"done"}'); echo "  revisión sin confirm ni versión → $RB"; check "revisión sin confirmar → 4xx (no se marca por trámite)" "$([ "$RB" -ge 400 ] && [ "$RB" -lt 500 ] && echo 1 || echo 0)" "$RB"
RX=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/exercises/$id1/review" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"reviewStatus":"hecho","confirm":true,"expectedVersion":1}'); check "reviewStatus inválido → 4xx" "$([ "$RX" -ge 400 ] && [ "$RX" -lt 500 ] && echo 1 || echo 0)" "$RX"

echo "== Paso 6 · Retirar uno"
pair=$(echo "$IDS" | cut -d' ' -f1); id=${pair%%:*}; ver=${pair##*:}; CUR=$(curl -sS "$BASE/api/admin/exercises/$id" -H "Authorization: Bearer $TOKEN" | j 'o.version'); echo "  versión actual del ejercicio $id: $CUR (la de la lista del paso 2 era $ver)"
R6=$(curl -sS -X POST "$BASE/api/admin/exercises/$id/withdraw" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"confirm\":true,\"expectedVersion\":$CUR}"); echo "  $(echo "$R6" | cut -c1-160)"; st6=$(echo "$R6" | j 'o.status'); check "paso 6: retirar → status distinto de published" "$([ "$st6" != published ] && [ "$st6" != ERR ] && echo 1 || echo 0)" "$st6"
check "paso 6: la persona deja de verlo al instante (2 de 3)" "$([ "$(curl -sS "$BASE/api/exercises" -H "Authorization: Bearer $PERSONA" | j 'o.length')" = 2 ] && echo 1 || echo 0)"
H=$(curl -sS "$BASE/api/admin/exercises/$id" -H "Authorization: Bearer $TOKEN"); echo "$H" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);const a=o.history||[];console.log('  historial:',a.map(x=>x.action+' por '+x.actorName+' '+x.createdAt).join(' | ').slice(0,300))})"
check "paso 6: el historial dice quién y cuándo (retirada registrada con actor y fecha)" "$([ "$(echo "$H" | j 'o.history.some(x=>x.action==="withdraw"&&!!x.actorName&&!!x.createdAt)')" = true ] && echo 1 || echo 0)"

echo "== «Repetir cualquier paso con la misma versión es idempotente»"
R1b=$(curl -sS -X POST "$BASE/api/admin/exercises/import-catalog" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'); check "repetir paso 1: 0 creados, 3 omitidos" "$([ "$(echo "$R1b" | j 'o.created.length+","+o.skipped.length')" = "0,3" ] && echo 1 || echo 0)" "$(echo "$R1b" | cut -c1-120)"
check "repetir el paso 1 no volvió a publicar ni a mostrar el retirado" "$([ "$(curl -sS "$BASE/api/exercises" -H "Authorization: Bearer $PERSONA" | j 'o.length')" = 2 ] && echo 1 || echo 0)"
pair2=$(echo "$IDS" | cut -d' ' -f2); id2=${pair2%%:*}; CUR2=$(curl -sS "$BASE/api/admin/exercises/$id2" -H "Authorization: Bearer $TOKEN" | j 'o.version')
R3b=$(curl -sS -X POST "$BASE/api/admin/exercises/$id2/publish" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"confirm\":true,\"expectedVersion\":$CUR2}"); check "repetir paso 3 (ya publicado) → unchanged" "$([ "$(echo "$R3b" | j 'o.unchanged')" = true ] && echo 1 || echo 0)" "$(echo "$R3b" | cut -c1-120)"
R6b=$(curl -sS -X POST "$BASE/api/admin/exercises/$id/withdraw" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"confirm\":true,\"expectedVersion\":$CUR}"); echo "  repetir retirada con la misma versión → $(echo "$R6b" | cut -c1-140)"
echo "  total en la base:"; node -e "
const {Client}=require('C:/Users/Usuario/tools/qa2/t2/backend/node_modules/pg');(async()=>{const c=new Client('postgres://elevation:elevation_local@127.0.0.1:54331/qa2_e346');await c.connect();console.log('  ejercicios en la base:',(await c.query('select count(*)::int n from \"Exercises\"')).rows[0].n);await c.end()})()"

echo "== admin recibe 403 en cada paso y no cambia nada"
for spec in "POST|/api/admin/exercises/import-catalog|{}" "GET|/api/admin/exercises|" "POST|/api/admin/exercises/$id2/publish|{\"confirm\":true,\"expectedVersion\":$CUR2}" "POST|/api/admin/exercises/$id2/review|{\"reviewStatus\":\"pending\",\"confirm\":true,\"expectedVersion\":$CUR2}" "POST|/api/admin/exercises/$id2/withdraw|{\"confirm\":true,\"expectedVersion\":$CUR2}"; do m=${spec%%|*}; rest=${spec#*|}; path=${rest%%|*}; body=${rest#*|}
  if [ -n "$body" ]; then code=$(curl -sS -o /dev/null -w "%{http_code}" -X "$m" "$BASE$path" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d "$body"); else code=$(curl -sS -o /dev/null -w "%{http_code}" -X "$m" "$BASE$path" -H "Authorization: Bearer $ADMIN"); fi
  check "admin $m $path → 403" "$([ "$code" = 403 ] && echo 1 || echo 0)" "$code"
done
check "persona tampoco puede (403) y sin sesión tampoco (401 o 403)" "$([ "$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/exercises/import-catalog" -H "Authorization: Bearer $PERSONA" -d '{}' -H 'Content-Type: application/json')/$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/admin/exercises" | sed 's/^401$/403/')" = "403/403" ] && echo 1 || echo 0)"
check "la base no cambió con las llamadas de admin (la persona sigue viendo 2)" "$([ "$(curl -sS "$BASE/api/exercises" -H "Authorization: Bearer $PERSONA" | j 'o.length')" = 2 ] && echo 1 || echo 0)"
echo "RUNBOOK: $ok comprobaciones correctas, $bad fallos"
