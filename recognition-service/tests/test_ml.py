"""Humo REAL con InsightFace buffalo_s. Opcional (requiere los modelos): pytest -m ml

Usa los modelos ya descargados en MODEL_DIR (por omision <repo>/recognition-service/.models) para no bajar nada; si no
existen, InsightFace los descarga ahi la primera vez (requiere red).
"""
import io
import os
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageEnhance

from app.config import Settings
from app.embedders import create_embedder
from app.index import parse_index
from app.main import create_app
from app.storage import LocalStorage
from tests.conftest import KEY

pytestmark = pytest.mark.ml

MODEL_DIR = os.environ.get('MODEL_DIR') or str(Path(__file__).resolve().parent.parent / '.models')


@pytest.fixture(scope='module')
def emb():
    return create_embedder(Settings(embedder='insightface', model_dir=MODEL_DIR))


def _jpeg(arr, calidad=92) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format='JPEG', quality=calidad)
    return buf.getvalue()


def _variantes_astronauta() -> list[np.ndarray]:
    """El original y 4 variantes (brillo, ruido, escala, giro leve) de UNA foto: la misma persona con condiciones distintas."""
    skimage = pytest.importorskip('skimage.data')
    im = Image.fromarray(skimage.astronaut())
    ruido = np.asarray(im).astype(np.int16) + np.random.default_rng(0).normal(0, 6, (512, 512, 3)).astype(np.int16)
    return [np.asarray(im),
            np.asarray(ImageEnhance.Brightness(im).enhance(0.8)),
            np.clip(ruido, 0, 255).astype(np.uint8),
            np.asarray(im.resize((716, 716), Image.BICUBIC)),
            np.asarray(im.rotate(6, resample=Image.BICUBIC))]


def _variantes_de(arr: np.ndarray, semilla: int) -> list[np.ndarray]:
    """Cinco variantes (brillo, ruido, escala, giro leve) de una imagen cualquiera."""
    im = Image.fromarray(arr)
    h, w = arr.shape[:2]
    ruido = np.asarray(im).astype(np.int16) + np.random.default_rng(semilla).normal(0, 6, arr.shape).astype(np.int16)
    return [np.asarray(im),
            np.asarray(ImageEnhance.Brightness(im).enhance(0.8)),
            np.clip(ruido, 0, 255).astype(np.uint8),
            np.asarray(im.resize((int(w * 1.4), int(h * 1.4)), Image.BICUBIC)),
            np.asarray(im.rotate(6, resample=Image.BICUBIC))]


def _otra_persona(emb) -> np.ndarray:
    """Recorte de UN rostro de la foto de grupo 't1' de insightface (otra persona, tamano suficiente y de frente)."""
    from insightface.data import get_image
    t1 = get_image('t1')
    f = emb.detect(t1)[1]
    x1, y1, x2, y2 = (int(v) for v in f.bbox)
    m = int((x2 - x1) * 0.5)
    return t1[max(0, y1 - m):y2 + m, max(0, x1 - m):x2 + m]


@pytest.fixture
def cliente(emb, tmp_path):
    cfg = Settings(env='development', api_key=KEY, embedder='insightface', model_dir=MODEL_DIR,
                   storage_backend='local', storage_dir=str(tmp_path / 'st'), bucket='b')
    st = LocalStorage(cfg.storage_dir, cfg.bucket)
    with TestClient(create_app(cfg, storage=st, embedder=emb), headers={'X-API-Key': KEY}) as c:
        c.storage = st
        yield c


def test_insightface_mismo_rostro_supera_a_otro_rostro(emb):
    skimage = pytest.importorskip('skimage.data')
    astro = skimage.astronaut()  # RGB uint8 512x512; contiene un rostro
    caras = emb.detect(astro)
    assert len(caras) == 1 and caras[0].embedding.shape == (512,)
    x1, y1, x2, y2 = (int(v) for v in caras[0].bbox)
    # Dos recortes distintos de la misma cara (margenes diferentes)
    a = astro[max(0, y1 - 40):y2 + 40, max(0, x1 - 40):x2 + 40]
    b = astro[max(0, y1 - 80):y2 + 80, max(0, x1 - 80):x2 + 80]
    ea, eb = emb.detect(a), emb.detect(b)
    assert len(ea) == 1 and len(eb) == 1
    otra = emb.detect(skimage.camera()[..., None].repeat(3, axis=2))  # otra imagen (fotografo)
    mismo = float(ea[0].embedding @ eb[0].embedding)
    assert mismo > 0.5
    if otra:  # si detecta una cara distinta, su similitud debe ser menor
        assert mismo > float(ea[0].embedding @ otra[0].embedding)


