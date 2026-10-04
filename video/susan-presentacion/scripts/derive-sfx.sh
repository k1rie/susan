#!/usr/bin/env bash
# Deriva la biblioteca de efectos v2 con ffmpeg (sin tocar los mp3 originales de assets/sfx) y regenera su catalogo.
#
# Uso:  bash scripts/derive-sfx.sh            (desde cualquier carpeta; trabaja sobre la raiz del proyecto)
# Sale: assets/sfx/derived/*.wav               WAV 48 kHz estereo 16 bit (sin retardo de codificador, sin remuestreo en el render)
#       assets/sfx/derived/sfx-meta.json       medicion de cada archivo (scripts/analyze-sfx.mjs)
#       assets/sfx/derived/_envolventes.png    envolventes (para revisar con los ojos)
#       assets/sfx/CATALOG.json                catalogo nombre -> {file, anclaMs, ...} (scripts/build-sfx-catalog.mjs)
# Falla (codigo != 0) si algun archivo derivado incumple la biblioteca v2 (ancla > 10 ms en percusivos, pico fuera de -6 dBFS,
# duplicados por md5, silencio): ver scripts/verify-sfx.mjs --solo biblioteca.
#
# Reglas (audit/sonido/REPORT.md 7.5): todo percusivo empieza con su golpe a <= 10 ms del inicio del archivo, de modo que
# data-start = instante visual - ancla; todos los picos quedan a -6 dBFS y la mezcla se ajusta con data-volume por categoria.
# Los sonidos nuevos se sintetizan con lavfi (aevalsrc / anoisesrc) + filtros; ninguno usa muestras externas.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=assets/sfx
OUT=assets/sfx/derived
TMP=$(mktemp -d "${TMPDIR:-/tmp}/susan-sfx.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"
rm -f "$OUT"/*.wav "$OUT"/sfx-meta.json
FMT="aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo"
PICO=6   # dBFS (en negativo): todos los archivos quedan con el pico a -6 dBFS

rec() { ffmpeg -v error -y "$@"; }
# pk in.wav out.wav [fade]  -> normaliza el pico a -$PICO dBFS y cierra con 6 ms de fundido (fade=0 para no tocar el final, p. ej. el riser)
pk() {
    local mx dur g fade="${3:-1}"
    mx=$(ffmpeg -hide_banner -i "$1" -af volumedetect -f null - 2>&1 | grep -o 'max_volume: [-0-9.]*' | grep -o '[-0-9.]*$')
    g=$(awk -v m="$mx" -v p="$PICO" 'BEGIN{printf "%.2f", -m-p}')
    if [ "$fade" = 1 ]; then
        dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1")
        rec -i "$1" -af "volume=${g}dB,afade=t=out:st=$(awk -v d="$dur" 'BEGIN{printf "%.4f", d-0.006}'):d=0.006" "$2"
    else
        rec -i "$1" -af "volume=${g}dB" "$2"
    fi
}
# fin  nombre  <entrada.wav>  -> escribe $OUT/nombre.wav normalizado (atajo)
fin() { pk "$2" "$OUT/$1.wav" "${3:-1}"; }

# ------------------------------------------------------------------ 1. a partir de los mp3 originales
# 1.1 pop: el original tiene 113 ms de aire antes del golpe. 4 alturas (mas corto cuanto mas agudo), cola recortada a 0.32 s
rec -i $SRC/pop.mp3 -af "atrim=start=0.113,asetpts=PTS-STARTPTS,$FMT" "$TMP/pop.wav"
i=0; for f in 0.84 1.0 1.19 1.41; do
    i=$((i+1))
    rec -i "$TMP/pop.wav" -af "asetrate=48000*$f,aresample=48000,atrim=0:0.32,afade=t=out:st=0.2:d=0.12" "$TMP/p$i.wav"
    fin "pop-$i" "$TMP/p$i.wav"
done

# 1.2 ping: 318 ms de silencio original fuera; escala de 8 notas (0,2,4,7,9,12,14,16 semitonos) para los 8 brackets del cuadro 5
rec -i $SRC/ping.mp3 -af "atrim=start=0.318,asetpts=PTS-STARTPTS,$FMT" "$TMP/ping.wav"
i=0; for n in 0 2 4 7 9 12 14 16; do
    i=$((i+1)); f=$(awk -v n="$n" 'BEGIN{printf "%.5f", 2^(n/12)}')
    rec -i "$TMP/ping.wav" -af "asetrate=48000*$f,aresample=48000,atrim=0:0.45,afade=t=out:st=0.3:d=0.15" "$TMP/n$i.wav"
    fin "ping-note$i" "$TMP/n$i.wav"
done

# 1.3 teclas sueltas desde typing.mp3: atrim por golpe medido (NO -ss: -ss cuenta desde start_time=0.025 del contenedor y desplaza la tecla)
i=0; for g in 0.455 0.547 0.613 0.719 0.8 0.961 1.172 1.36; do
    i=$((i+1)); t=$(awk -v g="$g" 'BEGIN{printf "%.3f", g-0.006}')
    rec -i $SRC/typing.mp3 -af "atrim=start=$t:duration=0.11,asetpts=PTS-STARTPTS,afade=t=out:st=0.08:d=0.03,$FMT" "$TMP/k$i.wav"
    fin "key-$i" "$TMP/k$i.wav"
done
rec -i $SRC/key-press.mp3 -af "atrim=start=0.066,asetpts=PTS-STARTPTS,$FMT" "$TMP/enter.wav"; fin key-enter "$TMP/enter.wav"
rec -i "$OUT/key-3.wav" -af "asetrate=48000*0.8,aresample=48000" "$TMP/back.wav"; fin key-back "$TMP/back.wav"

# 1.4 chime / error / notification sin la cola muda del inicio y con cola que se apaga (no se corta en seco)
rec -i $SRC/chime.mp3 -af "atrim=start=0.412:end=2.2,asetpts=PTS-STARTPTS,afade=t=out:st=1.0:d=0.8,$FMT" "$TMP/chime.wav"; fin chime-trim "$TMP/chime.wav"
rec -i $SRC/error.mp3 -af "atrim=start=0.60,asetpts=PTS-STARTPTS,$FMT" "$TMP/err.wav"; fin error-trim "$TMP/err.wav"
rec -i $SRC/notification.mp3 -af "atrim=start=0.082:end=2.0,asetpts=PTS-STARTPTS,afade=t=out:st=1.3:d=0.7,$FMT" "$TMP/not.wav"; fin notification-trim "$TMP/not.wav"

# 1.5 clicks: click.mp3 y click-soft.mp3 son el MISMO archivo; se derivan voces distintas
rec -i $SRC/click.mp3 -af "atrim=start=0.044:end=0.20,asetpts=PTS-STARTPTS,$FMT" "$TMP/c.wav"
fin click-hard "$TMP/c.wav"
rec -i "$TMP/c.wav" -af "lowpass=f=3200,atrim=0:0.12,afade=t=out:st=0.08:d=0.04" "$TMP/cs.wav"; fin click-soft2 "$TMP/cs.wav"
# tick (un solo uso, grave y seco, 90 ms) y tap (toque mate de interfaz, 80 ms): sintetizados para que el golpe quede en t ~ 0
rec -f lavfi -i "aevalsrc='(sin(2*PI*700*t)+0.4*sin(2*PI*1680*t)*exp(-t*50))*exp(-t*55)':d=0.09:s=48000" -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-t*400)|(random(1)*2-1)*exp(-t*400)':d=0.09:s=48000" \
    -filter_complex "[1]highpass=f=2500[n];[0][n]amix=inputs=2:weights=1 0.4:normalize=0,afade=t=in:d=0.0006,$FMT" "$TMP/tp.wav"; fin tick "$TMP/tp.wav"
rec -f lavfi -i "aevalsrc='sin(2*PI*(150*t+9*(1-exp(-30*t))))*exp(-t*45)':d=0.08:s=48000" -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-t*300)|(random(1)*2-1)*exp(-t*300)':d=0.08:s=48000" \
    -filter_complex "[1]lowpass=f=2200[n];[0][n]amix=inputs=2:weights=1 0.5:normalize=0,afade=t=in:d=0.0008,$FMT" "$TMP/tap.wav"; fin tap "$TMP/tap.wav"

# 1.6 whoosh: whoosh.mp3 y whoosh-short.mp3 son identicos. Corto (cortes), medio, largo/grave (push-slides) e invertido (swell hacia el corte)
rec -i $SRC/whoosh.mp3 -af "atrim=start=0.06:end=0.34,asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=0.18:d=0.1,$FMT" "$TMP/w.wav"; fin whoosh-s "$TMP/w.wav"
rec -i $SRC/whoosh.mp3 -af "asetrate=48000*0.88,aresample=48000,atrim=start=0.05:end=0.52,asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=0.28:d=0.19,$FMT" "$TMP/w.wav"; fin whoosh-m "$TMP/w.wav"
rec -i $SRC/whoosh.mp3 -af "asetrate=48000*0.72,aresample=48000,atrim=start=0.06,asetpts=PTS-STARTPTS,aecho=0.6:0.5:60:0.25,afade=t=out:st=0.55:d=0.25,$FMT" "$TMP/w.wav"; fin whoosh-l "$TMP/w.wav"
rec -i $SRC/whoosh.mp3 -af "atrim=start=0.06:end=0.34,asetpts=PTS-STARTPTS,areverse,$FMT" "$TMP/w.wav"; fin whoosh-rev "$TMP/w.wav"

# 1.7 impacto: el original es un drone de sub-graves (2.1-2.6 s a -3 dBFS RMS). Se acorta a un golpe con decaimiento exponencial (<= 0.9 s)
rec -i $SRC/impact-bass-1.mp3 -af "atrim=start=0.041:end=0.9,asetpts=PTS-STARTPTS,afade=t=out:st=0.10:d=0.76:curve=exp,$FMT" "$TMP/i.wav"; fin impact-hit "$TMP/i.wav"
rec -i $SRC/impact-bass-2.mp3 -af "atrim=start=0.018:end=0.7,asetpts=PTS-STARTPTS,highpass=f=70,afade=t=out:st=0.08:d=0.6:curve=exp,$FMT" "$TMP/i.wav"; fin impact-lite "$TMP/i.wav"

# 1.8 sparkle corto (1.8 s es excesivo para un destello de 0.2 s en pantalla)
rec -i $SRC/sparkle.mp3 -af "atrim=start=0.02:end=0.9,asetpts=PTS-STARTPTS,afade=t=out:st=0.45:d=0.45,$FMT" "$TMP/s.wav"; fin sparkle-short "$TMP/s.wav"

# ------------------------------------------------------------------ 2. sintetizados (hoy no existen en la biblioteca)
# Notas de sintesis: el ruido sale de aevalsrc (random(k)) con su envolvente DENTRO de la expresion: con `volume=...:eval=frame` la ganancia
# se actualiza por bloque de 1024 muestras (21 ms) y no sirve para ataques de 3-10 ms. random(0)/random(1) = dos canales distintos (estereo).
# riser REAL: el original es silencio (-118 dBFS). Ruido rosa-ish filtrado con modulacion de amplitud que se acelera + barrido 180->1700 Hz,
# ganancia creciente (t^3); el PICO queda en t = 1.0 s (ancla) y se corta en seco para que el impacto lo reemplace.
rec -f lavfi -i "aevalsrc='(random(0)*2-1)*min(1,pow(t/1.0,3))*(0.65+0.35*sin(2*PI*(5*t+13*t*t)))|(random(1)*2-1)*min(1,pow(t/1.0,3))*(0.65+0.35*sin(2*PI*(5*t+13*t*t)))':d=1.05:s=48000" \
    -f lavfi -i "aevalsrc='sin(2*PI*(180*t+760*t*t))*min(1,pow(t/1.0,2.2))':d=1.05:s=48000" \
    -filter_complex "[0]highpass=f=500,lowpass=f=7000[n];[n][1]amix=inputs=2:weights=1 0.7:normalize=0,atrim=0:1.0,afade=t=out:st=0.985:d=0.015,$FMT" "$TMP/r.wav"
fin riser-1s "$TMP/r.wav" 0
# riser corto (0.6 s) para subidas rapidas; mismo diseno con el tiempo comprimido
rec -f lavfi -i "aevalsrc='(random(0)*2-1)*min(1,pow(t/0.6,3))*(0.7+0.3*sin(2*PI*(8*t+22*t*t)))|(random(1)*2-1)*min(1,pow(t/0.6,3))*(0.7+0.3*sin(2*PI*(8*t+22*t*t)))':d=0.65:s=48000" \
    -f lavfi -i "aevalsrc='sin(2*PI*(260*t+1700*t*t))*min(1,pow(t/0.6,2.2))':d=0.65:s=48000" \
    -filter_complex "[0]highpass=f=600,lowpass=f=8000[n];[n][1]amix=inputs=2:weights=1 0.7:normalize=0,atrim=0:0.6,afade=t=out:st=0.59:d=0.01,$FMT" "$TMP/r.wav"
fin riser-s "$TMP/r.wav" 0

# check: dos notas sinusoidales 880 -> 1320 Hz (trazo de la palomita / "confirmado")
rec -f lavfi -i "aevalsrc='(lt(t,0.07))*sin(2*PI*880*t)*exp(-6*t)+(gte(t,0.07))*sin(2*PI*1320*t)*exp(-9*(t-0.07))':d=0.35:s=48000" -af "afade=t=in:d=0.001,$FMT" "$TMP/x.wav"; fin check "$TMP/x.wav"
# draw: rafaga de ruido filtrado con ataque instantaneo y cola exponencial (anillos / lineas SVG que se dibujan)
rec -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-t*14)|(random(1)*2-1)*exp(-t*14)':d=0.4:s=48000" -af "bandpass=f=2600:width_type=h:w=2200,afade=t=in:d=0.004,$FMT" "$TMP/x.wav"; fin draw "$TMP/x.wav"
# fill: murmullo grave de liquido que sube (tanques); el volumen crece hasta el final
rec -f lavfi -i "anoisesrc=d=1.2:c=brown:r=48000:a=0.9:seed=24" -af "bandpass=f=420:width_type=h:w=380,tremolo=f=13:d=0.55,volume='0.25+0.75*min(1,t/1.0)':eval=frame,afade=t=in:d=0.006,afade=t=out:st=1.0:d=0.2,$FMT" "$TMP/x.wav"; fin fill "$TMP/x.wav"
# scan: barrido fino y agudo de escaneo (linea que recorre la camara): chirp 2.5 -> 6.5 kHz con ataque de 3 ms + aire de ruido agudo
rec -f lavfi -i "aevalsrc='sin(2*PI*(2500*t+11000*t*t))*exp(-t*14)':d=0.2:s=48000" -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-t*25)|(random(1)*2-1)*exp(-t*25)':d=0.2:s=48000" \
    -filter_complex "[1]highpass=f=4500[n];[0][n]amix=inputs=2:weights=1 0.4:normalize=0,afade=t=in:d=0.003,afade=t=out:st=0.12:d=0.08,$FMT" "$TMP/x.wav"; fin scan "$TMP/x.wav"
# soft-in: entrada suave de panel/tarjeta: soplo grave de ruido (< 1.6 kHz) con ataque de 5 ms y decaimiento de 0.3 s, muy bajo
rec -f lavfi -i "aevalsrc='(random(0)*2-1)*(1-exp(-t*600))*exp(-t*10)|(random(1)*2-1)*(1-exp(-t*600))*exp(-t*10)':d=0.4:s=48000" \
    -af "lowpass=f=1600,highpass=f=150,afade=t=out:st=0.28:d=0.12,$FMT" "$TMP/x.wav"; fin soft-in "$TMP/x.wav"

# snap: golpe seco corto para el snap-zoom de camara = golpe grave que cae de tono (250 -> 60 Hz) + clic de ruido de 12 ms
rec -f lavfi -i "aevalsrc='sin(2*PI*(60*t+5*(1-exp(-50*t))))*exp(-t*26)':d=0.16:s=48000" \
    -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-t*220)|(random(1)*2-1)*exp(-t*220)':d=0.16:s=48000" \
    -filter_complex "[1]highpass=f=1800[c];[0][c]amix=inputs=2:weights=1 0.6:normalize=0,afade=t=in:d=0.0008,$FMT" "$TMP/x.wav"; fin snap "$TMP/x.wav"
# thud: golpe grave y corto (sin cola de drone): seno 140 -> 48 Hz con decaimiento rapido
rec -f lavfi -i "aevalsrc='sin(2*PI*(48*t+4.5*(1-exp(-20*t))))*exp(-t*9)':d=0.45:s=48000" -af "afade=t=in:d=0.0015,lowpass=f=420,$FMT" "$TMP/x.wav"; fin thud "$TMP/x.wav"
# stamp: sello = golpe mate (seno 150 -> 70 Hz, 90 ms) + palmada de ruido en banda media (1.3 kHz)
rec -f lavfi -i "aevalsrc='sin(2*PI*(70*t+3.2*(1-exp(-40*t))))*exp(-t*22)':d=0.3:s=48000" \
    -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-t*70)|(random(1)*2-1)*exp(-t*70)':d=0.3:s=48000" \
    -filter_complex "[1]bandpass=f=1300:width_type=h:w=1500[c];[0][c]amix=inputs=2:weights=1 0.7:normalize=0,afade=t=in:d=0.0008,$FMT" "$TMP/x.wav"; fin stamp "$TMP/x.wav"
# flash (OBSOLETO, ver flash-soft): destello = rafaga brillante de ruido agudo + tintineo de 3.2 kHz que se apaga
rec -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-t*30)|(random(1)*2-1)*exp(-t*30)':d=0.5:s=48000" \
    -f lavfi -i "aevalsrc='(sin(2*PI*3200*t)+0.5*sin(2*PI*4800*t))*exp(-t*14)':d=0.5:s=48000" \
    -filter_complex "[0]highpass=f=4500[n];[n][1]amix=inputs=2:weights=0.9 0.5:normalize=0,afade=t=in:d=0.0008,afade=t=out:st=0.3:d=0.2,$FMT" "$TMP/x.wav"; fin flash "$TMP/x.wav"
# flash-soft: sustituye a flash en el corte con destello crema (06 -> 07). flash (rafaga de ruido > 4.5 kHz + tintineo de 3.2 kHz, centroide ~9 kHz, casi toda la
# energia por encima de 9 kHz) era el momento mas agudo y aspero del video y el ultimo resto del "brillito" retirado. Esta variante es un golpe seco corto con cuerpo:
#   - cuerpo: seno que cae de ~92 a ~78 Hz con decaimiento rapido (30/s), el peso del corte;
#   - aire: ruido en banda media (1.5 kHz, ancho 2.2 kHz) con dos lowpass de 4.2 kHz y decaimiento de 55/s: el "pff" del destello, sin tintineo ni energia > 9 kHz;
#   - ataque de 0.8 ms (el golpe cae en los primeros 5 ms: ancla del catalogo <= 10 ms) y cierre de 50 ms.
# Se distingue de snap (clic > 1.8 kHz sobre un golpe de 60 Hz, usado en 01/03/05/06/10) por el aire de banda media y el cuerpo mas alto.
rec -f lavfi -i "aevalsrc='sin(2*PI*(78*t+14*(1-exp(-45*t))))*exp(-t*30)':d=0.22:s=48000" \
    -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-t*55)|(random(1)*2-1)*exp(-t*55)':d=0.22:s=48000" \
    -filter_complex "[1]bandpass=f=1500:width_type=h:w=2200,lowpass=f=4200,lowpass=f=4200[n];[0][n]amix=inputs=2:weights=1 0.55:normalize=0,afade=t=in:d=0.0008,afade=t=out:st=0.17:d=0.05,$FMT" "$TMP/x.wav"; fin flash-soft "$TMP/x.wav"
# swipe: barrido estereo rapido (700 -> 1900 -> 4800 Hz en 0.2 s) para un whip / paneo; el PICO (ancla) cae hacia 0.1 s
G='exp(-pow((t-0.04)/0.045,2))'; H='exp(-pow((t-0.10)/0.045,2))'; J='exp(-pow((t-0.17)/0.045,2))'
rec -f lavfi -i "aevalsrc='(random(0)*2-1)*$G|(random(1)*2-1)*$G':d=0.3:s=48000" -f lavfi -i "aevalsrc='(random(2)*2-1)*$H|(random(3)*2-1)*$H':d=0.3:s=48000" -f lavfi -i "aevalsrc='(random(4)*2-1)*$J|(random(5)*2-1)*$J':d=0.3:s=48000" \
    -filter_complex "[0]bandpass=f=700:width_type=h:w=500[a];[1]bandpass=f=1900:width_type=h:w=1200[b];[2]bandpass=f=4800:width_type=h:w=3000[c];[a][b][c]amix=inputs=3:weights=1 0.9 0.35:normalize=0,afade=t=in:d=0.006,afade=t=out:st=0.2:d=0.1,$FMT" "$TMP/x.wav"; fin swipe "$TMP/x.wav"
# zoom-in: barrido ascendente 380 -> 1900 Hz con ruido que crece; el PICO (ancla) esta casi al final (el empuje llega a su escala)
rec -f lavfi -i "aevalsrc='sin(2*PI*(380*t+2200*t*t))*pow(min(1,t/0.34),2)*0.7':d=0.4:s=48000" \
    -f lavfi -i "aevalsrc='(random(0)*2-1)*pow(min(1,t/0.34),2.4)|(random(1)*2-1)*pow(min(1,t/0.34),2.4)':d=0.4:s=48000" \
    -filter_complex "[1]highpass=f=900,lowpass=f=6000[n];[0][n]amix=inputs=2:normalize=0,atrim=0:0.36,afade=t=out:st=0.34:d=0.02,$FMT" "$TMP/x.wav"; fin zoom-in "$TMP/x.wav" 0
# zoom-out: barrido descendente 1900 -> 380 Hz con ataque inmediato y cola corta (el tiron de camara hacia atras)
rec -f lavfi -i "aevalsrc='sin(2*PI*(1900*t-2600*t*t))*exp(-t*7)':d=0.4:s=48000" \
    -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-t*9)|(random(1)*2-1)*exp(-t*9)':d=0.4:s=48000" \
    -filter_complex "[1]highpass=f=900,lowpass=f=5000[n];[0][n]amix=inputs=2:weights=1 0.7:normalize=0,afade=t=in:d=0.0015,afade=t=out:st=0.28:d=0.12,$FMT" "$TMP/x.wav"; fin zoom-out "$TMP/x.wav"
# blip: aviso de interfaz (seno 1760 Hz + armonico), 90 ms
rec -f lavfi -i "aevalsrc='(sin(2*PI*1760*t)+0.3*sin(2*PI*3520*t))*exp(-t*38)':d=0.12:s=48000" -af "afade=t=in:d=0.0008,$FMT" "$TMP/x.wav"; fin blip "$TMP/x.wav"
# type-enter: Enter de teclado = clic agudo + golpe de tecla grave 45 ms despues
rec -f lavfi -i "aevalsrc='(lt(t,0.045))*sin(2*PI*2400*t)*exp(-t*90)+(gte(t,0.045))*sin(2*PI*130*(t-0.045))*exp(-(t-0.045)*38)':d=0.25:s=48000" \
    -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-t*250)|(random(1)*2-1)*exp(-t*250)':d=0.25:s=48000" \
    -filter_complex "[1]highpass=f=2500[n];[0][n]amix=inputs=2:weights=1 0.6:normalize=0,afade=t=in:d=0.0008,$FMT" "$TMP/x.wav"; fin type-enter "$TMP/x.wav"
# lock: candado que cierra = clic metalico (3 kHz) + golpe grave 70 ms despues
rec -f lavfi -i "aevalsrc='(lt(t,0.07))*sin(2*PI*3100*t)*exp(-t*110)*0.8+(gte(t,0.07))*sin(2*PI*(95*(t-0.07)+1.5*(1-exp(-30*(t-0.07)))))*exp(-(t-0.07)*20)':d=0.35:s=48000" \
    -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-t*300)|(random(1)*2-1)*exp(-t*300)':d=0.35:s=48000" \
    -filter_complex "[1]bandpass=f=3500:width_type=h:w=3000[n];[0][n]amix=inputs=2:weights=1 0.5:normalize=0,afade=t=in:d=0.0008,$FMT" "$TMP/x.wav"; fin lock "$TMP/x.wav"
# shutter: obturador de camara = dos clics separados 55 ms (cuadro 5: bloqueo de rostros)
rec -f lavfi -i "aevalsrc='(random(0)*2-1)*(exp(-t*190)+0.8*gte(t,0.055)*exp(-(t-0.055)*150))|(random(1)*2-1)*(exp(-t*190)+0.8*gte(t,0.055)*exp(-(t-0.055)*150))':d=0.25:s=48000" \
    -af "bandpass=f=2800:width_type=h:w=2600,afade=t=in:d=0.0008,$FMT" "$TMP/x.wav"; fin shutter "$TMP/x.wav"
# tick-1..4: contador con alturas crecientes (1000 -> 2000 Hz, tipo bloque de madera) 70 ms; el ultimo es el acento
i=0; for f in 1000 1260 1587 2000; do
    i=$((i+1))
    rec -f lavfi -i "aevalsrc='(sin(2*PI*$f*t)+0.35*sin(2*PI*$f*2.4*t)*exp(-t*60))*exp(-t*85)':d=0.07:s=48000" \
        -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-t*500)|(random(1)*2-1)*exp(-t*500)':d=0.07:s=48000" \
        -filter_complex "[1]highpass=f=3000[n];[0][n]amix=inputs=2:weights=1 0.4:normalize=0,afade=t=in:d=0.0006,$FMT" "$TMP/x.wav"
    fin "tick-$i" "$TMP/x.wav"
done

# sheen / sheen-s: barrido de luz (la banda brillante que cruza SUSAN, la pastilla, los escudos) y destello pequeno. Sustituyen a sparkle-short,
# que venia de un sparkle de libreria (campanitas de varita magica, centroide ~5 kHz, 15 dB de energia por encima de 9 kHz) y se oia generico y aspero.
# Receta (un canal; el estereo son DOS canales con semillas distintas, que da anchura sin chorus ni fase):
#   - ruido ROSA (anoisesrc, semilla fija = determinista) filtrado en N bandas (bandpass Q 3.5, de 2 polos) cuyas frecuencias suben en progresion geometrica
#     de F0 a F1; cada banda se enciende con una ventana gaussiana en el instante que le toca (amultiply), de modo que el centro del barrido
#     sube de forma continua (en ffmpeg un bandpass no puede cambiar de frecuencia en el tiempo; asi se obtiene el barrido sin saltos);
#   - dos lowpass de 2 polos (24 dB/oct) a 5.2 kHz: nada de siseo por encima de ~9 kHz (se mide en la verificacion, < -35 dB);
#   - un leve cuerpo tonal: UNA sinusoide limpia (una quinta sobre la nota base) con ventana gaussiana centrada donde el barrido pasa por su altura,
#     por lo que se funde con el barrido en vez de sonar como un tono aparte; sin armonicos;
#   - envolvente global: ataque de 8 ms (smoothstep, sin chasquido) hasta ~60 % del maximo (asi el golpe de energia cae en los primeros 10 ms y el
#     ancla del catalogo es la del 'hit'), crecimiento suave hasta el maximo en ~0.12 s y caida exponencial natural; fundido final de 50 ms.
# sheen_canal semilla salida dur f0 f1 barrido nbandas ancho_gauss tono gan_tono env t_tono ancho_tono lp q comp
sheen_canal() {
    local seed=$1 out=$2 dur=$3 f0=$4 f1=$5 sweep=$6 nb=$7 wg=$8 tono=$9 gt=${10} env=${11} tt=${12} wt=${13} lp=${14} q=${15} ce=${16}
    local -a ins=()
    local fc="" mix="" i f tc g
    for ((i = 0; i < nb; i++)); do
        # frecuencia de la banda i, instante en que se enciende y compensacion de nivel (f/f0)^comp: sin ella el barrido se oye "apagado" hacia arriba
        read -r f tc g < <(awk -v i="$i" -v nb="$nb" -v f0="$f0" -v f1="$f1" -v sw="$sweep" -v ce="$ce" 'BEGIN{r=(i/(nb-1)); f=f0*(f1/f0)^r; printf "%.1f %.4f %.3f\n", f, sw*r, (f/f0)^ce}')
        ins+=(-f lavfi -i "anoisesrc=d=$dur:c=pink:r=48000:a=0.5:seed=$((seed * 10 + i))")
        ins+=(-f lavfi -i "aevalsrc='$g*exp(-pow((t-$tc)/$wg,2))':d=$dur:s=48000")
        fc+="[$((2 * i))]bandpass=f=$f:width_type=q:w=$q[b$i];[b$i][$((2 * i + 1))]amultiply[m$i];"
        mix+="[m$i]"
    done
    ins+=(-f lavfi -i "aevalsrc='$gt*exp(-pow((t-$tt)/$wt,2))*sin(2*PI*$tono*t)':d=$dur:s=48000")
    ins+=(-f lavfi -i "aevalsrc='$env':d=$dur:s=48000")
    fc+="${mix}amix=inputs=$nb:normalize=0,lowpass=f=$lp,lowpass=f=$lp[ruido];[ruido][$((2 * nb))]amix=inputs=2:normalize=0[suma];"
    fc+="[suma][$((2 * nb + 1))]amultiply,afade=t=out:st=$(awk -v d="$dur" 'BEGIN{printf "%.3f", d-0.05}'):d=0.05[o]"
    rec "${ins[@]}" -filter_complex "$fc" -map "[o]" -ac 1 "$out"
}
# sheen: 0.44 s, barrido 700 -> 3500 Hz en 0.40 s (9 bandas, ventanas de 45 ms, compensacion +0.55 de exponente), quinta de D6 (1174.7 Hz) muy baja
ENV_SHEEN='pow(min(1,t/0.008),2)*(3-2*min(1,t/0.008))*(0.6+0.4*pow(min(1,t/0.16),1.5))*if(lt(t,0.16),1,exp(-(t-0.16)*8))'
sheen_canal 1 "$TMP/sh-l.wav" 0.44 700 3500 0.40 9 0.045 1174.7 0.010 "$ENV_SHEEN" 0.13 0.09 5200 3.5 0.55
sheen_canal 2 "$TMP/sh-r.wav" 0.44 700 3500 0.40 9 0.045 1174.7 0.010 "$ENV_SHEEN" 0.13 0.09 5200 3.5 0.55
rec -i "$TMP/sh-l.wav" -i "$TMP/sh-r.wav" -filter_complex "[0][1]amerge=inputs=2,$FMT" "$TMP/x.wav"; fin sheen "$TMP/x.wav" 0
# sheen-s: 0.26 s para destellos pequenos, mas rapido: barrido 800 -> 3200 Hz en 0.17 s (7 bandas), quinta de G6 (1568 Hz)
ENV_SHEEN_S='pow(min(1,t/0.006),2)*(3-2*min(1,t/0.006))*(0.6+0.4*pow(min(1,t/0.09),1.5))*if(lt(t,0.09),1,exp(-(t-0.09)*14))'
sheen_canal 3 "$TMP/ss-l.wav" 0.26 800 3200 0.17 7 0.03 1568 0.008 "$ENV_SHEEN_S" 0.08 0.06 4800 3.5 0.55
sheen_canal 4 "$TMP/ss-r.wav" 0.26 800 3200 0.17 7 0.03 1568 0.008 "$ENV_SHEEN_S" 0.08 0.06 4800 3.5 0.55
rec -i "$TMP/ss-l.wav" -i "$TMP/ss-r.wav" -filter_complex "[0][1]amerge=inputs=2,$FMT" "$TMP/x.wav"; fin sheen-s "$TMP/x.wav" 0

# ------------------------------------------------------------------ 3. medicion, catalogo y envolventes
node scripts/analyze-sfx.mjs --dir "$OUT" --out "$OUT/sfx-meta.json" --png "$OUT/_envolventes.png" > "$TMP/analisis.txt"
node scripts/build-sfx-catalog.mjs
node scripts/verify-sfx.mjs --solo biblioteca
echo "derive-sfx: $(ls -1 "$OUT"/*.wav | wc -l | tr -d ' ') archivos en $OUT"
