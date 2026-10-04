"""Carga del indice al arrancar: version fijada, version en uso de la base, o ninguna."""
import httpx
import pytest

from app.storage import LocalStorage, StorageError, SupabaseStorage
from tests.conftest import activate, build, make_client


class StorageConBase(LocalStorage):
    """LocalStorage que ademas responde la version en uso, como lo haria Supabase."""

    def __init__(self, root, bucket, en_uso=None, falla=False):
        super().__init__(root, bucket)
        self.en_uso = en_uso
        self.falla = falla

    def active_index_version(self):
        if self.falla:
            raise StorageError('RPC svc_indice_en_uso fallo (500).')
        return self.en_uso


def preparar_indice(settings, storage):
    with make_client(settings, storage) as c:
        build(c, storage, 'v001', {1: (1, 11), 2: (2, 22)})
        activate(c, 'v001')


def test_arranca_con_el_indice_en_uso_de_la_base(settings, storage):
    preparar_indice(settings, storage)
    st = StorageConBase(settings.storage_dir, settings.bucket, en_uso='v001')
    with make_client(settings, st) as c:
        assert c.get('/health').json()['index_loaded'] is True


def test_la_version_fijada_tiene_prioridad(settings, storage):
    preparar_indice(settings, storage)
    st = StorageConBase(settings.storage_dir, settings.bucket, en_uso='v999')
    with make_client(settings, st, index_bootstrap_version='v001') as c:
        assert c.get('/health').json()['index_loaded'] is True


def test_sin_indice_en_uso_arranca_vacio(settings, storage):
    st = StorageConBase(settings.storage_dir, settings.bucket, en_uso=None)
    with make_client(settings, st) as c:
        assert c.get('/health').json()['index_loaded'] is False


def test_si_la_base_falla_el_servicio_arranca_igual(settings, storage):
    st = StorageConBase(settings.storage_dir, settings.bucket, falla=True)
    with make_client(settings, st) as c:
        assert c.get('/health').json() == {'status': 'ok', 'embedder': 'fake', 'index_loaded': False}


def test_version_en_uso_inexistente_no_tumba_el_arranque(settings, storage):
    st = StorageConBase(settings.storage_dir, settings.bucket, en_uso='v404')
    with make_client(settings, st) as c:
        assert c.get('/health').json()['index_loaded'] is False


def _supabase(respuesta):
    vistas = []

    def manejar(req: httpx.Request):
        vistas.append(req)
        return respuesta

    return SupabaseStorage('https://x.supabase.co/', 'clave-srv', 'b', client=httpx.Client(transport=httpx.MockTransport(manejar))), vistas


def test_supabase_lee_la_version_por_rpc():
    st, vistas = _supabase(httpx.Response(200, json={'id_indice': 4, 'version': 'v004', 'objeto_indice': 'indice/v004.json'}))
    assert st.active_index_version() == 'v004'
    req = vistas[0]
    assert req.method == 'POST' and str(req.url) == 'https://x.supabase.co/rest/v1/rpc/svc_indice_en_uso'
    assert req.headers['apikey'] == 'clave-srv' and req.headers['authorization'] == 'Bearer clave-srv'


def test_supabase_sin_indice_devuelve_none():
    # PostgREST responde el literal null cuando la funcion devuelve NULL
    st, _ = _supabase(httpx.Response(200, content=b'null', headers={'Content-Type': 'application/json'}))
    assert st.active_index_version() is None


def test_supabase_error_lanza_storage_error():
    st, _ = _supabase(httpx.Response(500, json={'message': 'x'}))
    with pytest.raises(StorageError):
        st.active_index_version()
