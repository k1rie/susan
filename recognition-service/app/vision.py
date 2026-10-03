"""Deteccion con tope de concurrencia y verificacion de calidad de la foto de registro (RF-15)."""
from __future__ import annotations

import threading

import numpy as np

from app import imaging
from app.embedders.base import DetectedFace, Embedder


class Vision:
    def __init__(self, embedder: Embedder, settings):
        self.embedder = embedder
        self.settings = settings
        # La inferencia es CPU-intensiva: se limita para que rafagas de peticiones no saturen el equipo
        self._sem = threading.BoundedSemaphore(max(1, settings.embedder_concurrency))

    def detect(self, rgb: np.ndarray) -> list[DetectedFace]:
        with self._sem:
            return self.embedder.detect(rgb)

    def check_photo(self, rgb: np.ndarray) -> dict:
        s = self.settings
        faces = self.detect(rgb)
        if not faces:
            return {'rostros': 0, 'un_solo_rostro': False,
                    'calidad': {'brillo': round(imaging.brightness(rgb), 1), 'nitidez': round(imaging.sharpness(rgb), 1),
                                'tamano_rostro_px': 0, 'frontal': False},
                    'motivo_rechazo': 'No se detecto ningun rostro.'}
        mayor = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        x1, y1, x2, y2 = (max(0, int(v)) for v in mayor.bbox)
        parche = rgb[y1:y2, x1:x2] if (x2 > x1 and y2 > y1) else rgb
        lado = int(min(mayor.bbox[2] - mayor.bbox[0], mayor.bbox[3] - mayor.bbox[1]))
        brillo, nitidez = imaging.brightness(parche), imaging.sharpness(parche)
        motivo = None
        if len(faces) > 1:
            motivo = 'Hay mas de un rostro en la foto.'
        elif lado < s.min_face_px:
            motivo = f'El rostro es demasiado pequeno (minimo {s.min_face_px} px).'
        elif not mayor.frontal:
            motivo = 'El rostro no esta de frente.'
        elif brillo < s.min_brightness:
            motivo = 'La foto esta muy oscura.'
        elif brillo > s.max_brightness:
            motivo = 'La foto esta sobreexpuesta.'
        elif nitidez < s.min_sharpness:
            motivo = 'La foto esta desenfocada.'
        return {'rostros': len(faces), 'un_solo_rostro': len(faces) == 1,
                'calidad': {'brillo': round(brillo, 1), 'nitidez': round(nitidez, 1),
                            'tamano_rostro_px': lado, 'frontal': bool(mayor.frontal)},
                'motivo_rechazo': motivo}
