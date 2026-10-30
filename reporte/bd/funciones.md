# Funciones de la base de datos de SUSAN (firmas reales)

Generado por `generar-resumen.mjs` desde `pg_proc` (2026-10-30 04:23 UTC). Total: **185** funciones propias: **98** en `public` (RPC que expone la API) y **87** en `app` (lógica interna, no expuesta).
Cada firma se muestra como `nombre(argumentos) → resultado`; **D** = SECURITY DEFINER, **I** = SECURITY INVOKER (con RLS de quien llama). Se agrupan por la migración que las define.

## Esquema `public`

### 0050_api_plataforma (3)

_RPC de plataforma: api_yo, api_ahora y api_parametros_publicos._

- `api_ahora() → jsonb` · I · STABLE
- `api_parametros_publicos() → jsonb` · D · STABLE
- `api_yo() → jsonb` · I · STABLE

### 0102_reportes_rpc (5)

_RPC de reportes y portal del alumno (RF-13, RF-14, RF-17, RF-21)._

- `api_alumno_historial(p_id_grupo integer, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_alumno_resumen(p_periodo text) → jsonb` · I · STABLE
- `api_reporte_filtros(p_periodo text) → jsonb` · I · STABLE
- `api_reporte_grupo(p_id_grupo integer, p_id_alumno integer, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_reporte_periodo(p_periodo text, p_id_grupo integer, p_limit integer, p_offset integer) → jsonb` · I · STABLE

### 0103_series_alertas_rpc (5)

_Series para el análisis numérico, impacto en tiempo y alertas del docente._

- `api_alertas_docente(p_id_grupo integer, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_impacto_tiempo(p_id_grupo integer, p_periodo text) → jsonb` · I · STABLE
- `api_matriz_grupo(p_id_grupo integer, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_serie_alumno(p_id_grupo integer, p_id_alumno integer) → jsonb` · I · STABLE
- `api_serie_grupo(p_id_grupo integer) → jsonb` · I · STABLE

### 0121_revision_escrituras (5)

_Revisión, escrituras: corregir asistencia, registrar y resolver justificantes, consulta auditada (RF-11, RF-12, RF-19)._

- `api_corregir_asistencia(p_id_asistencia integer, p_estado text, p_comentario text) → jsonb` · D · VOLATILE
- `api_registrar_justificante(p_id_sesion integer, p_motivo text, p_objeto_documento text, p_id_alumno integer) → jsonb` · D · VOLATILE
- `api_resolver_justificante(p_id_justificante integer, p_aprobar boolean, p_comentario text) → jsonb` · D · VOLATILE
- `api_validar_justificante(p_id_sesion integer, p_id_alumno integer) → jsonb` · D · STABLE
- `svc_registrar_consulta_revision(p_id_usuario integer, p_entidad text, p_id_registro bigint, p_ip text, p_detalle jsonb) → bigint` · D · VOLATILE

### 0122_revision_lecturas (7)

_Revisión, lecturas: cola de revisión, justificantes, detecciones de un caso y registros corregibles._

- `api_cola_revision(p_pestana text, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_detecciones_caso(p_id_asistencia integer, p_solo_validas boolean, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_justificante_documento(p_id_justificante integer) → jsonb` · I · STABLE
- `api_mis_justificables(p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_mis_justificantes(p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_registros_corregibles(p_id_sesion integer, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_sesiones_corregibles(p_limit integer, p_offset integer) → jsonb` · I · STABLE

### 0131_api_sesion_docente (3)

_RPC del docente para la sesión en vivo: panel, apertura en horario (RN-06) y monitor._

- `api_abrir_sesion(p_id_sesion integer) → jsonb` · D · VOLATILE
- `api_docente_panel() → jsonb` · I · STABLE
- `api_sesion_monitor(p_id_sesion integer) → jsonb` · I · STABLE

### 0132_api_sesion_manual (2)

_Registro manual de asistencia y pase de lista (RF-09, RF-06, RF-08, RNF-06)._

- `api_pase_lista_manual(p_id_sesion integer, p_registros jsonb, p_marcar_restantes boolean) → jsonb` · D · VOLATILE
- `api_registrar_manual(p_id_sesion integer, p_id_alumno integer, p_estado text, p_hora timestamp with time zone) → jsonb` · D · VOLATILE

