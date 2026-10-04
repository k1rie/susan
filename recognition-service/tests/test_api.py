import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.embedders.fake import FakeEmbedder, seed_to_vector
from app.index import IndexPayload, LoadedIndex, dump_index, parse_index, IndexFormatError
from app.main import create_app
from tests.conftest import KEY, DIM, activate, build, face_image, recognize


# ---------- autenticacion y arranque ----------
def test_health_sin_clave_y_resto_exige_clave(app):
    with TestClient(app) as c:
        h = c.get('/health')
        assert h.status_code == 200 and h.json() == {'status': 'ok', 'embedder': 'fake', 'index_loaded': False}
        assert c.get('/v1/index').status_code == 401
        assert c.get('/v1/index', headers={'X-API-Key': 'otra'}).status_code == 401
        assert c.post('/v1/index/activate', json={'version': 'v1'}).status_code == 401
        assert c.get('/v1/index', headers={'X-API-Key': KEY}).status_code == 200


def test_produccion_sin_api_key_no_arranca(settings):
    settings.env, settings.api_key = 'production', ''
    with pytest.raises(RuntimeError):
        create_app(settings)


# ---------- indice vacio / no cargado ----------
def test_indice_no_cargado_da_409(client):
    assert client.get('/v1/index').json()['version'] is None
    r = recognize(client, face_image(1), [1])
    assert r.status_code == 409 and r.json()['code'] == 'INDEX_NOT_LOADED'


def test_indice_vacio_sin_candidatos(client, storage):
    b = build(client, storage, 'v1', {})
    assert b['ntotal'] == 0
    activate(client, 'v1')
    r = recognize(client, face_image(5), [1, 2]).json()
    assert len(r['faces']) == 1 and r['faces'][0]['candidate'] is None


# ---------- reconocimiento ----------
def _indice_basico(client, storage):
    build(client, storage, 'v1', {10: (100, 11), 20: (200, 22), 30: (300, 33)})
    activate(client, 'v1')


def test_un_rostro_score_y_estructura(client, storage):
    _indice_basico(client, storage)
    r = recognize(client, face_image(22), [100, 200, 300], crop_prefix='recortes/c1/')
    assert r.status_code == 200
    j = r.json()
    assert j['index_version'] == 'v1' and j['image'] == {'width': 320, 'height': 200}
    (f,) = j['faces']
    assert f['candidate'] == {'faiss_id': 200, 'score': 1.0}
    assert f['det_score'] > 0 and len(f['bbox']) == 4
    assert 'embedding' not in json.dumps(j) and 'vector' not in json.dumps(j)


def test_cero_rostros(client, storage):
    _indice_basico(client, storage)
    r = recognize(client, face_image(), [100]).json()
    assert r['faces'] == []


def test_no_incluido_nunca_es_candidato(client, storage):
    _indice_basico(client, storage)
    # El alumno 200 es la coincidencia exacta pero no esta permitido
    f = recognize(client, face_image(22), [100, 300]).json()['faces'][0]
    assert f['candidate'] is None or f['candidate']['faiss_id'] in (100, 300)
    assert f['candidate']['faiss_id'] != 200
    assert f['candidate']['score'] < 0.75  # semillas distintas: casi ortogonales (coseno ~ 0 -> ~0.5)


def test_allowed_vacio_da_candidate_null(client, storage):
    _indice_basico(client, storage)
    f = recognize(client, face_image(22), []).json()['faces'][0]
    assert f['candidate'] is None


def test_varios_rostros_y_max_faces(client, storage):
    _indice_basico(client, storage)
    j = recognize(client, face_image(11, 22, 33), [100, 200, 300]).json()
    assert sorted(f['candidate']['faiss_id'] for f in j['faces']) == [100, 200, 300]
    assert len(recognize(client, face_image(11, 22, 33), [100, 200, 300], max_faces='2').json()['faces']) == 2


def test_umbral_y_score_formula(client, storage):
    _indice_basico(client, storage)
    mismo = recognize(client, face_image(11), [100, 200]).json()['faces'][0]['candidate']['score']
    otro = recognize(client, face_image(99), [100, 200]).json()['faces'][0]['candidate']['score']
    assert mismo == 1.0 and 0.0 <= otro < 0.85  # un desconocido queda bajo el umbral 0.850
    idx = LoadedIndex(IndexPayload('v', DIM, 'm', 'x', np.array([1]), seed_to_vector(1, DIM)[None, :]))
    (res,) = idx.search(-seed_to_vector(1, DIM)[None, :], [1])
    assert res == (1, 0.0)  # coseno -1 -> score 0


