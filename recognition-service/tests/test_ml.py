"""Humo REAL con InsightFace buffalo_s. Opcional: descarga modelos (requiere red). Ejecutar: pytest -m ml"""
import numpy as np
import pytest

from app.config import Settings
from app.embedders import create_embedder

pytestmark = pytest.mark.ml


def test_insightface_mismo_rostro_supera_a_otro_rostro(tmp_path):
    skimage = pytest.importorskip('skimage.data')
    emb = create_embedder(Settings(embedder='insightface', model_dir=str(tmp_path / 'models')))
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
