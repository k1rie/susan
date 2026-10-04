"""Plantilla de varias fotos: /v1/photo/check-set y /v1/index/build con objetos_foto (embedder de prueba por grupos)."""
import json
import time

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.index import parse_index
from tests.conftest import DIM, GrupoEmbedder, activate, build_multi, check_set, face_image, foto, make_client, recognize

# Semillas: el bloque de 16 es la "persona" (1..5 = persona A, 17..21 = B, 33..37 = C)
A = [1, 2, 3, 4, 5]
B = [17, 18, 19, 20, 21]
C = [33, 34, 35]


def estados(r):
    return [f['estado'] for f in r.json()['fotos']]


def _vec(storage, version='v1'):
    return parse_index(storage.get(f'indice/{version}.json'), DIM)


def _centroide(semillas):
    emb = GrupoEmbedder()
    v = sum(emb.vector_for(s).astype(np.float64) for s in semillas)
    return v / np.linalg.norm(v)


# ---------- /v1/photo/check: contrato heredado + motivo_codigo aditivo ----------
def test_photo_check_conserva_forma_y_agrega_motivo_codigo(client):
    def chk(img):
        return client.post('/v1/photo/check', files={'image': ('a.png', img, 'image/png')}).json()

    ok = chk(face_image(7, size=100))
    assert set(ok) == {'rostros', 'un_solo_rostro', 'calidad', 'motivo_rechazo', 'motivo_codigo'}
    assert ok['motivo_codigo'] is None and set(ok['calidad']) == {'brillo', 'nitidez', 'tamano_rostro_px', 'frontal'}
    assert chk(face_image())['motivo_codigo'] == 'SIN_ROSTRO'
    assert chk(face_image(7, 8, size=100))['motivo_codigo'] == 'MULTIPLES_ROSTROS'
    assert chk(face_image(7, size=50))['motivo_codigo'] == 'ROSTRO_PEQUENO'
    assert chk(face_image(7, size=50))['motivo_rechazo'].startswith('El rostro es demasiado pequeno')


# ---------- /v1/photo/check-set ----------
def test_cinco_fotos_de_la_misma_persona(client_g):
    r = check_set(client_g, [foto(s) for s in A])
    assert r.status_code == 200
    j = r.json()
    assert (j['total'], j['aceptadas'], j['minimo'], j['maximo']) == (5, 5, 3, 8)
    assert j['suficiente'] is True and j['consistente'] is True and j['ambiguo'] is False
    assert j['umbral_coseno'] == 0.35 and j['advertencias'] == []
    assert 0.6 < j['coseno_min'] <= j['coseno_medio'] <= j['coseno_max_par'] < 0.9
    for i, f in enumerate(j['fotos']):
        assert f['indice'] == i and f['estado'] == 'aceptada' and f['un_solo_rostro'] is True
        assert f['motivo_rechazo'] is None and f['motivo_codigo'] is None and 0.6 < f['coseno_resto'] < 0.9
        assert set(f['calidad']) == {'brillo', 'nitidez', 'tamano_rostro_px', 'frontal'}
    txt = json.dumps(j).lower()
    assert 'vector' not in txt and 'embedding' not in txt  # RNF-03: nunca viaja un vector


def test_cuatro_propias_y_una_ajena(client_g):
    r = check_set(client_g, [foto(s) for s in A[:4]] + [foto(B[0])])
    j = r.json()
    assert estados(r) == ['aceptada'] * 4 + ['inconsistente']
    ajena = j['fotos'][4]
    assert ajena['motivo_codigo'] == 'NO_COINCIDE' and ajena['coseno_resto'] < 0.3
    assert j['aceptadas'] == 4 and j['suficiente'] is True and j['consistente'] is False and j['ambiguo'] is False
    # los cosenos agregados solo cuentan las aceptadas
    assert j['coseno_min'] > 0.6


