-- 0030 · RLS y privilegios (spec 3.5.3, Tabla 36; ARCHITECTURE seccion 2).
--
-- Modelo:
--  * anon: sin acceso a nada.
--  * authenticated: SOLO SELECT, y solo donde una politica lo respalda (lo necesitan las RPC de
--    lectura SECURITY INVOKER). Ninguna escritura directa: todo cambio pasa por RPC DEFINER.
--  * service_role: salta RLS (BYPASSRLS) y conserva ALL, salvo en la bitacora: alli solo SELECT
--    (la unica via de escritura es app.bitacora()).
--  * La visibilidad por grupo ("sus grupos", RF-19) la resuelven app.grupos_visibles() y
--    app.puede_ver_*; en las politicas se envuelven en (SELECT ...) para que se evaluen una vez.

-- ---------------------------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT SELECT ON
    public.alumno, public.docente, public.materia, public.aula, public.grupo, public.horario_grupo,
    public.inscripcion, public.sesion_clase, public.asistencia, public.justificante,
    public.consentimiento, public.indice_faiss, public.plantilla_facial, public.camara,
    public.captura, public.deteccion, public.usuario, public.bitacora_auditoria,
    public.parametro_sistema
    TO authenticated;

-- Bitacora: solo lectura tambien para service_role (escribe app.bitacora(), DEFINER).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.bitacora_auditoria FROM service_role;

-- ---------------------------------------------------------------------------------------------
-- RLS en las 19 tablas (sin FORCE: el propietario, que ejecuta las RPC DEFINER, no queda sujeto).
-- Sin politica => nadie (salvo propietario/service_role) ve filas.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.alumno             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docente            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materia            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aula               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_grupo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripcion        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesion_clase       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justificante       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consentimiento     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indice_faiss       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantilla_facial   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camara             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captura            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deteccion          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitacora_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametro_sistema  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------------------------
-- A. Catalogo academico
-- ---------------------------------------------------------------------------------------------
-- alumno: admin todos · docente los inscritos (cualquier estatus) en sus grupos · alumno el propio
CREATE POLICY admin_ve_todo ON public.alumno FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
CREATE POLICY docente_ve_sus_grupos ON public.alumno FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'docente'
           AND id_alumno IN (SELECT i.id_alumno FROM public.inscripcion i
                              WHERE i.id_grupo IN (SELECT app.grupos_visibles())));
CREATE POLICY alumno_ve_lo_propio ON public.alumno FOR SELECT TO authenticated
    USING (id_alumno = (SELECT app.id_alumno()));

-- docente: admin todos · docente su fila · alumno los docentes de sus grupos (solo nombre/contacto)
CREATE POLICY admin_ve_todo ON public.docente FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
CREATE POLICY docente_ve_lo_propio ON public.docente FOR SELECT TO authenticated
    USING (id_docente = (SELECT app.id_docente()));
CREATE POLICY alumno_ve_docentes_de_sus_grupos ON public.docente FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'alumno'
           AND id_docente IN (SELECT g.id_docente FROM public.grupo g));

-- materia / aula: admin todas · docente y alumno las de sus grupos · aula tambien el tecnico (camaras)
CREATE POLICY admin_ve_todo ON public.materia FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
CREATE POLICY participante_ve_materias_de_sus_grupos ON public.materia FOR SELECT TO authenticated
    USING ((SELECT app.rol()) IN ('docente', 'alumno')
           AND id_materia IN (SELECT g.id_materia FROM public.grupo g));

CREATE POLICY admin_ve_todo ON public.aula FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
CREATE POLICY tecnico_ve_aulas ON public.aula FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'tecnico');
CREATE POLICY participante_ve_aulas_de_sus_grupos ON public.aula FOR SELECT TO authenticated
    USING ((SELECT app.rol()) IN ('docente', 'alumno')
           AND id_aula IN (SELECT g.id_aula FROM public.grupo g));

-- grupo / horario_grupo: admin todos · docente los suyos · alumno donde esta inscrito
CREATE POLICY admin_ve_todo ON public.grupo FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
CREATE POLICY docente_ve_sus_grupos ON public.grupo FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'docente' AND id_docente = (SELECT app.id_docente()));
CREATE POLICY alumno_ve_sus_grupos ON public.grupo FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'alumno' AND id_grupo IN (SELECT app.grupos_visibles()));

CREATE POLICY admin_ve_todo ON public.horario_grupo FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
CREATE POLICY participante_ve_horario_de_sus_grupos ON public.horario_grupo FOR SELECT TO authenticated
    USING ((SELECT app.rol()) IN ('docente', 'alumno') AND id_grupo IN (SELECT app.grupos_visibles()));

-- inscripcion: admin todas · docente las de sus grupos · alumno las propias
CREATE POLICY admin_ve_todo ON public.inscripcion FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
CREATE POLICY docente_ve_sus_grupos ON public.inscripcion FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'docente' AND id_grupo IN (SELECT app.grupos_visibles()));
CREATE POLICY alumno_ve_lo_propio ON public.inscripcion FOR SELECT TO authenticated
    USING (id_alumno = (SELECT app.id_alumno()));

