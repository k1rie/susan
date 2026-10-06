#!/usr/bin/env bash
# Uso: energia.sh <mp4> -> "t YAVG YMAX" de la diferencia absoluta entre cuadros consecutivos (luma)
ffmpeg -v info -i "$1" -vf "format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - 2>/dev/null \
 | awk '/pts_time/{split($3,a,":"); t=a[2]} /YAVG/{split($1,b,"="); printf "%.4f %s\n", t, b[2]}'