def test_dos_fotos_ajenas_entre_si_quedan_ambiguas(client_g):
    r = check_set(client_g, [foto(A[0]), foto(B[0])])
    j = r.json()
    assert estados(r) == ['inconsistente', 'inconsistente'] and j['ambiguo'] is True
    assert {f['motivo_codigo'] for f in j['fotos']} == {'CONJUNTO_AMBIGUO'}
    assert j['aceptadas'] == 0 and j['consistente'] is False and j['coseno_medio'] is None


def test_dos_fotos_propias_no_alcanzan_el_minimo(client_g):
    j = check_set(client_g, [foto(A[0]), foto(A[1])]).json()
    assert j['aceptadas'] == 2 and j['suficiente'] is False and j['consistente'] is True
    assert j['advertencias'] == []  # dos fotos distintas todavia no son "casi identicas"


def test_una_sola_foto_se_acepta_sin_coseno(client_g):
    j = check_set(client_g, [foto(A[0])]).json()
    assert j['aceptadas'] == 1 and j['consistente'] is None and j['coseno_medio'] is None
    assert j['fotos'][0]['estado'] == 'aceptada' and j['fotos'][0]['coseno_resto'] is None


def test_mezclas_balanceadas_son_ambiguas_y_se_rechazan_completas(client_g):
    for a, b in ((A[:3], B[:3]), (A[:2], B[:2])):
        r = check_set(client_g, [foto(s) for s in a + b])
        j = r.json()
        assert j['ambiguo'] is True and j['aceptadas'] == 0 and j['suficiente'] is False, (a, b)
        assert set(estados(r)) == {'inconsistente'}


def test_tres_personas_distintas_son_ambiguas(client_g):
    r = check_set(client_g, [foto(A[0]), foto(B[0]), foto(C[0])])
    assert r.json()['ambiguo'] is True and set(estados(r)) == {'inconsistente'}


def test_foto_sin_rostro_y_rostro_pequeno_son_de_calidad(client_g):
    r = check_set(client_g, [foto(A[0]), face_image(), face_image(A[1], size=50), foto(A[2]), foto(A[3])])
    j = r.json()
    assert estados(r) == ['aceptada', 'calidad', 'calidad', 'aceptada', 'aceptada']
    assert j['fotos'][1]['motivo_codigo'] == 'SIN_ROSTRO' and j['fotos'][2]['motivo_codigo'] == 'ROSTRO_PEQUENO'
    assert j['aceptadas'] == 3 and j['suficiente'] is True and j['consistente'] is True
    dos = check_set(client_g, [face_image(A[0], A[1], size=100), foto(A[2]), foto(A[3]), foto(A[4])]).json()
    assert dos['fotos'][0]['motivo_codigo'] == 'MULTIPLES_ROSTROS' and dos['fotos'][0]['rostros'] == 2


def test_basura_no_tumba_las_demas_fotos(client_g):
    r = check_set(client_g, [foto(A[0]), b'esto no es una imagen', foto(A[1]), foto(A[2])])
    j = r.json()
    assert r.status_code == 200 and estados(r) == ['aceptada', 'ilegible', 'aceptada', 'aceptada']
    mala = j['fotos'][1]
    assert mala['calidad'] is None and mala['motivo_codigo'] == 'IMAGEN_INVALIDA' and mala['indice'] == 1
    assert j['aceptadas'] == 3 and j['consistente'] is True


def test_imagen_enorme_en_pixeles_o_bytes_es_ilegible(settings, storage):
    grande = face_image(A[1], size=100)  # 320x200 = 64 000 px
    with make_client(settings, storage, GrupoEmbedder(), max_image_pixels=50_000) as c:
        r = check_set(c, [face_image(A[0], size=100), grande])  # ambas exceden 50 000 px
        assert estados(r) == ['ilegible', 'ilegible']
    with make_client(settings, storage, GrupoEmbedder(), max_image_bytes=20_000,
                     template_max_total_bytes=200_000) as c:
        # PNG de ~43 KB > 20 KB: ilegible; el JPEG (~12 KB) pasa
        r = check_set(c, [foto(A[0], fmt='jpeg'), foto(A[1], fmt='png'), foto(A[2], fmt='jpeg')], tipo='image/jpeg')
        assert estados(r) == ['aceptada', 'ilegible', 'aceptada']


