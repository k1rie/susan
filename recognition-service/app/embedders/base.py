"""Contrato del embedder: detectar rostros y devolver un vector L2-normalizado por rostro."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass
class DetectedFace:
    bbox: tuple[float, float, float, float]  # x1, y1, x2, y2 en pixeles de la imagen original
    det_score: float
    embedding: np.ndarray  # float32 (D,), norma 1; NUNCA se serializa hacia fuera del servicio
    frontal: bool = True
    # Razon de giro compensada por inclinacion de la cabeza (ver insight._razon_giro); None si el embedder no la mide.
    # El modo de conjunto (plantilla de varias fotos) la usa en lugar del booleano heredado `frontal`.
    yaw_ratio: float | None = None
    # Pose (cabeceo/pitch, giro/yaw, alabeo/roll) en grados, CON SIGNO, medida por un modelo de landmarks 3D. Solo se calcula
    # cuando el llamador la pide (`con_pose`) y solo para el rostro mayor; None si no se pidio o el embedder no la mide.
    pose: tuple[float, float, float] | None = None
    # Deteccion de vida (anti-spoofing pasivo) de ESTE rostro: {'estado', 'es_viva', 'puntaje'}. `estado` es 'ok' (evaluada),
    # 'omitida' (rostro menor al minimo fiable o sin puntos de referencia), 'entrada_rechazada' (el recorte alineado se sale
    # de la imagen) o 'error'. Solo se calcula con `con_vivacidad` y es informativa: nunca decide por si sola. None si no se
    # pidio, esta apagada o el embedder no la mide.
    vivacidad: dict | None = None


class Embedder(ABC):
    dimension: int
    model_name: str  # se escribe en el JSON del indice para detectar mezclas de modelos
    name: str  # valor de EMBEDDER
    mide_pose: bool = False  # True si `detect(rgb, con_pose=True)` entrega DetectedFace.pose
    mide_vivacidad: bool = False  # True si `detect(rgb, con_vivacidad=True)` entrega DetectedFace.vivacidad

    @abstractmethod
    def detect(self, rgb: np.ndarray) -> list[DetectedFace]:
        """rgb: uint8 (H, W, 3). Devuelve los rostros hallados (puede ser lista vacia)."""
