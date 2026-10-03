-- api_b2_01 · consentimiento: registrar, revocar, listar, vencer (biometria.md 3.1 a 3.3 + app.vencer_consentimientos).
BEGIN;
SELECT t.begin('api_b2_01_consentimiento');
SELECT t.cargar_fixtures();
-- ruta valida de objeto: <prefijo>/<id_alumno>/<uuid>.<ext>
CREATE FUNCTION t.ruta(p_prefijo text, p_matricula text, p_n integer, p_ext text) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT p_prefijo || '/' || t.id_alumno(p_matricula) || '/00000000-0000-4000-8000-' || lpad(p_n::text, 12, '0') || '.' || p_ext $$;
GRANT EXECUTE ON FUNCTION t.ruta(text, text, integer, text) TO PUBLIC;

-- ---- Registrar (administrador) ----
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_consentimiento_registrar(t.id_alumno('A002'), DATE '2026-09-01', DATE '2027-09-01',
    t.ruta('consentimientos', 'A002', 1, 'pdf')) ->> 'estatus'), 'vigente', 'registrar: estatus vigente');
SELECT t.ok((public.api_consentimiento_registrar(t.id_alumno('A002'), DATE '2026-09-02', DATE '2027-09-02',
    t.ruta('consentimientos', 'A002', 2, 'pdf')) ->> 'vigente')::boolean, 'registrar: vigente = true');
SELECT t.eq((SELECT count(*)::int FROM public.consentimiento WHERE id_alumno = t.id_alumno('A002')), 3,
    'registrar conserva el historial (1 de fixture + 2)');
-- limites de fecha: firma = hoy es valida; vigencia = hoy (firma anterior) es valida (aun vigente hoy)
SELECT t.lives_rb($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), DATE '2026-09-14', DATE '2026-09-15',
    t.ruta('consentimientos', 'A003', 3, 'pdf')) $q$, 'firma = hoy valida');
SELECT t.lives_rb($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), DATE '2026-09-13', DATE '2026-09-14',
    t.ruta('consentimientos', 'A003', 3, 'pdf')) $q$, 'vigencia = hoy valida (>= hoy)');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), DATE '2026-09-15', DATE '2027-09-15',
    t.ruta('consentimientos', 'A003', 4, 'pdf')) $q$, 'P0001:VALIDACION:no puede ser futura', 'firma futura (hoy + 1)');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), DATE '2026-09-01', DATE '2026-09-01',
    t.ruta('consentimientos', 'A003', 4, 'pdf')) $q$, 'P0001:VALIDACION:posterior', 'vigencia = firma rechazada');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), DATE '2026-08-01', DATE '2026-09-13',
    t.ruta('consentimientos', 'A003', 4, 'pdf')) $q$, 'P0001:VALIDACION:ya terminó', 'vigencia = ayer rechazada (ya vencida)');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), NULL, DATE '2027-09-13',
    t.ruta('consentimientos', 'A003', 4, 'pdf')) $q$, 'P0001:VALIDACION', 'fecha nula');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(999999, DATE '2026-09-01', DATE '2027-09-01',
    'consentimientos/999999/00000000-0000-4000-8000-000000000004.pdf') $q$, 'P0001:NO_ENCONTRADO', 'alumno inexistente');
-- rutas: de otro alumno, otro prefijo, otra extension, sin uuid, con traversal, demasiado larga
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), DATE '2026-09-01', DATE '2027-09-01',
    t.ruta('consentimientos', 'A001', 4, 'pdf')) $q$, 'P0001:RUTA_INVALIDA', 'ruta de otro alumno (IDOR)');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), DATE '2026-09-01', DATE '2027-09-01',
    t.ruta('registro', 'A003', 4, 'pdf')) $q$, 'P0001:RUTA_INVALIDA', 'prefijo incorrecto');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), DATE '2026-09-01', DATE '2027-09-01',
    t.ruta('consentimientos', 'A003', 4, 'jpg')) $q$, 'P0001:RUTA_INVALIDA', 'extension incorrecta');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), DATE '2026-09-01', DATE '2027-09-01',
    'consentimientos/' || t.id_alumno('A003') || '/fixture.pdf') $q$, 'P0001:RUTA_INVALIDA', 'nombre sin uuid');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), DATE '2026-09-01', DATE '2027-09-01',
    'consentimientos/' || t.id_alumno('A003') || '/../x/00000000-0000-4000-8000-000000000004.pdf') $q$, 'P0001:RUTA_INVALIDA', 'traversal');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), DATE '2026-09-01', DATE '2027-09-01', NULL) $q$,
    'P0001:RUTA_INVALIDA', 'ruta nula');
-- alumno inactivo
SELECT t.as_postgres();
UPDATE public.alumno SET estatus = 'baja_temporal' WHERE id_alumno = t.id_alumno('A003');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A003'), DATE '2026-09-01', DATE '2027-09-01',
    t.ruta('consentimientos', 'A003', 5, 'pdf')) $q$, 'P0001:ALUMNO_INACTIVO', 'alumno con baja temporal');
