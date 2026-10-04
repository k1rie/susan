#!/usr/bin/env bash
# Deriva con ffmpeg una biblioteca ampliada y CORRECTA desde assets/sfx (sin tocar los originales). Salida: audit/sonido/derived/*.wav
# (WAV 48 kHz estéreo 16-bit: sin retardo de codificador y sin remuestreo en el render).
# Regla de la biblioteca v2: cada archivo empieza con su golpe a <= 5 ms del inicio de archivo (ancla ~ 0), así data-start = instante visual.
set -euo pipefail
cd "$(dirname "$0")/../.."
SRC=assets/sfx
OUT=audit/sonido/derived
mkdir -p "$OUT"
FMT="aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo"
pk() { # normaliza a pico -$3 dBFS  (uso: pk in.wav out.wav 6)
  local mx; mx=$(ffmpeg -hide_banner -i "$1" -af volumedetect -f null - 2>&1 | grep -o 'max_volume: [-0-9.]*' | grep -o '[-0-9.]*$')
  ffmpeg -v error -y -i "$1" -af "volume=$(python3 -c "print(round(-($mx)-$3,2))")dB" "$2"
}
rec() { ffmpeg -v error -y "$@"; }

# 1) pop recortado (el original tiene 115 ms de aire antes del golpe) + 4 variantes de tono (más corto cuanto más agudo)
rec -i $SRC/pop.mp3 -af "atrim=start=0.113,asetpts=PTS-STARTPTS,$FMT" $OUT/_pop.wav
i=0; for f in 0.84 1.0 1.19 1.41; do i=$((i+1)); rec -i $OUT/_pop.wav -af "asetrate=48000*$f,aresample=48000" $OUT/_pop$i.wav; pk $OUT/_pop$i.wav $OUT/pop-$i.wav 8; rm $OUT/_pop$i.wav; done

# 2) ping recortado (320 ms de silencio original) + escala pentatónica de 8 notas para los 8 brackets del cuadro 5 (0,2,4,7,9,12,14,16 semitonos)
rec -i $SRC/ping.mp3 -af "atrim=start=0.318,asetpts=PTS-STARTPTS,$FMT" $OUT/_ping.wav
i=0; for n in 0 2 4 7 9 12 14 16; do i=$((i+1)); f=$(python3 -c "print(round(2**($n/12),5))"); rec -i $OUT/_ping.wav -af "asetrate=48000*$f,aresample=48000,atrim=0:0.45,afade=t=out:st=0.3:d=0.15" $OUT/_ping$i.wav; pk $OUT/_ping$i.wav $OUT/ping-note$i.wav 10; rm $OUT/_ping$i.wav; done

# 3) teclas sueltas desde typing.mp3 (se usa atrim, NO -ss: -ss cuenta desde start_time=0.025 s del contenedor y desplazaría la tecla): una tecla por golpe medido (sfx-meta.json -> typing.golpes), 5 ms de pre-roll y 110 ms de cuerpo
i=0; for g in 0.455 0.547 0.613 0.719 0.8 0.961 1.172 1.36; do i=$((i+1)); t=$(python3 -c "print(round($g-0.006,3))"); rec -i $SRC/typing.mp3 -af "atrim=start=$t:duration=0.11,asetpts=PTS-STARTPTS,afade=t=out:st=0.08:d=0.03,$FMT" $OUT/_k$i.wav; pk $OUT/_k$i.wav $OUT/key-$i.wav 12; rm $OUT/_k$i.wav; done
rec -i $SRC/key-press.mp3 -af "atrim=start=0.066,asetpts=PTS-STARTPTS,$FMT" $OUT/_enter.wav; pk $OUT/_enter.wav $OUT/key-enter.wav 9; rm $OUT/_enter.wav

