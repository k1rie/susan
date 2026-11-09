#!/usr/bin/env bash
# Instala el modo kiosco de SUSAN en la Raspberry Pi del aula desde esta computadora (por SSH con llave).
# Uso: scripts/raspberry/instalar.sh [usuario@host]      (por defecto susan@susan-aula.local)
# Variables: SUSAN_RPI_KEY (llave SSH; por defecto ~/.ssh/susan_rpi_ed25519). Ver docs/RASPBERRY.md.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTINO="${1:-susan@susan-aula.local}"
LLAVE="${SUSAN_RPI_KEY:-$HOME/.ssh/susan_rpi_ed25519}"
SSH_OPTS=(-i "$LLAVE" -o IdentitiesOnly=yes -o BatchMode=yes)

ssh "${SSH_OPTS[@]}" "$DESTINO" 'mkdir -p ~/.local/bin ~/.config/autostart'
scp -q "${SSH_OPTS[@]}" "$DIR/susan-kiosco.sh" "$DESTINO:.local/bin/susan-kiosco.sh"
scp -q "${SSH_OPTS[@]}" "$DIR/susan-kiosco.desktop" "$DESTINO:.config/autostart/susan-kiosco.desktop"

# Permiso de camara del portal de escritorio para aplicaciones del sistema (id ""): sin el, el navegador recibe
# NotAllowedError o se queda esperando para siempre al pedir la camara por PipeWire.
ssh "${SSH_OPTS[@]}" "$DESTINO" 'chmod +x ~/.local/bin/susan-kiosco.sh
export XDG_RUNTIME_DIR=/run/user/$(id -u) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus
busctl --user call org.freedesktop.impl.portal.PermissionStore /org/freedesktop/impl/portal/PermissionStore \
    org.freedesktop.impl.portal.PermissionStore SetPermission sbssas devices true camera "" 1 yes'

echo "Listo. Reinicia la Raspberry (sudo reboot) para que abra SUSAN en modo kiosco."
