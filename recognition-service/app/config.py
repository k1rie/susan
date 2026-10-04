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
    # Modelos de indice que se aceptan ADEMAS del propio embedder. Vacio (por omision) = estricto: un indice hecho con
    # otro modelo se rechaza. Solo para pruebas locales: permite reutilizar el indice de la demo (vectores 'fake-hash')
    # bajo insightface y viceversa, ver README y docs/DEMO.md.
    index_accept_models: tuple[str, ...] = ()
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
    # Plantilla de varias fotos (se promedian en UN vector). El minimo/maximo son la fuente de verdad del servicio; el
    # techo duro de 8 lo comparten SQL (api_plantilla_registrar) y el proxy de Next (cuerpo <= 10 MB).
    template_min_photos: int = 3
    template_max_photos: int = 8
    # Coseno MEDIO minimo de una foto contra las demas del conjunto (registro). 0 apaga el descarte (calibracion).
    template_outlier_cosine: float = 0.35
    # Umbral del constructor del indice: mas permisivo a proposito (ver build_outlier_cosine). None = min(0.25, registro)
    template_build_outlier_cosine: float | None = None
    # Segundo criterio de consistencia: las fotos conservadas deben formar UN grupo donde dos fotos se enlazan si su
    # coseno es >= este valor. Detecta mezclas balanceadas de dos personas (3+3, 4+4...) que la media de pares no ve. 0 lo apaga.
    template_link_cosine: float = 0.30
    # Razon de giro (nariz respecto al punto medio de los ojos, compensada por inclinacion) maxima: 0.40 ~ 36 grados
    template_max_yaw_ratio: float = 0.40
    # Dos fotos con coseno >= este valor se consideran casi identicas (rafaga de fotogramas)
    template_dup_cosine: float = 0.97
    # Tope de bytes de TODA la peticion /v1/photo/check-set (la web ya recorta a ~9 MiB; esto es defensa en profundidad)
    template_max_total_bytes: int = 30 * 1024 * 1024

    def build_outlier_cosine(self) -> float:
        """Umbral del constructor del indice. El registro es el filtro ESTRICTO; el constructor solo se defiende de
        fotos corruptas o ajenas de verdad, para que una plantilla ya aceptada jamas bloquee el indice ni una revocacion."""
        if self.template_build_outlier_cosine is not None:
            return self.template_build_outlier_cosine
        return min(0.25, self.template_outlier_cosine)

    def build_link_cosine(self) -> float:
        """Enlace del constructor del indice: igual de permisivo que su umbral de media (no puede ser mayor que el del registro)."""
        return min(0.20, self.template_link_cosine)

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
            index_accept_models=tuple(m.strip() for m in (e('INDEX_ACCEPT_MODELS') or '').split(',') if m.strip()),
            allow_private_cameras=_bool(e('ALLOW_PRIVATE_CAMERAS')),
            camera_timeout_s=float(e('CAMERA_TIMEOUT_S', '3')),
            max_faces_default=int(e('MAX_FACES', '60')),
            embedder_concurrency=int(e('EMBEDDER_CONCURRENCY', '2')),
            min_face_px=int(e('MIN_FACE_PX', '80')),
            min_brightness=float(e('MIN_BRIGHTNESS', '50')),
            max_brightness=float(e('MAX_BRIGHTNESS', '215')),
            min_sharpness=float(e('MIN_SHARPNESS', '40')),
            template_min_photos=int(e('TEMPLATE_MIN_PHOTOS', '3')),
            template_max_photos=int(e('TEMPLATE_MAX_PHOTOS', '8')),
            template_outlier_cosine=float(e('TEMPLATE_OUTLIER_COSINE', '0.35')),
            template_build_outlier_cosine=(
                float(e('TEMPLATE_BUILD_OUTLIER_COSINE')) if (e('TEMPLATE_BUILD_OUTLIER_COSINE') or '').strip() else None),
            template_link_cosine=float(e('TEMPLATE_LINK_COSINE', '0.30')),
            template_max_yaw_ratio=float(e('TEMPLATE_MAX_YAW_RATIO', '0.40')),
            template_dup_cosine=float(e('TEMPLATE_DUP_COSINE', '0.97')),
            template_max_total_bytes=int(e('TEMPLATE_MAX_TOTAL_BYTES', str(30 * 1024 * 1024))),
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
        # Plantilla multifoto: el 8 es techo duro compartido con SQL y con el proxy de Next (10 MB por peticion)
        if not 3 <= self.template_min_photos <= self.template_max_photos <= 8:
            raise RuntimeError('Se exige 3 <= TEMPLATE_MIN_PHOTOS <= TEMPLATE_MAX_PHOTOS <= 8.')
        if not 0 <= self.template_outlier_cosine < 1:
            raise RuntimeError('TEMPLATE_OUTLIER_COSINE debe estar en [0, 1).')
        if not 0 <= self.build_outlier_cosine() <= self.template_outlier_cosine:
            raise RuntimeError('TEMPLATE_BUILD_OUTLIER_COSINE debe estar entre 0 y TEMPLATE_OUTLIER_COSINE.')
        if not 0 <= self.template_link_cosine < 1:
            raise RuntimeError('TEMPLATE_LINK_COSINE debe estar en [0, 1).')
        if not 0.1 <= self.template_max_yaw_ratio <= 1:
            raise RuntimeError('TEMPLATE_MAX_YAW_RATIO debe estar en [0.1, 1].')
        if not 0.8 <= self.template_dup_cosine <= 1:
            raise RuntimeError('TEMPLATE_DUP_COSINE debe estar en [0.8, 1].')
        if self.template_max_total_bytes < self.max_image_bytes:
            raise RuntimeError('TEMPLATE_MAX_TOTAL_BYTES no puede ser menor que el tope de una imagen.')
