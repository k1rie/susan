"""Deteccion con tope de concurrencia y verificacion de calidad de la foto de registro (RF-15)."""
from __future__ import annotations

import threading

import numpy as np

from app import imaging
from app.embedders.base import DetectedFace, Embedder

# Codigos estables de rechazo: la web indexa sus textos por ellos (el texto de `motivo_rechazo` es una frase del servicio
# y puede cambiar). NO_COINCIDE, CONJUNTO_AMBIGUO e IMAGEN_INVALIDA los asigna el endpoint de conjunto, no `analyze`.
SIN_ROSTRO = 'SIN_ROSTRO'
MULTIPLES_ROSTROS = 'MULTIPLES_ROSTROS'
ROSTRO_PEQUENO = 'ROSTRO_PEQUENO'
NO_FRONTAL = 'NO_FRONTAL'
POCA_LUZ = 'POCA_LUZ'
EXCESO_LUZ = 'EXCESO_LUZ'
BORROSA = 'BORROSA'


class Vision:
    def __init__(self, embedder: Embedder, settings):
        self.embedder = embedder
        self.settings = settings
        # La inferencia es CPU-intensiva: se limita para que rafagas de peticiones no saturen el equipo
        self._sem = threading.BoundedSemaphore(max(1, settings.embedder_concurrency))

    def detect(self, rgb: np.ndarray) -> list[DetectedFace]:
        with self._sem:
            return self.embedder.detect(rgb)

    def analyze(self, rgb: np.ndarray, yaw_max_ratio: float | None = None) -> tuple[dict, np.ndarray | None]:
        """Calidad de UNA foto de registro con UNA sola deteccion. Devuelve (resultado, embedding del unico rostro).

        El embedding solo se entrega si la foto pasa TODA la calidad (el llamador lo usa para promediar y nunca lo
        serializa). Con `yaw_max_ratio` (modo de conjunto) y un embedder que mide la razon de giro, `frontal` pasa a ser
        `yaw_ratio < yaw_max_ratio`; sin ellos queda el booleano heredado, asi /v1/photo/check no cambia de contrato."""
        s = self.settings
        faces = self.detect(rgb)
        if not faces:
            return ({'rostros': 0, 'un_solo_rostro': False,
                     'calidad': {'brillo': round(imaging.brightness(rgb), 1), 'nitidez': round(imaging.sharpness(rgb), 1),
                                 'tamano_rostro_px': 0, 'frontal': False},
                     'motivo_rechazo': 'No se detecto ningun rostro.', 'motivo_codigo': SIN_ROSTRO}, None)
        mayor = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        x1, y1, x2, y2 = (max(0, int(v)) for v in mayor.bbox)
        parche = rgb[y1:y2, x1:x2] if (x2 > x1 and y2 > y1) else rgb
        lado = int(min(mayor.bbox[2] - mayor.bbox[0], mayor.bbox[3] - mayor.bbox[1]))
        brillo, nitidez = imaging.brightness(parche), imaging.sharpness(parche)
        if yaw_max_ratio is not None and mayor.yaw_ratio is not None:
            frontal = bool(mayor.yaw_ratio < yaw_max_ratio)
        else:
            frontal = bool(mayor.frontal)
        motivo = codigo = None
        if len(faces) > 1:
            motivo, codigo = 'Hay mas de un rostro en la foto.', MULTIPLES_ROSTROS
        elif lado < s.min_face_px:
            motivo, codigo = f'El rostro es demasiado pequeno (minimo {s.min_face_px} px).', ROSTRO_PEQUENO
        elif not frontal:
            motivo, codigo = 'El rostro no esta de frente.', NO_FRONTAL
        elif brillo < s.min_brightness:
            motivo, codigo = 'La foto esta muy oscura.', POCA_LUZ
        elif brillo > s.max_brightness:
            motivo, codigo = 'La foto esta sobreexpuesta.', EXCESO_LUZ
        elif nitidez < s.min_sharpness:
            motivo, codigo = 'La foto esta desenfocada.', BORROSA
        resultado = {'rostros': len(faces), 'un_solo_rostro': len(faces) == 1,
                     'calidad': {'brillo': round(brillo, 1), 'nitidez': round(nitidez, 1),
                                 'tamano_rostro_px': lado, 'frontal': frontal},
                     'motivo_rechazo': motivo, 'motivo_codigo': codigo}
        return resultado, (mayor.embedding if motivo is None else None)

    def check_photo(self, rgb: np.ndarray) -> dict:
        return self.analyze(rgb)[0]
