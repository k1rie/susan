-- Fixtures reutilizables por TODAS las pruebas SQL (db-schema, db-api-a, db-api-b).
-- Se aplica una vez junto con _harness.sql; cada prueba llama t.cargar_fixtures() DENTRO de su
-- transaccion (que termina en ROLLBACK), asi cada archivo parte del mismo catalogo limpio.
--
-- Reloj fijo: lunes 14-sep-2026 07:12 hora del plantel (13:12 UTC), como el escenario de la spec.
--
-- Catalogo (claves naturales; usa los ayudantes t.id_*() en vez de ids fijos):
--   Aulas      A-12 (camaras: frente IP activa 10.20.0.12, fondo navegador activa) · B-04 (frente IP inactiva)
--   Materias   ADM101, CON202 · Docentes D001 (Ana Lopez), D002 (Luis Perez)
--   Grupos     3A (ADM101, D001, A-12, lun/mie 07:00-08:00) · 5B (CON202, D002, B-04, lun 09:00-10:00)
--   Alumnos    A001 (3A, consentimiento vigente, plantilla activa en indice v001)
--              A002 (3A, consentimiento vigente, sin plantilla)
--              A003 (3A con inscripcion en BAJA, consentimiento vigente)
--              A004 (solo 5B, consentimiento vigente, plantilla activa en v001)
--              A005 (3A, consentimiento REVOCADO)   A006 (3A, consentimiento 'vigente' pero vencido por fecha)
--   Indices    v001 (en uso, 2 vectores) · v002 (sin usar)
--   Cuentas    admin@ docente1@ docente2@ alumno1@ alumno2@ alumno4@ tecnico@ (todas @susan.test)
--              alumno5@susan.test = cuenta INACTIVA de A005 · servicio@susan.local = cuenta de servicio (migracion 0040)
--   Sesiones   3A: 07-sep cerrada, 14-sep ABIERTA (automatico), 16-sep programada · 5B: 07-sep cerrada, 14-sep ABIERTA (manual)
--   Asistencia 3A 07-sep: A001 presente(auto) A002 ausente(auto) A005 retardo(manual) A006 presente(manual)
--              3A 14-sep: A001 pendiente(auto, 1 lectura) · 5B 07-sep: A004 presente(manual)
--   Capturas   3A 14-sep: 2 capturas de la camara frente de A-12 con 3 detecciones
--   Justificante pendiente de A002 (3A 07-sep) registrado por alumno2@ · 1 evento de bitacora ('consulta' de docente1@)

CREATE FUNCTION t.id_alumno(p_matricula text) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT id_alumno FROM public.alumno WHERE matricula = p_matricula $$;
CREATE FUNCTION t.id_docente(p_num text) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT id_docente FROM public.docente WHERE num_empleado = p_num $$;
CREATE FUNCTION t.id_aula(p_clave text) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT id_aula FROM public.aula WHERE clave = p_clave $$;
CREATE FUNCTION t.id_materia(p_clave text) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT id_materia FROM public.materia WHERE clave = p_clave $$;
CREATE FUNCTION t.id_grupo(p_clave_grupo text) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT id_grupo FROM public.grupo WHERE clave_grupo = p_clave_grupo AND periodo = '2026-2' $$;
CREATE FUNCTION t.id_sesion(p_clave_grupo text, p_fecha date) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT s.id_sesion FROM public.sesion_clase s WHERE s.id_grupo = t.id_grupo(p_clave_grupo) AND s.fecha = p_fecha $$;
CREATE FUNCTION t.id_camara(p_aula text, p_posicion text) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT id_camara FROM public.camara WHERE id_aula = t.id_aula(p_aula) AND posicion = p_posicion::public.posicion_camara $$;
CREATE FUNCTION t.id_usuario(p_correo text) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT id_usuario FROM public.usuario WHERE correo = p_correo $$;
-- Primer consentimiento del alumno (los fixtures crean uno por alumno).
CREATE FUNCTION t.id_consent(p_matricula text) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT min(id_consent) FROM public.consentimiento WHERE id_alumno = t.id_alumno(p_matricula) $$;
CREATE FUNCTION t.id_plantilla(p_matricula text) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT id_plantilla FROM public.plantilla_facial WHERE id_alumno = t.id_alumno(p_matricula) AND activa $$;
CREATE FUNCTION t.id_indice(p_version text) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT id_indice FROM public.indice_faiss WHERE version = p_version $$;
CREATE FUNCTION t.id_asistencia(p_clave_grupo text, p_fecha date, p_matricula text) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT id_asistencia FROM public.asistencia
       WHERE id_sesion = t.id_sesion(p_clave_grupo, p_fecha) AND id_alumno = t.id_alumno(p_matricula) $$;

CREATE FUNCTION t.cargar_fixtures() RETURNS void
    LANGUAGE plpgsql
AS $$
DECLARE
    v_n int := 10;
