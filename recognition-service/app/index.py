"""Formato JSON del indice (susan-faiss-json/1), carga a FAISS y gestor con puntero atomico."""
from __future__ import annotations

import base64
import json
import logging
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import faiss
import numpy as np

from app.config import VERSION_RE
from app.errors import ApiError, index_not_loaded
from app.storage import ObjectNotFound, Storage

FORMAT = 'susan-faiss-json/1'

log = logging.getLogger('susan.recognition')


class IndexFormatError(ValueError):
    pass


def index_object(version: str) -> str:
    if not VERSION_RE.match(version):
        raise ApiError(422, 'VERSION_INVALID', 'La version debe cumplir ^[A-Za-z0-9._-]{1,12}$.')
    return f'indice/{version}.json'


@dataclass
class IndexPayload:
    """Contenido del JSON. `refs` (id_plantilla por faiss_id) es una extension opcional que habilita el manifiesto."""
    version: str
    dimension: int
    model: str
    created_at: str
    ids: np.ndarray  # int64 (N,)
    vectors: np.ndarray  # float32 (N, D), L2-normalizados
    refs: list[dict] | None = None


def dump_index(p: IndexPayload) -> bytes:
    n = int(p.ids.shape[0])
    doc = {
        'format': FORMAT, 'version': p.version, 'dimension': p.dimension, 'model': p.model,
        'metric': 'ip', 'created_at': p.created_at, 'ntotal': n,
        'ids': [int(i) for i in p.ids],
        'vectors_b64': base64.b64encode(np.ascontiguousarray(p.vectors, dtype='<f4').tobytes()).decode('ascii'),
    }
    if p.refs is not None:
        doc['refs'] = p.refs
    return json.dumps(doc, separators=(',', ':')).encode('utf-8')


def parse_index(raw: bytes, expected_dimension: int) -> IndexPayload:
    """Valida formato, dimension, ids unicos, longitud de vectores, finitud y normalizacion."""
    try:
        doc = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise IndexFormatError('El indice no es JSON valido.') from None
    if not isinstance(doc, dict) or doc.get('format') != FORMAT:
        raise IndexFormatError(f'Formato no soportado (se esperaba {FORMAT}).')
    if doc.get('metric') != 'ip':
        raise IndexFormatError('Metrica no soportada (se esperaba ip).')
    dim, n, ids = doc.get('dimension'), doc.get('ntotal'), doc.get('ids')
    if not isinstance(dim, int) or dim != expected_dimension:
        raise IndexFormatError(f'Dimension {dim!r} distinta de la configurada ({expected_dimension}).')
    if not isinstance(n, int) or n < 0 or not isinstance(ids, list) or len(ids) != n:
        raise IndexFormatError('ntotal no coincide con ids.')
    if not all(isinstance(i, int) and not isinstance(i, bool) and i >= 0 for i in ids):
        raise IndexFormatError('ids debe contener enteros >= 0.')
    if len(set(ids)) != n:
        raise IndexFormatError('ids repetidos.')
    try:
        buf = base64.b64decode(doc.get('vectors_b64') or '', validate=True)
    except (ValueError, TypeError):
        raise IndexFormatError('vectors_b64 no es base64 valido.') from None
    if len(buf) != n * dim * 4:
        raise IndexFormatError('La longitud de vectors_b64 no es N*D*4 bytes.')
    vec = np.frombuffer(buf, dtype='<f4').astype(np.float32).reshape(n, dim)
    if n:
        if not np.isfinite(vec).all():
            raise IndexFormatError('Hay vectores no finitos.')
        if np.abs(np.linalg.norm(vec, axis=1) - 1.0).max() > 1e-3:
            raise IndexFormatError('Hay vectores sin normalizar (L2 != 1).')
    refs = doc.get('refs')
    if refs is not None:
        ok = isinstance(refs, list) and len(refs) == n and all(
            isinstance(r, dict) and isinstance(r.get('id_plantilla'), int) and isinstance(r.get('faiss_id'), int)
            for r in refs)
        if not ok or {r['faiss_id'] for r in refs} != set(ids):
            raise IndexFormatError('refs inconsistente con ids.')
    return IndexPayload(str(doc.get('version', '')), dim, str(doc.get('model', '')),
                        str(doc.get('created_at', '')), np.asarray(ids, dtype=np.int64), vec, refs)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


