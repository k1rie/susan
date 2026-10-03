-- 0002 · Dominios enumerados (spec Tabla 13): los 13 de la especificacion + tipo_camara.
-- Se eligio ENUM y no tabla de catalogo porque son dominios pequenos y estables cuyos valores
-- gobiernan la logica del sistema; ALTER TYPE ... ADD VALUE agrega valores sin reescribir tablas.

CREATE TYPE public.estatus_alumno AS ENUM ('activo', 'baja_temporal', 'baja_definitiva', 'egresado');
CREATE TYPE public.estatus_docente AS ENUM ('activo', 'licencia', 'baja');
CREATE TYPE public.estatus_inscripcion AS ENUM ('activa', 'baja');
CREATE TYPE public.modo_registro_sesion AS ENUM ('automatico', 'manual');
-- Extension a la spec (4.3): 'suspendida' se excluye del denominador de RN-11.
CREATE TYPE public.estatus_sesion AS ENUM ('programada', 'abierta', 'cerrada', 'suspendida');
CREATE TYPE public.estado_asistencia AS ENUM ('presente', 'retardo', 'ausente', 'pendiente', 'justificado');
CREATE TYPE public.origen_asistencia AS ENUM ('automatico', 'manual', 'correccion');
CREATE TYPE public.estatus_justificante AS ENUM ('pendiente', 'aprobado', 'rechazado');
CREATE TYPE public.estatus_consentimiento AS ENUM ('vigente', 'revocado', 'vencido');
CREATE TYPE public.posicion_camara AS ENUM ('frente', 'fondo');
CREATE TYPE public.estatus_camara AS ENUM ('activa', 'inactiva', 'mantenimiento');
CREATE TYPE public.rol_usuario AS ENUM ('administrador', 'docente', 'alumno', 'tecnico');
CREATE TYPE public.accion_bitacora AS ENUM (
    'consulta', 'correccion', 'aprobacion_justificante', 'rechazo_justificante',
    'alta_plantilla', 'cambio_parametro', 'cierre_sesion', 'notificacion'
);

-- Extension: una camara puede ser IP (snapshot por red) o la webcam del navegador del docente.
CREATE TYPE public.tipo_camara AS ENUM ('ip', 'navegador');