def test_razon_de_giro_compensada_del_astronauta(emb):
    skimage = pytest.importorskip('skimage.data')
    (cara,) = emb.detect(skimage.astronaut())
    assert cara.yaw_ratio is not None and cara.yaw_ratio < 0.05
    assert bool(cara.frontal)  # el criterio heredado tambien pasa
    # Inclinar la cabeza 25 grados no debe parecer un giro: la razon compensada sigue baja
    inclinada = np.asarray(Image.fromarray(skimage.astronaut()).rotate(25, resample=Image.BICUBIC))
    (c2,) = emb.detect(inclinada)
    assert c2.yaw_ratio < 0.15


def test_check_set_real_cinco_variantes_y_una_ajena(cliente, emb):
    imgs = [_jpeg(v) for v in _variantes_astronauta()]
    files = [('images', (f'f{i}.jpg', b, 'image/jpeg')) for i, b in enumerate(imgs)]
    j = cliente.post('/v1/photo/check-set', files=files).json()
    assert j['aceptadas'] == 5 and j['suficiente'] and j['consistente'] is True, j
    assert all(f['estado'] == 'aceptada' and f['coseno_resto'] >= 0.35 for f in j['fotos']), j['fotos']
    # Con una persona distinta entre las cinco: queda 'inconsistente' con un coseno bajo y las cinco propias se conservan
    files.append(('images', ('otra.jpg', _jpeg(_otra_persona(emb)), 'image/jpeg')))
    j = cliente.post('/v1/photo/check-set', files=files).json()
    ajena = j['fotos'][5]
    assert ajena['estado'] == 'inconsistente' and ajena['motivo_codigo'] == 'NO_COINCIDE' and ajena['coseno_resto'] < 0.3
    assert [f['estado'] for f in j['fotos'][:5]] == ['aceptada'] * 5 and j['consistente'] is False
    assert j['coseno_min'] >= 0.35


def test_build_real_centroide_cercano_a_cada_variante(cliente, emb):
    variantes = _variantes_astronauta()
    rutas = []
    for k, v in enumerate(variantes):
        cliente.storage.put(f'registro/1/{k}.jpg', _jpeg(v), 'image/jpeg')
        rutas.append(f'registro/1/{k}.jpg')
    b = cliente.post('/v1/index/build', json={'version': 'v1', 'base_version': None, 'entries': [
        {'id_plantilla': 1, 'faiss_id': 10, 'objetos_foto': rutas}]}).json()
    assert b['errores'] == [] and b['muestras'][0]['usadas'] == 5 and b['muestras'][0]['degradada'] is False
    centroide = parse_index(cliente.storage.get('indice/v1.json'), 512).vectors[0]
    for v in variantes:
        (cara,) = emb.detect(v)
        assert float(centroide @ cara.embedding) >= 0.6


@pytest.mark.parametrize('n', [3, 4])  # 3+3 y 4+4 (el maximo de la API son 8 fotos)
def test_mezcla_balanceada_de_dos_personas_es_ambigua(cliente, emb, n):
    """Regresion: n fotos de una persona + n de otra pasaban como un conjunto valido (la media de pares por foto cae justo
    en el umbral cuando las fotos de cada persona se parecen mucho entre si) y el centroide reconocia a AMBAS."""
    propias = _variantes_astronauta()
    ajenas = _variantes_de(_otra_persona(emb), 1)
    imgs = [_jpeg(v) for v in propias[:n] + ajenas[:n]]
    files = [('images', (f'f{i}.jpg', b, 'image/jpeg')) for i, b in enumerate(imgs)]
    j = cliente.post('/v1/photo/check-set', files=files).json()
    assert j['ambiguo'] is True and j['consistente'] is False and j['aceptadas'] == 0, j
    assert all(f['estado'] == 'inconsistente' and f['motivo_codigo'] == 'CONJUNTO_AMBIGUO' for f in j['fotos']), j['fotos']

    # Aunque llegue por API directa, el constructor no indexa el promedio de dos personas: solo la primera foto
    rutas = []
    for k, b in enumerate(imgs):
        cliente.storage.put(f'registro/2/{k}.jpg', b, 'image/jpeg')
        rutas.append(f'registro/2/{k}.jpg')
    b = cliente.post('/v1/index/build', json={'version': f'vm{n}', 'base_version': None, 'entries': [
        {'id_plantilla': 2, 'faiss_id': 20, 'objetos_foto': rutas}]}).json()
    m = b['muestras'][0]
    assert b['errores'] == [] and m['usadas'] == 1 and m['degradada'] is True
    assert {d['motivo'] for d in m['descartadas']} == {'ambigua'}
    centroide = parse_index(cliente.storage.get(f'indice/vm{n}.json'), 512).vectors[0]
    (primera,) = emb.detect(propias[0])
    (de_otra,) = emb.detect(ajenas[0])
    assert float(centroide @ primera.embedding) > 0.99          # es la primera foto, no un promedio
    assert float(centroide @ de_otra.embedding) < 0.3           # y no reconoce a la otra persona
