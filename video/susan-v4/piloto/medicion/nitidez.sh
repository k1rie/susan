#!/usr/bin/env bash
# Uso: nitidez.sh <png>  -> energía media de bordes (sobel) en gris; más alto = más nítido
ffmpeg -v info -i "$1" -vf "format=gray,sobel,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - 2>/dev/null | grep -o 'YAVG=[0-9.]*' | cut -d= -f2
