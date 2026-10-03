"""Configuracion por variables de entorno. Ningun secreto vive en el codigo."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field

VERSION_RE = re.compile(r'^[A-Za-z0-9._-]{1,12}$')

# Mismo directorio que usa el modo local de Next (LOCAL_STORAGE_DIR). scripts/local-dir.sh exporta SUSAN_LOCAL_DIR
# (fuera de iCloud si el proyecto esta en el Escritorio); sin ella, <repo>/.local/storage.
_REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DEFAULT_STORAGE_DIR = os.path.join(os.environ.get('SUSAN_LOCAL_DIR') or os.path.join(_REPO, '.local'), 'storage')


def _bool(valor: str | None, defecto: bool = False) -> bool:
    if valor is None or valor == '':
        return defecto
    return valor.strip().lower() in ('1', 'true', 'yes', 'si', 'on')


@dataclass
class Settings:
    env: str = 'development'  # 'production' exige API_KEY
    api_key: str = ''
    embedder: str = 'insightface'
    insightface_model: str = 'buffalo_s'
    model_dir: str = '.models'
    dimension: int = 512
    det_size: int = 640
    min_det_score: float = 0.5
    storage_backend: str = 'local'
    storage_dir: str = DEFAULT_STORAGE_DIR
    supabase_url: str = ''
    supabase_service_role_key: str = field(default='', repr=False)
    bucket: str = 'susan-private'
    index_bootstrap_version: str = ''
    allow_private_cameras: bool = False
    camera_timeout_s: float = 3.0
    camera_max_bytes: int = 5 * 1024 * 1024
    max_image_bytes: int = 15 * 1024 * 1024
    max_image_pixels: int = 50_000_000
    max_faces_default: int = 60
    max_faces_limit: int = 200
    max_allowed_ids: int = 100_000
    embedder_concurrency: int = 2
    # Umbrales de calidad de foto de registro (RF-15)
    min_face_px: int = 80
    min_brightness: float = 50.0
    max_brightness: float = 215.0
    min_sharpness: float = 40.0

    @classmethod
    def from_env(cls) -> 'Settings':
        e = os.environ.get
        return cls(
            env=(e('APP_ENV') or e('ENV') or 'development').lower(),
            api_key=e('API_KEY', ''),
            embedder=(e('EMBEDDER') or 'insightface').lower(),
            insightface_model=e('INSIGHTFACE_MODEL', 'buffalo_s'),
            model_dir=e('MODEL_DIR', '.models'),
            dimension=int(e('DIMENSION', '512')),
            det_size=int(e('DET_SIZE', '640')),
            min_det_score=float(e('MIN_DET_SCORE', '0.5')),
            storage_backend=(e('STORAGE_BACKEND') or 'local').lower(),
            storage_dir=e('STORAGE_DIR') or DEFAULT_STORAGE_DIR,
            supabase_url=(e('SUPABASE_URL') or '').rstrip('/'),
            supabase_service_role_key=e('SUPABASE_SERVICE_ROLE_KEY', ''),
            bucket=e('BUCKET') or 'susan-private',
            index_bootstrap_version=e('INDEX_BOOTSTRAP_VERSION', ''),
            allow_private_cameras=_bool(e('ALLOW_PRIVATE_CAMERAS')),
            camera_timeout_s=float(e('CAMERA_TIMEOUT_S', '3')),
            max_faces_default=int(e('MAX_FACES', '60')),
            embedder_concurrency=int(e('EMBEDDER_CONCURRENCY', '2')),
            min_face_px=int(e('MIN_FACE_PX', '80')),
            min_brightness=float(e('MIN_BRIGHTNESS', '50')),
            max_brightness=float(e('MAX_BRIGHTNESS', '215')),
            min_sharpness=float(e('MIN_SHARPNESS', '40')),
        )

    def validate(self) -> None:
        """Falla al arrancar (fail-fast) si la configuracion es insegura o incompleta."""
        if self.env == 'production' and not self.api_key:
            raise RuntimeError('API_KEY es obligatoria en modo produccion: el servicio no arranca sin ella.')
        if self.storage_backend not in ('local', 'supabase'):
            raise RuntimeError('STORAGE_BACKEND debe ser local o supabase.')
        if self.storage_backend == 'supabase' and not (self.supabase_url and self.supabase_service_role_key):
            raise RuntimeError('STORAGE_BACKEND=supabase requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.')
        if self.index_bootstrap_version and not VERSION_RE.match(self.index_bootstrap_version):
            raise RuntimeError('INDEX_BOOTSTRAP_VERSION invalida.')