### 0133_api_sesion_cierre (3)

_Cierre de sesión (RF-10, RN-07), suspensión y reanudación._

- `api_cerrar_sesion(p_id_sesion integer) → jsonb` · D · VOLATILE
- `api_reanudar_sesion(p_id_sesion integer) → jsonb` · D · VOLATILE
- `api_suspender_sesion(p_id_sesion integer, p_motivo text) → jsonb` · D · VOLATILE

### 0135_svc_captura (3)

_Funciones de servicio del muestreo (solo service_role): candidatos, capturas y detecciones._

- `svc_alumnos_candidatos(p_id_sesion integer) → jsonb` · D · STABLE
- `svc_crear_captura(p_id_sesion integer, p_id_camara integer, p_marca_tiempo timestamp with time zone, p_rostros integer) → bigint` · D · VOLATILE
- `svc_registrar_detecciones(p_id_captura bigint, p_detecciones jsonb) → jsonb` · D · VOLATILE

### 0136_svc_camara_direccion (1)

_Dirección de la cámara IP para el Route Handler de captura (solo service_role)._

- `svc_camara_direccion(p_id_sesion integer, p_id_camara integer) → text` · D · STABLE

### 0201_admin_catalogos (11)

_Administración de alumnos, docentes y materias (RF-01)._

- `api_alumno_cambiar_estatus(p_id_alumno integer, p_estatus text) → jsonb` · D · VOLATILE
- `api_alumno_guardar(p jsonb) → jsonb` · D · VOLATILE
- `api_alumno_obtener(p_id_alumno integer) → jsonb` · I · STABLE
- `api_alumnos_listar(p_q text, p_estatus text, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_docente_cambiar_estatus(p_id_docente integer, p_estatus text) → jsonb` · D · VOLATILE
- `api_docente_guardar(p jsonb) → jsonb` · D · VOLATILE
- `api_docente_obtener(p_id_docente integer) → jsonb` · I · STABLE
- `api_docentes_listar(p_q text, p_estatus text, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_materia_guardar(p jsonb) → jsonb` · D · VOLATILE
- `api_materia_obtener(p_id_materia integer) → jsonb` · I · STABLE
- `api_materias_listar(p_q text, p_limit integer, p_offset integer) → jsonb` · I · STABLE

### 0202_admin_aulas_camaras (5)

_Administración de aulas y cámaras (RF-22, RN-06)._

- `api_aula_guardar(p jsonb) → jsonb` · D · VOLATILE
- `api_aula_obtener(p_id_aula integer) → jsonb` · I · STABLE
- `api_aulas_listar(p_q text, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_camara_guardar(p jsonb) → jsonb` · D · VOLATILE
- `api_camaras_listar(p_id_aula integer) → jsonb` · I · STABLE

### 0203_admin_grupos (5)

_Administración de grupos, horario semanal y generación de sesiones programadas (RF-01, RF-22, RN-06)._

- `api_generar_sesiones(p_id_grupo integer, p_desde date, p_hasta date, p_omitir_fechas date[]) → jsonb` · D · VOLATILE
- `api_grupo_guardar(p jsonb) → jsonb` · D · VOLATILE
- `api_grupo_obtener(p_id_grupo integer) → jsonb` · I · STABLE
- `api_grupos_listar(p_periodo text, p_q text, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_horario_guardar(p_id_grupo integer, p_bloques jsonb) → jsonb` · D · VOLATILE

### 0204_admin_inscripciones (4)

_Inscripciones (RF-02, RN-01) y carga masiva._

- `api_baja_inscripcion(p_id_inscripcion integer) → jsonb` · D · VOLATILE
- `api_importar_inscripciones(p_id_grupo integer, p_filas jsonb) → jsonb` · D · VOLATILE
- `api_inscribir(p_id_grupo integer, p_id_alumno integer) → jsonb` · D · VOLATILE
- `api_inscritos(p_id_grupo integer, p_estatus text) → jsonb` · I · STABLE

### 0205_admin_usuarios_bitacora (5)