def test_jpeg_tolera_compresion(client, storage):
    _indice_basico(client, storage)
    f = recognize(client, face_image(33, fmt='jpeg'), [100, 200, 300]).json()['faces'][0]
    assert f['candidate']['faiss_id'] == 300


def test_recortes_subidos(client, storage):
    _indice_basico(client, storage)
    j = recognize(client, face_image(11, 22), [100, 200], crop_prefix='recortes/ses1/').json()
    objs = [f['objeto_recorte'] for f in j['faces']]
    assert sorted(objs) == ['recortes/ses1/1.jpg', 'recortes/ses1/2.jpg']
    for o in objs:
        assert storage.get(o)[:2] == b'\xff\xd8'
    # sin crop_prefix no se sube nada
    assert recognize(client, face_image(11), [100]).json()['faces'][0]['objeto_recorte'] is None
    assert recognize(client, face_image(11), [100], crop_prefix='../x/').status_code == 422


def test_imagen_corrupta_y_parametros(client, storage):
    _indice_basico(client, storage)
    r = recognize(client, b'esto no es una imagen', [100])
    assert r.status_code == 422 and r.json()['code'] == 'INVALID_IMAGE'
    assert client.post('/v1/recognize', data={'allowed_faiss_ids': '[]'}).status_code == 422
    assert recognize(client, face_image(11), [100], camera_url='http://x/').status_code == 422
    assert client.post('/v1/recognize', files={'image': ('a.png', face_image(1), 'image/png')},
                       data={'allowed_faiss_ids': 'no-json'}).status_code == 422


# ---------- camera_url ----------
class _Cam(BaseHTTPRequestHandler):
    def do_GET(self):
        body = face_image(22) if self.path == '/snap.png' else b'x' * (6 * 1024 * 1024)
        self.send_response(200)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


@pytest.fixture
def camara():
    srv = HTTPServer(('127.0.0.1', 0), _Cam)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f'http://127.0.0.1:{srv.server_port}'
    srv.shutdown()


def _cam_client(settings, storage, permitir):
    settings.allow_private_cameras = permitir
    return TestClient(create_app(settings, storage=storage, embedder=FakeEmbedder(DIM)), headers={'X-API-Key': KEY})


def test_camera_url_bloqueada(settings, storage):
    with _cam_client(settings, storage, False) as c:
        build(c, storage, 'v1', {1: (100, 11)}); activate(c, 'v1')
        for url in ('http://127.0.0.1:9/x', 'http://169.254.169.254/latest/meta-data', 'http://localhost/x',
                    'http://metadata.google.internal/', 'ftp://example.com/x', 'file:///etc/passwd',
                    'http://user:pw@example.com/'):
            r = c.post('/v1/recognize', data={'camera_url': url, 'allowed_faiss_ids': '[]'})
            assert r.status_code == 422 and r.json()['code'] == 'CAMERA_URL_BLOCKED', url
    with _cam_client(settings, storage, True) as c:  # el flag no abre los metadatos
        r = c.post('/v1/recognize', data={'camera_url': 'http://169.254.169.254/', 'allowed_faiss_ids': '[]'})
        assert r.status_code in (409, 422)


def test_camera_url_permitida_inalcanzable_y_grande(settings, storage, camara):
    with _cam_client(settings, storage, True) as c:
        build(c, storage, 'v1', {1: (100, 22)}); activate(c, 'v1')
        r = c.post('/v1/recognize', data={'camera_url': camara + '/snap.png', 'allowed_faiss_ids': '[100]'})
        assert r.status_code == 200 and r.json()['faces'][0]['candidate']['faiss_id'] == 100
        assert c.post('/v1/recognize', data={'camera_url': camara + '/grande',
                                             'allowed_faiss_ids': '[]'}).status_code == 422
        r = c.post('/v1/recognize', data={'camera_url': 'http://127.0.0.1:1/x', 'allowed_faiss_ids': '[]'})
        assert r.status_code == 504 and r.json()['code'] == 'CAMERA_UNREACHABLE'


