#!/usr/bin/env bash
# Actualiza la cabecera de docs/DESIGN_PROGRESS.md (protocolo de continuación del diseño real).
# Uso: scripts/design-heartbeat.sh [running|pending|done] [fase]     (sin argumentos: solo refresca el latido)
set -euo pipefail
F="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/docs/DESIGN_PROGRESS.md"
ahora="$(date -u +%FT%TZ)"
python3 - "$F" "$ahora" "${1:-}" "${2:-}" <<'PY'
import re, sys
p, ahora, estado, fase = sys.argv[1:5]
s = open(p, encoding='utf8').read()
s = re.sub(r'(?m)^heartbeat:.*$', f'heartbeat: {ahora}', s, count=1)
if estado:
    s = re.sub(r'(?m)^status:.*$', f'status: {estado}', s, count=1)
if fase:
    s = re.sub(r'(?m)^phase:.*$', f'phase: {fase}', s, count=1)
open(p, 'w', encoding='utf8').write(s)
print(f'heartbeat={ahora}' + (f' status={estado}' if estado else '') + (f' phase={fase}' if fase else ''))
PY
