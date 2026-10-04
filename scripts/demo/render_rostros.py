"""Dibuja los rostros sintéticos de la demostración (solo modo local, EMBEDDER=fake).

Lo invoca scripts/demo/seed-demo.mjs con el Python del venv de recognition-service. Lee de la entrada estándar un
JSON {"imagenes": [{"destino": "/ruta/absoluta.jpg", "semilla": 123, "tipo": "registro" | "recorte"},
{"destino": "...", "semillas": [1, 2, 3], "tipo": "cuadro"}]} y escribe un JPEG por cada entrada (crea las carpetas; no pisa un archivo existente salvo "sobrescribir": true).
Responde por la salida estándar con {"escritas": n, "omitidas": n}.

Reutiliza el código del propio servicio (app.embedders.fake) para el color de la semilla y el grosor del marco, de modo
que la imagen sea, por construcción, lo que el detector espera. Por qué el ruido del interior en las fotos de registro:
la verificación de calidad (RF-15) exige nitidez (varianza del laplaciano) y un interior plano la da casi en cero para
ciertas semillas; un tablero de ajedrez de +-4 niveles la sube por encima de 100 sin mover el color que el detector lee (promedio 3x3
redondeado al escalón de 8).
"""
from __future__ import annotations

import io
import json
import math
import os
import sys

import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
sys.path.insert(0, os.path.join(RAIZ, 'recognition-service'))

from app.embedders.fake import FRAME, seed_to_color  # noqa: E402  (la ruta se agrega arriba)

MAGENTA = (255, 0, 255)
OSCURO = (30, 30, 30)


def dibujar(semilla: int, ancho: int, alto: int, lado: int, x: int, y: int, ruido_interior: int) -> np.ndarray:
    # Mismo fondo que render_fake_image: gris con ruido suave y reproducible (depende de la semilla para que las
    # fotos de dos alumnos no sean idénticas byte a byte).
    rng = np.random.default_rng(1000 + semilla)
    img = np.full((alto, ancho, 3), 128, dtype=np.int16)
    img += rng.integers(-6, 7, size=(alto, ancho, 1))
    img = np.clip(img, 0, 255).astype(np.uint8)
    img[y:y + lado, x:x + lado] = MAGENTA
    interior = np.empty((lado - 2 * FRAME, lado - 2 * FRAME, 3), dtype=np.int16)
    interior[:] = seed_to_color(semilla)
    if ruido_interior:
        # Tablero de ajedrez de +-ruido_interior niveles: es textura de alta frecuencia que sobrevive a la compresión
        # JPEG (el ruido aleatorio no) y cuyo promedio en el parche 3x3 del centro casi no mueve el color leído.
        filas, columnas = np.indices(interior.shape[:2])
        interior += (((filas + columnas) % 2) * 2 - 1)[..., None] * ruido_interior
    img[y + FRAME:y + lado - FRAME, x + FRAME:x + lado - FRAME] = np.clip(interior, 0, 255).astype(np.uint8)
    return img


def facciones(img: np.ndarray, x: int, y: int, lado: int) -> None:
    """Dos ojos y una boca para que el rostro se vea como tal en la revisión. Quedan lejos del centro, que es el único
    punto donde el detector lee el color de la semilla (parche 3x3), así que no alteran el reconocimiento."""
    ojo = max(2, lado // 10)
    for cx in (0.28, 0.62):
        ox, oy = x + int(lado * cx), y + int(lado * 0.32)
        img[oy:oy + ojo, ox:ox + ojo] = OSCURO
    bx, by = x + int(lado * 0.32), y + int(lado * 0.72)
    img[by:by + max(2, lado // 16), bx:bx + int(lado * 0.36)] = OSCURO


def cuadro(semillas: list[int]) -> np.ndarray:
    """Fotograma de aula con varios rostros en cuadrícula (para la prueba de humo del reconocimiento)."""
    lado, hueco = 96, 40
    # Cuadrícula de proporción ~16:10 (un aula llena cabe en un fotograma apaisado como el de una webcam).
    columnas = max(1, math.ceil(math.sqrt(len(semillas) * 1.7)))
    filas = (len(semillas) + columnas - 1) // columnas
    ancho, alto = hueco + columnas * (lado + hueco), hueco + filas * (lado + hueco)
    img = dibujar(semillas[0], ancho, alto, lado, hueco, hueco, ruido_interior=0)
    for i, semilla in enumerate(semillas[1:], start=1):
        x = hueco + (i % columnas) * (lado + hueco)
        y = hueco + (i // columnas) * (lado + hueco)
        cara = dibujar(semilla, ancho, alto, lado, x, y, ruido_interior=0)
        img[y:y + lado, x:x + lado] = cara[y:y + lado, x:x + lado]
    return img


def render(item: dict) -> bytes:
    tipo = item['tipo']
    semilla = int(item.get('semilla', 0))
    if tipo == 'cuadro':
        img = cuadro([int(s) for s in item['semillas']])
        calidad = 90
    elif tipo == 'registro':
        # Foto de plantilla: cuadro de 480 px con un solo rostro grande y centrado (mínimo del servicio: 80 px).
        img = dibujar(semilla, 480, 480, 240, 120, 120, ruido_interior=4)
        facciones(img, 120, 120, 240)
        calidad = 92
    elif tipo == 'recorte':
        # Recorte de una detección: cuadro pequeño con el rostro y un margen, como el que sube el servicio.
        img = dibujar(semilla, 112, 112, 80, 16, 16, ruido_interior=0)
        facciones(img, 16, 16, 80)
        calidad = 85
    else:
        raise ValueError(f'tipo desconocido: {tipo}')
    buf = io.BytesIO()
    Image.fromarray(img).save(buf, format='JPEG', quality=calidad)
    return buf.getvalue()


def main() -> int:
    entrada = json.load(sys.stdin)
    escritas = omitidas = 0
    for item in entrada.get('imagenes', []):
        destino = item['destino']
        if os.path.exists(destino) and not item.get('sobrescribir'):
            omitidas += 1
            continue
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        datos = render(item)
        tmp = f'{destino}.{os.getpid()}.tmp'
        with open(tmp, 'wb') as f:
            f.write(datos)
        os.replace(tmp, destino)  # atómico: el servicio nunca lee un JPEG a medias
        escritas += 1
    json.dump({'escritas': escritas, 'omitidas': omitidas}, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
