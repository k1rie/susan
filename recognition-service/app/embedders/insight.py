"""InsightFace buffalo_s: SCRFD (deteccion) + w600k_mbf (ArcFace 512-d).

LICENCIA: el codigo de InsightFace es MIT, pero los modelos preentrenados que descarga (buffalo_*) son solo para
investigacion / uso NO comercial. Un despliegue comercial exige otra licencia o modelos propios.
"""
from __future__ import annotations

import logging
import os
import threading

import numpy as np

from app.embedders.base import DetectedFace, Embedder

log = logging.getLogger(__name__)


class InsightFaceEmbedder(Embedder):
    name = 'insightface'
    mide_pose = True

    def __init__(self, model_dir: str, model_name: str = 'buffalo_s', dimension: int = 512,
                 det_size: int = 640, min_det_score: float = 0.5, liveness: str = 'off',
                 liveness_threshold: float = 0.8, liveness_min_face_px: int = 64):
        # Import perezoso: insightface/onnxruntime/opencv solo se exigen con EMBEDDER=insightface
        from insightface.app import FaceAnalysis

        self.dimension = dimension
        self.model_name = model_name
        self.min_det_score = min_det_score
        self._model_dir = model_dir
        self.liveness_min_face_px = liveness_min_face_px
        self.liveness_threshold = liveness_threshold
        # Se carga al arrancar (a diferencia de la pose, se usa en cada captura); None = apagada o sin modelo.
        self._liveness = self._cargar_liveness() if liveness != 'off' else None
        self.mide_vivacidad = self._liveness is not None
        # La pose usa 1k3d68 (landmarks 3D, ya incluido en el paquete buffalo_*): se carga la primera vez que se pide, no al
        # arrancar, para que el pase de lista (que nunca la pide) no pague ni memoria ni tiempo por ella.
        self._modelo_pose = None
        self._pose_intentada = False
        self._pose_lock = threading.Lock()
        # Los modelos se descargan al primer uso a model_dir
        self._app = FaceAnalysis(name=model_name, root=model_dir,
                                 allowed_modules=['detection', 'recognition'],
                                 providers=['CPUExecutionProvider'])
        self._app.prepare(ctx_id=-1, det_size=(det_size, det_size), det_thresh=min_det_score)

    def _cargar_liveness(self):
        """Addon `liveness` de InsightFace 2.x (CNN de 80x80 sobre el rostro alineado, un solo cuadro).

        Se usa la clase `Liveness` directamente y NO `FaceAnalysis(addons=['liveness'])`: asi se evalua solo lo que interesa (los
        rostros demasiado pequenos no se evaluan: el puntaje deja de ser fiable) y una excepcion del addon (landmarks invalidos,
        alineacion fallida) se atrapa por rostro en vez de tumbar `app.get` y con ello el reconocimiento de toda la captura.
        `download=False`: el servicio nunca baja nada por su cuenta; el modelo se coloca en <MODEL_DIR>/addons (ver README)."""
        try:
            from insightface.addons import Liveness, ensure_addon

            ruta = ensure_addon('liveness', root=self._model_dir, download=False)
            modelo = Liveness(ruta, threshold=self.liveness_threshold, providers=['CPUExecutionProvider'])
            modelo.prepare(ctx_id=-1)
            log.info('Deteccion de vida activa (modo observacion, umbral %.2f, rostro minimo %d px).',
                     self.liveness_threshold, self.liveness_min_face_px)
            return modelo
        except Exception as e:  # noqa: BLE001 - opcional: sin addon (insightface < 2.0 o sin modelo) el servicio sigue sin ella
            log.warning('Deteccion de vida apagada (%s: %s). Falta <MODEL_DIR>/addons/liveness.onnx o insightface >= 2.0.',
                        type(e).__name__, e)
            return None

    def _vivacidad(self, bgr: np.ndarray, cara, lado: int) -> dict:
        omitida = {'estado': 'omitida', 'es_viva': None, 'puntaje': None}
        kps = getattr(cara, 'kps', None)
        if lado < self.liveness_min_face_px or kps is None:
            return omitida
        try:
            r = self._liveness.predict(bgr, kps)
        except Exception as e:  # noqa: BLE001 - la vida es informativa: un fallo suyo no puede quitar la lectura del rostro
            log.warning('No se pudo evaluar la vida de un rostro (%s).', type(e).__name__)
            return {'estado': 'error', 'es_viva': None, 'puntaje': None}
        if r['status'] != 'ok':
            return {'estado': 'entrada_rechazada', 'es_viva': None, 'puntaje': None}
        return {'estado': 'ok', 'es_viva': bool(r['is_live']), 'puntaje': round(float(r['live_score']), 3)}

    def _cargar_modelo_pose(self):
        """1k3d68 desde el mismo directorio de modelos; sin el archivo (o si falla la carga) la pose simplemente no se mide."""
        with self._pose_lock:
            if self._pose_intentada:
                return self._modelo_pose
            self._pose_intentada = True
            ruta = os.path.join(self._model_dir, 'models', self.model_name, '1k3d68.onnx')
            try:
                from insightface.model_zoo import get_model

                modelo = get_model(ruta, providers=['CPUExecutionProvider'])
                if modelo is not None and getattr(modelo, 'taskname', None) == 'landmark_3d_68':
                    modelo.prepare(ctx_id=-1)
                    self._modelo_pose = modelo
                else:
                    log.warning('El modelo de pose %s no es de landmarks 3D: no se medira la pose.', ruta)
            except Exception as e:  # noqa: BLE001 - la pose es opcional; nunca debe tumbar la verificacion de la foto
                log.warning('No se pudo cargar el modelo de pose (%s): no se medira la pose.', e)
            return self._modelo_pose

    def _pose(self, bgr: np.ndarray, cara) -> tuple[float, float, float] | None:
        modelo = self._cargar_modelo_pose()
        if modelo is None:
            return None
        try:
            modelo.get(bgr, cara)
            pitch, yaw, roll = (float(v) for v in cara['pose'])
        except Exception as e:  # noqa: BLE001
            log.warning('No se pudo estimar la pose (%s).', e)
            return None
        return (pitch, yaw, roll)

    def detect(self, rgb: np.ndarray, con_pose: bool = False, con_vivacidad: bool = False) -> list[DetectedFace]:
        bgr = np.ascontiguousarray(rgb[..., ::-1])  # insightface espera BGR (convencion OpenCV)
        crudas = list(self._app.get(bgr))
        # La pose solo se estima para el rostro mayor (el que `Vision.analyze` evalua): ~20 ms en CPU por rostro.
        mayor = max(crudas, key=lambda c: (c.bbox[2] - c.bbox[0]) * (c.bbox[3] - c.bbox[1])) if (con_pose and crudas) else None
        faces = []
        for f in crudas:
            emb = np.asarray(f.normed_embedding, dtype=np.float32)
            if emb.shape[0] != self.dimension:
                raise RuntimeError(f'El modelo produce {emb.shape[0]}-d y DIMENSION={self.dimension}.')
            faces.append(DetectedFace(
                bbox=tuple(float(v) for v in f.bbox),
                det_score=float(f.det_score),
                embedding=emb / max(float(np.linalg.norm(emb)), 1e-12),
                frontal=_es_frontal(getattr(f, 'kps', None)),
                yaw_ratio=_razon_giro(getattr(f, 'kps', None)),
                pose=self._pose(bgr, f) if f is mayor else None,
                # Solo cuando se pide: el constructor del indice re-embebe miles de fotos y no necesita la vida (~5 ms por rostro).
                vivacidad=(self._vivacidad(bgr, f, int(min(f.bbox[2] - f.bbox[0], f.bbox[3] - f.bbox[1])))
                           if (con_vivacidad and self._liveness is not None) else None),
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


def _razon_giro(kps) -> float | None:
    """Razon de giro COMPENSADA por la inclinacion de la cabeza: |(nariz - punto medio de los ojos) . u| / distancia
    interocular, con u el vector unitario del ojo izquierdo al derecho.

    La heuristica heredada (_es_frontal) usa solo la coordenada x de la nariz y confunde inclinar la cabeza (roll) con girarla
    (yaw): con 8 rostros reales, un rostro de yaw +7 y roll -25 grados daba 0.282 y otro de yaw -36 daba 0.079. Proyectar sobre
    el eje de los ojos quita el roll y correlaciona 0.91 con |yaw| 3D (modelo 1k3d68) frente a 0.60 de la heredada;
    razon ~ 0.55 * tan(yaw), asi que 0.15 es un giro de ~15 grados y 0.40 ~ 36. Ojos coincidentes: infinito (no frontal)."""
    if kps is None or len(kps) < 3:
        return None
    izq, der, nariz = (np.asarray(kps[i], dtype=np.float64) for i in range(3))
    d = der - izq
    dist = float(np.linalg.norm(d))
    if dist < 1e-6:
        return float('inf')
    u = d / dist
    return abs(float((nariz - (izq + der) / 2) @ u)) / dist
