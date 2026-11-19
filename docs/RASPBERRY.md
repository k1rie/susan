# Terminal del aula: Raspberry Pi

Componente físico del proyecto: una **Raspberry Pi 4 Model B** con la **Camera Module V2** (sensor imx219) hace de
terminal del aula. Al encender abre SUSAN a pantalla completa (modo kiosco) y el docente pasa lista con la cámara de
la Raspberry, con el mismo flujo «Pasar lista» de la web. El procesamiento, la base de datos y el reconocimiento siguen
en el servidor; la Raspberry solo muestra la app y captura imagen. No hay código de SUSAN que corra en la Raspberry.

```
[Camera Module V2] --cinta CSI--> [Raspberry Pi 4: Chromium en kiosco] --Wi-Fi--> [servidor SUSAN :3000]
```

## Equipo

| Pieza | Detalle |
|---|---|
| Raspberry Pi 4 Model B | caja Argon NEO; fuente oficial 5 V 3 A USB-C |
| Camera Module V2 | conectada en el puerto `CAMERA` (no en `DISPLAY`), parte azul de la cinta hacia el conector de audio |
| Disco | memoria USB de 8 GB en un puerto USB azul (no hay microSD) |
| Sistema | Raspberry Pi OS 64-bit con escritorio (Debian 13 «trixie»), grabado con Raspberry Pi Imager |
| Red | Wi-Fi, nombre `susan-aula`, usuario `susan`; SSH solo con llave pública (`~/.ssh/susan_rpi_ed25519`) |

No necesita monitor: su escritorio se ve desde la Mac con **RealVNC Connect Viewer** (el visor «Compartir pantalla» de
macOS no es compatible con el VNC de Raspberry Pi OS). Dirección: `susan-aula.local` o su IP.

## Puesta en marcha

**Configuración actual: producción.** La Raspberry tiene `~/.config/susan-kiosco.env` con
`SUSAN_URL="https://susan-six.vercel.app"`: no depende de la Mac (solo de que haya internet) y, al ser HTTPS, la cámara
funciona sin excepciones del navegador. Los pasos 1–3 de abajo son para apuntarla a un servidor de desarrollo local;
para volver a él, borrar ese archivo y reiniciar.

1. En la Mac, levantar SUSAN: `scripts/dev-all.sh` (ver `docs/DEMO.md`). Next ya acepta peticiones de nombres
   `*.local` (`allowedDevOrigins` en `web/next.config.mjs`); para otro nombre o una IP, `SUSAN_DEV_ORIGINS=192.168.1.89`.
2. Instalar el kiosco en la Raspberry (una sola vez): `scripts/raspberry/instalar.sh` (o `... susan@<ip>`).
3. Reiniciar la Raspberry. Al iniciar sesión, el escritorio lanza `~/.local/bin/susan-kiosco.sh`, que espera a que
   `http://Diegos-MacBook-Pro.local:3000/login` responda y abre Chromium en kiosco. Para otro servidor, crear en la
   Raspberry `~/.config/susan-kiosco.env` con `SUSAN_URL="http://<host>:3000"`.
4. Entrar como docente (en local: `docente1@susan.local`, contraseña de desarrollo de `docs/DEMO.md`; en producción,
   una cuenta real), abrir «Pasar lista» y aceptar el permiso de cámara la primera vez.

Salir del kiosco: `Alt+F4`. Probar la cámara sin navegador: `rpicam-still -n -o foto.jpg` por SSH.

## Problemas conocidos (y por qué el script es así)

- **La memoria USB es muy lenta para escribir** (cientos de ms por escritura): Chromium se congela con la ventana en
  blanco o ni siquiera aparece. El script pone el perfil y las cachés en `/tmp` (RAM); la sesión se pierde al reiniciar.
  Una microSD A1/A2 resolvería esto.
- **La cámara CSI no es una webcam USB.** Chromium solo la ve por libcamera → PipeWire → portal de escritorio
  (`--enable-features=WebRtcPipeWireCamera`). Además el portal debe tener el permiso de cámara para aplicaciones del
  sistema; si está en «no», el navegador recibe `NotAllowedError` o espera para siempre. `instalar.sh` lo deja en «yes».
- **HTTP en la red local**: el navegador solo permite la cámara en HTTPS o `localhost`; el kiosco usa
  `--unsafely-treat-insecure-origin-as-secure` solo para la URL de SUSAN. Es una configuración de demostración, no de
  producción (en producción SUSAN va por HTTPS y la bandera sobra).
- **Red en la escuela**: `UnachWiFi` rechaza la asociacion de la Raspberry (`association took too long`), asi que se
  usa el hotspot del iPhone (`DiegoiPhone`, 2.4 GHz con «Maximizar compatibilidad»). El iPhone oculta el nombre del
  hotspot fuera de su pantalla de ajustes: el perfil de NetworkManager lleva `hidden=true` y prioridad 30. Sin red
  conocida, la Wi-Fi se cambia desde la Mac con un paso de un solo arranque en `bootfs` (`systemd.run=` en
  `cmdline.txt`, respaldo en `cmdline.txt.orig`) que escribe el perfil en `/etc/NetworkManager/system-connections/`.
  La luz verde no sirve de indicador: al arrancar desde USB solo marca la ranura microSD.
- Chromium lanzado por SSH necesita `WAYLAND_DISPLAY=wayland-0`, `XDG_RUNTIME_DIR` y `DBUS_SESSION_BUS_ADDRESS` de la
  sesión del escritorio; lanzado por el autoarranque ya los tiene.
