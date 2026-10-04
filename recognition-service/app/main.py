"""API HTTP del servicio de reconocimiento (contrato en ARCHITECTURE.md sec. 11)."""
from __future__ import annotations

import hmac
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import Annotated, Optional

import numpy as np
from fastapi import Depends, FastAPI, File, Form, Header, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app import imaging
from app.builder import build_index
from app.camera import fetch_snapshot
from app.config import VERSION_RE, Settings
from app.embedders import create_embedder
from app.errors import ApiError, unauthorized, validation
from app.index import IndexManager, index_object
from app.samples import consolidar, diversidad, trunc3
from app.storage import StorageError, create_storage
from app.vision import Vision

log = logging.getLogger('susan.recognition')

Version = str

# Techo duro de fotos por plantilla: lo comparten SQL (api_plantilla_registrar) y el proxy de Next. Settings.validate lo
# exige como tope de TEMPLATE_MAX_PHOTOS; aqui acota el esquema de /v1/index/build antes de tomar el lock.
MAX_FOTOS_ENTRADA = 8
RutaObjeto = Annotated[str, StringConstraints(min_length=1, max_length=512)]


class EntryIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id_plantilla: int = Field(ge=0)
    faiss_id: int = Field(ge=0)
    keep: Optional[bool] = None
    objeto_foto: Optional[str] = Field(default=None, min_length=1, max_length=512)
    # Plantilla de varias fotos: se promedian en UN vector (un faiss_id). Una sola foto va por `objeto_foto`.
    objetos_foto: Optional[list[RutaObjeto]] = Field(default=None, min_length=2, max_length=MAX_FOTOS_ENTRADA)

    @model_validator(mode='after')
    def _una_forma(self):
        formas = [self.keep is True, self.objeto_foto is not None, self.objetos_foto is not None]
        if sum(formas) == 1:
            return self
        raise ValueError('Cada entrada es exactamente una de {keep:true}, {objeto_foto} u {objetos_foto}.')


class BuildIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    version: str = Field(pattern=VERSION_RE.pattern)
    base_version: Optional[str] = Field(default=None, pattern=VERSION_RE.pattern)
    entries: list[EntryIn] = Field(max_length=100_000)

    @model_validator(mode='after')
    def _unicos(self):
        if len({e.id_plantilla for e in self.entries}) != len(self.entries):
            raise ValueError('id_plantilla repetido.')
        if len({e.faiss_id for e in self.entries}) != len(self.entries):
            raise ValueError('faiss_id repetido.')
        if self.base_version is None and any(e.keep for e in self.entries):
            raise ValueError('keep requiere base_version.')
        return self


class ActivateIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    version: str = Field(pattern=VERSION_RE.pattern)
    preload_only: bool = False


def _check_prefix(prefix: str) -> str:
    if prefix.startswith('/') or '..' in prefix.split('/') or '\\' in prefix or '//' in prefix:
        raise validation('crop_prefix invalido.')
    return prefix


