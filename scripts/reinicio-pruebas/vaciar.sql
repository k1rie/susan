-- Vacía los datos de la base para reiniciar una ronda de pruebas (lo ejecuta scripts/reinicio-pruebas.mjs dentro de UNA transacción).
-- Conserva el esquema, los valores de `parametro_sistema` (la app no funciona sin sus claves) y la cuenta de servicio del programador de tareas.
-- No lleva BEGIN/COMMIT: el que lo llama decide (el script hace COMMIT; las pruebas locales hacen ROLLBACK).

-- La bitácora es de solo inserción (RNF-08) con triggers ENABLE ALWAYS: sin desactivarlos no hay forma de vaciarla, y sin vaciarla no se
-- pueden borrar los usuarios (fk_bitacora_usuario es RESTRICT). Se reactivan más abajo, antes de salir de la transacción.
ALTER TABLE public.bitacora_auditoria DISABLE TRIGGER trg_bitacora_sin_cambios;
ALTER TABLE public.bitacora_auditoria DISABLE TRIGGER trg_bitacora_sin_truncate;

-- parametro_sistema referencia a usuario (actualizado_por) y PostgreSQL solo deja truncar una tabla referenciada si TODAS las que la
-- referencian van en la misma sentencia. Se respaldan los valores y se reinsertan al final (se pierde solo quién los modificó).
CREATE TEMP TABLE _parametros ON COMMIT DROP AS
    SELECT clave, valor, descripcion, fecha_actualizacion FROM public.parametro_sistema;

-- Todas las tablas de datos en un solo TRUNCATE: así las llaves foráneas entre ellas no estorban y, si alguna tabla nueva las referencia
-- y falta aquí, PostgreSQL falla con un error claro y la transacción se revierte entera (no queda nada a medias).
TRUNCATE TABLE
    public.deteccion, public.captura, public.asistencia, public.justificante,
    public.plantilla_foto, public.plantilla_facial, public.consentimiento, public.indice_faiss,
    public.inscripcion, public.sesion_clase, public.horario_grupo, public.grupo,
    public.camara, public.aula, public.materia, public.alumno, public.docente,
    public.bitacora_auditoria, public.usuario, public.parametro_sistema
    RESTART IDENTITY;

TRUNCATE TABLE app.bloqueo;

-- El reloj de demostración por tabla (0236) existe solo en Supabase; si quedara una fila, app.now() devolvería una hora vieja y toda captura
-- real se rechazaría como MARCA_FUTURA.
DO $$
BEGIN
    IF to_regclass('app.reloj_demo') IS NOT NULL THEN
        DELETE FROM app.reloj_demo;
    END IF;
END
$$;

ALTER TABLE public.bitacora_auditoria ENABLE ALWAYS TRIGGER trg_bitacora_sin_cambios;
ALTER TABLE public.bitacora_auditoria ENABLE ALWAYS TRIGGER trg_bitacora_sin_truncate;

-- Cuenta de servicio (misma fila que inserta 0040_parametros.sql): sin fila en auth.users, no inicia sesión; app.asumir_cuenta_servicio() la usa.
INSERT INTO public.usuario (auth_uid, correo, rol, activo)
VALUES ('00000000-0000-4000-8000-000000000001', 'servicio@susan.local', 'tecnico', true);

INSERT INTO public.parametro_sistema (clave, valor, descripcion, fecha_actualizacion)
    SELECT clave, valor, descripcion, fecha_actualizacion FROM _parametros;