def test_limites_de_cantidad_tamano_total_y_clave(client_g, settings, storage):
    assert check_set(client_g, []).status_code == 422
    assert client_g.post('/v1/photo/check-set').status_code == 422
    r = check_set(client_g, [foto(A[0])] * 9)
    assert r.status_code == 422 and r.json()['code'] == 'VALIDATION_ERROR'
    assert check_set(client_g, [foto(A[0])] * 8).status_code == 200
    with make_client(settings, storage, GrupoEmbedder(), max_image_bytes=100_000, template_max_total_bytes=100_000) as c:
        r = check_set(c, [foto(s) for s in A])  # 5 x ~43 KB > 100 KB
        assert r.status_code == 422 and r.json()['code'] == 'VALIDATION_ERROR'
    with TestClient(client_g.app) as sin_clave:
        r = sin_clave.post('/v1/photo/check-set', files=[('images', ('a.png', foto(1), 'image/png'))])
        assert r.status_code == 401


def test_diversidad_baja_avisa_solo_con_fotogramas_casi_identicos(client_g):
    j = check_set(client_g, [foto(A[0])] * 5).json()  # el mismo fotograma cinco veces: coseno 1
    assert j['aceptadas'] == 5 and j['advertencias'] == ['DIVERSIDAD_BAJA'] and j['coseno_max_par'] == 1.0
    assert check_set(client_g, [foto(s) for s in A]).json()['advertencias'] == []


def test_giro_compensado_en_modo_conjunto_y_heredado_intacto(settings, storage):
    emb = GrupoEmbedder(yaw={A[0]: 0.5, A[1]: 0.3})
    with make_client(settings, storage, emb) as c:
        j = check_set(c, [foto(s) for s in A]).json()
        assert j['fotos'][0]['estado'] == 'calidad' and j['fotos'][0]['motivo_codigo'] == 'NO_FRONTAL'
        assert j['fotos'][0]['calidad']['frontal'] is False
        assert j['fotos'][1]['estado'] == 'aceptada' and j['fotos'][1]['calidad']['frontal'] is True  # 0.3 < 0.40
        # el criterio heredado de /v1/photo/check no cambia: usa el booleano `frontal` del embedder
        legado = c.post('/v1/photo/check', files={'image': ('a.png', foto(A[0]), 'image/png')}).json()
        assert legado['motivo_rechazo'] is None and legado['calidad']['frontal'] is True
    with make_client(settings, storage, emb, template_max_yaw_ratio=0.6) as c:
        assert check_set(c, [foto(s) for s in A]).json()['fotos'][0]['estado'] == 'aceptada'


def test_umbral_cero_apaga_el_descarte(settings, storage):
    with make_client(settings, storage, GrupoEmbedder(), template_outlier_cosine=0) as c:
        r = check_set(c, [foto(s) for s in A[:4]] + [foto(B[0])])
        j = r.json()
        assert estados(r) == ['aceptada'] * 5 and j['consistente'] is True
        assert j['fotos'][4]['coseno_resto'] < 0.3  # sigue informando el coseno (modo calibracion)


def test_el_fake_puro_acepta_el_conjunto_sin_razon_de_giro(client):
    r = check_set(client, [foto(7)] * 3)  # semillas iguales: vectores iguales
    assert r.status_code == 200 and r.json()['aceptadas'] == 3


def test_check_set_cinco_fotos_es_rapido(client_g):
    imgs = [foto(s) for s in A]
    t = time.perf_counter()
    assert check_set(client_g, imgs).status_code == 200
    assert time.perf_counter() - t < 1.0


