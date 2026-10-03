"""Almacenamiento de objetos con interfaz comun get/put/delete (local o Supabase Storage)."""
from __future__ import annotations

import os
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path
from urllib.parse import quote

import httpx


class ObjectNotFound(Exception):
    pass


class StorageError(Exception):
    pass


def check_object_path(path: str) -> str:
    """Rechaza rutas que escapen del bucket (traversal) o absolutas."""
    if not path or path.startswith('/') or '\\' in path or '\x00' in path:
        raise StorageError('Ruta de objeto invalida.')
    if any(p in ('..', '.', '') for p in path.split('/')):
        raise StorageError('Ruta de objeto invalida.')
    return path


class Storage(ABC):
    @abstractmethod
    def get(self, path: str) -> bytes: ...

    @abstractmethod
    def put(self, path: str, data: bytes, content_type: str = 'application/octet-stream') -> None: ...

    @abstractmethod
    def delete(self, path: str) -> None: ...


class LocalStorage(Storage):
    """Disco: <root>/<bucket>/<objeto>. Misma disposicion que el modo local de Next."""

    def __init__(self, root: str, bucket: str):
        self.base = Path(root).expanduser().resolve() / bucket

    def _file(self, path: str) -> Path:
        check_object_path(path)
        f = (self.base / path).resolve()
        if self.base not in f.parents:
            raise StorageError('Ruta de objeto invalida.')
        return f

    def get(self, path: str) -> bytes:
        f = self._file(path)
        try:
            return f.read_bytes()
        except (FileNotFoundError, IsADirectoryError):
            raise ObjectNotFound(path) from None

    def put(self, path: str, data: bytes, content_type: str = 'application/octet-stream') -> None:
        f = self._file(path)
        f.parent.mkdir(parents=True, exist_ok=True)
        # Escritura atomica: un lector nunca ve un indice a medias
        fd, tmp = tempfile.mkstemp(dir=f.parent, prefix='.tmp-')
        try:
            with os.fdopen(fd, 'wb') as fh:
                fh.write(data)
            os.replace(tmp, f)
        except BaseException:
            if os.path.exists(tmp):
                os.unlink(tmp)
            raise

    def delete(self, path: str) -> None:
        try:
            self._file(path).unlink()
        except FileNotFoundError:
            pass


class SupabaseStorage(Storage):
    """Storage REST con service_role. La llave solo viaja en cabecera, nunca en logs."""

    def __init__(self, url: str, service_role_key: str, bucket: str, client: httpx.Client | None = None):
        self.base = f'{url.rstrip("/")}/storage/v1/object'
        self.bucket = bucket
        self.client = client or httpx.Client(timeout=httpx.Timeout(60.0, connect=10.0))
        self.headers = {'Authorization': f'Bearer {service_role_key}', 'apikey': service_role_key}

    def _url(self, path: str) -> str:
        check_object_path(path)
        return f'{self.base}/{quote(self.bucket)}/{quote(path, safe="/")}'

    def get(self, path: str) -> bytes:
        r = self.client.get(self._url(path), headers=self.headers)
        if r.status_code in (400, 404):  # Supabase responde 400/404 para objeto inexistente
            raise ObjectNotFound(path)
        if r.status_code != 200:
            raise StorageError(f'Storage GET fallo ({r.status_code}).')
        return r.content

    def put(self, path: str, data: bytes, content_type: str = 'application/octet-stream') -> None:
        headers = {**self.headers, 'Content-Type': content_type, 'x-upsert': 'true'}
        r = self.client.post(self._url(path), headers=headers, content=data)
        if r.status_code not in (200, 201):
            raise StorageError(f'Storage PUT fallo ({r.status_code}).')

    def delete(self, path: str) -> None:
        r = self.client.delete(self._url(path), headers=self.headers)
        if r.status_code not in (200, 204, 400, 404):
            raise StorageError(f'Storage DELETE fallo ({r.status_code}).')


def create_storage(settings) -> Storage:
    if settings.storage_backend == 'supabase':
        return SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key, settings.bucket)
    return LocalStorage(settings.storage_dir, settings.bucket)