-- roles
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A001'), DATE '2026-09-01', DATE '2027-09-01',
    t.ruta('consentimientos', 'A001', 6, 'pdf')) $q$, 'P0001:NO_AUTORIZADO', 'docente no registra');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(t.id_alumno('A001'), DATE '2026-09-01', DATE '2027-09-01',
    t.ruta('consentimientos', 'A001', 6, 'pdf')) $q$, 'P0001:NO_AUTORIZADO', 'alumno no registra (ni el propio)');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(1, DATE '2026-09-01', DATE '2027-09-01', 'x') $q$,
    'P0001:NO_AUTORIZADO', 'tecnico no registra');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(1, DATE '2026-09-01', DATE '2027-09-01', 'x') $q$,
    '42501', 'anon sin EXECUTE');
SELECT t.as_service();
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(1, DATE '2026-09-01', DATE '2027-09-01', 'x') $q$,
    'P0001:NO_AUTENTICADO', 'service_role sin cuenta de usuario no pasa exigir_rol');
SELECT t.as_uid_huerfano();
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(1, DATE '2026-09-01', DATE '2027-09-01', 'x') $q$,
    'P0001:CUENTA_NO_VINCULADA', 'JWT sin cuenta');
SELECT t.as_user('alumno5@susan.test');
SELECT t.throws($q$ SELECT public.api_consentimiento_registrar(1, DATE '2026-09-01', DATE '2027-09-01', 'x') $q$,
    'P0001:CUENTA_INACTIVA', 'cuenta inactiva');

-- ---- Listar ----
SELECT t.as_user('admin@susan.test');
SELECT t.ok((public.api_consentimientos_alumno(t.id_alumno('A001')) ->> 'vigente')::boolean, 'A001 con consentimiento vigente');
SELECT t.eq((public.api_consentimientos_alumno(t.id_alumno('A001')) #>> '{consentimiento_vigente,dias_restantes}')::int,
    (DATE '2027-08-01' - DATE '2026-09-14'), 'dias_restantes = vigencia - hoy');
SELECT t.eq((public.api_consentimientos_alumno(t.id_alumno('A006')) -> 'items' -> 0 ->> 'estatus_efectivo'), 'vencido',
    'A006: vigente por estatus pero vencido por fecha => vencido');
SELECT t.ok(public.api_consentimientos_alumno(t.id_alumno('A006')) -> 'consentimiento_vigente' = 'null'::jsonb, 'A006: sin consentimiento vigente');
SELECT t.ok((public.api_consentimientos_alumno(t.id_alumno('A006')) -> 'items' -> 0 -> 'dias_restantes') = 'null'::jsonb, 'vencido: dias_restantes null');
SELECT t.eq((public.api_consentimientos_alumno(t.id_alumno('A005')) -> 'items' -> 0 ->> 'estatus_efectivo'), 'revocado', 'A005 revocado');
SELECT t.eq((public.api_consentimientos_alumno(t.id_alumno('A001')) -> 'items' -> 0 ->> 'plantillas_activas')::int, 1, 'plantillas_activas ligadas');
SELECT t.eq((public.api_consentimientos_alumno(t.id_alumno('A002')) ->> 'total')::int, 3, 'total de A002');
SELECT t.eq((public.api_consentimientos_alumno(t.id_alumno('A002'), 1, 0) -> 'items' -> 0 ->> 'fecha_firma'), '2026-09-02', 'orden: firma DESC');
SELECT t.eq(jsonb_array_length(public.api_consentimientos_alumno(t.id_alumno('A002'), 1, 0) -> 'items'), 1, 'limit 1');
SELECT t.eq(jsonb_array_length(public.api_consentimientos_alumno(t.id_alumno('A002'), 0, 0) -> 'items'), 1, 'limit 0 se corrige a 1');
SELECT t.eq(jsonb_array_length(public.api_consentimientos_alumno(t.id_alumno('A002'), 50, 2) -> 'items'), 1, 'offset 2 deja 1');
SELECT t.eq(jsonb_array_length(public.api_consentimientos_alumno(t.id_alumno('A002'), 50, 3) -> 'items'), 0, 'offset 3 deja 0');
SELECT t.ok(public.api_consentimientos_alumno(t.id_alumno('A004')) -> 'items' -> 0 ? 'tiene_documento', 'forma del item');
SELECT t.throws($q$ SELECT public.api_consentimientos_alumno(999999) $q$, 'P0001:NO_ENCONTRADO', 'alumno inexistente');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_consentimientos_alumno(t.id_alumno('A001')) $q$, 'P0001:NO_AUTORIZADO', 'docente no lista consentimientos');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_consentimientos_alumno(t.id_alumno('A001')) $q$, 'P0001:NO_AUTORIZADO', 'alumno no lista (ni los propios)');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_consentimientos_alumno(1) $q$, 'P0001:NO_AUTORIZADO', 'tecnico no lista');