# ---------- photo/check (RF-15) ----------
def test_photo_check(client):
    def chk(img):
        return client.post('/v1/photo/check', files={'image': ('a.png', img, 'image/png')}).json()

    ok = chk(face_image(7, size=100))
    assert ok['rostros'] == 1 and ok['un_solo_rostro'] and ok['motivo_rechazo'] is None
    assert set(ok['calidad']) == {'brillo', 'nitidez', 'tamano_rostro_px', 'frontal'}
    assert chk(face_image())['rostros'] == 0 and chk(face_image())['motivo_rechazo']
    dos = chk(face_image(7, 8, size=100))
    assert dos['rostros'] == 2 and not dos['un_solo_rostro'] and dos['motivo_rechazo']
    assert chk(face_image(7, size=50))['motivo_rechazo'].startswith('El rostro es demasiado pequeno')
    r = client.post('/v1/photo/check', files={'image': ('a.png', b'basura', 'image/png')})
    assert r.status_code == 422


# ---------- build ----------
def test_build_2_rostros_en_foto_de_registro_no_escribe(client, storage):
    storage.put('registro/a.png', face_image(1, 2))
    storage.put('registro/b.png', face_image(3))
    storage.put('registro/c.png', face_image())
    storage.put('registro/d.png', b'corrupta')
    entries = [{'id_plantilla': 1, 'faiss_id': 1, 'objeto_foto': 'registro/a.png'},
               {'id_plantilla': 2, 'faiss_id': 2, 'objeto_foto': 'registro/b.png'},
               {'id_plantilla': 3, 'faiss_id': 3, 'objeto_foto': 'registro/c.png'},
               {'id_plantilla': 4, 'faiss_id': 4, 'objeto_foto': 'registro/d.png'},
               {'id_plantilla': 5, 'faiss_id': 5, 'objeto_foto': 'registro/nada.png'}]
    j = client.post('/v1/index/build', json={'version': 'v9', 'base_version': None, 'entries': entries}).json()
    assert sorted(e['id_plantilla'] for e in j['errores']) == [1, 3, 4, 5]
    assert j['objeto_indice'] is None and j['mapeo'] == []
    with pytest.raises(Exception):
        storage.get('indice/v9.json')


def test_json_ida_y_vuelta_y_validaciones(client, storage):
    b = build(client, storage, 'v1', {1: (7, 11), 2: (9, 22)})
    assert b['objeto_indice'] == 'indice/v1.json' and b['ntotal'] == 2 and b['dimension'] == DIM
    assert b['mapeo'] == [{'id_plantilla': 1, 'faiss_id': 7}, {'id_plantilla': 2, 'faiss_id': 9}]
    raw = storage.get('indice/v1.json')
    p = parse_index(raw, DIM)
    assert p.ids.tolist() == [7, 9] and np.allclose(p.vectors[0], seed_to_vector(11, DIM))
    assert parse_index(dump_index(p), DIM).vectors.tobytes() == p.vectors.tobytes()
    doc = json.loads(raw)
    assert doc['format'] == 'susan-faiss-json/1' and doc['metric'] == 'ip' and doc['ntotal'] == 2
    for malo in ({**doc, 'format': 'x'}, {**doc, 'dimension': 128}, {**doc, 'ids': [7, 7]},
                 {**doc, 'vectors_b64': doc['vectors_b64'][:-8]}, {**doc, 'ntotal': 3}):
        with pytest.raises(IndexFormatError):
            parse_index(json.dumps(malo).encode(), DIM)
    v = np.frombuffer(__import__('base64').b64decode(doc['vectors_b64']), dtype='<f4').copy()
    v[0] = np.nan
    with pytest.raises(IndexFormatError):
        parse_index(json.dumps({**doc, 'vectors_b64': __import__('base64').b64encode(v.tobytes()).decode()}).encode(), DIM)
    v = np.frombuffer(__import__('base64').b64decode(doc['vectors_b64']), dtype='<f4') * 2
    with pytest.raises(IndexFormatError):
        parse_index(json.dumps({**doc, 'vectors_b64': __import__('base64').b64encode(v.astype('<f4').tobytes()).decode()}).encode(), DIM)