# ---------- Settings ----------
@pytest.mark.parametrize('cambio', [
    {'template_min_photos': 2}, {'template_max_photos': 9}, {'template_min_photos': 6, 'template_max_photos': 5},
    {'template_outlier_cosine': 1.0}, {'template_outlier_cosine': -0.1},
    {'template_build_outlier_cosine': 0.5}, {'template_build_outlier_cosine': -0.1},
    {'template_max_yaw_ratio': 0.05}, {'template_max_yaw_ratio': 1.5},
    {'template_dup_cosine': 0.5}, {'template_dup_cosine': 1.1},
    {'template_max_total_bytes': 1024},
])
def test_settings_validate_rechaza_valores_fuera_de_rango(settings, cambio):
    for k, v in cambio.items():
        setattr(settings, k, v)
    with pytest.raises(RuntimeError):
        settings.validate()


def test_settings_defectos_y_entorno(monkeypatch):
    s = Settings.from_env()
    assert (s.template_min_photos, s.template_max_photos, s.template_outlier_cosine) == (3, 8, 0.35)
    assert s.template_build_outlier_cosine is None and s.build_outlier_cosine() == 0.25
    assert (s.template_max_yaw_ratio, s.template_dup_cosine, s.template_max_total_bytes) == (0.40, 0.97, 31457280)
    s.validate()
    monkeypatch.setenv('TEMPLATE_OUTLIER_COSINE', '0.2')
    assert Settings.from_env().build_outlier_cosine() == 0.2  # min(0.25, registro)
    monkeypatch.setenv('TEMPLATE_BUILD_OUTLIER_COSINE', '0.1')
    monkeypatch.setenv('TEMPLATE_MIN_PHOTOS', '4')
    s = Settings.from_env()
    assert s.build_outlier_cosine() == 0.1 and s.template_min_photos == 4


# ---------- /v1/index/build con objetos_foto ----------
def test_build_promedia_las_fotos_en_un_solo_vector(client_g, storage):
    b = build_multi(client_g, storage, 'v1', {1: (10, A[:4])})
    assert b['errores'] == [] and b['ntotal'] == 1 and b['mapeo'] == [{'id_plantilla': 1, 'faiss_id': 10}]
    assert b['muestras'] == [{'id_plantilla': 1, 'total': 4, 'usadas': 4, 'descartadas': [],
                              'coseno_min': b['muestras'][0]['coseno_min'], 'coseno_medio': b['muestras'][0]['coseno_medio'],
                              'degradada': False}]
    assert 0.6 < b['muestras'][0]['coseno_min'] <= b['muestras'][0]['coseno_medio'] < 0.9
    p = _vec(storage)
    assert p.vectors.shape == (1, DIM) and np.allclose(p.vectors[0], _centroide(A[:4]), atol=1e-6)
    assert abs(float(np.linalg.norm(p.vectors[0])) - 1) < 1e-6
    assert 'muestras' not in json.dumps(json.loads(storage.get('indice/v1.json')))  # el JSON del indice no cambia
    # el centroide reconoce a cualquier toma de la persona y mejor que a una ajena
    activate(client_g, 'v1')
    for s in (A[4], 6, 7):
        sc = recognize(client_g, foto(s), [10]).json()['faces'][0]['candidate']['score']
        assert sc > 0.9
    assert recognize(client_g, foto(B[0]), [10]).json()['faces'][0]['candidate']['score'] < 0.6


def test_build_descarta_la_foto_ajena_y_lo_informa(client_g, storage):
    b = build_multi(client_g, storage, 'v1', {1: (10, A[:4] + [B[0]])})
    (m,) = b['muestras']
    assert b['errores'] == [] and m['total'] == 5 and m['usadas'] == 4 and m['degradada'] is True
    assert [d['indice'] for d in m['descartadas']] == [4] and m['descartadas'][0]['motivo'] == 'inconsistente'
    assert m['descartadas'][0]['coseno_resto'] < 0.3
    assert np.allclose(_vec(storage).vectors[0], _centroide(A[:4]), atol=1e-6)
    assert 'vector' not in json.dumps(b).lower()