# 4) chime y error sin la cola muda del inicio (0.40 s y 0.60 s)
rec -i $SRC/chime.mp3 -af "atrim=start=0.412,asetpts=PTS-STARTPTS,afade=t=out:st=1.2:d=0.8,$FMT" $OUT/_chime.wav; pk $OUT/_chime.wav $OUT/chime-trim.wav 10; rm $OUT/_chime.wav
rec -i $SRC/error.mp3 -af "atrim=start=0.60,asetpts=PTS-STARTPTS,$FMT" $OUT/_err.wav; pk $OUT/_err.wav $OUT/error-trim.wav 12; rm $OUT/_err.wav
rec -i $SRC/notification.mp3 -af "atrim=start=0.082,asetpts=PTS-STARTPTS,afade=t=out:st=1.4:d=0.8,$FMT" $OUT/_n.wav; pk $OUT/_n.wav $OUT/notification-trim.wav 10; rm $OUT/_n.wav

# 5) clicks: click y click-soft son el MISMO archivo; se derivan 3 voces distintas (tick de contador, click suave, click seco)
rec -i $SRC/click.mp3 -af "atrim=start=0.044:end=0.20,asetpts=PTS-STARTPTS,$FMT" $OUT/_c.wav
pk $OUT/_c.wav $OUT/click-hard.wav 8
rec -i $OUT/_c.wav -af "lowpass=f=3200,volume=0.8,atrim=0:0.12,afade=t=out:st=0.08:d=0.04" $OUT/_cs.wav; pk $OUT/_cs.wav $OUT/click-soft2.wav 14; rm $OUT/_cs.wav
rec -i $OUT/_c.wav -af "asetrate=48000*1.6,aresample=48000,highpass=f=900,atrim=0:0.05,afade=t=out:st=0.03:d=0.02" $OUT/_t.wav; pk $OUT/_t.wav $OUT/tick.wav 16; rm $OUT/_t.wav $OUT/_c.wav

# 6) whoosh: whoosh.mp3 y whoosh-short.mp3 son idénticos; se derivan corto (para cortes), largo/grave (para push-slides) e invertido (swell que crece hacia el corte)
rec -i $SRC/whoosh.mp3 -af "atrim=start=0.06:end=0.34,asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=0.18:d=0.1,$FMT" $OUT/_w.wav; pk $OUT/_w.wav $OUT/whoosh-s.wav 9; rm $OUT/_w.wav
rec -i $SRC/whoosh.mp3 -af "asetrate=48000*0.72,aresample=48000,atrim=start=0.06,asetpts=PTS-STARTPTS,aecho=0.6:0.5:60:0.25,afade=t=out:st=0.55:d=0.25,$FMT" $OUT/_w.wav; pk $OUT/_w.wav $OUT/whoosh-l.wav 9; rm $OUT/_w.wav
rec -i $SRC/whoosh.mp3 -af "atrim=start=0.06:end=0.34,asetpts=PTS-STARTPTS,areverse,$FMT" $OUT/_w.wav; pk $OUT/_w.wav $OUT/whoosh-rev.wav 9; rm $OUT/_w.wav

# 7) impacto: el original es un drone de sub-graves a ~ -3 dBFS RMS durante 2.1-2.6 s. Se acorta a un golpe con decaimiento (impact-hit) y se hace un golpe ligero (impact-lite, sin sub)
rec -i $SRC/impact-bass-1.mp3 -af "atrim=start=0.03:end=0.9,asetpts=PTS-STARTPTS,afade=t=out:st=0.12:d=0.7:curve=exp,$FMT" $OUT/_i.wav; pk $OUT/_i.wav $OUT/impact-hit.wav 6; rm $OUT/_i.wav
rec -i $SRC/impact-bass-2.mp3 -af "atrim=start=0.015:end=0.7,asetpts=PTS-STARTPTS,highpass=f=70,afade=t=out:st=0.08:d=0.6:curve=exp,$FMT" $OUT/_i.wav; pk $OUT/_i.wav $OUT/impact-lite.wav 9; rm $OUT/_i.wav

# 8) riser NUEVO (el original es silencio a -118 dBFS): ruido rosa filtrado + barrido sinusoidal 180->1700 Hz, ganancia creciente; el PICO está en t = 1.000 s (ancla = 1.0) y se corta en seco para que el impacto lo reemplace
rec -f lavfi -i "anoisesrc=d=1.05:c=pink:r=48000:a=0.9" -f lavfi -i "aevalsrc='sin(2*PI*(180*t+760*t*t))':d=1.05:s=48000" \
  -filter_complex "[0]highpass=f=500,lowpass=f=7000,volume='min(1,pow(t/1.0,3))':eval=frame[n];[1]volume='min(1,pow(t/1.0,2.2))':eval=frame[s];[n][s]amix=inputs=2:normalize=0,atrim=0:1.0,afade=t=out:st=0.985:d=0.015,$FMT" $OUT/_r.wav