_Usuarios (RF-20), consulta de la bitácora (RNF-08) y resumen del administrador._

- `api_admin_resumen() → jsonb` · I · STABLE
- `api_bitacora_listar(p_accion text, p_entidad text, p_id_usuario integer, p_desde date, p_hasta date, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `api_usuario_actualizar(p_id_usuario integer, p jsonb) → jsonb` · D · VOLATILE
- `api_usuarios_listar(p_q text, p_rol text, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `svc_usuario_crear(p_correo text, p_rol text, p_id_docente integer, p_id_alumno integer, p_auth_uid uuid) → integer` · D · VOLATILE

### 0231_api_consentimiento_plantilla (3)

_RPC de consentimiento y plantilla facial (RF-15, RF-16, RN-12, RN-13)._

- `api_consentimiento_registrar(p_id_alumno integer, p_fecha_firma date, p_vigencia_hasta date, p_objeto_documento text, p_ip inet) → jsonb` · D · VOLATILE
- `api_consentimiento_revocar(p_id_consent integer, p_ip inet) → jsonb` · D · VOLATILE
- `api_consentimientos_alumno(p_id_alumno integer, p_limit integer, p_offset integer) → jsonb` · I · STABLE

### 0232_api_indice_parametros_camaras (5)

_RPC de la consola técnica: estado del índice, parámetros del sistema y cámaras._

- `api_camara_cambiar_estatus(p_id_camara integer, p_estatus estatus_camara) → jsonb` · D · VOLATILE
- `api_camaras_estado(p_estatus estatus_camara, p_limit integer, p_offset integer) → jsonb` · D · STABLE
- `api_indice_estado(p_limit integer, p_offset integer) → jsonb` · D · STABLE
- `api_parametro_actualizar(p_clave text, p_valor text, p_ip inet) → jsonb` · D · VOLATILE
- `api_parametros_listar(p_limit integer, p_offset integer) → jsonb` · D · STABLE

### 0233_svc_indice (6)

_RPC de servicio del índice FAISS (solo service_role)._

- `svc_bloqueo_adquirir(p_clave text, p_dueno text, p_ttl_seg integer) → boolean` · D · VOLATILE
- `svc_bloqueo_liberar(p_clave text, p_dueno text) → boolean` · D · VOLATILE
- `svc_indice_activar(p_id_indice integer, p_mapeo jsonb) → jsonb` · D · VOLATILE
- `svc_indice_en_uso() → jsonb` · D · STABLE
- `svc_indice_registrar(p_version text, p_dimension integer, p_objeto_indice text, p_total_vectores integer) → jsonb` · D · VOLATILE
- `svc_indice_revertir(p_id_indice integer, p_mapeo jsonb) → jsonb` · D · VOLATILE

### 0234_svc_jobs (6)

_Jobs del programador de tareas: cerrar sesiones, resolver pendientes, recalcular, purgar recortes y reconstruir el índice._

- `svc_job_cerrar_sesiones(p_limit integer) → jsonb` · D · VOLATILE
- `svc_job_purgar_recortes_listar(p_limit integer) → jsonb` · D · STABLE
- `svc_job_purgar_recortes_marcar(p_ids bigint[]) → jsonb` · D · VOLATILE
- `svc_job_recalcular(p_periodo text) → jsonb` · D · VOLATILE
- `svc_job_reconstruir_indice() → jsonb` · D · STABLE
- `svc_job_resolver_pendientes(p_limit integer) → jsonb` · D · VOLATILE

### 0235_plantilla_fotos (1)

_Extensión 17: plantilla facial de varias fotos; crea la tabla plantilla_foto._

- `svc_indice_plan(p_completa boolean) → jsonb` · D · STABLE

### 0237_fotos_registro_efimeras (4)

_Extensión 18: fotos de registro efímeras (objeto_foto admite nulo cuando la foto ya no se conserva)._

- `api_documento_url_autorizar(p_tipo text, p_id_registro integer, p_ip inet) → jsonb` · D · VOLATILE
- `api_plantilla_alumno(p_id_alumno integer, p_limit integer, p_offset integer) → jsonb` · I · STABLE
- `svc_fotos_registro_listar(p_ids integer[], p_limit integer) → jsonb` · D · STABLE
- `svc_fotos_registro_marcar(p_ids integer[]) → jsonb` · D · VOLATILE

### 0239_autoservicio_registro (6)

_Extensión 19: autoservicio del alumno (consentimiento y registro del propio rostro); columnas origen y version_aviso._

- `api_mi_consentimiento_aceptar(p_objeto_documento text, p_version_aviso text, p_ip inet) → jsonb` · D · VOLATILE
- `api_mi_consentimiento_revocar(p_ip inet) → jsonb` · D · VOLATILE
- `api_mi_plantilla_registrar(p_id_consent integer, p_objeto_foto text, p_ip inet, p_fotos jsonb) → jsonb` · D · VOLATILE
- `api_mi_registro() → jsonb` · D · STABLE
- `api_plantilla_registrar(p_id_alumno integer, p_id_consent integer, p_objeto_foto text, p_ip inet, p_fotos jsonb) → jsonb` · D · VOLATILE
- `svc_faiss_ids_otros_alumnos(p_id_alumno integer) → jsonb` · D · STABLE

## Esquema `app`

### 0001_esquemas (3)

_Esquema privado app, privilegios cerrados por omisión, extensiones (pgcrypto, pg_trgm) y reloj único (app.now, app.tz, app.hoy)._

- `hoy() → date` · I · STABLE
- `instante_clase(p_fecha date, p_hora time without time zone) → timestamp with time zone` · I · STABLE
- `tz() → text` · I · IMMUTABLE

### 0010_app_helpers (21)

_Funciones del esquema app: identidad y rol, visibilidad por grupo, errores, consentimiento, IP, cuenta de servicio y bitácora._

- `asumir_cuenta_servicio() → integer` · D · VOLATILE
- `bitacora(p_accion accion_bitacora, p_entidad text, p_id_registro bigint, p_anterior jsonb, p_nuevo jsonb, p_ip inet, p_id_usuario integer) → bigint` · D · VOLATILE
- `consentimiento_vigente(p_id_consent integer) → boolean` · D · STABLE
- `es_admin() → boolean` · D · STABLE
- `exigir_rol(VARIADIC p_roles text[]) → text` · D · STABLE
- `fallar(p_codigo text, p_mensaje text) → void` · I · VOLATILE
- `grupos_visibles() → SETOF integer` · D · STABLE
- `id_alumno() → integer` · D · STABLE
- `id_cuenta_servicio() → integer` · D · STABLE
- `id_docente() → integer` · D · STABLE
- `id_usuario() → integer` · D · STABLE
- `id_usuario_servicio() → integer` · I · STABLE
- `ip_origen() → inet` · I · STABLE
- `param(p_clave text) → text` · D · STABLE
- `param_num(p_clave text) → numeric` · D · STABLE
- `puede_ver_alumno(p_id_alumno integer) → boolean` · D · STABLE
- `puede_ver_grupo(p_id_grupo integer) → boolean` · D · STABLE
- `puede_ver_sesion(p_id_sesion integer) → boolean` · D · STABLE
- `rol() → text` · D · STABLE
- `rol_de_usuario(p_id_usuario integer) → text` · D · STABLE
- `tiene_consentimiento_vigente(p_id_alumno integer) → boolean` · D · STABLE

### 0020_triggers (7)

_Los seis disparadores de la especificación: RN-01, ciclo de asistencia (RN-02/05/06/07/09), RN-06 de captura, RN-13 y bitácora de solo inserción._

- `rechazar_regla(p_regla text, p_detalle text) → void` · I · VOLATILE
- `trg_asistencia_ciclo() → trigger` · D · VOLATILE
- `trg_asistencia_rn01() → trigger` · D · VOLATILE
- `trg_bitacora_sin_cambios() → trigger` · I · VOLATILE
- `trg_bitacora_sin_truncate() → trigger` · I · VOLATILE
- `trg_captura_rn06() → trigger` · D · VOLATILE
- `trg_plantilla_rn13() → trigger` · D · VOLATILE

### 0040_parametros (1)

_Los parámetros del sistema (Tabla 4), sus metadatos y validación, y la cuenta de servicio._

- `validar_parametro(p_clave text, p_valor text) → text` · D · STABLE

### 0100_reportes_base (2)

_Vista v_resumen_asistencia y recálculo del derecho a examen (RF-13, RF-14, RN-10, RN-11)._

- `recalcular_grupo(p_id_grupo integer) → void` · D · VOLATILE
- `recalcular_inscripcion(p_id_inscripcion integer) → void` · D · VOLATILE

### 0101_ayudantes_c (8)

_Ayudantes internos c1_* (formato de fechas, paginación, JSON de alumno, grupo y sesión) para reportes y revisión._

- `c1_alumno_json(p_id integer, p_matricula text, p_ap text, p_am text, p_nombres text) → jsonb` · I · IMMUTABLE
- `c1_desplazamiento(p_offset integer) → integer` · I · IMMUTABLE
- `c1_grupo_json(p_id integer, p_clave_grupo text, p_periodo text) → jsonb` · I · IMMUTABLE
- `c1_iso(p_ts timestamp with time zone) → text` · I · STABLE
- `c1_limite(p_limit integer, p_def integer, p_max integer) → integer` · I · IMMUTABLE
- `c1_materia_json(p_id integer, p_clave text, p_nombre text) → jsonb` · I · IMMUTABLE
- `c1_nombre(p_ap text, p_am text, p_nombres text) → text` · I · IMMUTABLE
- `c1_sesion_json(s sesion_clase) → jsonb` · I · IMMUTABLE

### 0102_reportes_rpc (2)

_RPC de reportes y portal del alumno (RF-13, RF-14, RF-17, RF-21)._

- `c1_grupo_visible(p_id_grupo integer) → grupo` · I · STABLE
- `c1_resumen_json(v v_resumen_asistencia) → jsonb` · I · IMMUTABLE

### 0120_revision_base (6)

_Revisión, base: índice único del justificante pendiente, plazo de corrección (RN-08) y ayudantes de corrección._

- `aplicar_correccion(p_id_asistencia integer, p_estado text, p_comentario text, p_id_usuario integer, p_ip inet) → jsonb` · D · VOLATILE
- `correcciones_recientes(p_limit integer, p_offset integer) → jsonb` · D · STABLE
- `estado_sugerido_revision(p_hora_registro timestamp with time zone, p_fecha date, p_hora_inicio time without time zone, p_limite_presente_min integer) → text` · I · STABLE
- `limite_correccion(p_fecha date, p_hora_fin time without time zone) → timestamp with time zone` · I · STABLE
- `resolver_pendientes_vencidos(p_id_usuario integer, p_limite integer) → jsonb` · D · VOLATILE
- `validar_destino_justificante(p_id_sesion integer, p_id_alumno integer, p_bloquear boolean) → jsonb` · D · VOLATILE

### 0122_revision_lecturas (1)

_Revisión, lecturas: cola de revisión, justificantes, detecciones de un caso y registros corregibles._

- `c1_lecturas_caso(p_id_alumno integer, p_id_sesion integer, p_max integer) → jsonb` · I · STABLE

### 0130_sesiones_helpers (6)

_Ayudantes de la sesión de clase: minuto de sesión, estado por minuto (RN-03), lecturas válidas y bloqueo de sesión._

- `estado_por_minuto(p_limite integer, p_tolerancia integer, p_minuto numeric) → estado_asistencia` · I · IMMUTABLE
- `estado_sugerido(p_fecha date, p_hora_inicio time without time zone, p_limite integer, p_tolerancia integer, p_instante timestamp with time zone) → estado_asistencia` · I · STABLE
- `lecturas_validas(p_id_sesion integer, p_id_alumno integer) → integer` · D · STABLE
- `minuto_de_sesion(p_fecha date, p_hora_inicio time without time zone, p_instante timestamp with time zone) → numeric` · I · STABLE
- `sesion_autorizada(p_id_sesion integer, p_permitir_admin boolean) → sesion_clase` · D · STABLE
- `sesion_bloqueada(p_id_sesion integer, p_permitir_admin boolean) → sesion_clase` · D · VOLATILE

### 0132_api_sesion_manual (1)

_Registro manual de asistencia y pase de lista (RF-09, RF-06, RF-08, RNF-06)._

- `registrar_asistencia_manual(s sesion_clase, p_id_alumno integer, p_estado text, p_hora timestamp with time zone) → jsonb` · D · VOLATILE

### 0133_api_sesion_cierre (1)

_Cierre de sesión (RF-10, RN-07), suspensión y reanudación._

- `cerrar_sesion(p_id_sesion integer, p_por_docente boolean) → jsonb` · D · VOLATILE

### 0200_admin_helpers (12)

_Ayudantes internos b1_* de la gestión académica._

- `b1_alumno_json(a alumno) → jsonb` · I · IMMUTABLE
- `b1_aula_json(a aula) → jsonb` · I · IMMUTABLE
- `b1_camara_json(c camara) → jsonb` · I · STABLE
- `b1_desplazamiento(p_offset integer) → integer` · I · IMMUTABLE
- `b1_docente_json(d docente) → jsonb` · I · IMMUTABLE
- `b1_int(p jsonb, k text) → integer` · I · IMMUTABLE
- `b1_limite(p_limit integer) → integer` · I · IMMUTABLE
- `b1_materia_json(m materia) → jsonb` · I · IMMUTABLE
- `b1_nombre(p_ap text, p_am text, p_nombres text) → text` · I · IMMUTABLE
- `b1_obj(p jsonb) → jsonb` · I · IMMUTABLE
- `b1_patron(p_q text) → text` · I · IMMUTABLE
- `b1_str(p jsonb, k text) → text` · I · IMMUTABLE

### 0203_admin_grupos (2)

_Administración de grupos, horario semanal y generación de sesiones programadas (RF-01, RF-22, RN-06)._

- `b1_choque_horario(p_id_aula integer, p_periodo text, p_id_grupo integer, p_dia integer, p_ini time without time zone, p_fin time without time zone) → text` · I · STABLE
- `b1_grupo_base(p_id_grupo integer) → jsonb` · I · STABLE

### 0204_admin_inscripciones (1)

_Inscripciones (RF-02, RN-01) y carga masiva._

- `b1_inscribir(p_id_grupo integer, p_id_alumno integer) → TABLE(id_inscripcion integer, resultado text)` · I · VOLATILE

### 0230_biometria_soporte (4)

_Soporte interno de biometría: validación de rutas de objetos, bloqueos con arrendamiento y vencimiento de consentimientos._

- `bloqueo_adquirir(p_clave text, p_dueno text, p_ttl_seg integer) → boolean` · D · VOLATILE
- `bloqueo_liberar(p_clave text, p_dueno text) → boolean` · D · VOLATILE
- `es_ruta_objeto(p_ruta text, p_prefijo text, p_id_alumno integer, p_ext text) → boolean` · I · IMMUTABLE
- `vencer_consentimientos() → integer` · D · VOLATILE

### 0233_svc_indice (1)

_RPC de servicio del índice FAISS (solo service_role)._

- `validar_mapeo_indice(p_mapeo jsonb) → jsonb` · I · IMMUTABLE

### 0235_plantilla_fotos (2)

_Extensión 17: plantilla facial de varias fotos; crea la tabla plantilla_foto._

- `calidad_foto_valida(p jsonb) → boolean` · I · IMMUTABLE
- `trg_plantilla_foto_principal() → trigger` · D · VOLATILE

### 0236_reloj_demo_tabla (3)

_Reloj de demostración en la tabla app.reloj_demo (para Supabase, donde no se puede usar ALTER DATABASE SET)._

- `now() → timestamp with time zone` · I · STABLE
- `reloj_demo_valor() → timestamp with time zone` · D · STABLE
- `reloj_simulado() → boolean` · I · STABLE

### 0239_autoservicio_registro (3)

_Extensión 19: autoservicio del alumno (consentimiento y registro del propio rostro); columnas origen y version_aviso._

- `autoregistro_limite() → integer` · I · IMMUTABLE
- `consentimiento_meses() → integer` · I · IMMUTABLE
- `plantilla_registrar(p_id_alumno integer, p_id_consent integer, p_objeto_foto text, p_ip inet, p_fotos jsonb, p_origen text) → jsonb` · D · VOLATILE