-- ---- Revocar ----
SELECT t.as_user('admin@susan.test');
SELECT t.efecto($q$ SELECT public.api_consentimiento_revocar(t.id_consent('A001')) $q$,
    $q$ SELECT (SELECT estatus FROM public.consentimiento WHERE id_consent = t.id_consent('A001')) = 'revocado'
           AND NOT EXISTS (SELECT 1 FROM public.plantilla_facial WHERE id_alumno = t.id_alumno('A001') AND activa) $q$,
    'revocar: consentimiento revocado y plantilla archivada');
SELECT t.eq((public.api_consentimiento_revocar(t.id_consent('A001')) ->> 'plantillas_archivadas')::int, 1, 'revocar: 1 plantilla archivada');
SELECT t.throws($q$ SELECT public.api_consentimiento_revocar(t.id_consent('A001')) $q$, 'P0001:RN_13_CONSENTIMIENTO_NO_VIGENTE', 'revocar dos veces');
SELECT t.ok(NOT public.api_consentimientos_alumno(t.id_alumno('A001')) ->> 'vigente' = 'true', 'tras revocar ya no esta vigente');
SELECT t.ok(NOT app.tiene_consentimiento_vigente(t.id_alumno('A001')), 'RNF-06: sin consentimiento vigente tras revocar');
SELECT t.eq((SELECT activa::text FROM public.plantilla_facial WHERE id_alumno = t.id_alumno('A001')), 'false', 'la fila de plantilla se conserva archivada');
SELECT t.eq((public.api_consentimiento_revocar(t.id_consent('A002')) ->> 'plantillas_archivadas')::int, 0, 'revocar sin plantilla: 0 archivadas');
SELECT t.ok(NOT (public.api_consentimiento_revocar(t.id_consent('A004')) ->> 'requiere_reconstruccion')::boolean = false, 'revocar plantilla indexada: requiere reconstruccion');
SELECT t.throws($q$ SELECT public.api_consentimiento_revocar(t.id_consent('A005')) $q$, 'P0001:RN_13_CONSENTIMIENTO_NO_VIGENTE', 'ya revocado en fixtures');
SELECT t.lives_rb($q$ SELECT public.api_consentimiento_revocar(t.id_consent('A006')) $q$, 'estatus vigente pero vencido por fecha: aun revocable');
SELECT t.throws($q$ SELECT public.api_consentimiento_revocar(999999) $q$, 'P0001:NO_ENCONTRADO', 'consentimiento inexistente');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_consentimiento_revocar(t.id_consent('A002')) $q$, 'P0001:NO_AUTORIZADO', 'docente no revoca');
SELECT t.as_user('alumno2@susan.test');
SELECT t.throws($q$ SELECT public.api_consentimiento_revocar(t.id_consent('A002')) $q$, 'P0001:NO_AUTORIZADO', 'alumno no revoca el propio');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_consentimiento_revocar(1) $q$, 'P0001:NO_AUTORIZADO', 'tecnico no revoca');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_consentimiento_revocar(1) $q$, '42501', 'anon sin EXECUTE');

-- ---- app.vencer_consentimientos ----
SELECT t.as_postgres();
INSERT INTO public.consentimiento (id_alumno, fecha_firma, vigencia_hasta, objeto_documento, estatus) VALUES
    (t.id_alumno('A002'), '2026-09-01', '2026-09-14', t.ruta('consentimientos', 'A002', 7, 'pdf'), 'vigente'),   -- vence hoy: sigue vigente
    (t.id_alumno('A004'), '2026-09-01', '2026-09-13', t.ruta('consentimientos', 'A004', 8, 'pdf'), 'vigente');   -- vencio ayer
SELECT t.as_service();
SELECT t.eq(app.vencer_consentimientos(), 2, 'vence 2: A006 (fixture) y el de ayer; el de hoy no');
SELECT t.eq(app.vencer_consentimientos(), 0, 'idempotente: segunda corrida no vence nada');
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*)::int FROM public.consentimiento WHERE estatus = 'vencido'), 2, 'dos consentimientos en estatus vencido');
SELECT t.eq((SELECT estatus::text FROM public.consentimiento WHERE vigencia_hasta = '2026-09-14' AND id_alumno = t.id_alumno('A002')), 'vigente',
    'vigencia_hasta = hoy sigue vigente');
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE entidad = 'consentimiento' AND accion = 'correccion'
              AND id_usuario = app.id_usuario_servicio() AND valor_nuevo ->> 'estatus' = 'vencido'), 2, 'bitacora a nombre de la cuenta de servicio');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT app.vencer_consentimientos() $q$, '42501', 'authenticated no ejecuta app.vencer_consentimientos');
SELECT t.summary();
ROLLBACK;