def test_build_conserva_vectores_keep(client, storage):
    build(client, storage, 'v1', {1: (10, 11), 2: (20, 22)})
    b2 = build(client, storage, 'v2', {3: (30, 33)}, base='v1', keep=[(1, 10), (2, 20)])
    assert b2['ntotal'] == 3
    p1, p2 = (parse_index(storage.get(f'indice/{v}.json'), DIM) for v in ('v1', 'v2'))
    assert np.array_equal(p2.vectors[:2], p1.vectors)  # byte a byte, sin re-vectorizar
    activate(client, 'v2')
    for seed, fid in ((11, 10), (22, 20), (33, 30)):
        assert recognize(client, face_image(seed), [10, 20, 30]).json()['faces'][0]['candidate']['faiss_id'] == fid
    # keep con faiss_id inexistente en la base -> error por id_plantilla
    r = client.post('/v1/index/build', json={'version': 'v3', 'base_version': 'v1',
                                             'entries': [{'id_plantilla': 1, 'faiss_id': 999, 'keep': True}]}).json()
    assert r['errores'][0]['id_plantilla'] == 1 and r['objeto_indice'] is None
    # validaciones de entrada
    assert client.post('/v1/index/build', json={'version': 'v3', 'base_version': None,
                                                'entries': [{'id_plantilla': 1, 'faiss_id': 1, 'keep': True}]}).status_code == 422
    assert client.post('/v1/index/build', json={'version': 'v4', 'entries': [
        {'id_plantilla': 1, 'faiss_id': 1, 'objeto_foto': 'a'}, {'id_plantilla': 2, 'faiss_id': 1, 'objeto_foto': 'b'}]}).status_code == 422
    assert client.post('/v1/index/build', json={'version': 'v2', 'entries': []}).status_code == 409  # en uso: inmutable


def test_manifest_y_activate_errores(client, storage):
    build(client, storage, 'v1', {1: (10, 11)})
    m = client.get('/v1/index/v1/manifest').json()
    assert m == {'version': 'v1', 'ntotal': 1, 'dimension': DIM, 'refs': [{'id_plantilla': 1, 'faiss_id': 10}]}
    assert client.get('/v1/index/v77/manifest').status_code == 404
    assert client.post('/v1/index/activate', json={'version': 'v77'}).status_code == 404
    assert client.post('/v1/index/activate', json={'version': '../x'}).status_code == 422
    storage.put('indice/vx.json', b'{}')
    assert client.post('/v1/index/activate', json={'version': 'vx'}).json()['code'] == 'INDEX_INVALID'


def test_preload_no_cambia_puntero(client, storage):
    build(client, storage, 'v1', {1: (10, 11)}); build(client, storage, 'v2', {1: (10, 22)})
    activate(client, 'v1')
    p = activate(client, 'v2', preload_only=True)
    assert p['preloaded'] and not p['active'] and client.get('/v1/index').json()['version'] == 'v1'
    a = activate(client, 'v2')
    assert a['previous_version'] == 'v1' and client.get('/v1/index').json()['version'] == 'v2'
    assert client.get('/health').json()['index_loaded'] is True


# ---------- concurrencia y rendimiento ----------
def test_activate_atomico_con_busquedas_concurrentes(app, storage):
    # Mismo faiss_id 1: semilla 11 en v1 y semilla 22 en v2. Una busqueda con la imagen de la semilla 11
    # debe dar score 1.0 si y solo si respondio sobre v1 (coherencia de la instantanea).
    with TestClient(app, headers={'X-API-Key': KEY}) as c:
        build(c, storage, 'v1', {1: (1, 11)}); build(c, storage, 'v2', {1: (1, 22)})
        activate(c, 'v1')
        img = face_image(11)
        parar, fallos, vistas = threading.Event(), [], set()

        def buscar():
            cl = TestClient(app, headers={'X-API-Key': KEY})
            while not parar.is_set():
                r = recognize(cl, img, [1])
                if r.status_code != 200:
                    fallos.append(r.text); continue
                j = r.json()
                score = j['faces'][0]['candidate']['score']
                vistas.add(j['index_version'])
                if (j['index_version'] == 'v1') != (score == 1.0):
                    fallos.append((j['index_version'], score))

        hilos = [threading.Thread(target=buscar) for _ in range(4)]
        [h.start() for h in hilos]
        for i in range(12):
            activate(c, 'v2' if i % 2 == 0 else 'v1')
            time.sleep(0.02)
        parar.set(); [h.join() for h in hilos]
        assert not fallos, fallos[:3]
        assert vistas == {'v1', 'v2'}