class LoadedIndex:
    """Indice FAISS en memoria. Inmutable tras construirse: seguro para lecturas concurrentes sin lock."""

    def __init__(self, payload: IndexPayload):
        self.version = payload.version
        self.dimension = payload.dimension
        self.model = payload.model
        self.ntotal = int(payload.ids.shape[0])
        self.loaded_at = now_iso()
        self._index = faiss.IndexIDMap2(faiss.IndexFlatIP(payload.dimension))
        if self.ntotal:
            self._index.add_with_ids(np.ascontiguousarray(payload.vectors), payload.ids)

    def search(self, queries: np.ndarray, allowed_ids) -> list[tuple[int, float] | None]:
        """Mejor vecino de cada consulta SOLO entre allowed_ids. Devuelve (faiss_id, score) o None."""
        q = np.ascontiguousarray(queries, dtype=np.float32).reshape(-1, self.dimension)
        if q.shape[0] == 0 or self.ntotal == 0 or len(allowed_ids) == 0:
            return [None] * q.shape[0]
        params = faiss.SearchParameters()
        params.sel = faiss.IDSelectorBatch(np.asarray(list(allowed_ids), dtype='int64'))
        dist, ids = self._index.search(q, 1, params=params)
        out = []
        for d, i in zip(dist[:, 0], ids[:, 0]):
            out.append(None if i < 0 else (int(i), cosine_to_score(float(d))))
        return out

    def info(self) -> dict:
        return {'version': self.version, 'ntotal': self.ntotal, 'dimension': self.dimension,
                'model': self.model, 'loaded_at': self.loaded_at}


def cosine_to_score(cos: float) -> float:
    """score = clip((coseno + 1) / 2, 0, 1) a 3 decimales (ARCHITECTURE.md sec. 5)."""
    return round(min(1.0, max(0.0, (cos + 1.0) / 2.0)), 3)


class IndexManager:
    """Carga/activa versiones. El lock serializa build/activate; las lecturas usan el puntero sin bloquear."""

    def __init__(self, storage: Storage, dimension: int, model_name: str, accept_models: tuple[str, ...] = ()):
        self.storage = storage
        self.dimension = dimension
        self.model_name = model_name
        # Modelos ajenos que se toleran al LEER un indice (INDEX_ACCEPT_MODELS). Un `build` siempre escribe con
        # `model_name`, asi que una reconstruccion sobre una base ajena deja el indice nuevo con el modelo propio.
        self.accept_models = tuple(accept_models)
        self.lock = threading.RLock()
        self._current: LoadedIndex | None = None  # asignacion de referencia = atomica en CPython
        self._preloaded: dict[str, LoadedIndex] = {}

    @property
    def current(self) -> LoadedIndex | None:
        return self._current

    def require(self) -> LoadedIndex:
        idx = self._current
        if idx is None:
            raise index_not_loaded()
        return idx

    def read_payload(self, version: str) -> IndexPayload:
        obj = index_object(version)
        try:
            raw = self.storage.get(obj)
        except ObjectNotFound:
            raise ApiError(404, 'INDEX_NOT_FOUND', f'No existe la version de indice {version}.') from None
        try:
            payload = parse_index(raw, self.dimension)
        except IndexFormatError as e:
            raise ApiError(422, 'INDEX_INVALID', str(e)) from None
        if payload.version != version:
            raise ApiError(422, 'INDEX_INVALID', 'La version del contenido no coincide con el nombre del objeto.')
        if payload.model != self.model_name and payload.model not in self.accept_models:
            raise ApiError(422, 'INDEX_INVALID',
                           f'El indice fue construido con el modelo {payload.model!r}, no con {self.model_name!r}.')
        if payload.model != self.model_name:
            log.warning('Indice %s construido con el modelo %r y leido con %r (INDEX_ACCEPT_MODELS): sus vectores '
                        'no son comparables con los de este embedder.', version, payload.model, self.model_name)
        return payload

    def activate(self, version: str, preload_only: bool = False) -> dict:
        with self.lock:
            loaded = self._preloaded.get(version)
            if loaded is None:
                # La carga (lenta) ocurre antes de tocar el puntero: las busquedas siguen sobre la version previa
                loaded = LoadedIndex(self.read_payload(version))
            previous = self._current.version if self._current else None
            if preload_only:
                self._preloaded = {version: loaded}  # solo se retiene una precarga para acotar memoria
                return {**loaded.info(), 'active': previous == version, 'preloaded': True, 'previous_version': previous}
            self._current = loaded  # cambio atomico del puntero
            self._preloaded = {}
            return {**loaded.info(), 'active': True, 'preloaded': False, 'previous_version': previous}


def timed_ms(t0: float) -> int:
    return int((time.perf_counter() - t0) * 1000)
