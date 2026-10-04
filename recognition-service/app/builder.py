"""Construccion de una version del indice (sin activarla)."""
from __future__ import annotations

import logging

import numpy as np

from app import imaging
from app.errors import ApiError
from app.index import IndexManager, IndexPayload, dump_index, index_object, now_iso
from app.samples import consolidar, trunc3
from app.storage import ObjectNotFound, Storage, StorageError
from app.vision import Vision

log = logging.getLogger('susan.recognition')

# Umbral del constructor cuando no se le pasan settings (mismo defecto que Settings.build_outlier_cosine)
BUILD_OUTLIER_DEFECTO = 0.25
BUILD_LINK_DEFECTO = 0.20


class _EntradaFallida(Exception):
    """La entrada no se puede construir; se informa por id_plantilla y el build entero no se escribe (todo o nada)."""

    def __init__(self, motivo: str, codigo: str | None = None, muestra: dict | None = None):
        super().__init__(motivo)
        self.motivo = motivo
        self.codigo = codigo
        self.muestra = muestra  # para que la respuesta explique que paso con las fotos aunque la entrada falle


def _embeber_fotos(objetos: list[str], vision: Vision, storage: Storage, max_pixels: int):
    """Lee y embebe cada foto. Devuelve (vectores utilizables [(indice, vector)], descartes [{indice, motivo}]).
    Una foto ausente, ilegible o sin exactamente un rostro se DESCARTA (no es error de la entrada): la plantilla ya paso
    el filtro estricto al registrarse y un objeto perdido no debe bloquear el indice. Un fallo del almacenamiento SI
    tumba la entrada (puede ser transitorio y no sabemos si la foto es buena), igual que con una sola foto."""
    utiles: list[tuple[int, np.ndarray]] = []
    descartes: list[dict] = []
    for i, objeto in enumerate(objetos):
        try:
            data = storage.get(objeto)
        except ObjectNotFound:
            descartes.append({'indice': i, 'motivo': 'no_encontrada'})
            continue
        except StorageError:
            raise _EntradaFallida('No se pudo leer la foto.') from None
        try:
            caras = vision.detect(imaging.decode_image(data, max_pixels))
        except ApiError:
            descartes.append({'indice': i, 'motivo': 'ilegible'})
            continue
        if len(caras) != 1:
            descartes.append({'indice': i, 'motivo': 'sin_rostro' if not caras else 'varios_rostros'})
            continue
        utiles.append((i, caras[0].embedding))
    return utiles, descartes


def _centroide_de_fotos(idp: int, objetos: list[str], vision: Vision, storage: Storage, max_pixels: int,
                        umbral: float, enlace: float = BUILD_LINK_DEFECTO) -> tuple[np.ndarray, dict]:
    """Vector unico de una plantilla de varias fotos: centroide de las consistentes, re-normalizado (en float32).
    Devuelve (vector, muestra) donde `muestra` solo lleva escalares (el vector del centroide nunca sale)."""
    total = len(objetos)
    utiles, descartes = _embeber_fotos(objetos, vision, storage, max_pixels)
    muestra = {'id_plantilla': idp, 'total': total, 'usadas': 0, 'descartadas': [], 'coseno_min': None,
               'coseno_medio': None, 'degradada': True}
    if not utiles:
        muestra['descartadas'] = [{**d, 'coseno_resto': None} for d in descartes]
        raise _EntradaFallida(f'Ninguna de las {total} fotos es utilizable.', 'SIN_MUESTRAS_UTILIZABLES', muestra)

    indices = [i for i, _ in utiles]
    mat = np.vstack([v for _, v in utiles])
    c = consolidar(mat, umbral, 1, enlace)
    descartadas = [{**d, 'coseno_resto': None} for d in descartes]
    if len(utiles) == 1:
        usadas_pos, vector = [0], mat[0]
    elif c.ambiguo:
        # Sin mayoria clara: no se promedia a ciegas. Se indexa la primera foto utilizable sola (el comportamiento
        # heredado de una foto) y las demas se informan descartadas.
        usadas_pos, vector = [0], mat[0]
        descartadas += [{'indice': indices[k], 'motivo': 'ambigua', 'coseno_resto': trunc3(c.cosenos[k])}
                        for k in range(1, len(utiles))]
    else:
        usadas_pos, vector = c.usadas, c.centroide
        descartadas += [{'indice': indices[k], 'motivo': 'inconsistente', 'coseno_resto': trunc3(c.cosenos[k])}
                        for k in c.descartadas]
    descartadas.sort(key=lambda d: d['indice'])
    cos_usadas = [c.cosenos[k] for k in usadas_pos if c.cosenos[k] is not None] if len(usadas_pos) > 1 else []
    muestra.update({
        'usadas': len(usadas_pos), 'descartadas': descartadas,
        'coseno_min': trunc3(min(cos_usadas)) if cos_usadas else None,
        'coseno_medio': trunc3(sum(cos_usadas) / len(cos_usadas)) if cos_usadas else None,
        'degradada': len(usadas_pos) < total,
    })
    return np.asarray(vector, dtype=np.float32), muestra


