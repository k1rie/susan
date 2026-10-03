"""Errores de dominio con codigo estable; el handler los serializa como {code, message}."""


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, extra: dict | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.extra = extra or {}


def unauthorized() -> ApiError:
    return ApiError(401, 'UNAUTHORIZED', 'API key ausente o invalida.')


def index_not_loaded() -> ApiError:
    return ApiError(409, 'INDEX_NOT_LOADED', 'No hay un indice facial cargado; use /v1/index/activate.')


def invalid_image(msg: str = 'La imagen no es valida.') -> ApiError:
    return ApiError(422, 'INVALID_IMAGE', msg)


def validation(msg: str, code: str = 'VALIDATION_ERROR') -> ApiError:
    return ApiError(422, code, msg)
