#!/usr/bin/env bash
# Mide el costo por cuadro de cada variante (1 worker, --debug) y escribe: variante fps calidad corrida cuadros
# captureFrameMs captureAvgMs captureP50Ms. Antes: `python3 medicion/variantes.py .` (crea medicion-*.html en la raíz).
# Después: borrar medicion-*.html y compositions/frames/med/ (si se quedan, `check` falla con multiple_root_compositions).
# Uso: medir.sh <dir-proyecto> <fps> <calidad> <corridas> <variantes...>
cd "$1"; FPS=$2; Q=$3; N=$4; shift 4
mkdir -p renders/med
for v in "$@"; do
  for i in $(seq 1 $N); do
    npx --yes hyperframes@0.8.134 render . -c medicion-$v.html --quality $Q --fps $FPS --workers 1 --debug --output renders/med/med-$v-$Q-$FPS.mp4 > renders/med/log-$v-$Q-$FPS-$i.txt 2>&1
    D=$(sed 's/\x1b\[[0-9;]*m//g' renders/med/log-$v-$Q-$FPS-$i.txt | grep -o '"workDir":"[^"]*"' | head -1 | cut -d'"' -f4)
    python3 -c "
import json
d=json.load(open('$D/perf-summary.json'))
print('$v',$FPS,'$Q',$i,d['totalFrames'],d['stages']['captureFrameMs'],d['captureAvgMs'],d['captureP50Ms'])
"
    rm -rf "$D"
  done
done