def build_index(version: str, base_version: str | None, entries: list[dict], manager: IndexManager,
                vision: Vision, storage: Storage, max_pixels: int, settings=None) -> dict:
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

        umbral_build = settings.build_outlier_cosine() if settings is not None else BUILD_OUTLIER_DEFECTO
        enlace_build = settings.build_link_cosine() if settings is not None else BUILD_LINK_DEFECTO
        errores: list[dict] = []
        muestras: list[dict] = []
        filas: list[tuple[np.ndarray, bool]] = []  # (vector, es_nueva): solo las nuevas se normalizan
        for e in entries:
            idp = e['id_plantilla']
            if e.get('keep'):
                v = base_rows.get(e['faiss_id'])
                if v is None:
                    errores.append({'id_plantilla': idp, 'motivo': 'El faiss_id no existe en base_version.'})
                    continue
                filas.append((v, False))
                continue
            if e.get('objetos_foto'):
                try:
                    vector, muestra = _centroide_de_fotos(idp, e['objetos_foto'], vision, storage, max_pixels,
                                                          umbral_build, enlace_build)
                except _EntradaFallida as f:
                    errores.append({'id_plantilla': idp, 'motivo': f.motivo,
                                    **({'codigo': f.codigo} if f.codigo else {})})
                    if f.muestra is not None:
                        muestras.append(f.muestra)
                    continue
                muestras.append(muestra)
                filas.append((vector, True))
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
            filas.append((caras[0].embedding, True))

        if muestras:  # solo contadores: nunca PII ni vectores en el log
            log.info('plantillas multi: %d, fotos descartadas: %d', len(muestras),
                     sum(len(m['descartadas']) for m in muestras))

        if errores:
            # Todo o nada: ante cualquier error no se escribe el indice
            return {'version': version, 'objeto_indice': None, 'dimension': dim, 'ntotal': 0,
                    'mapeo': [], 'errores': errores, 'muestras': muestras}

        mat = np.vstack([v for v, _ in filas]).astype(np.float32) if filas else np.zeros((0, dim), dtype=np.float32)
        nuevas = np.asarray([n for _, n in filas], dtype=bool)
        if nuevas.any():
            # L2 explicito SOLO en las filas nuevas: re-normalizar una fila keep (ya normalizada) cambia bits en ~1/3 de los
            # casos, y keep debe quedar identica a la base byte a byte.
            mat[nuevas] /= np.maximum(np.linalg.norm(mat[nuevas], axis=1, keepdims=True), 1e-12)
        ids = np.asarray([e['faiss_id'] for e in entries], dtype=np.int64)
        refs = [{'id_plantilla': e['id_plantilla'], 'faiss_id': e['faiss_id']} for e in entries]
        payload = IndexPayload(version, dim, manager.model_name, now_iso(), ids, mat, refs)
        storage.put(obj, dump_index(payload), 'application/json')
        return {'version': version, 'objeto_indice': obj, 'dimension': dim, 'ntotal': int(ids.shape[0]),
                'mapeo': refs, 'errores': [], 'muestras': muestras}
