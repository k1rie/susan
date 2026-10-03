"""Descarga de un fotograma desde una camara IP con salvaguardas anti-SSRF."""
from __future__ import annotations

import ipaddress
import socket
import time
from urllib.parse import urlsplit

import httpx

from app.errors import ApiError

METADATA_HOSTS = {'metadata.google.internal', 'metadata', 'instance-data'}


# Metadatos de nube: se bloquean SIEMPRE, aun con ALLOW_PRIVATE_CAMERAS (169.254.169.254 ya cae por link-local).
ALWAYS_BLOCKED = (ipaddress.ip_address('fd00:ec2::254'), ipaddress.ip_address('100.100.100.200'))


def _blocked(ip: ipaddress._BaseAddress, allow_private: bool) -> bool:
    if getattr(ip, 'ipv4_mapped', None):
        ip = ip.ipv4_mapped
    if ip.is_link_local or ip.is_unspecified or ip.is_multicast or ip.is_reserved or ip in ALWAYS_BLOCKED:
        return True
    # Loopback, redes privadas, CGNAT 100.64.0.0/10 y demas rangos no globales: solo si el operador declaro que
    # las camaras estan en su LAN (ALLOW_PRIVATE_CAMERAS=1). Una IP publica (global) siempre se permite.
    if not ip.is_global:
        return not allow_private
    return False


def validate_camera_url(url: str, allow_private: bool) -> None:
    parts = urlsplit(url)
    if parts.scheme not in ('http', 'https') or not parts.hostname:
        raise ApiError(422, 'CAMERA_URL_BLOCKED', 'camera_url debe ser http o https.')
    if parts.username or parts.password:
        raise ApiError(422, 'CAMERA_URL_BLOCKED', 'camera_url no admite credenciales incrustadas.')
    host = parts.hostname.lower()
    if host in METADATA_HOSTS:
        raise ApiError(422, 'CAMERA_URL_BLOCKED', 'Direccion no permitida.')
    try:
        infos = socket.getaddrinfo(host, parts.port or (443 if parts.scheme == 'https' else 80), type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError):
        raise ApiError(504, 'CAMERA_UNREACHABLE', 'No se pudo resolver el host de la camara.') from None
    for info in infos:
        if _blocked(ipaddress.ip_address(info[4][0].split('%')[0]), allow_private):
            raise ApiError(422, 'CAMERA_URL_BLOCKED', 'Direccion no permitida para camaras.')


def fetch_snapshot(url: str, allow_private: bool, timeout_s: float, max_bytes: int) -> bytes:
    validate_camera_url(url, allow_private)
    try:
        # Sin redirecciones: un 302 podria apuntar a una direccion interna saltando la validacion.
        # Nota: queda una ventana minima de DNS-rebinding entre validar y conectar (aceptada, ver README).
        with httpx.Client(timeout=httpx.Timeout(timeout_s), follow_redirects=False) as client:
            with client.stream('GET', url) as r:
                if r.status_code != 200:
                    raise ApiError(504, 'CAMERA_UNREACHABLE', f'La camara respondio {r.status_code}.')
                declared = r.headers.get('content-length')
                if declared and declared.isdigit() and int(declared) > max_bytes:
                    raise ApiError(422, 'CAMERA_RESPONSE_TOO_LARGE', 'El fotograma excede el tamano maximo.')
                buf = bytearray()
                limite = time.monotonic() + timeout_s * 2  # tope total: el timeout de httpx es por operacion
                for chunk in r.iter_bytes():
                    if time.monotonic() > limite:
                        raise ApiError(504, 'CAMERA_UNREACHABLE', 'La camara tardo demasiado en responder.')
                    buf += chunk
                    if len(buf) > max_bytes:
                        raise ApiError(422, 'CAMERA_RESPONSE_TOO_LARGE', 'El fotograma excede el tamano maximo.')
                return bytes(buf)
    except httpx.HTTPError:
        raise ApiError(504, 'CAMERA_UNREACHABLE', 'Camara inalcanzable.') from None
