import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.embedders.fake import FakeEmbedder, render_fake_image
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