-- ---------------------------------------------------------------------------------------------
-- B. Operacion de la clase
-- ---------------------------------------------------------------------------------------------
CREATE POLICY admin_ve_todo ON public.sesion_clase FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
CREATE POLICY participante_ve_sesiones_de_sus_grupos ON public.sesion_clase FOR SELECT TO authenticated
    USING ((SELECT app.rol()) IN ('docente', 'alumno') AND id_grupo IN (SELECT app.grupos_visibles()));

-- asistencia: la politica de ejemplo de la spec (docente_ve_sus_grupos), mas admin (reportes de
-- todos los grupos) y alumno (historial propio, RF-21).
CREATE POLICY admin_ve_todo ON public.asistencia FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
CREATE POLICY docente_ve_sus_grupos ON public.asistencia FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'docente'
           AND EXISTS (SELECT 1 FROM public.sesion_clase s
                        WHERE s.id_sesion = asistencia.id_sesion
                          AND s.id_grupo IN (SELECT app.grupos_visibles())));
CREATE POLICY alumno_ve_lo_propio ON public.asistencia FOR SELECT TO authenticated
    USING (id_alumno = (SELECT app.id_alumno()));

-- justificante: docente los de sus grupos · alumno los propios · el administrador no (Tabla 36)
CREATE POLICY docente_ve_sus_grupos ON public.justificante FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'docente'
           AND EXISTS (SELECT 1 FROM public.sesion_clase s
                        WHERE s.id_sesion = justificante.id_sesion
                          AND s.id_grupo IN (SELECT app.grupos_visibles())));
CREATE POLICY alumno_ve_lo_propio ON public.justificante FOR SELECT TO authenticated
    USING (id_alumno = (SELECT app.id_alumno()));

-- ---------------------------------------------------------------------------------------------
-- C. Captura y modulo biometrico
-- ---------------------------------------------------------------------------------------------
-- consentimiento: solo administrador
CREATE POLICY admin_ve_todo ON public.consentimiento FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));

-- indice_faiss: tecnico (supervisa) y administrador (metadatos para el alta de plantilla)
CREATE POLICY admin_o_tecnico_ven_indices ON public.indice_faiss FOR SELECT TO authenticated
    USING ((SELECT app.rol()) IN ('administrador', 'tecnico'));

-- plantilla_facial: administrador todas · docente las de alumnos inscritos en sus grupos
-- (candidato de la deteccion y foto de registro en la cola de revision, P-05)
CREATE POLICY admin_ve_todo ON public.plantilla_facial FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
CREATE POLICY docente_ve_sus_grupos ON public.plantilla_facial FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'docente'
           AND id_alumno IN (SELECT i.id_alumno FROM public.inscripcion i
                              WHERE i.id_grupo IN (SELECT app.grupos_visibles())));

-- camara: administrador y tecnico todas · docente las del aula de sus grupos
CREATE POLICY admin_o_tecnico_ven_camaras ON public.camara FOR SELECT TO authenticated
    USING ((SELECT app.rol()) IN ('administrador', 'tecnico'));
CREATE POLICY docente_ve_sus_grupos ON public.camara FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'docente' AND id_aula IN (SELECT g.id_aula FROM public.grupo g));

-- captura / deteccion: solo el docente de la sesion (RF-18, RF-19); el resto, ni el admin
CREATE POLICY docente_ve_sus_grupos ON public.captura FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'docente'
           AND EXISTS (SELECT 1 FROM public.sesion_clase s
                        WHERE s.id_sesion = captura.id_sesion
                          AND s.id_grupo IN (SELECT app.grupos_visibles())));
CREATE POLICY docente_ve_sus_grupos ON public.deteccion FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'docente'
           AND id_captura IN (SELECT c.id_captura FROM public.captura c));

-- ---------------------------------------------------------------------------------------------
-- D. Seguridad y configuracion
-- ---------------------------------------------------------------------------------------------
-- usuario: cada quien su cuenta (aun inactiva: api_yo debe poder informar CUENTA_INACTIVA) · admin todas
CREATE POLICY usuario_ve_su_cuenta ON public.usuario FOR SELECT TO authenticated
    USING (auth_uid = (SELECT auth.uid()));
CREATE POLICY admin_ve_todo ON public.usuario FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));

-- bitacora: solo administrador (RNF-08); nadie escribe ni borra por esta via
CREATE POLICY admin_ve_todo ON public.bitacora_auditoria FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));

-- parametro_sistema: administrador (consulta) y tecnico (los modifica, via RPC DEFINER)
CREATE POLICY admin_o_tecnico_ven_parametros ON public.parametro_sistema FOR SELECT TO authenticated
    USING ((SELECT app.rol()) IN ('administrador', 'tecnico'));
