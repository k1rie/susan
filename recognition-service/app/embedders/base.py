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


class Embedder(ABC):
    dimension: int
    model_name: str  # se escribe en el JSON del indice para detectar mezclas de modelos
    name: str  # valor de EMBEDDER

    @abstractmethod
    def detect(self, rgb: np.ndarray) -> list[DetectedFace]:
        """rgb: uint8 (H, W, 3). Devuelve los rostros hallados (puede ser lista vacia)."""