def _check_set(vision: Vision, settings: Settings, crudas: list[bytes | None]) -> dict:
    """Cuerpo de /v1/photo/check-set (ver README). `crudas[i]` es None si la foto excedio el tope de bytes."""
    fotos: list[dict] = []
    embs: dict[int, np.ndarray] = {}  # solo fotos candidatas (pasaron calidad), por indice de envio
    for i, data in enumerate(crudas):
        try:
            if data is None:
                raise imaging.invalid_image('La imagen excede el tamano maximo.')
            rgb = imaging.decode_image(data, settings.max_image_pixels)
        except ApiError:
            fotos.append({'indice': i, 'estado': 'ilegible', 'rostros': 0, 'un_solo_rostro': False, 'calidad': None,
                          'motivo_rechazo': 'No se pudo leer la imagen.', 'motivo_codigo': 'IMAGEN_INVALIDA',
                          'coseno_resto': None})
            continue
        res, emb = vision.analyze(rgb, settings.template_max_yaw_ratio)
        foto = {'indice': i, 'estado': 'calidad' if res['motivo_rechazo'] else 'aceptada', **res, 'coseno_resto': None}
        fotos.append(foto)
        if emb is not None:
            embs[i] = emb

    cand = sorted(embs)  # indices de envio de las candidatas
    ambiguo = False
    aceptadas: list[int] = []
    cosenos: dict[int, float] = {}
    mat = np.vstack([embs[i] for i in cand]) if cand else None
    if len(cand) >= 2:
        c = consolidar(mat, settings.template_outlier_cosine, settings.template_min_photos,
                        settings.template_link_cosine)
        ambiguo = c.ambiguo
        for pos, i in enumerate(cand):
            if c.cosenos[pos] is not None:
                fotos[i]['coseno_resto'] = trunc3(c.cosenos[pos])
        if ambiguo:
            # Sin una persona mayoritaria no se sabe cual es la correcta: se rechazan todas, que repitan la captura
            for i in cand:
                fotos[i].update(estado='inconsistente', motivo_codigo='CONJUNTO_AMBIGUO',
                                motivo_rechazo='Las fotos no coinciden entre si.')
        else:
            aceptadas = [cand[pos] for pos in c.usadas]
            for pos in c.descartadas:
                fotos[cand[pos]].update(estado='inconsistente', motivo_codigo='NO_COINCIDE',
                                        motivo_rechazo='La foto no parece de la misma persona que las demas.')
            cosenos = {cand[pos]: c.cosenos[pos] for pos in c.usadas}
    else:
        aceptadas = list(cand)  # una sola candidata: nada contra que compararla

    coseno_max_par = None
    advertencias: list[str] = []
    if len(aceptadas) >= 2:
        pos_aceptadas = [cand.index(i) for i in aceptadas]
        coseno_max_par, grupos = diversidad(mat, pos_aceptadas, settings.template_dup_cosine)
        # Rafaga de fotogramas casi iguales: el promedio no aporta variedad. Solo se avisa si hay grupos colapsados
        # (grupos < aceptadas); dos fotos distintas todavia por debajo del minimo no son "casi identicas".
        if grupos < settings.template_min_photos and grupos < len(aceptadas):
            advertencias.append('DIVERSIDAD_BAJA')
    vals = list(cosenos.values())
    return {
        'total': len(crudas),
        'aceptadas': len(aceptadas),
        'minimo': settings.template_min_photos,
        'maximo': settings.template_max_photos,
        'suficiente': len(aceptadas) >= settings.template_min_photos,
        'consistente': None if len(cand) < 2 else not (ambiguo or any(f['estado'] == 'inconsistente' for f in fotos)),
        'ambiguo': ambiguo,
        'umbral_coseno': settings.template_outlier_cosine,
        'coseno_min': trunc3(min(vals)) if vals else None,
        'coseno_medio': trunc3(sum(vals) / len(vals)) if vals else None,
        'coseno_max_par': trunc3(coseno_max_par),
        'advertencias': advertencias,
        'fotos': fotos,
    }