BEGIN
    PERFORM t.as_postgres();
    PERFORM t.reloj('2026-09-14 07:12:00-06');

    -- Catalogo
    INSERT INTO public.aula (clave, edificio, capacidad) VALUES ('A-12', 'A', 40), ('B-04', 'B', 35);
    INSERT INTO public.camara (id_aula, posicion, tipo, direccion_ip, estatus) VALUES
        (t.id_aula('A-12'), 'frente', 'ip', '10.20.0.12', 'activa'),
        (t.id_aula('A-12'), 'fondo', 'navegador', NULL, 'activa'),
        (t.id_aula('B-04'), 'frente', 'ip', '10.20.0.4', 'inactiva');
    INSERT INTO public.materia (clave, nombre, creditos, horas_semana) VALUES
        ('ADM101', 'Administración I', 8, 4), ('CON202', 'Contabilidad II', 8, 4);
    INSERT INTO public.docente (num_empleado, apellido_paterno, apellido_materno, nombres, correo_institucional) VALUES
        ('D001', 'López', 'Ruiz', 'Ana', 'ana.lopez@unach.test'),
        ('D002', 'Pérez', NULL, 'Luis', 'luis.perez@unach.test');
    INSERT INTO public.grupo (id_materia, id_docente, id_aula, clave_grupo, periodo) VALUES
        (t.id_materia('ADM101'), t.id_docente('D001'), t.id_aula('A-12'), '3A', '2026-2'),
        (t.id_materia('CON202'), t.id_docente('D002'), t.id_aula('B-04'), '5B', '2026-2');
    INSERT INTO public.horario_grupo (id_grupo, dia_semana, hora_inicio, hora_fin) VALUES
        (t.id_grupo('3A'), 1, '07:00', '08:00'), (t.id_grupo('3A'), 3, '07:00', '08:00'),
        (t.id_grupo('5B'), 1, '09:00', '10:00');

    INSERT INTO public.alumno (matricula, apellido_paterno, apellido_materno, nombres, correo_institucional) VALUES
        ('A001', 'Ramos', 'Díaz', 'Beatriz', 'a001@unach.test'),
        ('A002', 'Cruz', 'Mena', 'Carlos', 'a002@unach.test'),
        ('A003', 'Gómez', NULL, 'Diana', 'a003@unach.test'),
        ('A004', 'Ortiz', 'Vela', 'Emilio', 'a004@unach.test'),
        ('A005', 'Silva', 'Toro', 'Fernanda', 'a005@unach.test'),
        ('A006', 'Nava', 'Luna', 'Gael', 'a006@unach.test');
    INSERT INTO public.inscripcion (id_alumno, id_grupo, estatus, fecha_alta) VALUES
        (t.id_alumno('A001'), t.id_grupo('3A'), 'activa', '2026-08-03'),
        (t.id_alumno('A002'), t.id_grupo('3A'), 'activa', '2026-08-03'),
        (t.id_alumno('A003'), t.id_grupo('3A'), 'baja', '2026-08-03'),
        (t.id_alumno('A005'), t.id_grupo('3A'), 'activa', '2026-08-03'),
        (t.id_alumno('A006'), t.id_grupo('3A'), 'activa', '2026-08-03'),
        (t.id_alumno('A004'), t.id_grupo('5B'), 'activa', '2026-08-03');

    -- Cuentas (auth_uid deterministas 00000000-0000-4000-8000-0000000000NN; sin filas en auth.users)
    INSERT INTO public.usuario (auth_uid, correo, rol, id_docente, id_alumno, activo) VALUES
        ('00000000-0000-4000-8000-000000000011', 'admin@susan.test', 'administrador', NULL, NULL, true),
        ('00000000-0000-4000-8000-000000000012', 'docente1@susan.test', 'docente', t.id_docente('D001'), NULL, true),
        ('00000000-0000-4000-8000-000000000013', 'docente2@susan.test', 'docente', t.id_docente('D002'), NULL, true),
        ('00000000-0000-4000-8000-000000000014', 'alumno1@susan.test', 'alumno', NULL, t.id_alumno('A001'), true),
        ('00000000-0000-4000-8000-000000000015', 'alumno2@susan.test', 'alumno', NULL, t.id_alumno('A002'), true),
        ('00000000-0000-4000-8000-000000000016', 'alumno4@susan.test', 'alumno', NULL, t.id_alumno('A004'), true),
        ('00000000-0000-4000-8000-000000000017', 'tecnico@susan.test', 'tecnico', NULL, NULL, true),
        ('00000000-0000-4000-8000-000000000018', 'alumno5@susan.test', 'alumno', NULL, t.id_alumno('A005'), false);

    -- Biometria
    INSERT INTO public.consentimiento (id_alumno, fecha_firma, vigencia_hasta, objeto_documento, estatus)
    SELECT t.id_alumno(m), f, v, 'consentimientos/' || t.id_alumno(m) || '/fixture.pdf', e
      FROM (VALUES
        ('A001', DATE '2026-08-01', DATE '2027-08-01', 'vigente'::public.estatus_consentimiento),
        ('A002', DATE '2026-08-01', DATE '2027-08-01', 'vigente'),
        ('A003', DATE '2026-08-01', DATE '2027-08-01', 'vigente'),
        ('A004', DATE '2026-08-01', DATE '2027-08-01', 'vigente'),
        ('A005', DATE '2026-08-01', DATE '2027-08-01', 'revocado'),
        ('A006', DATE '2025-01-01', DATE '2026-01-01', 'vigente')
      ) AS c(m, f, v, e);
    INSERT INTO public.indice_faiss (version, dimension, objeto_indice, total_vectores, en_uso) VALUES
        ('v001', 512, 'indice/v001.json', 2, false),
        ('v002', 512, 'indice/v002.json', 2, false);
    UPDATE public.indice_faiss SET en_uso = true WHERE version = 'v001';
    INSERT INTO public.plantilla_facial (id_alumno, id_consent, id_indice, faiss_id, objeto_foto) VALUES
        (t.id_alumno('A001'), t.id_consent('A001'), t.id_indice('v001'), 0, 'registro/' || t.id_alumno('A001') || '/fixture.jpg'),
        (t.id_alumno('A004'), t.id_consent('A004'), t.id_indice('v001'), 1, 'registro/' || t.id_alumno('A004') || '/fixture.jpg');

    -- Sesiones (la tolerancia, el limite y el intervalo toman los DEFAULT = parametros iniciales)
    INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, modo_registro, estatus) VALUES
        (t.id_grupo('3A'), '2026-09-07', '07:00', '08:00', 'automatico', 'cerrada'),
        (t.id_grupo('3A'), '2026-09-14', '07:00', '08:00', 'automatico', 'abierta'),
        (t.id_grupo('3A'), '2026-09-16', '07:00', '08:00', 'automatico', 'programada'),
        (t.id_grupo('5B'), '2026-09-07', '09:00', '10:00', 'manual', 'cerrada'),
        (t.id_grupo('5B'), '2026-09-14', '09:00', '10:00', 'manual', 'abierta');

    -- Asistencia: los automaticos nacen pendientes y se confirman con 3 lecturas (ciclo real)
    INSERT INTO public.asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones) VALUES
        (t.id_sesion('3A', '2026-09-07'), t.id_alumno('A001'), 'pendiente', '2026-09-07 07:03:00-06', 'automatico', 1);
    UPDATE public.asistencia SET estado = 'presente', conteo_detecciones = 4
     WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A001');
    INSERT INTO public.asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones) VALUES
        (t.id_sesion('3A', '2026-09-07'), t.id_alumno('A002'), 'ausente', NULL, 'automatico', 0),
        (t.id_sesion('3A', '2026-09-07'), t.id_alumno('A005'), 'retardo', '2026-09-07 07:12:00-06', 'manual', 0),
        (t.id_sesion('3A', '2026-09-07'), t.id_alumno('A006'), 'presente', '2026-09-07 07:02:00-06', 'manual', 0),
        (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A001'), 'pendiente', '2026-09-14 07:05:00-06', 'automatico', 1),
        (t.id_sesion('5B', '2026-09-07'), t.id_alumno('A004'), 'presente', '2026-09-07 09:01:00-06', 'manual', 0);

    INSERT INTO public.justificante (id_sesion, id_alumno, motivo, objeto_documento, registrado_por) VALUES
        (t.id_sesion('3A', '2026-09-07'), t.id_alumno('A002'), 'Cita médica',
         'justificantes/' || t.id_alumno('A002') || '/00000000-0000-4000-8000-000000000099.pdf', t.id_usuario('alumno2@susan.test'));

    -- Capturas y detecciones de la sesion abierta de 3A
    INSERT INTO public.captura (id_camara, id_sesion, marca_tiempo, rostros_detectados) VALUES
        (t.id_camara('A-12', 'frente'), t.id_sesion('3A', '2026-09-14'), '2026-09-14 07:05:00-06', 2),
        (t.id_camara('A-12', 'frente'), t.id_sesion('3A', '2026-09-14'), '2026-09-14 07:05:15-06', 1);
    INSERT INTO public.deteccion (id_captura, id_plantilla, score_similitud, es_valida, objeto_recorte)
    SELECT c.id_captura, d.id_plantilla, d.score, d.valida, d.recorte
      FROM (VALUES
        (1, t.id_plantilla('A001'), 0.912::numeric, true,  'recortes/1/1/1.jpg'),
        (1, NULL::int,              NULL::numeric,  false, 'recortes/1/1/2.jpg'),
        (2, t.id_plantilla('A001'), 0.801::numeric, false, 'recortes/1/2/1.jpg')
      ) AS d(n_captura, id_plantilla, score, valida, recorte)
      JOIN (SELECT id_captura, row_number() OVER (ORDER BY marca_tiempo) AS n FROM public.captura) c ON c.n = d.n_captura;

    -- Bitacora (por la unica via: app.bitacora)
    PERFORM app.bitacora('consulta', 'deteccion', 1, NULL, jsonb_build_object('fixture', true),
                         '10.0.0.5'::inet, t.id_usuario('docente1@susan.test'));
END
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO PUBLIC;
