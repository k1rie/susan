#!/usr/bin/env bash
# Convierte un .docx a PDF con LibreOffice (sin interfaz). Perfil temporal propio para no chocar con
# otras instancias de soffice que corran en paralelo.
#
# Uso:  ./convertir.sh reporte.docx [directorio_de_salida]
# Salida: <directorio_de_salida>/<nombre>.pdf  (por omisión, junto al .docx)
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Uso: $0 archivo.docx [directorio_de_salida]" >&2
    exit 2
fi

docx="$(readlink -f "$1")"
salida="${2:-$(dirname "$docx")}"
mkdir -p "$salida"
salida="$(readlink -f "$salida")"
perfil="$(mktemp -d /tmp/lo_perfil_XXXXXX)"
trap 'rm -rf "$perfil"' EXIT

SAL_USE_VCLPLUGIN=svp soffice "-env:UserInstallation=file://$perfil" \
    --headless --convert-to pdf --outdir "$salida" "$docx" >/dev/null 2>&1

pdf="$salida/$(basename "${docx%.docx}").pdf"
if [ ! -s "$pdf" ]; then
    echo "No se generó $pdf" >&2
    exit 1
fi
echo "$pdf"
