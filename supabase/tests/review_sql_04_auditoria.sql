-- review_sql_04 · cobertura de bitacora de operaciones sensibles de administracion y falsificacion de la IP de origen
BEGIN;
SELECT t.begin('review_sql_04_auditoria');
SELECT t.cargar_fixtures();
\ir api_c_escenario.inc

SELECT t.as_user('admin@susan.test');
-- Cambio de rol / baja de cuenta: ¿deja bitacora?
SELECT t.efecto($q$ SELECT public.api_usuario_actualizar(t.id_usuario('alumno1@susan.test'), jsonb_build_object('rol','administrador','id_alumno',NULL)) $q$,
    $q$ SELECT (SELECT rol::text FROM usuario WHERE correo = 'alumno1@susan.test') = 'administrador'
          AND t.c_nbit_total() = 1 $q$,
    'HALLAZGO: AU1: promover una cuenta de alumno a administrador funciona y NO deja asiento en bitacora (la bitacora sigue con 1 solo asiento: el de fixtures)');
SELECT t.efecto($q$ SELECT public.api_usuario_actualizar(t.id_usuario('docente2@susan.test'), '{"activo": false}'::jsonb) $q$,
    $q$ SELECT t.c_nbit_total() = 1 $q$, 'HALLAZGO: AU2: desactivar una cuenta no deja bitacora');
SELECT t.efecto($q$ SELECT public.api_consentimiento_revocar(t.id_consent('A001')) $q$,
    $q$ SELECT (SELECT estatus::text FROM consentimiento WHERE id_consent = t.id_consent('A001')) = 'revocado' AND t.c_nbit_total() = 1 $q$,
    'HALLAZGO: AU3: revocar un consentimiento biometrico no deja bitacora');
SELECT t.efecto($q$ SELECT public.api_alumno_cambiar_estatus(t.id_alumno('A001'), 'baja_definitiva') $q$,
    $q$ SELECT t.c_nbit_total() = 1 $q$, 'HALLAZGO: AU4: dar de baja a un alumno (cierra inscripciones) no deja bitacora');
-- Marcado manual del docente (cambia el registro de asistencia) tampoco asienta bitacora
SELECT t.as_user('docente1@susan.test');
SELECT t.efecto($q$ SELECT public.api_registrar_manual(t.c('S2'), t.c('ID_A002'), 'presente') $q$,
    $q$ SELECT t.c_nbit_total() = 1 $q$, 'HALLAZGO: AU5: pase de lista manual (RF-09) no deja bitacora');

-- IP de origen falsificable: el llamador la declara
SELECT t.as_user('admin@susan.test');
SELECT t.efecto($q$ SELECT public.api_documento_url_autorizar('consentimiento', t.id_consent('A001'), '1.2.3.4'::inet) $q$,
    $q$ SELECT (t.c_bit('consulta', 'consentimiento', t.id_consent('A001')) ->> 'ip_origen') = '1.2.3.4' $q$,
    'HALLAZGO: IP1: la IP de origen de la bitacora es el argumento p_ip que declara el propio usuario (falsificable llamando la RPC directo con su JWT)');
SELECT t.summary();
ROLLBACK;
