# Video de presentación de SUSAN

Proyecto de [HyperFrames](https://github.com/heygen-com/hyperframes) (HTML → MP4). Presenta la app en 56 s, 1920×1080 a 30 fps, **solo con efectos de sonido** (sin voz ni música).

- `susan-presentacion/STORYBOARD.md` — guion gráfico de 12 cuadros con sus escenas, tiempos y señales de sonido (`sfx:`).
- `susan-presentacion/compositions/frames/NN-*.html` — un archivo por cuadro (la interfaz de SUSAN recreada en HTML/CSS con sus tokens reales).
- `susan-presentacion/frame.md` — sistema de diseño del video y kit de recreación de la interfaz.
- `susan-presentacion/assets/` — tipografías (Hanken Grotesk, EB Garamond, Geist Mono), escudos UNACH/FCA y efectos de sonido (biblioteca incluida en media-use, licencia Pixabay; ver `assets/sfx/CREDITS.md`).
- `susan-presentacion/scripts/mount-sfx.mjs` — monta los efectos de sonido en `index.html` a partir de las líneas `sfx:` del storyboard (idempotente).

## Volver a renderizar

```bash
cd video/susan-presentacion
npx hyperframes@0.8.114 check      # lint + runtime + layout + movimiento + contraste
npx hyperframes@0.8.114 render --quality high --output renders/video.mp4
```

Si cambias el storyboard o un cuadro: reensambla con `node ~/.claude/skills/product-launch-video/scripts/assemble-index.mjs --storyboard ./STORYBOARD.md --hyperframes .`, inyecta las transiciones con `transitions.mjs inject` y vuelve a correr `node scripts/mount-sfx.mjs`.

## Locución (ElevenLabs)

El video tiene una versión narrada: `susan-presentacion/renders/video-v3-voz.mp4` (16 frases en español, voz «Antonio - Confident, Gentle and Clear» de la biblioteca de ElevenLabs; requiere plan de pago para usarla por API).

- `susan-presentacion/v2/voz-guion.json` — el guion: cada línea trae su palabra ancla y el segundo del video en que debe caer (impactos, clics, cruces de la gráfica...), la velocidad opcional y los parámetros de mezcla (volumen de la voz y atenuación de los efectos mientras habla).
- `susan-presentacion/scripts/generar-voz.mjs` — genera cada línea con `/text-to-speech/<voz>/with-timestamps`, normaliza la sonoridad con ffmpeg y guarda `assets/voz/NN.wav` y `v2/voz-alineacion.json`. La clave se lee de `susan-presentacion/.env` (`ELEVENLABS_API_KEY`, ignorado por Git); las líneas ya generadas se reutilizan de `v2/voz-cache/` (no gastan créditos).
- `susan-presentacion/scripts/mount-voz.mjs` — coloca cada línea (`data-start` = segundo de la ancla − instante de la palabra en el clip), comprueba que no se pisen y baja los efectos que solapan una frase (idempotente).

Orden del pipeline (la voz va al final porque `build-index` y `mount-sfx` reescriben `index.html`): `build-index → extract-events --cues → mount-sfx → mount-voz → render`.
Nota: «Susan» va en minúsculas en el guion porque en mayúsculas el modelo la deletrea.

**Versión definitiva:** `susan-presentacion/renders/video-v3-voz.mp4` (50.75 s, voz + efectos, sin música, −17.1 LUFS).
