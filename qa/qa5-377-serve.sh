#!/bin/bash
# Reconstruye pr377 (bandera de vista previa ENCENDIDA, modo servidor) y reinicia SU vista previa en 4365 (solo mis procesos).
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -match 'qa5.tools.qa5.pr377.frontend.node_modules|pr377.frontend.node_modules' -and \$_.CommandLine -match 'preview' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -match '--port 4365' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
(cd $Q/pr377/frontend && rm -rf dist && VITE_ENABLE_CAREER_PREVIEW=true VITE_CAREER_SOURCE=api VITE_BACKEND_URL=http://127.0.0.1:8199 npm run build >/dev/null 2>&1; echo "build=$?")
(cd $Q/pr377/frontend && nohup npx vite preview --host 127.0.0.1 --port 4365 --strictPort > $Q/out/prev-pr377.log 2>&1 &)
for i in $(seq 1 20); do sleep 1; curl -s -o /dev/null http://127.0.0.1:4365/ && break; done; curl -s -o /dev/null -w "preview %{http_code}\n" http://127.0.0.1:4365/