def create_app(settings: Settings | None = None, storage=None, embedder=None) -> FastAPI:
    settings = settings or Settings.from_env()
    settings.validate()  # produccion sin API_KEY: no arranca
    if not settings.api_key:
        log.warning('API_KEY no configurada: todas las rutas salvo /health responderan 401.')

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        st = storage or create_storage(settings)
        emb = embedder or create_embedder(settings)
        app.state.settings = settings
        app.state.vision = Vision(emb, settings)
        app.state.manager = IndexManager(st, settings.dimension, emb.model_name, settings.index_accept_models)
        app.state.storage = st
        # Al arrancar (deploy, reinicio o despertar tras dormir) la memoria esta vacia: se carga la version fijada a mano o,
        # si no hay, la que la base marca en uso. Sin esto el servicio no reconoceria a nadie hasta la siguiente activacion.
        version, origen = settings.index_bootstrap_version, 'INDEX_BOOTSTRAP_VERSION'
        if not version:
            origen = 'indice en uso de la base'
            try:
                version = st.active_index_version()
            except Exception as e:
                log.error('No se pudo consultar el indice en uso: %s', getattr(e, 'message', e))
        if version:
            try:
                app.state.manager.activate(version)
                log.info('Indice %s cargado al arrancar (%s).', version, origen)
            except Exception as e:  # el servicio sigue vivo; recognize respondera 409 hasta activar
                log.error('No se pudo cargar el indice %s (%s): %s', version, origen, getattr(e, 'message', e))
        yield

    app = FastAPI(title='SUSAN recognition-service', version='1.0.0', lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)  # sin documentacion publica

    def err(status: int, code: str, message: str, extra: dict | None = None) -> JSONResponse:
        return JSONResponse(status_code=status, content={'code': code, 'message': message, **(extra or {})})

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, e: ApiError):
        return err(e.status, e.code, e.message, e.extra)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, e: RequestValidationError):
        det = '; '.join(f"{'.'.join(str(p) for p in x['loc'])}: {x['msg']}" for x in e.errors())[:500]
        return err(422, 'VALIDATION_ERROR', det)

    @app.exception_handler(StorageError)
    async def _storage(_: Request, e: StorageError):
        log.error('Fallo de almacenamiento: %s', e)
        return err(502, 'STORAGE_ERROR', 'Fallo el almacenamiento de objetos.')

    def require_key(x_api_key: str | None = Header(default=None, alias='X-API-Key')) -> None:
        # Comparacion en tiempo constante; sin clave configurada nada pasa (falla cerrado)
        if not settings.api_key or not x_api_key or not hmac.compare_digest(
                x_api_key.encode('utf-8'), settings.api_key.encode('utf-8')):
            raise unauthorized()

    auth = [Depends(require_key)]

    def read_upload(f: UploadFile) -> bytes:
        data = f.file.read(settings.max_image_bytes + 1)
        if len(data) > settings.max_image_bytes:
            raise imaging.invalid_image('La imagen excede el tamano maximo.')
        return data

    @app.get('/health')
    def health(request: Request):
        s = request.app.state
        return {'status': 'ok', 'embedder': s.vision.embedder.name, 'index_loaded': s.manager.current is not None}

    @app.get('/v1/index', dependencies=auth)
    def get_index(request: Request):
        cur = request.app.state.manager.current
        if cur is None:
            return {'version': None, 'ntotal': 0, 'dimension': settings.dimension,
                    'model': request.app.state.vision.embedder.model_name, 'loaded_at': None}
        return cur.info()

    @app.get('/v1/index/{version}/manifest', dependencies=auth)
    def manifest(version: str, request: Request):
        index_object(version)
        p = request.app.state.manager.read_payload(version)
        if p.refs is None:
            raise ApiError(409, 'MANIFEST_SIN_REFS', 'Esa version no incluye refs (id_plantilla); reconstruyala.')
        return {'version': p.version, 'ntotal': int(p.ids.shape[0]), 'dimension': p.dimension,
                'refs': p.refs}

    @app.post('/v1/photo/check', dependencies=auth)
    def photo_check(request: Request, image: UploadFile = File(...)):
        rgb = imaging.decode_image(read_upload(image), settings.max_image_pixels)
        return request.app.state.vision.check_photo(rgb)

    @app.post('/v1/photo/check-set', dependencies=auth)
    def photo_check_set(request: Request, images: list[UploadFile] = File(...)):
        """Verifica un CONJUNTO de fotos de una plantilla: calidad por foto + consistencia de identidad. No guarda nada
        y no devuelve vectores: solo cosenos escalares (RNF-03)."""
        if not 1 <= len(images) <= settings.template_max_photos:
            raise validation(f'Envie de 1 a {settings.template_max_photos} imagenes en el campo images.')
        crudas: list[bytes | None] = []
        total_bytes = 0
        for f in images:
            data = f.file.read(settings.max_image_bytes + 1)
            total_bytes += len(data)
            if total_bytes > settings.template_max_total_bytes:
                raise validation('El conjunto de imagenes excede el tamano maximo.')
            # Una foto enorme no tumba el conjunto: sale 'ilegible' y las demas se evaluan
            crudas.append(data if len(data) <= settings.max_image_bytes else None)
        return _check_set(request.app.state.vision, settings, crudas)

    @app.post('/v1/index/build', dependencies=auth)
    def index_build(body: BuildIn, request: Request):
        s = request.app.state
        return build_index(body.version, body.base_version, [e.model_dump() for e in body.entries],
                           s.manager, s.vision, s.storage, settings.max_image_pixels, settings)

    @app.post('/v1/index/activate', dependencies=auth)
    def index_activate(body: ActivateIn, request: Request):
        return request.app.state.manager.activate(body.version, body.preload_only)

    @app.post('/v1/recognize', dependencies=auth)
    def recognize(request: Request,
                  image: Optional[UploadFile] = File(default=None),
                  camera_url: Optional[str] = Form(default=None),
                  allowed_faiss_ids: str = Form(default='[]'),
                  crop_prefix: Optional[str] = Form(default=None),
                  max_faces: int = Form(default=settings.max_faces_default)):
        t0 = time.perf_counter()
        s = request.app.state
        if (image is None) == (not camera_url):
            raise validation('Envie exactamente uno: image o camera_url.')
        if not 1 <= max_faces <= settings.max_faces_limit:
            raise validation(f'max_faces debe estar entre 1 y {settings.max_faces_limit}.')
        try:
            allowed = json.loads(allowed_faiss_ids)
        except ValueError:
            raise validation('allowed_faiss_ids debe ser un arreglo JSON de enteros.') from None
        if (not isinstance(allowed, list) or len(allowed) > settings.max_allowed_ids or not all(
                isinstance(i, int) and not isinstance(i, bool) and i >= 0 for i in allowed)):
            raise validation('allowed_faiss_ids debe ser un arreglo JSON de enteros >= 0.')
        prefix = _check_prefix(crop_prefix) if crop_prefix else None

        idx = s.manager.require()  # snapshot: toda la peticion usa esta version aunque cambie el puntero

        if image is not None:
            data = read_upload(image)
        else:
            data = fetch_snapshot(camera_url, settings.allow_private_cameras,
                                  settings.camera_timeout_s, settings.camera_max_bytes)
        rgb = imaging.decode_image(data, settings.max_image_pixels)
        h, w = rgb.shape[:2]

        faces = sorted(s.vision.detect(rgb), key=lambda f: -f.det_score)[:max_faces]
        if faces:
            q = np.vstack([f.embedding for f in faces])
            candidatos = idx.search(q, allowed)  # el vector q nunca sale de esta funcion
        else:
            candidatos = []

        out = []
        for n, (f, cand) in enumerate(zip(faces, candidatos), start=1):
            objeto = None
            if prefix is not None:
                destino = f'{prefix}{n}.jpg'
                try:
                    s.storage.put(destino, imaging.crop_jpeg(rgb, f.bbox), 'image/jpeg')
                    objeto = destino
                except StorageError as e:
                    # No se tumba el reconocimiento por un recorte; queda sin evidencia y se registra
                    log.error('No se pudo subir un recorte: %s', e)
            out.append({
                'bbox': imaging.clip_bbox(f.bbox, w, h),
                'det_score': round(float(f.det_score), 3),
                'candidate': None if cand is None else {'faiss_id': cand[0], 'score': cand[1]},
                'objeto_recorte': objeto,
            })
        return {'index_version': idx.version, 'elapsed_ms': int((time.perf_counter() - t0) * 1000),
                'image': {'width': w, 'height': h}, 'faces': out}

    return app


def app_factory() -> FastAPI:
    """Punto de entrada para `uvicorn app.main:app_factory --factory`."""
    logging.basicConfig(level=logging.INFO)
    return create_app()
