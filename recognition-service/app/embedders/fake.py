"""Embedder determinista y SIN modelos, para pruebas y demos.

Como se "detecta" una cara de forma reproducible: una cara sintetica es un cuadrado con marco magenta de 4 px
(255, 0, 255) cuyo interior es un color plano que codifica una semilla de 12 bits (3 canales x 4 bits; cada
canal vale 64 + 8*n, n en 0..15, asi tolera la compresion JPEG). El embedding sale de un hash de la semilla:
la misma semilla da el mismo vector y semillas distintas dan vectores casi ortogonales (coseno ~ 0).
Use `render_fake_image` para fabricar imagenes de prueba.
"""
from __future__ import annotations

import hashlib

import numpy as np

from app.embedders.base import DetectedFace, Embedder

FRAME = 4
MIN_SIDE = 24  # lado minimo (px) para considerar un cuadrado como cara


def seed_to_color(seed: int) -> tuple[int, int, int]:
    if not 0 <= seed < 4096:
        raise ValueError('La semilla debe estar en 0..4095')
    return (64 + 8 * ((seed >> 8) & 15), 64 + 8 * ((seed >> 4) & 15), 64 + 8 * (seed & 15))


def color_to_seed(rgb) -> int:
    n = [int(np.clip(round((int(c) - 64) / 8), 0, 15)) for c in rgb]
    return (n[0] << 8) | (n[1] << 4) | n[2]


def seed_to_vector(seed: int, dimension: int) -> np.ndarray:
    digest = hashlib.sha256(f'susan-fake-face:{seed}'.encode()).digest()
    rng = np.random.default_rng(int.from_bytes(digest[:8], 'little'))
    v = rng.standard_normal(dimension).astype(np.float32)
    return (v / np.linalg.norm(v)).astype(np.float32)


def render_fake_image(width: int, height: int, faces: list[tuple[int, int, int, int]], background: int = 128) -> np.ndarray:
    """faces: [(semilla, x, y, lado)]. Fondo gris con ruido suave y reproducible."""
    img = np.full((height, width, 3), background, dtype=np.uint8)
    noise = np.random.default_rng(7).integers(-6, 7, size=(height, width, 1))
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    for seed, x, y, side in faces:
        img[y:y + side, x:x + side] = (255, 0, 255)
        img[y + FRAME:y + side - FRAME, x + FRAME:x + side - FRAME] = seed_to_color(seed)
    return img


def _components(mask: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Cajas de componentes conexos (4-vecinos) de la mascara; BFS solo sobre pixeles activos."""
    ys, xs = np.nonzero(mask)
    pendientes = set(zip(ys.tolist(), xs.tolist()))
    cajas = []
    while pendientes:
        inicio = pendientes.pop()
        pila = [inicio]
        y1 = y2 = inicio[0]
        x1 = x2 = inicio[1]
        while pila:
            y, x = pila.pop()
            y1, y2, x1, x2 = min(y1, y), max(y2, y), min(x1, x), max(x2, x)
            for v in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if v in pendientes:
                    pendientes.discard(v)
                    pila.append(v)
        cajas.append((x1, y1, x2 + 1, y2 + 1))
    return cajas


class FakeEmbedder(Embedder):
    name = 'fake'
    model_name = 'fake-hash'

    def __init__(self, dimension: int = 512):
        self.dimension = dimension

    # Ganchos para las pruebas: una subclase puede cambiar como se deriva el vector de la semilla o fijar una razon de
    # giro (el embedder fake no la mide: devuelve None y el modo de conjunto cae al booleano `frontal`).
    def vector_for(self, seed: int) -> np.ndarray:
        return seed_to_vector(seed, self.dimension)

    def yaw_ratio_for(self, seed: int) -> float | None:
        return None

    def detect(self, rgb: np.ndarray) -> list[DetectedFace]:
        r, g, b = (rgb[..., i].astype(np.int16) for i in range(3))
        mask = (r > 180) & (g < 80) & (b > 180)  # marco magenta (tolerante a JPEG)
        out = []
        for x1, y1, x2, y2 in sorted(_components(mask), key=lambda c: (c[1], c[0])):
            if (x2 - x1) < MIN_SIDE or (y2 - y1) < MIN_SIDE:
                continue  # ruido: no es un marco de cara
            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
            parche = rgb[cy - 1:cy + 2, cx - 1:cx + 2].reshape(-1, 3).mean(axis=0)
            seed = color_to_seed(parche)
            out.append(DetectedFace(
                bbox=(float(x1), float(y1), float(x2), float(y2)),
                det_score=0.99,
                embedding=self.vector_for(seed),
                frontal=True,
                yaw_ratio=self.yaw_ratio_for(seed),
            ))
        return out
