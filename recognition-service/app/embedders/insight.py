"""InsightFace buffalo_s: SCRFD (deteccion) + w600k_mbf (ArcFace 512-d).

LICENCIA: el codigo de InsightFace es MIT, pero los modelos preentrenados que descarga (buffalo_*) son solo para
investigacion / uso NO comercial. Un despliegue comercial exige otra licencia o modelos propios.
"""
from __future__ import annotations

import numpy as np

from app.embedders.base import DetectedFace, Embedder


class InsightFaceEmbedder(Embedder):
    name = 'insightface'

    def __init__(self, model_dir: str, model_name: str = 'buffalo_s', dimension: int = 512,
                 det_size: int = 640, min_det_score: float = 0.5):
        # Import perezoso: insightface/onnxruntime/opencv solo se exigen con EMBEDDER=insightface
        from insightface.app import FaceAnalysis

        self.dimension = dimension
        self.model_name = model_name
        self.min_det_score = min_det_score
        # Los modelos se descargan al primer uso a model_dir
        self._app = FaceAnalysis(name=model_name, root=model_dir,
                                 allowed_modules=['detection', 'recognition'],
                                 providers=['CPUExecutionProvider'])
        self._app.prepare(ctx_id=-1, det_size=(det_size, det_size), det_thresh=min_det_score)

    def detect(self, rgb: np.ndarray) -> list[DetectedFace]:
        bgr = np.ascontiguousarray(rgb[..., ::-1])  # insightface espera BGR (convencion OpenCV)
        faces = []
        for f in self._app.get(bgr):
            emb = np.asarray(f.normed_embedding, dtype=np.float32)
            if emb.shape[0] != self.dimension:
                raise RuntimeError(f'El modelo produce {emb.shape[0]}-d y DIMENSION={self.dimension}.')
            faces.append(DetectedFace(
                bbox=tuple(float(v) for v in f.bbox),
                det_score=float(f.det_score),
                embedding=emb / max(float(np.linalg.norm(emb)), 1e-12),
                frontal=_es_frontal(getattr(f, 'kps', None)),
            ))
        return faces


def _es_frontal(kps) -> bool:
    """Aproxima la guinada con los 5 puntos (ojo izq, ojo der, nariz, ...): en un rostro frontal la nariz
    cae cerca del punto medio entre los ojos. Heuristica barata; no sustituye una estimacion de pose."""
    if kps is None or len(kps) < 3:
        return True
    izq, der, nariz = kps[0], kps[1], kps[2]
    ancho = abs(der[0] - izq[0])
    if ancho < 1e-6:
        return False
    return abs(nariz[0] - (izq[0] + der[0]) / 2) / ancho < 0.35
