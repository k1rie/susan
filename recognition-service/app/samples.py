"""Consolidacion de las muestras de una plantilla facial (centroide con descarte de fotos ajenas).

Funcion pura (solo numpy, sin FastAPI). Entrada: los embeddings L2-normalizados de las fotos candidatas de UNA plantilla.
Salida: que fotos se usan, cuales se descartan, el coseno MEDIO de cada una contra las demas y el centroide. El centroide
solo vive en memoria (RNF-03): quien llame decide si lo indexa; nunca debe viajar en una respuesta.

Criterio de consistencia: una foto debe parecerse, en PROMEDIO, al menos `umbral` a las demas fotos que se conservan.
Mientras queden mas de 2 fotos se descarta la peor si esta por debajo y se repite. Se usa la media de pares y no el
coseno contra el centroide de las demas porque el centroide normalizado "infla" el coseno cuando las demas fotos son una
mezcla de dos personas (pierde norma): una mezcla balanceada 3+3 pasaba sin detectarse el 17 % de las veces con
el criterio del centroide y solo el 4.7 % con la media de pares (medido con rostros reales, ver README). La media de pares
ademas no divide entre normas, asi que no existe el NaN de una suma casi nula.

Aritmetica en float64: la suma en float32 depende del orden de los sumandos y cambiaria bits del centroide. El centroide
se entrega en float32 (el formato del indice).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

NORMA_MIN = 1e-9  # una suma casi nula (vectores opuestos) no define centroide


@dataclass
class Consolidacion:
    usadas: list[int]                    # indices de entrada que forman el centroide (orden original)
    descartadas: list[int]               # indices descartados, en orden de descarte
    cosenos: list[float | None]          # uno por entrada: usadas = coseno medio contra las demas usadas;
    #                                      descartadas = coseno medio contra las usadas; None si no aplica
    centroide: np.ndarray | None         # float32 (D,), L2 = 1; None si no existe. SOLO en memoria
    ambiguo: bool = False                # sin mayoria clara, o el par final no coincide, o no hay centroide
    valida: bool = False                 # no ambiguo, hay centroide y len(usadas) >= minimo
    par_final: float | None = None       # coseno del par restante cuando quedan exactamente 2
    motivos: dict = field(default_factory=dict)


def _unit(v: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, NORMA_MIN)


def _medias(e: np.ndarray, idx: list[int]) -> dict[int, float]:
    """Coseno medio de cada foto de idx contra las DEMAS de idx (requiere len(idx) >= 2)."""
    s = e[idx].sum(axis=0)
    return {k: (float(e[k] @ s) - 1.0) / (len(idx) - 1) for k in idx}  # e_k . e_k = 1


def _componentes(e: np.ndarray, idx: list[int], enlace: float) -> int:
    """Numero de componentes conexas de las fotos de idx cuando dos fotos se enlazan si su coseno es >= enlace."""
    padre = {k: k for k in idx}

    def raiz(x):
        while padre[x] != x:
            padre[x] = padre[padre[x]]
            x = padre[x]
        return x

    g = e[idx] @ e[idx].T
    for a in range(len(idx)):
        for b in range(a + 1, len(idx)):
            if g[a, b] >= enlace:
                padre[raiz(idx[a])] = raiz(idx[b])
    return len({raiz(k) for k in idx})


def consolidar(vectores: np.ndarray, umbral: float, minimo: int, enlace: float = 0.0) -> Consolidacion:
    """Ver el docstring del modulo. `umbral <= 0` apaga el descarte (modo calibracion): se conservan todas las fotos
    y solo se informan los cosenos; solo puede quedar ambiguo si no hay centroide (suma nula).

    `enlace` (> 0) es el segundo criterio: las fotos que se conservan deben formar UN solo grupo, donde dos fotos se
    enlazan si su coseno es >= enlace. La media de pares por si sola no ve una mezcla balanceada de dos personas
    (3+3, 4+4, 5+5): cuando las fotos de cada persona se parecen mucho entre si (coseno ~0.8) la media de cada foto
    cae justo en el umbral y la mezcla pasa. Con el enlace, dos grupos coherentes pero ajenos entre si quedan
    desconectados (el cruce entre personas distintas rara vez supera 0.27) y el conjunto es ambiguo. A diferencia de
    exigir un coseno minimo entre TODOS los pares, basta que cada foto tenga un solo companero parecido, asi que una
    foto genuina dificil (otra luz, otro giro) no rompe el conjunto."""
    arr = np.asarray(vectores, dtype=np.float64)
    if arr.ndim != 2 or arr.shape[0] == 0:
        return Consolidacion([], [], [], None, False, False, None)
    e = _unit(arr)
    n = e.shape[0]
    keep = list(range(n))
    descartadas: list[int] = []
    while umbral > 0 and len(keep) > 2:
        c = _medias(e, keep)
        w = min(keep, key=lambda k: (c[k], k))  # la peor; empate -> la de menor indice (determinista)
        if c[w] >= umbral:  # igual al umbral se conserva
            break
        keep.remove(w)
        descartadas.append(w)

    cosenos: list[float | None] = [None] * n
    par = None
    s = e[keep].sum(axis=0)
    ns = float(np.linalg.norm(s))
    centro = None if ns < NORMA_MIN else s / ns
    if len(keep) >= 2:
        for k, v in _medias(e, keep).items():
            cosenos[k] = v
        for k in descartadas:
            cosenos[k] = float(e[k] @ s) / len(keep)
        if len(keep) == 2:
            par = float(e[keep[0]] @ e[keep[1]])

    ambiguo = False
    motivos: dict = {}
    if n >= 2:
        if umbral > 0 and len(keep) == 2 and par is not None and par < umbral:
            ambiguo, motivos['par'] = True, True  # las dos que quedan no se parecen: no hay a quien creerle
        if len(descartadas) >= len(keep):
            ambiguo, motivos['sin_mayoria'] = True, True  # se fue la mitad o mas: no hay una persona mayoritaria
        if umbral > 0 and enlace > 0 and len(keep) >= 3 and _componentes(e, keep, enlace) > 1:
            ambiguo, motivos['desconexo'] = True, True  # dos grupos de fotos que no se parecen entre si: mezcla
        if centro is None:
            ambiguo, motivos['sin_centroide'] = True, True
    valida = (not ambiguo) and centro is not None and len(keep) >= minimo
    return Consolidacion(sorted(keep), descartadas, cosenos,
                         None if centro is None else centro.astype(np.float32), ambiguo, valida, par, motivos)


def trunc3(x: float | None) -> float | None:
    """Trunca (no redondea) a 3 decimales: un coseno por debajo del umbral jamas se muestra como el umbral."""
    return None if x is None else math.floor(float(x) * 1000) / 1000


def diversidad(vectores: np.ndarray, usadas: list[int], dup: float = 0.97) -> tuple[float | None, int]:
    """(coseno maximo entre pares distintos, numero de grupos de fotos casi identicas a coseno >= dup).
    Los grupos se forman por enlace simple: una rafaga de fotogramas casi iguales cuenta como uno solo."""
    if len(usadas) < 2:
        return None, len(usadas)
    e = _unit(np.asarray(vectores, dtype=np.float64)[usadas])
    g = e @ e.T
    m = len(usadas)
    padre = list(range(m))

    def raiz(x):
        while padre[x] != x:
            padre[x] = padre[padre[x]]
            x = padre[x]
        return x

    mx = -1.0
    for a in range(m):
        for b in range(a + 1, m):
            mx = max(mx, float(g[a, b]))
            if g[a, b] >= dup:
                padre[raiz(a)] = raiz(b)
    return mx, len({raiz(x) for x in range(m)})