def test_build_foto_ausente_o_ilegible_no_tumba_la_plantilla(client_g, storage):
    build_multi(client_g, storage, 'v0', {1: (10, A)}, imagenes={(1, 1): b'basura', (1, 3): face_image()})
    storage.delete('registro/1/2.png')  # la foto 2 desaparece del bucket; la 1 es basura; la 3 no tiene rostro
    b = client_g.post('/v1/index/build', json={'version': 'v2', 'base_version': None, 'entries': [
        {'id_plantilla': 1, 'faiss_id': 10, 'objetos_foto': [f'registro/1/{k}.png' for k in range(5)]}]}).json()
    (m,) = b['muestras']
    assert b['errores'] == [] and b['ntotal'] == 1 and m['total'] == 5 and m['usadas'] == 2 and m['degradada'] is True
    assert {d['indice']: d['motivo'] for d in m['descartadas']} == {1: 'ilegible', 2: 'no_encontrada', 3: 'sin_rostro'}
    assert np.allclose(_vec(storage, 'v2').vectors[0], _centroide([A[0], A[4]]), atol=1e-6)


def test_build_una_utilizable_indexa_esa_foto(client_g, storage):
    b = build_multi(client_g, storage, 'v1', {1: (10, [A[0], A[1], A[2]])},
                    imagenes={(1, 1): b'basura', (1, 2): b'basura'})
    (m,) = b['muestras']
    assert b['errores'] == [] and m['usadas'] == 1 and m['coseno_medio'] is None
    assert np.allclose(_vec(storage).vectors[0], GrupoEmbedder().vector_for(A[0]), atol=1e-6)


def test_build_todas_inutilizables_da_error_con_codigo_y_no_escribe(client_g, storage):
    b = build_multi(client_g, storage, 'v1', {1: (10, A[:3])},
                    imagenes={(1, 0): b'x', (1, 1): face_image(), (1, 2): b'y'})
    assert b['objeto_indice'] is None and b['ntotal'] == 0 and b['mapeo'] == []
    assert b['errores'] == [{'id_plantilla': 1, 'motivo': 'Ninguna de las 3 fotos es utilizable.',
                             'codigo': 'SIN_MUESTRAS_UTILIZABLES'}]
    (m,) = b['muestras']  # la respuesta explica que paso con cada foto aunque la entrada falle
    assert m['usadas'] == 0 and len(m['descartadas']) == 3
    with pytest.raises(Exception):
        storage.get('indice/v1.json')


def test_build_conjunto_ambiguo_indexa_la_primera_foto_utilizable(client_g, storage):
    b = build_multi(client_g, storage, 'v1', {1: (10, [A[0], B[0], C[0]])})
    (m,) = b['muestras']
    assert b['errores'] == [] and m['usadas'] == 1 and m['degradada'] is True
    assert [d['motivo'] for d in m['descartadas']] == ['ambigua', 'ambigua']
    assert np.allclose(_vec(storage).vectors[0], GrupoEmbedder().vector_for(A[0]), atol=1e-6)


def test_build_storage_error_de_una_foto_tumba_la_entrada(client_g, storage, monkeypatch):
    for k in range(3):
        storage.put(f'registro/1/{k}.png', foto(A[k]))
    from app.storage import StorageError
    original = storage.get

    def get(path):
        if path.endswith('/1.png'):
            raise StorageError('boom')
        return original(path)

    monkeypatch.setattr(storage, 'get', get)
    b = client_g.post('/v1/index/build', json={'version': 'v1', 'base_version': None, 'entries': [
        {'id_plantilla': 1, 'faiss_id': 10, 'objetos_foto': [f'registro/1/{k}.png' for k in range(3)]}]}).json()
    assert b['errores'] == [{'id_plantilla': 1, 'motivo': 'No se pudo leer la foto.'}] and b['objeto_indice'] is None


