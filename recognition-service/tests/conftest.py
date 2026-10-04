import io
from contextlib import contextmanager
from dataclasses import replace

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.embedders.fake import FakeEmbedder, render_fake_image, seed_to_vector
from app.main import create_app
from app.storage import LocalStorage

KEY = 'clave-de-prueba'
DIM = 512


def png(arr) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format='PNG')
    return buf.getvalue()


def jpeg(arr, quality=90) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format='JPEG', quality=quality)
    return buf.getvalue()


def face_image(*seeds, size=64, fmt='png') -> bytes:
    """Imagen sintetica con una cara por semilla, separadas horizontalmente."""
    faces = [(s, 10 + i * (size + 20), 20, size) for i, s in enumerate(seeds)]
    arr = render_fake_image(max(320, 20 + len(seeds) * (size + 20)), 200, faces)
    return png(arr) if fmt == 'png' else jpeg(arr)


@pytest.fixture
def settings(tmp_path):
    return Settings(env='development', api_key=KEY, embedder='fake', dimension=DIM,
                    storage_backend='local', storage_dir=str(tmp_path / 'st'), bucket='b',
                    allow_private_cameras=False)


@pytest.fixture
def storage(settings):
    return LocalStorage(settings.storage_dir, settings.bucket)


@pytest.fixture
def app(settings, storage):
    return create_app(settings, storage=storage, embedder=FakeEmbedder(DIM))


@pytest.fixture
def client(app):
    with TestClient(app, headers={'X-API-Key': KEY}) as c:
        yield c


def build(client, storage, version, fotos, base=None, keep=()):
    """fotos: {id_plantilla: (faiss_id, semilla)}; keep: [(id_plantilla, faiss_id)]. Devuelve la respuesta JSON."""
    entries = [{'id_plantilla': i, 'faiss_id': f, 'keep': True} for i, f in keep]
    for idp, (fid, seed) in fotos.items():
        obj = f'registro/{idp}.png'
        storage.put(obj, face_image(seed))
        entries.append({'id_plantilla': idp, 'faiss_id': fid, 'objeto_foto': obj})
    r = client.post('/v1/index/build', json={'version': version, 'base_version': base, 'entries': entries})
    assert r.status_code == 200, r.text
    return r.json()


def activate(client, version, **kw):
    r = client.post('/v1/index/activate', json={'version': version, **kw})
    assert r.status_code == 200, r.text
    return r.json()


def recognize(client, img, allowed, **extra):
    import json
    data = {'allowed_faiss_ids': json.dumps(allowed), **extra}
    return client.post('/v1/recognize', files={'image': ('f.png', img, 'image/png')}, data=data)


class GrupoEmbedder(FakeEmbedder):
    """Embedder de prueba con rostros "de la misma persona" parecidos pero no identicos, como en la vida real.

    El vector de una semilla es norm(base(semilla // 16) + 0.6 * base(semilla)): dos semillas del mismo grupo (mismo
    bloque de 16) dan coseno ~0.74, de grupos distintos ~0 y la misma semilla 1. Asi una "plantilla" son varias
    semillas del mismo grupo y una "foto ajena" es una semilla de otro grupo. `yaw` fija la razon de giro por semilla
    (el fake puro no la mide)."""

    def __init__(self, dimension: int = DIM, yaw: dict[int, float] | None = None):
        super().__init__(dimension)
        self.yaw = dict(yaw or {})

    def vector_for(self, seed: int) -> np.ndarray:
        # 10_000 + grupo: espacio de nombres propio para que la base del grupo no coincida con la de otra semilla
        v = seed_to_vector(10_000 + seed // 16, self.dimension) + 0.6 * seed_to_vector(seed, self.dimension)
        return (v / np.linalg.norm(v)).astype(np.float32)

    def yaw_ratio_for(self, seed: int) -> float | None:
        return self.yaw.get(seed)


def foto(seed: int, fmt='png') -> bytes:
    """Foto de registro valida para el modo de conjunto: un solo rostro de 100 px (> MIN_FACE_PX)."""
    return face_image(seed, size=100, fmt=fmt)


@contextmanager
def make_client(settings, storage, embedder=None, **overrides):
    """TestClient con otra configuracion/embedder (cada prueba que lo necesita arma el suyo)."""
    cfg = replace(settings, **overrides)
    with TestClient(create_app(cfg, storage=storage, embedder=embedder or FakeEmbedder(DIM)),
                    headers={'X-API-Key': KEY}) as c:
        yield c


@pytest.fixture
def client_g(settings, storage):
    """Cliente con el embedder por grupos y la configuracion por omision de la plantilla multifoto."""
    with make_client(settings, storage, GrupoEmbedder()) as c:
        yield c


def check_set(client, imagenes: list[bytes], tipo='image/png', **kw):
    files = [('images', (f'f{i}.png', b, tipo)) for i, b in enumerate(imagenes)]
    return client.post('/v1/photo/check-set', files=files, **kw)


def build_multi(client, storage, version, plantillas, base=None, keep=(), imagenes=None):
    """plantillas: {id_plantilla: (faiss_id, [semillas])}: sube una foto por semilla y construye con objetos_foto.
    `imagenes` permite sustituir los bytes de una semilla (p. ej. basura). Devuelve la respuesta JSON completa."""
    entries = [{'id_plantilla': i, 'faiss_id': f, 'keep': True} for i, f in keep]
    for idp, (fid, semillas) in plantillas.items():
        rutas = []
        for k, sd in enumerate(semillas):
            obj = f'registro/{idp}/{k}.png'
            storage.put(obj, (imagenes or {}).get((idp, k), foto(sd)))
            rutas.append(obj)
        entries.append({'id_plantilla': idp, 'faiss_id': fid, 'objetos_foto': rutas})
    r = client.post('/v1/index/build', json={'version': version, 'base_version': base, 'entries': entries})
    assert r.status_code == 200, r.text
    return r.json()
