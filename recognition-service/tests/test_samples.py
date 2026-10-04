"""Consolidacion de muestras (app/samples.py): funcion pura, con vectores de coseno controlado y semillas fijas."""
import math

import numpy as np
import pytest

from app.samples import consolidar, diversidad, trunc3

D = 64
UMBRAL = 0.35


def _unit(v):
    return v / np.linalg.norm(v)


def grupo(n, s=0.6, seed=0, dim=D):
    """n vectores v_i = norm(u + s * n_i) de la MISMA persona (u comun, n_i ruido): coseno entre pares ~ 1 / (1 + s^2)."""
    rng = np.random.default_rng(seed)
    u = _unit(rng.standard_normal(dim))
    return np.stack([_unit(u + s * _unit(rng.standard_normal(dim))) for _ in range(n)])


def ajeno(seed=100, dim=D):
    return _unit(np.random.default_rng(seed).standard_normal(dim))


def test_todas_consistentes_usan_todas_y_el_centroide_es_la_suma_normalizada():
    e = grupo(5)
    c = consolidar(e, UMBRAL, 3)
    assert c.usadas == [0, 1, 2, 3, 4] and c.descartadas == [] and not c.ambiguo and c.valida
    assert c.centroide.dtype == np.float32 and c.centroide.shape == (D,)
    assert np.allclose(c.centroide, _unit(e.sum(axis=0)), atol=1e-6)
    assert abs(float(np.linalg.norm(c.centroide)) - 1.0) < 1e-6
    assert all(x is not None and x > UMBRAL for x in c.cosenos)


def test_una_ajena_se_descarta_y_no_contamina_el_centroide():
    e = np.vstack([grupo(4), ajeno()[None]])
    c = consolidar(e, UMBRAL, 3)
    assert c.descartadas == [4] and c.usadas == [0, 1, 2, 3] and c.valida
    assert np.allclose(c.centroide, _unit(e[:4].sum(axis=0)), atol=1e-6)
    assert c.cosenos[4] < UMBRAL < min(c.cosenos[:4])


def test_dos_ajenas_entre_cinco_se_descartan_en_dos_pasos():
    e = np.vstack([grupo(3), ajeno(101)[None], ajeno(102)[None]])
    c = consolidar(e, UMBRAL, 3)
    assert sorted(c.descartadas) == [3, 4] and c.usadas == [0, 1, 2] and c.valida and not c.ambiguo


def test_con_tres_fotos_una_o_dos_ajenas():
    uno = consolidar(np.vstack([grupo(2), ajeno()[None]]), UMBRAL, 3)
    assert uno.descartadas == [2] and uno.usadas == [0, 1]
    assert not uno.ambiguo and not uno.valida  # quedan 2 < minimo 3: no es una plantilla valida
    dos = consolidar(np.vstack([grupo(1), ajeno(101)[None], ajeno(102)[None]]), UMBRAL, 3)
    assert dos.ambiguo and not dos.valida  # sin mayoria: no se sabe quien es el propietario


def test_empate_en_el_reparto_es_ambiguo():
    for a, b in ((3, 3), (2, 2)):
        e = np.vstack([grupo(a, seed=1), grupo(b, seed=2)])
        c = consolidar(e, UMBRAL, 3)
        assert c.ambiguo and not c.valida, (a, b)


def test_par_final_ajeno_es_ambiguo():
    c = consolidar(np.vstack([ajeno(1)[None], ajeno(2)[None]]), UMBRAL, 3)
    assert c.ambiguo and c.par_final is not None and c.par_final < UMBRAL and not c.valida


def test_vectores_opuestos_y_suma_nula_no_dan_nan():
    v = ajeno()
    c = consolidar(np.stack([v, -v]), UMBRAL, 3)
    assert c.ambiguo and c.centroide is None and not c.valida
    assert all(x is None or math.isfinite(x) for x in c.cosenos)
    # ya con el umbral apagado: la suma nula sigue sin definir centroide
    c0 = consolidar(np.stack([v, -v]), 0, 1)
    assert c0.centroide is None and c0.ambiguo and not c0.valida


def test_casos_limite_de_tamano():
    assert consolidar(np.zeros((0, D)), UMBRAL, 3).usadas == []
    uno = consolidar(ajeno()[None], UMBRAL, 3)
    assert uno.usadas == [0] and uno.cosenos == [None] and not uno.ambiguo and not uno.valida
    assert np.allclose(uno.centroide, ajeno(), atol=1e-6)
    dos = consolidar(grupo(2), UMBRAL, 3)
    assert dos.usadas == [0, 1] and dos.par_final is not None and not dos.ambiguo and not dos.valida
    assert consolidar(grupo(2), UMBRAL, 2).valida


def test_un_coseno_igual_al_umbral_se_conserva():
    from app.samples import _medias, _unit as unit_interno
    a = np.array([[1.0, 0, 0], [0.5, math.sqrt(3) / 2, 0], [0.5, math.sqrt(3) / 6, math.sqrt(2 / 3)]])
    exacto = min(_medias(unit_interno(a), [0, 1, 2]).values())  # el mismo calculo bit a bit que hace consolidar
    assert consolidar(a, exacto, 3).descartadas == []  # >=: igual al umbral se conserva
    assert consolidar(a, float(np.nextafter(exacto, 1)), 3).descartadas  # un epsilon por encima: cae


