#!/bin/bash
# Terminal del aula (Raspberry Pi 4 + Camera Module V2): abre SUSAN a pantalla completa en Chromium en cuanto el
# servidor responde. Lo lanza el escritorio al iniciar sesion (susan-kiosco.desktop). Ver docs/RASPBERRY.md.
# Salir del kiosco: Alt+F4.

# Servidor de SUSAN en la red local (la Mac de desarrollo por su nombre .local). Se puede cambiar sin editar el script
# con un archivo ~/.config/susan-kiosco.env que defina SUSAN_URL.
SUSAN_URL="http://Diegos-MacBook-Pro.local:3000"
[ -f "$HOME/.config/susan-kiosco.env" ] && . "$HOME/.config/susan-kiosco.env"

# El sistema corre desde una memoria USB lenta (cada escritura tarda cientos de ms) y Chromium se congela esperando el
# disco: perfil y caches van a la RAM (/tmp es tmpfs). Consecuencia aceptada: la sesion de SUSAN se pierde al reiniciar.
export XDG_CACHE_HOME=/tmp/susan-kiosco-cache
PERFIL=/tmp/susan-kiosco-perfil

# El escritorio arranca antes que la red y que el servidor: espera a que la pagina de acceso responda.
until curl -s -o /dev/null --max-time 3 "$SUSAN_URL/login"; do
    sleep 5
done

# --unsafely-treat-insecure-origin-as-secure: el navegador solo permite la camara en HTTPS o localhost, y el servidor
# de desarrollo es HTTP en la red local. WebRtcPipeWireCamera: la camara CSI no es una webcam USB; llega por
# libcamera -> PipeWire -> portal de escritorio (que ademas debe tener el permiso de camara, ver instalar.sh).
exec chromium \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --password-store=basic \
    --user-data-dir="$PERFIL" \
    --ozone-platform=wayland \
    --enable-features=WebRtcPipeWireCamera \
    --unsafely-treat-insecure-origin-as-secure="$SUSAN_URL" \
    "$SUSAN_URL/login"