def test_latencia_busqueda_20000_vectores():
    rng = np.random.default_rng(1)
    n = 20000
    v = rng.standard_normal((n, DIM)).astype(np.float32)
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    idx = LoadedIndex(IndexPayload('v', DIM, 'm', 'x', np.arange(n, dtype=np.int64), v))
    allowed = rng.choice(n, 2000, replace=False).tolist()
    q = v[allowed[:5]]
    idx.search(q, allowed)  # calentamiento
    tiempos = []
    for _ in range(10):
        t = time.perf_counter(); res = idx.search(q, allowed); tiempos.append((time.perf_counter() - t) * 1000)
    assert min(tiempos) < 50, tiempos
    assert [r[0] for r in res] == allowed[:5]
    # un id no permitido nunca aparece, aunque sea el vecino exacto
    fuera = next(i for i in range(n) if i not in set(allowed))
    (r,) = idx.search(v[fuera][None, :], allowed)
    assert r[0] != fuera


# ---------- modelos de indice ajenos (INDEX_ACCEPT_MODELS) ----------
def test_indice_de_otro_modelo_se_rechaza_por_omision(client, storage):
    build(client, storage, 'v1', {1: (10, 11)})
    # Mismo contenido, pero etiquetado con otro modelo: el modo estricto lo rechaza al activar y como base de un build.
    ajeno = parse_index(storage.get('indice/v1.json'), DIM)
    ajeno.version, ajeno.model = 'v9', 'buffalo_s'
    storage.put('indice/v9.json', dump_index(ajeno))
    r = client.post('/v1/index/activate', json={'version': 'v9'})
    assert r.status_code == 422 and r.json()['code'] == 'INDEX_INVALID'
    r = client.post('/v1/index/build', json={'version': 'v10', 'base_version': 'v9',
                                             'entries': [{'id_plantilla': 1, 'faiss_id': 10, 'keep': True}]})
    assert r.status_code == 422 and r.json()['code'] == 'INDEX_INVALID'


def test_indice_ajeno_aceptado_se_conserva_y_se_reetiqueta(settings, storage):
    # Demo bajo insightface: el indice 'buffalo_s' (vectores de otro modelo) se acepta como base y se conserva;
    # el indice nuevo queda con el modelo propio ('fake-hash' aqui) y el vector ajeno no coincide con rostros propios.
    cfg = Settings(**{**settings.__dict__, 'index_accept_models': ('buffalo_s',)})
    with TestClient(create_app(cfg, storage=storage, embedder=FakeEmbedder(DIM)), headers={'X-API-Key': KEY}) as c:
        build(c, storage, 'v1', {1: (10, 11)})
        ajeno = parse_index(storage.get('indice/v1.json'), DIM)
        ajeno.version, ajeno.model = 'v2', 'buffalo_s'
        storage.put('indice/v2.json', dump_index(ajeno))
        assert activate(c, 'v2')['model'] == 'buffalo_s'
        b = build(c, storage, 'v3', {2: (20, 22)}, base='v2', keep=[(1, 10)])
        assert b['ntotal'] == 2 and b['errores'] == []
        p = parse_index(storage.get('indice/v3.json'), DIM)
        assert p.model == 'fake-hash'
        assert np.array_equal(p.vectors[0], ajeno.vectors[0])  # el vector ajeno se conserva byte a byte
        activate(c, 'v3')
        assert recognize(c, face_image(22), [10, 20]).json()['faces'][0]['candidate']['faiss_id'] == 20


def test_accept_models_desde_el_entorno(monkeypatch):
    monkeypatch.setenv('INDEX_ACCEPT_MODELS', ' fake-hash , buffalo_s ,')
    assert Settings.from_env().index_accept_models == ('fake-hash', 'buffalo_s')
    monkeypatch.delenv('INDEX_ACCEPT_MODELS')
    assert Settings.from_env().index_accept_models == ()