def test_desempate_por_menor_indice():
    # Tres fotos exactamente simetricas: la peor es cualquiera; debe caer la de menor indice
    a = np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]], dtype=float)
    c = consolidar(a, 0.1, 1)
    assert c.descartadas[0] == 0


def test_umbral_cero_apaga_el_descarte():
    e = np.vstack([grupo(3), ajeno()[None]])
    c = consolidar(e, 0, 3)
    assert c.descartadas == [] and c.usadas == [0, 1, 2, 3] and not c.ambiguo and c.valida
    assert c.cosenos[3] < 0.3  # el coseno se informa aunque no se descarte


def test_idempotente_e_independiente_del_orden_como_propiedades():
    rng = np.random.default_rng(42)
    for caso in range(200):
        n_prop, n_aj = int(rng.integers(2, 7)), int(rng.integers(0, 3))
        e = np.vstack([grupo(n_prop, s=float(rng.uniform(0.3, 1.2)), seed=caso)]
                      + [ajeno(1000 + caso * 3 + k)[None] for k in range(n_aj)])
        base = consolidar(e, UMBRAL, 3)
        # Idempotencia: aplicar a su propia salida no descarta nada mas
        if not base.ambiguo and len(base.usadas) >= 3:
            otra = consolidar(e[base.usadas], UMBRAL, 3)
            assert otra.descartadas == [], caso
        # Orden: la misma decision (por indices ORIGINALES) con las fotos permutadas
        perm = rng.permutation(len(e))
        perm_c = consolidar(e[perm], UMBRAL, 3)
        assert perm_c.ambiguo == base.ambiguo, caso
        assert sorted(int(perm[k]) for k in perm_c.usadas) == base.usadas, caso
        if base.centroide is not None and perm_c.centroide is not None:
            assert np.allclose(base.centroide, perm_c.centroide, atol=1e-6), caso


def test_trunc3_no_redondea_hacia_arriba():
    assert trunc3(0.3499999) == 0.349 and trunc3(0.3501) == 0.35 and trunc3(None) is None
    assert trunc3(0.9999) == 0.999 and trunc3(-0.0004) == -0.001


def test_diversidad_agrupa_fotogramas_casi_identicos():
    base = grupo(1)[0]
    rafaga = np.stack([_unit(base + 0.01 * np.random.default_rng(k).standard_normal(D)) for k in range(4)])
    otras = grupo(2, s=1.5, seed=9)
    e = np.vstack([rafaga, otras])
    mx, grupos = diversidad(e, list(range(len(e))), 0.97)
    assert mx > 0.97 and grupos <= 3
    mx2, grupos2 = diversidad(rafaga, [0, 1, 2, 3], 0.97)
    assert grupos2 == 1
    assert diversidad(e, [0], 0.97) == (None, 1)
    assert diversidad(grupo(4, s=2.0), [0, 1, 2, 3], 0.97)[1] == 4


def _mezcla_coherente(n, intra_s=0.5, cruce=None, dim=D):
    """n fotos de A + n de B; cada persona muy coherente (coseno intra ~0.8) y cruce ~0.07: la media de pares de cada
    foto queda en ~0.36, justo sobre el umbral, que es el caso que la media sola no detecta."""
    cruce = cruce if cruce is not None else (0.16 if n == 3 else 0.09)  # con 3+3 hace falta mas cruce para rozar el umbral
    rng = np.random.default_rng(7)
    ua = _unit(rng.standard_normal(dim))
    w = rng.standard_normal(dim)
    w = _unit(w - (w @ ua) * ua)
    ub = cruce * ua + math.sqrt(1 - cruce ** 2) * w

    def fotos(u):
        return np.stack([_unit(u + intra_s * _unit(rng.standard_normal(dim))) for _ in range(n)])
    return np.vstack([fotos(ua), fotos(ub)])


@pytest.mark.parametrize('n', [3, 4, 5])
def test_mezcla_balanceada_coherente_pasa_la_media_pero_no_el_enlace(n):
    e = _mezcla_coherente(n)
    sin = consolidar(e, UMBRAL, 3)  # solo la media de pares: el hueco que este criterio cierra
    assert sin.valida and not sin.ambiguo, 'la precondicion de la prueba: la media sola NO detecta esta mezcla'
    con = consolidar(e, UMBRAL, 3, enlace=0.30)
    assert con.ambiguo and not con.valida and con.motivos.get('desconexo')


def test_el_enlace_no_rechaza_un_conjunto_genuino_ni_una_foto_dificil():
    e = grupo(5, s=0.6, seed=3)
    assert consolidar(e, UMBRAL, 3, enlace=0.30).valida
    # Una foto dificil (poco parecida a la mayoria pero con UN companero parecido) mantiene el grupo conectado
    base = grupo(4, s=0.5, seed=4)
    dificil = _unit(base[0] * 0.45 + ajeno(55) * 0.9)
    c = consolidar(np.vstack([base, dificil[None]]), 0.20, 3, enlace=0.30)
    assert not c.ambiguo


def test_el_enlace_se_apaga_con_cero_y_en_modo_calibracion():
    e = _mezcla_coherente(4)
    assert consolidar(e, UMBRAL, 3, enlace=0.0).valida
    assert consolidar(e, 0, 3, enlace=0.30).valida  # umbral 0 apaga el descarte y tambien el enlace
