"""Decodificacion segura de imagenes, recortes JPEG y metricas de calidad (RF-15). Solo Pillow + numpy."""
from __future__ import annotations

import io

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from app.errors import invalid_image


def decode_image(data: bytes, max_pixels: int) -> np.ndarray:
    """Devuelve uint8 (H, W, 3) RGB. Cualquier fallo se traduce en 422 INVALID_IMAGE."""
    if not data:
        raise invalid_image('La imagen esta vacia.')
    try:
        with Image.open(io.BytesIO(data)) as im:
            w, h = im.size
            # Se verifica el tamano ANTES de decodificar para frenar bombas de descompresion
            if w * h > max_pixels:
                raise invalid_image('La imagen excede el tamano permitido.')
            im = ImageOps.exif_transpose(im)
            im = im.convert('RGB')
            return np.asarray(im, dtype=np.uint8).copy()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, SyntaxError):
        raise invalid_image('No se pudo decodificar la imagen.') from None


def crop_jpeg(rgb: np.ndarray, bbox, margin: float = 0.2, quality: int = 85) -> bytes:
    h, w = rgb.shape[:2]
    x1, y1, x2, y2 = bbox
    mx, my = (x2 - x1) * margin, (y2 - y1) * margin
    a, b = max(0, int(x1 - mx)), max(0, int(y1 - my))
    c, d = min(w, int(x2 + mx)), min(h, int(y2 + my))
    if c <= a or d <= b:
        a, b, c, d = 0, 0, w, h
    buf = io.BytesIO()
    Image.fromarray(rgb[b:d, a:c]).save(buf, format='JPEG', quality=quality)
    return buf.getvalue()


def clip_bbox(bbox, width: int, height: int) -> list[int]:
    x1, y1, x2, y2 = bbox
    return [
        int(max(0, min(width, round(x1)))), int(max(0, min(height, round(y1)))),
        int(max(0, min(width, round(x2)))), int(max(0, min(height, round(y2)))),
    ]


def brightness(rgb: np.ndarray) -> float:
    """Luminancia media 0-255 (Rec. 601)."""
    return float((rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114).mean())


def sharpness(rgb: np.ndarray) -> float:
    """Varianza del laplaciano (nucleo 4-vecinos) sobre el gris: mayor = mas nitida."""
    g = (rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114).astype(np.float32)
    if g.shape[0] < 3 or g.shape[1] < 3:
        return 0.0
    lap = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    return float(lap.var())