def test_build_determinista_y_sin_dependencia_del_orden(client_g, storage):
    build_multi(client_g, storage, 'v1', {1: (10, A)})
    build_multi(client_g, storage, 'v2', {1: (10, A)})
    assert _vec(storage, 'v1').vectors.tobytes() == _vec(storage, 'v2').vectors.tobytes()
    build_multi(client_g, storage, 'v3', {1: (10, A[::-1])})
    assert np.allclose(_vec(storage, 'v1').vectors, _vec(storage, 'v3').vectors, atol=1e-6)


def test_cambiar_el_minimo_entre_registro_y_build_no_rompe_nada(settings, storage):
    with make_client(settings, storage, GrupoEmbedder(), template_min_photos=6, template_max_photos=8) as c:
        b = build_multi(c, storage, 'v1', {1: (10, A[:3])})  # 3 fotos con minimo 6: el builder no exige minimo
        assert b['errores'] == [] and b['muestras'][0]['usadas'] == 3


def test_el_umbral_del_builder_es_independiente_del_de_registro(settings, storage):
    # Con el descarte del builder apagado (0) una foto ajena se promedia: el umbral del builder es propio
    with make_client(settings, storage, GrupoEmbedder(), template_build_outlier_cosine=0.0) as c:
        b = build_multi(c, storage, 'v1', {1: (10, A[:4] + [B[0]])})
        assert b['muestras'][0]['usadas'] == 5 and b['muestras'][0]['degradada'] is False  # descarte apagado


def test_keep_conserva_la_fila_de_una_plantilla_multifoto_byte_a_byte(client_g, storage):
    build_multi(client_g, storage, 'v1', {1: (10, A), 2: (20, B[:3])})
    b2 = build_multi(client_g, storage, 'v2', {3: (30, C)}, base='v1', keep=[(1, 10), (2, 20)])
    b3 = build_multi(client_g, storage, 'v3', {}, base='v2', keep=[(1, 10), (2, 20), (3, 30)])
    assert b2['muestras'][0]['id_plantilla'] == 3 and b3['muestras'] == []
    p1, p2, p3 = (_vec(storage, v) for v in ('v1', 'v2', 'v3'))
    assert np.array_equal(p2.vectors[:2], p1.vectors) and np.array_equal(p3.vectors, p2.vectors)


def test_formas_de_entrada_se_validan_antes_del_lock(client_g, storage):
    def post(entry, base=None):
        return client_g.post('/v1/index/build', json={'version': 'vx', 'base_version': base, 'entries': [
            {'id_plantilla': 1, 'faiss_id': 1, **entry}]})

    ok = [f'registro/{k}.png' for k in range(3)]
    assert post({'objetos_foto': ok[:1]}).status_code == 422  # 1 foto va por objeto_foto
    assert post({'objetos_foto': [f'r/{k}.png' for k in range(9)]}).status_code == 422
    assert post({'objetos_foto': ok, 'objeto_foto': 'a.png'}).status_code == 422
    assert post({'objetos_foto': ok, 'keep': True}, base='v1').status_code == 422
    assert post({'keep': True, 'objeto_foto': 'a.png'}, base='v1').status_code == 422
    assert post({}).status_code == 422
    assert post({'objetos_foto': ['', 'a.png']}).status_code == 422
    assert post({'objetos_foto': ['a.png', 'x' * 513]}).status_code == 422
    assert post({'objetos_foto': ok, 'extra': 1}).status_code == 422


def test_el_fake_puro_construye_plantillas_multifoto(client, storage):
    # Tres fotos de la misma semilla: el centroide es el vector de la semilla (el fake no tiene variacion)
    for k in range(3):
        storage.put(f'registro/1/{k}.png', face_image(11))
    b = client.post('/v1/index/build', json={'version': 'v1', 'base_version': None, 'entries': [
        {'id_plantilla': 1, 'faiss_id': 10, 'objetos_foto': [f'registro/1/{k}.png' for k in range(3)]}]}).json()
    assert b['errores'] == [] and b['muestras'][0]['usadas'] == 3
    activate(client, 'v1')
    assert recognize(client, face_image(11), [10]).json()['faces'][0]['candidate'] == {'faiss_id': 10, 'score': 1.0}
