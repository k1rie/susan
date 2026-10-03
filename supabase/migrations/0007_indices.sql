-- 0007 · Indices unicos parciales (RN-12, RNF-09) e indices de apoyo.
-- PostgreSQL no indexa automaticamente las columnas de las FK: se crean los que respaldan
-- joins de las RLS/RPC y las comprobaciones ON DELETE RESTRICT.

-- A lo sumo una plantilla activa por alumno. Los indices parciales se comprueban fila por fila:
-- el alta archiva primero la anterior y despues inserta la nueva, en la misma transaccion.
CREATE UNIQUE INDEX ux_plantilla_facial_activa ON public.plantilla_facial (id_alumno) WHERE activa;

-- A lo sumo una version del indice en uso. No es diferible: el cambio de version hace primero
-- UPDATE ... en_uso = false en la vigente y despues en_uso = true en la nueva (orden inverso se rechaza).
CREATE UNIQUE INDEX ux_indice_faiss_en_uso ON public.indice_faiss (en_uso) WHERE en_uso;

-- Apoyo
CREATE INDEX ix_grupo_docente ON public.grupo (id_docente);
CREATE INDEX ix_grupo_aula ON public.grupo (id_aula);
CREATE INDEX ix_grupo_periodo ON public.grupo (periodo);
CREATE INDEX ix_inscripcion_grupo ON public.inscripcion (id_grupo);
CREATE INDEX ix_sesion_fecha ON public.sesion_clase (fecha);
CREATE INDEX ix_sesion_estatus_fecha ON public.sesion_clase (estatus, fecha);
CREATE INDEX ix_asistencia_alumno ON public.asistencia (id_alumno);
CREATE INDEX ix_asistencia_estado ON public.asistencia (estado) WHERE estado = 'pendiente';
CREATE INDEX ix_justificante_asistencia ON public.justificante (id_sesion, id_alumno);
CREATE INDEX ix_justificante_estatus ON public.justificante (estatus) WHERE estatus = 'pendiente';
CREATE INDEX ix_consentimiento_alumno ON public.consentimiento (id_alumno);
CREATE INDEX ix_plantilla_alumno ON public.plantilla_facial (id_alumno);
CREATE INDEX ix_plantilla_consent ON public.plantilla_facial (id_consent);
CREATE INDEX ix_camara_aula ON public.camara (id_aula);
CREATE INDEX ix_captura_sesion ON public.captura (id_sesion);
CREATE INDEX ix_deteccion_captura ON public.deteccion (id_captura);
CREATE INDEX ix_deteccion_plantilla ON public.deteccion (id_plantilla);
CREATE INDEX ix_bitacora_entidad ON public.bitacora_auditoria (entidad, id_registro);
CREATE INDEX ix_bitacora_fecha ON public.bitacora_auditoria (fecha_hora);
CREATE INDEX ix_bitacora_usuario ON public.bitacora_auditoria (id_usuario);