pk $OUT/_r.wav $OUT/riser-1s.wav 8; rm $OUT/_r.wav
# 9) sparkle más corto (1.8 s es excesivo para un destello de 0.2 s en pantalla)
rec -i $SRC/sparkle.mp3 -af "atrim=start=0.02:end=0.9,asetpts=PTS-STARTPTS,afade=t=out:st=0.45:d=0.45,$FMT" $OUT/_s.wav; pk $OUT/_s.wav $OUT/sparkle-short.wav 12; rm $OUT/_s.wav

# 10) sonidos que HOY NO EXISTEN en la biblioteca y que el video necesita (síntesis pura con ffmpeg lavfi, golpe en t ~ 0)
#  - check: dos notas sinusoidales 880 -> 1320 Hz (trazo de la palomita / "confirmado": cuadros 7, 8, 11)
rec -f lavfi -i "aevalsrc='(lt(t,0.07))*sin(2*PI*880*t)*exp(-6*t)+(gte(t,0.07))*sin(2*PI*1320*t)*exp(-9*(t-0.07))':d=0.35:s=48000" -af "$FMT" $OUT/_x.wav; pk $OUT/_x.wav $OUT/check.wav 10; rm $OUT/_x.wav
#  - draw: ráfaga de ruido filtrado con ataque instantáneo y decaimiento (anillos / líneas SVG que se dibujan: cuadros 2, 9, 11)
rec -f lavfi -i "anoisesrc=d=0.4:c=pink:r=48000:a=0.9" -af "bandpass=f=2600:width_type=h:w=2200,afade=t=in:d=0.004,afade=t=out:st=0.06:d=0.3:curve=exp,$FMT" $OUT/_x.wav; pk $OUT/_x.wav $OUT/draw.wav 14; rm $OUT/_x.wav
#  - fill: murmullo grave de líquido que sube (tanques de los cuadros 6 y 10): ruido marrón + trémolo + barrido de paso de banda por volumen
rec -f lavfi -i "anoisesrc=d=1.2:c=brown:r=48000:a=0.9" -af "bandpass=f=420:width_type=h:w=380,tremolo=f=13:d=0.55,volume='0.25+0.75*min(1,t/1.0)':eval=frame,afade=t=in:d=0.01,afade=t=out:st=1.0:d=0.2,$FMT" $OUT/_x.wav; pk $OUT/_x.wav $OUT/fill.wav 12; rm $OUT/_x.wav
#  - scan: barrido fino y agudo para la línea de escaneo de la cámara (cuadro 5): el whoosh original filtrado y subido de tono
rec -i $SRC/whoosh.mp3 -af "atrim=start=0.06:end=0.34,asetpts=PTS-STARTPTS,asetrate=48000*1.45,aresample=48000,highpass=f=2200,afade=t=out:st=0.14:d=0.06,$FMT" $OUT/_x.wav; pk $OUT/_x.wav $OUT/scan.wav 14; rm $OUT/_x.wav
#  - key-back: retroceso (corrección del cuadro 1, 5 borrados seguidos): tecla más grave y seca
rec -i $OUT/key-3.wav -af "asetrate=48000*0.8,aresample=48000" $OUT/_x.wav; pk $OUT/_x.wav $OUT/key-back.wav 14; rm $OUT/_x.wav
#  - soft-in: entrada suave de panel/tarjeta (los 10 "card enters" que hoy no suenan): whoosh grave, corto y muy bajo
rec -i $SRC/whoosh.mp3 -af "atrim=start=0.07:end=0.42,asetpts=PTS-STARTPTS,asetrate=48000*0.7,aresample=48000,lowpass=f=1800,afade=t=in:d=0.02,afade=t=out:st=0.2:d=0.1,$FMT" $OUT/_x.wav; pk $OUT/_x.wav $OUT/soft-in.wav 16; rm $OUT/_x.wav
rm -f $OUT/_*.wav
ls -1 $OUT | grep -c wav
