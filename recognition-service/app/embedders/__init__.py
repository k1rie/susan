"""Embedders enchufables (EMBEDDER=insightface|fake)."""
from app.embedders.base import DetectedFace, Embedder


def create_embedder(settings) -> Embedder:
    """Fabrica del embedder; los imports son perezosos para no exigir insightface con EMBEDDER=fake."""
    nombre = settings.embedder
    if nombre == 'fake':
        from app.embedders.fake import FakeEmbedder
        return FakeEmbedder(dimension=settings.dimension)
    if nombre == 'insightface':
        from app.embedders.insight import InsightFaceEmbedder
        return InsightFaceEmbedder(
            model_dir=settings.model_dir,
            model_name=settings.insightface_model,
            dimension=settings.dimension,
            det_size=settings.det_size,
            min_det_score=settings.min_det_score,
        )
    raise ValueError(f'EMBEDDER desconocido: {nombre!r} (use insightface o fake)')


__all__ = ['DetectedFace', 'Embedder', 'create_embedder']
