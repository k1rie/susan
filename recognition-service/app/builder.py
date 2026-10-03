"""Construccion de una version del indice (sin activarla)."""
from __future__ import annotations

import numpy as np

from app import imaging
from app.errors import ApiError
from app.index import IndexManager, IndexPayload, dump_index, index_object, now_iso
from app.storage import ObjectNotFound, Storage, StorageError
from app.vision import Vision


def build_index(version: str, base_version: str | None, entries: list[dict], manager: IndexManager,
                vision: Vision, storage: Storage, max_pixels: int) -> dict:
    obj = index_object(version)
    dim = manager.dimension
    with manager.lock:  # build y activate se serializan
        actual = manager.current
        if actual is not None and actual.version == version:
            raise ApiError(409, 'VERSION_IN_USE', 'Esa version esta en uso y es inmutable; elija otra.')
        if base_version == version:
            raise ApiError(422, 'VALIDATION_ERROR', 'base_version no puede ser igual a version.')

        base_rows: dict[int, np.ndarray] = {}
        if base_version is not None:
            base = manager.read_payload(base_version)
            base_rows = {int(i): base.vectors[k] for k, i in enumerate(base.ids)}

        errores: list[dict] = []
        vectores: list[np.ndarray] = []
        for e in entries:
            idp = e['id_plantilla']
            if e.get('keep'):
                v = base_rows.get(e['faiss_id'])
                if v is None:
                    errores.append({'id_plantilla': idp, 'motivo': 'El faiss_id no existe en base_version.'})
                    continue
                vectores.append(v)
                continue
            try:
                data = storage.get(e['objeto_foto'])
            except ObjectNotFound:
                errores.append({'id_plantilla': idp, 'motivo': 'La foto no existe en el almacenamiento.'})
                continue
            except StorageError:
                errores.append({'id_plantilla': idp, 'motivo': 'No se pudo leer la foto.'})
                continue
            try:
                caras = vision.detect(imaging.decode_image(data, max_pixels))
            except ApiError:
                errores.append({'id_plantilla': idp, 'motivo': 'La foto no es una imagen valida.'})
                continue
            if len(caras) != 1:
                errores.append({'id_plantilla': idp, 'motivo': (
                    'No se detecto ningun rostro.' if not caras else f'Se detectaron {len(caras)} rostros; debe haber uno.')})
                continue
            vectores.append(caras[0].embedding)

        if errores:
            # Todo o nada: ante cualquier error no se escribe el indice
            return {'version': version, 'objeto_indice': None, 'dimension': dim, 'ntotal': 0,
                    'mapeo': [], 'errores': errores}

        mat = np.vstack(vectores).astype(np.float32) if vectores else np.zeros((0, dim), dtype=np.float32)
        if mat.shape[0]:
            mat /= np.maximum(np.linalg.norm(mat, axis=1, keepdims=True), 1e-12)  # L2 explicito
        ids = np.asarray([e['faiss_id'] for e in entries], dtype=np.int64)
        refs = [{'id_plantilla': e['id_plantilla'], 'faiss_id': e['faiss_id']} for e in entries]
        payload = IndexPayload(version, dim, manager.model_name, now_iso(), ids, mat, refs)
        storage.put(obj, dump_index(payload), 'application/json')
        return {'version': version, 'objeto_indice': obj, 'dimension': dim, 'ntotal': int(ids.shape[0]),
                'mapeo': refs, 'errores': []}
