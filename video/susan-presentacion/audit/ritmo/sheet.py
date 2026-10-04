#!/usr/bin/env python3
"""Hoja de contactos con tiempo rotulado. Uso: sheet.py salida.jpg cols t1 t2 t3 ... (segundos absolutos)"""
import sys, subprocess, io, os
from PIL import Image, ImageDraw
out, cols, ts = sys.argv[1], int(sys.argv[2]), [float(x) for x in sys.argv[3:]]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
W, H = int(os.environ.get("SW", 480)), int(os.environ.get("SH", 270))
ims = []
for t in ts:
    b = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', f'{ROOT}/renders/video.mp4', '-frames:v', '1',
                        '-vf', f'scale={W}:{H}', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True).stdout
    im = Image.open(io.BytesIO(b)).convert('RGB'); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 62, 20], fill=(255, 255, 255)); d.text((4, 4), f'{t:.2f}s', fill=(220, 0, 0))
    ims.append(im)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * H), (40, 40, 40))
for i, im in enumerate(ims): sheet.paste(im, ((i % cols) * W, (i // cols) * H))
sheet.save(out, quality=82)
