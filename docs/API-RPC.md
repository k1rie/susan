# Catálogo de RPC de SUSAN (generado)

> **No editar a mano.** Generado por `node scripts/gen-api-catalog.mjs` desde `pg_proc` y `COMMENT ON FUNCTION` de la BD local.
> El SQL es la fuente de verdad (docs/ARCHITECTURE.md §7). Convenciones: `api_*` → `authenticated`; `svc_*` → `service_role`.
> En la capa de datos web: `api_docente_panel` → `docentePanel()`, argumentos sin el prefijo `p_` y en camelCase.

- Funciones `api_*`: **72** · Funciones `svc_*`: **19** · Códigos de error propios: **54**

## Índice

| Función | Argumentos | Retorna | Ejecuta | Modo |
|---|---|---|---|---|
| `api_abrir_sesion` | `p_id_sesion integer` | `jsonb` | authenticated | DEFINER |
| `api_admin_resumen` | — | `jsonb` | authenticated | INVOKER |
| `api_ahora` | — | `jsonb` | authenticated | INVOKER |
| `api_alertas_docente` | `p_id_grupo integer DEFAULT NULL::integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_alumno_cambiar_estatus` | `p_id_alumno integer, p_estatus text` | `jsonb` | authenticated | DEFINER |
| `api_alumno_guardar` | `p jsonb` | `jsonb` | authenticated | DEFINER |
| `api_alumno_historial` | `p_id_grupo integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_alumno_obtener` | `p_id_alumno integer` | `jsonb` | authenticated | INVOKER |
| `api_alumno_resumen` | `p_periodo text DEFAULT NULL::text` | `jsonb` | authenticated | INVOKER |
| `api_alumnos_listar` | `p_q text DEFAULT NULL::text, p_estatus text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_aula_guardar` | `p jsonb` | `jsonb` | authenticated | DEFINER |
| `api_aula_obtener` | `p_id_aula integer` | `jsonb` | authenticated | INVOKER |
| `api_aulas_listar` | `p_q text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_baja_inscripcion` | `p_id_inscripcion integer` | `jsonb` | authenticated | DEFINER |
| `api_bitacora_listar` | `p_accion text DEFAULT NULL::text, p_entidad text DEFAULT NULL::text, p_id_usuario integer DEFAULT NULL::integer, p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_camara_cambiar_estatus` | `p_id_camara integer, p_estatus estatus_camara` | `jsonb` | authenticated | DEFINER |
| `api_camara_guardar` | `p jsonb` | `jsonb` | authenticated | DEFINER |
| `api_camaras_estado` | `p_estatus estatus_camara DEFAULT NULL::estatus_camara, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | DEFINER |
| `api_camaras_listar` | `p_id_aula integer DEFAULT NULL::integer` | `jsonb` | authenticated | INVOKER |
| `api_cerrar_sesion` | `p_id_sesion integer` | `jsonb` | authenticated | DEFINER |
| `api_cola_revision` | `p_pestana text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_consentimiento_registrar` | `p_id_alumno integer, p_fecha_firma date, p_vigencia_hasta date, p_objeto_documento text, p_ip inet DEFAULT NULL::inet` | `jsonb` | authenticated | DEFINER |
| `api_consentimiento_revocar` | `p_id_consent integer, p_ip inet DEFAULT NULL::inet` | `jsonb` | authenticated | DEFINER |
| `api_consentimientos_alumno` | `p_id_alumno integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_corregir_asistencia` | `p_id_asistencia integer, p_estado text, p_comentario text DEFAULT NULL::text` | `jsonb` | authenticated | DEFINER |
| `api_detecciones_caso` | `p_id_asistencia integer, p_solo_validas boolean DEFAULT false, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_docente_cambiar_estatus` | `p_id_docente integer, p_estatus text` | `jsonb` | authenticated | DEFINER |
| `api_docente_guardar` | `p jsonb` | `jsonb` | authenticated | DEFINER |
| `api_docente_obtener` | `p_id_docente integer` | `jsonb` | authenticated | INVOKER |
| `api_docente_panel` | — | `jsonb` | authenticated | INVOKER |
| `api_docentes_listar` | `p_q text DEFAULT NULL::text, p_estatus text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_documento_url_autorizar` | `p_tipo text, p_id_registro integer, p_ip inet DEFAULT NULL::inet` | `jsonb` | authenticated | DEFINER |
| `api_generar_sesiones` | `p_id_grupo integer, p_desde date, p_hasta date, p_omitir_fechas date[] DEFAULT '{}'::date[]` | `jsonb` | authenticated | DEFINER |
| `api_grupo_guardar` | `p jsonb` | `jsonb` | authenticated | DEFINER |
| `api_grupo_obtener` | `p_id_grupo integer` | `jsonb` | authenticated | INVOKER |
| `api_grupos_listar` | `p_periodo text DEFAULT NULL::text, p_q text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_horario_guardar` | `p_id_grupo integer, p_bloques jsonb` | `jsonb` | authenticated | DEFINER |
| `api_impacto_tiempo` | `p_id_grupo integer DEFAULT NULL::integer, p_periodo text DEFAULT NULL::text` | `jsonb` | authenticated | INVOKER |
| `api_importar_inscripciones` | `p_id_grupo integer, p_filas jsonb` | `jsonb` | authenticated | DEFINER |
| `api_indice_estado` | `p_limit integer DEFAULT 10, p_offset integer DEFAULT 0` | `jsonb` | authenticated | DEFINER |
| `api_inscribir` | `p_id_grupo integer, p_id_alumno integer` | `jsonb` | authenticated | DEFINER |
| `api_inscritos` | `p_id_grupo integer, p_estatus text DEFAULT NULL::text` | `jsonb` | authenticated | INVOKER |
| `api_justificante_documento` | `p_id_justificante integer` | `jsonb` | authenticated | INVOKER |
| `api_materia_guardar` | `p jsonb` | `jsonb` | authenticated | DEFINER |
| `api_materia_obtener` | `p_id_materia integer` | `jsonb` | authenticated | INVOKER |
| `api_materias_listar` | `p_q text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_matriz_grupo` | `p_id_grupo integer, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_mis_justificables` | `p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_mis_justificantes` | `p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_parametro_actualizar` | `p_clave text, p_valor text, p_ip inet DEFAULT NULL::inet` | `jsonb` | authenticated | DEFINER |
| `api_parametros_listar` | `p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | DEFINER |
| `api_parametros_publicos` | — | `jsonb` | authenticated | DEFINER |
| `api_pase_lista_manual` | `p_id_sesion integer, p_registros jsonb, p_marcar_restantes boolean DEFAULT false` | `jsonb` | authenticated | DEFINER |
| `api_plantilla_alumno` | `p_id_alumno integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_plantilla_registrar` | `p_id_alumno integer, p_id_consent integer, p_objeto_foto text, p_ip inet DEFAULT NULL::inet, p_fotos jsonb DEFAULT NULL::jsonb` | `jsonb` | authenticated | DEFINER |
| `api_reanudar_sesion` | `p_id_sesion integer` | `jsonb` | authenticated | DEFINER |
| `api_registrar_justificante` | `p_id_sesion integer, p_motivo text, p_objeto_documento text, p_id_alumno integer DEFAULT NULL::integer` | `jsonb` | authenticated | DEFINER |
| `api_registrar_manual` | `p_id_sesion integer, p_id_alumno integer, p_estado text, p_hora timestamp with time zone DEFAULT NULL::timestamp with time zone` | `jsonb` | authenticated | DEFINER |
| `api_registros_corregibles` | `p_id_sesion integer, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_reporte_filtros` | `p_periodo text DEFAULT NULL::text` | `jsonb` | authenticated | INVOKER |
| `api_reporte_grupo` | `p_id_grupo integer, p_id_alumno integer DEFAULT NULL::integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_reporte_periodo` | `p_periodo text, p_id_grupo integer DEFAULT NULL::integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_resolver_justificante` | `p_id_justificante integer, p_aprobar boolean, p_comentario text DEFAULT NULL::text` | `jsonb` | authenticated | DEFINER |
| `api_serie_alumno` | `p_id_grupo integer, p_id_alumno integer DEFAULT NULL::integer` | `jsonb` | authenticated | INVOKER |
| `api_serie_grupo` | `p_id_grupo integer` | `jsonb` | authenticated | INVOKER |
| `api_sesion_monitor` | `p_id_sesion integer` | `jsonb` | authenticated | INVOKER |
| `api_sesiones_corregibles` | `p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_suspender_sesion` | `p_id_sesion integer, p_motivo text` | `jsonb` | authenticated | DEFINER |
| `api_usuario_actualizar` | `p_id_usuario integer, p jsonb` | `jsonb` | authenticated | DEFINER |
| `api_usuarios_listar` | `p_q text DEFAULT NULL::text, p_rol text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0` | `jsonb` | authenticated | INVOKER |
| `api_validar_justificante` | `p_id_sesion integer, p_id_alumno integer DEFAULT NULL::integer` | `jsonb` | authenticated | DEFINER |
| `api_yo` | — | `jsonb` | authenticated | INVOKER |
| `svc_alumnos_candidatos` | `p_id_sesion integer` | `jsonb` | service_role | DEFINER |
| `svc_bloqueo_adquirir` | `p_clave text, p_dueno text, p_ttl_seg integer DEFAULT 900` | `boolean` | service_role | DEFINER |
| `svc_bloqueo_liberar` | `p_clave text, p_dueno text` | `boolean` | service_role | DEFINER |
| `svc_camara_direccion` | `p_id_sesion integer, p_id_camara integer` | `text` | service_role | DEFINER |
| `svc_crear_captura` | `p_id_sesion integer, p_id_camara integer, p_marca_tiempo timestamp with time zone, p_rostros integer` | `bigint` | service_role | DEFINER |
| `svc_indice_activar` | `p_id_indice integer, p_mapeo jsonb` | `jsonb` | service_role | DEFINER |
| `svc_indice_en_uso` | — | `jsonb` | service_role | DEFINER |
| `svc_indice_plan` | `p_completa boolean DEFAULT false` | `jsonb` | service_role | DEFINER |
| `svc_indice_registrar` | `p_version text, p_dimension integer, p_objeto_indice text, p_total_vectores integer` | `jsonb` | service_role | DEFINER |
| `svc_indice_revertir` | `p_id_indice integer, p_mapeo jsonb` | `jsonb` | service_role | DEFINER |
| `svc_job_cerrar_sesiones` | `p_limit integer DEFAULT 200` | `jsonb` | service_role | DEFINER |
| `svc_job_purgar_recortes_listar` | `p_limit integer DEFAULT 500` | `jsonb` | service_role | DEFINER |
| `svc_job_purgar_recortes_marcar` | `p_ids bigint[]` | `jsonb` | service_role | DEFINER |
| `svc_job_recalcular` | `p_periodo text DEFAULT NULL::text` | `jsonb` | service_role | DEFINER |
| `svc_job_reconstruir_indice` | — | `jsonb` | service_role | DEFINER |
| `svc_job_resolver_pendientes` | `p_limit integer DEFAULT 500` | `jsonb` | service_role | DEFINER |
| `svc_registrar_consulta_revision` | `p_id_usuario integer, p_entidad text, p_id_registro bigint, p_ip text DEFAULT NULL::text, p_detalle jsonb DEFAULT NULL::jsonb` | `bigint` | service_role | DEFINER |
| `svc_registrar_detecciones` | `p_id_captura bigint, p_detecciones jsonb` | `jsonb` | service_role | DEFINER |
| `svc_usuario_crear` | `p_correo text, p_rol text, p_id_docente integer DEFAULT NULL::integer, p_id_alumno integer DEFAULT NULL::integer, p_auth_uid uuid DEFAULT NULL::uuid` | `integer` | service_role | DEFINER |

## Funciones api_* (usuario autenticado)

### `api_abrir_sesion(p_id_sesion integer)`

Abre la sesion de clase (programada -> abierta) y fija el modo de registro por las camaras del aula (RN-06).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** docente (titular del grupo)
- **Argumentos:** p_id_sesion integer. Solo dentro del horario (hora_inicio <= ahora < hora_fin de la fecha de la sesion, hora del plantel). Modo automatico si el aula tiene al menos una camara con estatus activa; si no, manual. Idempotente si ya esta abierta.
- **Forma JSON:** {id_sesion,id_grupo,fecha,hora_inicio,hora_fin,estatus:"abierta",modo_registro:"automatico"|"manual",ya_abierta,tolerancia_min,limite_presente_min,intervalo_muestreo_seg,camaras:[{id_camara,posicion,tipo,estatus}]}
- **Errores:** NO_ENCONTRADO (sesion inexistente), NO_AUTORIZADO (rol o sesion de otro docente), FUERA_DE_HORARIO (fuera de hora_inicio..hora_fin), SESION_CERRADA, SESION_SUSPENDIDA

### `api_admin_resumen()`

Contadores de la portada del administrador. El periodo es el del calendario (ene-jun = 1, jul-dic = 2) o, si no tiene grupos, el mas reciente. camaras.inactivas incluye las en mantenimiento.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador.
- **Argumentos:** ninguno.
- **Forma JSON:** {"fecha": "2026-09-14", "periodo": "2026-2", "alumnos_activos": 6, "docentes_activos": 2, "grupos_periodo": 2, "sesiones_hoy": {"total": 2, "programadas": 0, "abiertas": 2, "cerradas": 0, "suspendidas": 0}, "camaras": {"activas": 2, "inactivas": 1, "en_mantenimiento": 0}, "consentimientos_por_vencer_30d": 0, "plantillas_sin_indexar": 0}
- **Errores:** NO_AUTORIZADO.

### `api_ahora()`

Hora de negocio: {ahora, zona, fecha, hora, dia_semana (ISO 1=lunes..7), reloj_simulado}. Cualquier rol activo.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE

### `api_alertas_docente(p_id_grupo integer DEFAULT NULL::integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Alertas de asistencia para el panel del docente (RF-14): alumnos activos sin derecho a examen (tipo sin_derecho) o a una falta equivalente de perderlo (tipo en_limite), primero los que ya no tienen derecho y luego por porcentaje descendente.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** docente (solo sus grupos), administrador (todos)
- **Argumentos:** p_id_grupo integer opcional; p_limit integer (def. 50, max 200); p_offset integer
- **Forma JSON:** {generado_en, total, sin_derecho, en_limite, items:[{tipo:"sin_derecho"|"en_limite", id_grupo, clave_grupo, periodo, materia_clave, materia_nombre, id_alumno, matricula, apellido_paterno, apellido_materno, nombres, nombre_completo, id_inscripcion, sesiones_programadas, presentes, retardos, ausencias, justificadas, pendientes, faltas_equivalentes, porcentaje_faltas, limite_pct, faltas_maximas_permitidas, faltas_restantes_antes_limite, supera_limite, en_limite, derecho_examen}]}
- **Errores:** NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador)

### `api_alumno_cambiar_estatus(p_id_alumno integer, p_estatus text)`

Baja logica o reactivacion de un alumno: cambia el estatus y conserva todo el historial. Un estatus distinto de activo da de baja sus inscripciones activas; reactivar NO las restituye (hay que reinscribir). Idempotente.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p_id_alumno; p_estatus activo|baja_temporal|baja_definitiva|egresado.
- **Forma JSON:** {"id_alumno": 7, "estatus_anterior": "activo", "estatus": "baja_temporal", "cambio": true, "inscripciones_dadas_de_baja": 2}
- **Errores:** NO_AUTORIZADO, VALIDACION (estatus), NO_ENCONTRADO.

### `api_alumno_guardar(p jsonb)`

Da de alta (sin id_alumno) o modifica (con id_alumno) un alumno; el alta nace activo. El estatus se cambia con api_alumno_cambiar_estatus.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p {id_alumno?, matricula, apellido_paterno, apellido_materno?, nombres, correo_institucional}; en modificacion lo ausente se conserva.
- **Forma JSON:** {"id_alumno": 7, "matricula": "A007", "nombre_completo": "Soto Mena Carla", "correo_institucional": "a007@unach.test", "estatus": "activo", "creado": true}
- **Errores:** NO_AUTORIZADO, VALIDACION (campos), NO_ENCONTRADO (id_alumno), DUPLICADO (matricula o correo).

### `api_alumno_historial(p_id_grupo integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Historial por sesion del alumno autenticado en un grupo propio (RF-21), sin imagenes ni rutas: estado de cada sesion cerrada, abierta o suspendida (estado null = sin registro), origen, estatus de su justificante y si aun puede justificarla.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** alumno (solo propios)
- **Argumentos:** p_id_grupo integer; p_limit integer (def. 50, max 200); p_offset integer
- **Forma JSON:** {grupo:{id_grupo, clave_grupo, periodo, materia}, resumen:{...contadores del grupo...}, total, items:[{id_sesion, fecha, hora_inicio, hora_fin, estatus_sesion, modo_registro, estado, origen, hora_registro, justificante:{id_justificante, estatus}|null, puede_justificar}]}
- **Errores:** NO_AUTORIZADO (rol distinto de alumno o grupo donde no esta inscrito)

### `api_alumno_obtener(p_id_alumno integer)`

Ficha de un alumno con resumen de consentimiento, plantilla facial e inscripciones (sin rutas privadas).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador; docente (solo alumnos de sus grupos; consentimiento llega null porque la tabla es solo del administrador).
- **Argumentos:** p_id_alumno.
- **Forma JSON:** {"id_alumno": 1, "matricula": "A001", "nombre_completo": "Ramos Diaz Beatriz", "correo_institucional": "a001@unach.test", "estatus": "activo", "consentimiento_vigente": true, "consentimiento": {"id_consent": 1, "fecha_firma": "2026-08-01", "vigencia_hasta": "2027-08-01", "estatus": "vigente", "vigente": true}, "plantilla": {"id_plantilla": 1, "id_consent": 1, "fecha_registro": "2026-08-02T10:00:00-06:00", "indexada": true, "version_indice": "v001"}, "inscripciones": [{"id_inscripcion": 1, "id_grupo": 1, "clave_grupo": "3A", "periodo": "2026-2", "materia_clave": "ADM101", "estatus": "activa", "fecha_alta": "2026-08-03", "derecho_examen": true}]}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (no existe o el docente no lo tiene en sus grupos).

### `api_alumno_resumen(p_periodo text DEFAULT NULL::text)`

Resumen por materia del alumno autenticado en un periodo (RF-21): acumulados, porcentaje de faltas frente al limite, faltas restantes y derecho a examen. Coincide con el reporte del docente; los pendientes no cuentan hasta resolverse.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** alumno (solo propios)
- **Argumentos:** p_periodo text opcional (def. el periodo mas reciente del alumno)
- **Forma JSON:** {id_alumno, periodo, periodos_disponibles:["2026-2"], items:[{id_grupo, clave_grupo, periodo, materia:{id_materia, clave, nombre}, docente_nombre, sesiones_cerradas, id_inscripcion, sesiones_programadas, presentes, retardos, ausencias, justificadas, pendientes, faltas_equivalentes, porcentaje_faltas, limite_pct, faltas_maximas_permitidas, faltas_restantes_antes_limite, supera_limite, en_limite, derecho_examen}]}
- **Errores:** NO_AUTORIZADO (rol distinto de alumno)

### `api_alumnos_listar(p_q text DEFAULT NULL::text, p_estatus text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Lista alumnos con filtro de texto y estatus (paginada).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador (todos); docente (solo alumnos inscritos en sus grupos, por RLS).
- **Argumentos:** p_q texto libre (matricula, nombre, correo; opcional); p_estatus activo|baja_temporal|baja_definitiva|egresado (opcional); p_limit def. 50 max 200; p_offset def. 0.
- **Forma JSON:** {"total": 25, "items": [{"id_alumno": 1, "matricula": "A001", "apellido_paterno": "Ramos", "apellido_materno": "Diaz", "nombres": "Beatriz", "nombre_completo": "Ramos Diaz Beatriz", "correo_institucional": "a001@unach.test", "estatus": "activo", "consentimiento_vigente": true, "plantilla_activa": true}]}
- **Errores:** NO_AUTENTICADO, CUENTA_INACTIVA, NO_AUTORIZADO (alumno, tecnico), VALIDACION (estatus invalido).

### `api_aula_guardar(p jsonb)`

Da de alta (sin id_aula) o modifica (con id_aula) un aula.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p {id_aula?, clave (max 10), edificio (max 40), capacidad > 0}; en modificacion lo ausente se conserva.
- **Forma JSON:** {"id_aula": 3, "clave": "C-01", "edificio": "C", "capacidad": 30, "creado": true}
- **Errores:** NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, DUPLICADO (clave), AULA_CAPACIDAD_INSUFICIENTE (menor que los inscritos activos de un grupo).

### `api_aula_obtener(p_id_aula integer)`

Ficha de un aula con sus camaras (la direccion IP solo se entrega al administrador).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador; docente (solo aulas de sus grupos).
- **Argumentos:** p_id_aula.
- **Forma JSON:** {"id_aula": 1, "clave": "A-12", "edificio": "A", "capacidad": 40, "camaras": [{"id_camara": 1, "id_aula": 1, "posicion": "frente", "tipo": "ip", "direccion_ip": "10.20.0.12", "estatus": "activa"}]}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (no existe o el docente no la usa).

### `api_aulas_listar(p_q text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Lista aulas con conteo de camaras (paginada).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador (todas); docente (solo aulas de sus grupos, por RLS).
- **Argumentos:** p_q texto libre (clave o edificio; opcional); p_limit def. 50 max 200; p_offset def. 0.
- **Forma JSON:** {"total": 2, "items": [{"id_aula": 1, "clave": "A-12", "edificio": "A", "capacidad": 40, "camaras_total": 2, "camaras_activas": 2}]}
- **Errores:** NO_AUTORIZADO (alumno, tecnico).

### `api_baja_inscripcion(p_id_inscripcion integer)`

Da de baja (logica) una inscripcion: conserva la fila y su historial. Idempotente.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p_id_inscripcion.
- **Forma JSON:** {"id_inscripcion": 7, "id_grupo": 1, "id_alumno": 3, "estatus": "baja", "cambio": true}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO.

### `api_bitacora_listar(p_accion text DEFAULT NULL::text, p_entidad text DEFAULT NULL::text, p_id_usuario integer DEFAULT NULL::integer, p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Consulta la bitacora de auditoria (solo lectura, mas reciente primero) con filtros opcionales.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador (la RLS de bitacora_auditoria lo respalda).
- **Argumentos:** p_accion consulta|correccion|aprobacion_justificante|rechazo_justificante|alta_plantilla|cambio_parametro|cierre_sesion|notificacion; p_entidad (nombre de entidad); p_id_usuario; p_desde y p_hasta (date en hora del plantel, hasta inclusivo); p_limit def. 50 max 200; p_offset def. 0.
- **Forma JSON:** {"total": 1, "items": [{"id_bitacora": 1, "id_usuario": 2, "usuario_correo": "docente1@susan.test", "accion": "consulta", "entidad": "deteccion", "id_registro": 1, "valor_anterior": null, "valor_nuevo": {"fixture": true}, "fecha_hora": "2026-09-14T07:12:00-06:00", "ip_origen": "10.0.0.5"}]}
- **Errores:** NO_AUTORIZADO, VALIDACION (accion o rango de fechas).

### `api_camara_cambiar_estatus(p_id_camara integer, p_estatus estatus_camara)`

Cambia solo el estatus de una camara (RF-22). El modo de las sesiones ya abiertas no cambia; las nuevas lo deciden con las camaras activas (RN-06).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** tecnico, administrador
- **Argumentos:** p_id_camara, p_estatus (activa | inactiva | mantenimiento)
- **Forma JSON:** {"id_camara":5,"id_aula":2,"posicion":"fondo","estatus_anterior":"activa","estatus":"mantenimiento","cambio":true,"advertencias":["..."]}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (camara), VALIDACION (estatus nulo)

### `api_camara_guardar(p jsonb)`

Da de alta (sin id_camara) o modifica (con id_camara) una camara de un aula: una por posicion (frente|fondo); la direccion IP es obligatoria solo para tipo ip (en navegador se descarta). No cambia una camara de aula. No altera sesiones ya abiertas.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p {id_camara?, id_aula (solo alta), posicion frente|fondo, tipo ip|navegador (def. ip), direccion_ip, estatus activa|inactiva|mantenimiento (def. activa)}; en modificacion lo ausente se conserva.
- **Forma JSON:** {"id_camara": 4, "id_aula": 1, "posicion": "fondo", "tipo": "ip", "direccion_ip": "10.20.0.13", "estatus": "activa", "creado": true}
- **Errores:** NO_AUTORIZADO (incluye tecnico), VALIDACION, NO_ENCONTRADO (camara o aula), CAMARA_IP_REQUERIDA, CAMARA_POSICION_DUPLICADA, DUPLICADO (IP en uso).

### `api_camaras_estado(p_estatus estatus_camara DEFAULT NULL::estatus_camara, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Camaras con su estatus, ultima captura, capturas de las ultimas 24 h y si hay sesion abierta en el aula.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER STABLE
- **Roles:** tecnico, administrador
- **Argumentos:** p_estatus (activa | inactiva | mantenimiento; NULL = todas), p_limit (def. 50, max 200), p_offset
- **Forma JSON:** {"total":2,"items":[{"id_camara":4,"id_aula":2,"aula_clave":"A-12","edificio":"A","posicion":"frente","tipo":"ip","direccion_ip":"10.20.4.21"|null,"estatus":"activa","ultima_captura":"..."|null,"capturas_24h":160,"sesion_abierta":true}]}
- **Errores:** NO_AUTORIZADO

### `api_camaras_listar(p_id_aula integer DEFAULT NULL::integer)`

Lista las camaras de un aula (o de todas si p_id_aula es null), frente antes que fondo.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador (con direccion_ip); docente (camaras de las aulas de sus grupos, direccion_ip null). El tecnico usa api_camaras_estado.
- **Argumentos:** p_id_aula (opcional).
- **Forma JSON:** {"total": 2, "items": [{"id_camara": 1, "id_aula": 1, "aula_clave": "A-12", "posicion": "frente", "tipo": "ip", "direccion_ip": "10.20.0.12", "estatus": "activa"}]}
- **Errores:** NO_AUTORIZADO (alumno, tecnico), NO_ENCONTRADO (aula inexistente o ajena al docente).

### `api_cerrar_sesion(p_id_sesion integer)`

Cierra la sesion de clase (RF-10, RN-07): ausente a los inscritos activos sin registro, pendientes a la cola, estatus cerrada, bitacora y recalculo de faltas.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** docente (titular del grupo)
- **Argumentos:** p_id_sesion integer. Adelantar el cierre solo cuando termino la ventana de tolerancia (hora_inicio + tolerancia_min de la sesion). Idempotente.
- **Forma JSON:** {id_sesion,estatus:"cerrada",ya_cerrada,modo_registro,ausentes_creados,confirmados,pendientes,presentes,retardos,ausentes,justificados,registros,cerrada_por:"docente",cerrada_en}
- **Errores:** NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO, VENTANA_TOLERANCIA_ABIERTA (cierre antes de terminar la tolerancia), SESION_NO_ABIERTA (programada), SESION_SUSPENDIDA

### `api_cola_revision(p_pestana text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Cola de revision del docente (RF-18): pendientes de sesiones cerradas, justificantes por resolver y correcciones de los ultimos 30 dias, con lecturas (sin rutas), plazo restante y estado sugerido (RN-03).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** docente (solo sus grupos)
- **Argumentos:** p_pestana text (NULL = las tres listas; pendientes|justificantes|correcciones); p_limit integer (def. 50, max 200, por lista); p_offset integer
- **Forma JSON:** {generado_en, horas_limite_correccion, min_detecciones_validas, contadores:{pendientes, justificantes, correcciones_recientes}, pendientes:[{id_asistencia, estado, origen, hora_registro, conteo_detecciones, alumno, materia, grupo, sesion, vence_en, segundos_restantes, vencido, estado_sugerido, lecturas_validas, total_lecturas, mejor_score, lecturas:[{id_deteccion, id_captura, marca_tiempo, minuto_sesion, camara_posicion, score_similitud, es_valida, tiene_recorte}]}], justificantes:[...], correcciones_recientes:[...]}
- **Errores:** NO_AUTORIZADO (no es docente), VALIDACION (pestana)

### `api_consentimiento_registrar(p_id_alumno integer, p_fecha_firma date, p_vigencia_hasta date, p_objeto_documento text, p_ip inet DEFAULT NULL::inet)`

Registra un consentimiento firmado (RN-13); conserva el historial.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador
- **Argumentos:** p_id_alumno, p_fecha_firma (<= hoy), p_vigencia_hasta (> firma y >= hoy), p_objeto_documento (consentimientos/{id_alumno}/{uuid}.pdf), p_ip (opc.)
- **Forma JSON:** {"id_consent":9,"id_alumno":17,"fecha_firma":"2026-08-24","vigencia_hasta":"2027-08-23","estatus":"vigente","vigente":true}
- **Errores:** NO_AUTORIZADO (no es administrador), NO_ENCONTRADO (alumno), ALUMNO_INACTIVO, VALIDACION (fechas), RUTA_INVALIDA

### `api_consentimiento_revocar(p_id_consent integer, p_ip inet DEFAULT NULL::inet)`

Revoca un consentimiento vigente y archiva sus plantillas activas (el alumno pasa a pase manual).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador
- **Argumentos:** p_id_consent, p_ip (opc.)
- **Forma JSON:** {"id_consent":9,"id_alumno":17,"estatus":"revocado","plantillas_archivadas":1,"requiere_reconstruccion":true}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (consentimiento), RN_13_CONSENTIMIENTO_NO_VIGENTE (ya revocado o vencido)

### `api_consentimientos_alumno(p_id_alumno integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Historial de consentimientos de un alumno y el vigente (mayor vigencia_hasta).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador
- **Argumentos:** p_id_alumno, p_limit (def. 50, max 200), p_offset
- **Forma JSON:** {"id_alumno":17,"vigente":true,"consentimiento_vigente":{"id_consent":9,"fecha_firma":"2026-08-24","vigencia_hasta":"2027-08-23","dias_restantes":344},"total":2,"items":[{"id_consent":9,"fecha_firma":"2026-08-24","vigencia_hasta":"2027-08-23","estatus":"vigente","estatus_efectivo":"vigente","vigente":true,"dias_restantes":344,"plantillas_activas":1,"tiene_documento":true}]}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (alumno)

### `api_corregir_asistencia(p_id_asistencia integer, p_estado text, p_comentario text DEFAULT NULL::text)`

Corrige el estado de un registro de asistencia (RF-11, RN-08): origen correccion, plazo de horas_limite_correccion, bitacora con valor anterior y nuevo, recalculo del derecho a examen.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** docente titular del grupo
- **Argumentos:** p_id_asistencia integer; p_estado text (presente|retardo|ausente); p_comentario text opcional (<= 200)
- **Forma JSON:** {id_asistencia, id_sesion, id_alumno, estado_anterior, estado, origen:"correccion", hora_registro, vence_en, id_bitacora, inscripcion:{id_inscripcion, derecho_examen_anterior, derecho_examen}}
- **Errores:** NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO, VALIDACION (estado o comentario), TRANSICION_NO_PERMITIDA (pendiente, justificado o registro justificado), SIN_CAMBIO, SESION_NO_CERRADA, RN_08_PLAZO_VENCIDO, JUSTIFICANTE_PENDIENTE (presente con justificante pendiente)

### `api_detecciones_caso(p_id_asistencia integer, p_solo_validas boolean DEFAULT false, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Lecturas de un caso (detecciones atribuidas al alumno en la sesion) con rutas de recortes y foto de registro: SOLO para el Route Handler, que debe asentar la consulta (svc_registrar_consulta_revision) antes de firmar URLs de 300 s como maximo.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** docente titular (via Route Handler)
- **Argumentos:** p_id_asistencia integer; p_solo_validas boolean (def. false); p_limit integer (def. 50, max 100); p_offset integer
- **Forma JSON:** {id_usuario, vigencia_url_firmada_seg, asistencia, alumno, sesion, objeto_foto_registro, total, lecturas:[{id_deteccion, id_captura, marca_tiempo, minuto_sesion, camara_posicion, score_similitud, es_valida, tiene_recorte, objeto_recorte}]}
- **Errores:** NO_AUTORIZADO (no es docente), NO_ENCONTRADO (inexistente o de grupo ajeno)

### `api_docente_cambiar_estatus(p_id_docente integer, p_estatus text)`

Baja logica, licencia o reactivacion de un docente; conserva el historial. Idempotente. La baja se rechaza si tiene sesiones programadas o abiertas de hoy en adelante.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p_id_docente; p_estatus activo|licencia|baja.
- **Forma JSON:** {"id_docente": 3, "estatus_anterior": "activo", "estatus": "licencia", "cambio": true}
- **Errores:** NO_AUTORIZADO, VALIDACION (estatus), NO_ENCONTRADO, DOCENTE_CON_GRUPOS (baja con sesiones por impartir).

### `api_docente_guardar(p jsonb)`

Da de alta (sin id_docente) o modifica (con id_docente) un docente; el alta nace activo. El estatus se cambia con api_docente_cambiar_estatus.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p {id_docente?, num_empleado, apellido_paterno, apellido_materno?, nombres, correo_institucional}; en modificacion lo ausente se conserva.
- **Forma JSON:** {"id_docente": 3, "num_empleado": "D003", "nombre_completo": "Mena Soto Rosa", "correo_institucional": "rosa.mena@unach.test", "estatus": "activo", "creado": true}
- **Errores:** NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, DUPLICADO (num_empleado o correo).

### `api_docente_obtener(p_id_docente integer)`

Ficha de un docente con sus grupos.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador; docente (solo a si mismo).
- **Argumentos:** p_id_docente.
- **Forma JSON:** {"id_docente": 1, "num_empleado": "D001", "nombre_completo": "Lopez Ruiz Ana", "correo_institucional": "ana.lopez@unach.test", "estatus": "activo", "grupos": [{"id_grupo": 1, "clave_grupo": "3A", "periodo": "2026-2", "materia_clave": "ADM101", "materia_nombre": "Administracion I"}]}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (no existe o el docente consulta a otro).

### `api_docente_panel()`

Panel del docente (P-02): sesiones de hoy, pendientes, justificantes por resolver, alertas y grupos del periodo.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** docente
- **Argumentos:** (sin argumentos; la RLS limita todo a los grupos del docente)
- **Forma JSON:** {fecha, sesiones_hoy:[{id_sesion,id_grupo,materia,clave_grupo,aula,fecha,hora_inicio,hora_fin,estatus,modo_previsto,camaras_activas,abrible}], pendientes:2, justificantes_por_resolver:1, alertas:[{tipo:"sin_derecho_examen"|"en_limite",id_grupo,id_alumno,matricula,nombre,...}], grupos:[{id_grupo,materia,clave_grupo,periodo,aula,inscritos}]}. modo_previsto = modo real si la sesion ya abrio; si esta programada, automatico con al menos una camara activa en el aula y manual si no. pendientes = registros pendientes de sesiones cerradas. alertas usa api_alertas_docente() si existe; si no, v_resumen_asistencia. grupos = periodo mas reciente del docente.
- **Errores:** NO_AUTENTICADO (sin sesion), CUENTA_INACTIVA, NO_AUTORIZADO (rol distinto de docente)

### `api_docentes_listar(p_q text DEFAULT NULL::text, p_estatus text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Lista docentes con filtro de texto y estatus (paginada).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador (todos); docente (solo su propia fila, por RLS).
- **Argumentos:** p_q texto libre (num_empleado, nombre, correo; opcional); p_estatus activo|licencia|baja (opcional); p_limit def. 50 max 200; p_offset def. 0.
- **Forma JSON:** {"total": 2, "items": [{"id_docente": 1, "num_empleado": "D001", "apellido_paterno": "Lopez", "apellido_materno": "Ruiz", "nombres": "Ana", "nombre_completo": "Lopez Ruiz Ana", "correo_institucional": "ana.lopez@unach.test", "estatus": "activo", "grupos": 1}]}
- **Errores:** NO_AUTORIZADO (alumno, tecnico), VALIDACION (estatus invalido).

### `api_documento_url_autorizar(p_tipo text, p_id_registro integer, p_ip inet DEFAULT NULL::inet)`

Autoriza la URL firmada de un documento/foto: devuelve la ruta y la vigencia (<= 300 s) y asienta consulta en bitacora (RF-19) antes de devolver. plantilla = foto principal de la plantilla; plantilla_foto = una foto concreta de la plantilla (p_id_registro = id_foto; la consulta se asienta sobre la plantilla con id_foto y orden). Tambien funciona para fotos de plantillas archivadas.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador
- **Argumentos:** p_tipo (consentimiento | plantilla | plantilla_foto), p_id_registro (id_consent, id_plantilla o id_foto), p_ip (opc.)
- **Forma JSON:** {"tipo":"plantilla","id_registro":41,"id_alumno":17,"objeto":"registro/17/<uuid>.jpg","vigencia_seg":300}   |   tipo plantilla_foto: {"tipo":"plantilla_foto","id_registro":<id_foto>,"id_alumno":17,"id_plantilla":41,"orden":3,"objeto":"registro/17/<uuid>.jpg","vigencia_seg":300}
- **Errores:** NO_AUTORIZADO, VALIDACION (tipo), NO_ENCONTRADO

### `api_generar_sesiones(p_id_grupo integer, p_desde date, p_hasta date, p_omitir_fechas date[] DEFAULT '{}'::date[])`

Crea sesiones 'programada' a partir del horario del grupo entre dos fechas (inclusivas), copiando tolerancia_min, limite_presente_min e intervalo_muestreo_seg de los parametros vigentes; el modo nace automatico si el aula tiene alguna camara activa y manual si no. Idempotente por (grupo, fecha, hora_inicio): lo ya existente se omite, no se modifica.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p_id_grupo; p_desde y p_hasta (date, rango maximo 366 dias); p_omitir_fechas date[] (feriados o suspensiones; opcional).
- **Forma JSON:** {"id_grupo": 1, "desde": "2026-09-01", "hasta": "2026-09-30", "creadas": 12, "omitidas": 3, "omitidas_por_fecha": 1, "ya_existentes": 2, "modo_registro": "automatico", "parametros": {"tolerancia_min": 20, "limite_presente_min": 10, "intervalo_muestreo_seg": 15}}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (grupo), VALIDACION (rango), GRUPO_SIN_HORARIO.

### `api_grupo_guardar(p jsonb)`

Da de alta (sin id_grupo) o modifica (con id_grupo) un grupo: materia + clave_grupo + periodo unicos, periodo AAAA-S, docente activo, aula existente. Con inscripciones o sesiones no se cambia materia ni periodo; al cambiar de aula se revalida el horario.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p {id_grupo?, id_materia, id_docente, id_aula, clave_grupo (max 8), periodo 'AAAA-S'}; en modificacion lo ausente se conserva.
- **Forma JSON:** {"id_grupo": 3, "periodo": "2026-2", "clave_grupo": "3C", "id_materia": 1, "materia_clave": "ADM101", "materia_nombre": "Administracion I", "id_docente": 1, "docente_nombre": "Lopez Ruiz Ana", "id_aula": 1, "aula_clave": "A-12", "creado": true}
- **Errores:** NO_AUTORIZADO, VALIDACION, PERIODO_INVALIDO, NO_ENCONTRADO (grupo, materia, docente o aula), DOCENTE_NO_ACTIVO, DUPLICADO, GRUPO_CON_HISTORIAL, HORARIO_CHOQUE (cambio de aula).

### `api_grupo_obtener(p_id_grupo integer)`

Ficha de un grupo con horario, aula y camaras, inscritos y sesiones (P-09).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador; docente (solo sus grupos; sin direccion_ip de camaras).
- **Argumentos:** p_id_grupo.
- **Forma JSON:** {"id_grupo": 1, "periodo": "2026-2", "clave_grupo": "3A", "materia_clave": "ADM101", "docente_nombre": "Lopez Ruiz Ana", "aula_clave": "A-12", "horario": [{"id_horario": 1, "dia_semana": 1, "hora_inicio": "07:00:00", "hora_fin": "08:00:00"}], "aula": {"id_aula": 1, "clave": "A-12", "edificio": "A", "capacidad": 40, "camaras": [{"id_camara": 1, "posicion": "frente", "tipo": "ip", "direccion_ip": "10.20.0.12", "estatus": "activa"}]}, "inscritos": {"activos": 4, "baja": 1, "capacidad_aula": 40}, "sesiones": {"total": 3, "programadas": 1, "abiertas": 1, "cerradas": 1, "suspendidas": 0}}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (no existe o el docente no es el titular).

### `api_grupos_listar(p_periodo text DEFAULT NULL::text, p_q text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Lista grupos con filtro de periodo y texto (paginada), del periodo mas reciente al mas antiguo.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador (todos); docente (solo los suyos, por RLS).
- **Argumentos:** p_periodo 'AAAA-S' (opcional); p_q texto libre (clave de grupo, materia, docente, aula; opcional); p_limit def. 50 max 200; p_offset def. 0.
- **Forma JSON:** {"total": 2, "items": [{"id_grupo": 1, "periodo": "2026-2", "clave_grupo": "3A", "id_materia": 1, "materia_clave": "ADM101", "materia_nombre": "Administracion I", "id_docente": 1, "docente_nombre": "Lopez Ruiz Ana", "id_aula": 1, "aula_clave": "A-12", "inscritos_activos": 4, "sesiones_total": 3}]}
- **Errores:** NO_AUTORIZADO (alumno, tecnico), PERIODO_INVALIDO.

### `api_horario_guardar(p_id_grupo integer, p_bloques jsonb)`

Reemplaza el horario semanal completo de un grupo. Valida dia 1..6, hora_fin > hora_inicio, que los bloques no se traslapen entre si y que no choquen con otros grupos del mismo aula y periodo (bloques contiguos no chocan). No modifica sesiones ya generadas.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p_id_grupo; p_bloques [{"dia_semana": 1, "hora_inicio": "07:00", "hora_fin": "08:00"}] (1..42 bloques; 1 = lunes).
- **Forma JSON:** {"id_grupo": 1, "id_aula": 1, "bloques": [{"id_horario": 9, "dia_semana": 1, "hora_inicio": "07:00:00", "hora_fin": "08:00:00"}]}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (grupo), VALIDACION (arreglo vacio o demasiado grande), HORARIO_INVALIDO (dia, hora, fin <= inicio, traslape propio), HORARIO_CHOQUE (otro grupo del aula).

### `api_impacto_tiempo(p_id_grupo integer DEFAULT NULL::integer, p_periodo text DEFAULT NULL::text)`

ESTIMACION del tiempo de clase recuperado: sesiones cerradas en modo automatico vs manual y minutos recuperados = automaticas x minutos_pase_lista_base. No es una medicion.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador, docente (solo sus grupos)
- **Argumentos:** p_id_grupo integer opcional; p_periodo text opcional (AAAA-1|AAAA-2)
- **Forma JSON:** {id_grupo, periodo, sesiones_cerradas, sesiones_automaticas, sesiones_manuales, minutos_pase_lista_base:5, minutos_recuperados, horas_recuperadas, es_estimacion:true, nota}
- **Errores:** NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador), VALIDACION (periodo)

### `api_importar_inscripciones(p_id_grupo integer, p_filas jsonb)`

Carga masiva de inscripciones por lote (maximo 500 filas): por cada fila crea el alumno si su matricula no existe (exige apellido_paterno, nombres y correo) o reutiliza el existente (sin modificar sus datos) y lo inscribe. Cada fila se valida y se ejecuta en su propia subtransaccion: las malas no deshacen las buenas. Una fila ya inscrita se reporta como omitida; un alumno que no esta activo, como error.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p_id_grupo; p_filas [{"matricula": "A101", "nombres": "Ana", "apellido_paterno": "Soto", "apellido_materno": "Mena", "correo": "a101@unach.test"}].
- **Forma JSON:** {"id_grupo": 1, "total": 3, "inscritos": 1, "reinscritos": 0, "omitidos": 1, "errores": 1, "alumnos_creados": 1, "filas": [{"fila": 1, "matricula": "A101", "resultado": "inscrito", "codigo": null, "mensaje": "Alumno creado e inscrito.", "alumno_creado": true}]}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (grupo), VALIDACION (lote vacio o de mas de 500). Por fila: resultado inscrito|reinscrito|omitido|error con codigo VALIDACION, DUPLICADO, ALUMNO_NO_ACTIVO, INSCRIPCION_DUPLICADA o ERROR_FILA.

### `api_indice_estado(p_limit integer DEFAULT 10, p_offset integer DEFAULT 0)`

Estado del indice facial: version en uso, contadores de plantillas (activas, indexadas, pendientes, obsoletas), si requiere reconstruccion y versiones.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER STABLE
- **Roles:** tecnico, administrador
- **Argumentos:** p_limit (def. 10, max 200; versiones), p_offset
- **Forma JSON:** {"en_uso":{"id_indice":3,"version":"v003","dimension":512,"total_vectores":498,"fecha_construccion":"..."}|null,"dimension_configurada":512,"dimension_coincide":true,"plantillas":{"activas":500,"indexadas":498,"pendientes":2,"obsoletas_en_indice":0},"requiere_reconstruccion":true,"pendientes_detalle":[{"id_plantilla":41,"id_alumno":17,"fecha_registro":"..."}],"versiones":{"total":3,"items":[{"id_indice":3,"version":"v003","dimension":512,"total_vectores":498,"fecha_construccion":"...","en_uso":true}]}}
- **Errores:** NO_AUTORIZADO

### `api_inscribir(p_id_grupo integer, p_id_alumno integer)`

Inscribe a un alumno activo en un grupo. Sin duplicados: si ya esta activo se rechaza; si estaba en baja se reactiva la misma fila con fecha_alta de hoy.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p_id_grupo; p_id_alumno.
- **Forma JSON:** {"id_inscripcion": 7, "id_grupo": 1, "id_alumno": 3, "estatus": "activa", "fecha_alta": "2026-09-14", "derecho_examen": true, "reinscrita": false}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (grupo o alumno), ALUMNO_NO_ACTIVO, INSCRIPCION_DUPLICADA.

### `api_inscritos(p_id_grupo integer, p_estatus text DEFAULT NULL::text)`

Lista de inscritos de un grupo (sin paginar: un grupo es acotado) con estatus, alta, derecho a examen y consentimiento vigente.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador; docente (solo sus grupos, por RLS).
- **Argumentos:** p_id_grupo; p_estatus activa|baja (opcional; sin el, todas).
- **Forma JSON:** {"id_grupo": 1, "total": 5, "items": [{"id_inscripcion": 1, "id_alumno": 1, "matricula": "A001", "nombre_completo": "Ramos Diaz Beatriz", "correo_institucional": "a001@unach.test", "estatus_alumno": "activo", "estatus": "activa", "fecha_alta": "2026-08-03", "derecho_examen": true, "consentimiento_vigente": true}]}
- **Errores:** NO_AUTORIZADO (alumno, tecnico), NO_ENCONTRADO (grupo inexistente o ajeno al docente), VALIDACION (estatus).

### `api_justificante_documento(p_id_justificante integer)`

Ruta del documento de un justificante de un grupo propio: SOLO para el Route Handler, que asienta la consulta y firma una URL de 300 s como maximo.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** docente titular (via Route Handler)
- **Argumentos:** p_id_justificante integer
- **Forma JSON:** {id_usuario, vigencia_url_firmada_seg, id_justificante, id_alumno, id_asistencia, estatus, objeto_documento}
- **Errores:** NO_AUTORIZADO (no es docente), NO_ENCONTRADO (inexistente o de grupo ajeno)

### `api_materia_guardar(p jsonb)`

Da de alta (sin id_materia) o modifica (con id_materia) una materia.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p {id_materia?, clave (max 8), nombre (max 80), creditos > 0, horas_semana 1..20}; en modificacion lo ausente se conserva.
- **Forma JSON:** {"id_materia": 3, "clave": "MAT110", "nombre": "Matematicas", "creditos": 6, "horas_semana": 4, "creado": true}
- **Errores:** NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, DUPLICADO (clave).

### `api_materia_obtener(p_id_materia integer)`

Ficha de una materia.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador; docente (solo materias de sus grupos).
- **Argumentos:** p_id_materia.
- **Forma JSON:** {"id_materia": 1, "clave": "ADM101", "nombre": "Administracion I", "creditos": 8, "horas_semana": 4}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO.

### `api_materias_listar(p_q text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Lista materias con filtro de texto (paginada).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador (todas); docente (solo materias de sus grupos, por RLS).
- **Argumentos:** p_q texto libre (clave o nombre; opcional); p_limit def. 50 max 200; p_offset def. 0.
- **Forma JSON:** {"total": 2, "items": [{"id_materia": 1, "clave": "ADM101", "nombre": "Administracion I", "creditos": 8, "horas_semana": 4}]}
- **Errores:** NO_AUTORIZADO (alumno, tecnico).

### `api_matriz_grupo(p_id_grupo integer, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0)`

Matriz alumno x sesion cerrada para el analisis numerico: fechas (una por sesion cerrada, por orden cronologico) y, por alumno, estados alineados con fechas (null = sin registro). Los alumnos dados de baja solo aparecen si tienen registros. Paginada por alumno (def. 200); clave extra total.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador, docente (solo sus grupos)
- **Argumentos:** p_id_grupo integer; p_limit integer (def. 200, max 200); p_offset integer
- **Forma JSON:** {fechas:["2026-08-17"], total, alumnos:[{id_alumno, id_inscripcion, matricula, nombre, estados:["presente","ausente",null]}]}
- **Errores:** NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador), VALIDACION (grupo nulo)

### `api_mis_justificables(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Faltas y retardos propios de sesiones cerradas que aun se pueden justificar (sin justificante pendiente).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** alumno (solo propios)
- **Argumentos:** p_limit integer (def. 50, max 200); p_offset integer
- **Forma JSON:** {total, items:[{id_asistencia, id_sesion, estado, origen, fecha, hora_inicio, hora_fin, materia, grupo, tiene_rechazado}]}
- **Errores:** NO_AUTORIZADO (no es alumno)

### `api_mis_justificantes(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Justificantes propios del alumno con su estatus, sin documento ni comentarios del docente.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** alumno (solo propios)
- **Argumentos:** p_limit integer (def. 50, max 200); p_offset integer
- **Forma JSON:** {total, items:[{id_justificante, estatus, motivo, fecha_registro, fecha_resolucion, registrado_por_rol, id_sesion, id_asistencia, estado_asistencia, fecha, hora_inicio, materia, grupo}]}
- **Errores:** NO_AUTORIZADO (no es alumno)

### `api_parametro_actualizar(p_clave text, p_valor text, p_ip inet DEFAULT NULL::inet)`

Cambia un parametro del sistema (RNF-02): valida tipo, rango y coherencia, guarda el valor canonico y asienta cambio_parametro. Sin cambio real no escribe ni asienta.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** tecnico
- **Argumentos:** p_clave, p_valor (texto), p_ip (opc.)
- **Forma JSON:** {"clave":"umbral_similitud","valor_anterior":"0.850","valor":"0.900","cambio":true,"tipo":"decimal","advertencias":["..."],"fecha_actualizacion":"...","actualizado_por":{"id_usuario":3,"correo":"tecnico@example.test"}}
- **Errores:** NO_AUTORIZADO (solo tecnico), PARAMETRO_NO_ENCONTRADO, PARAMETRO_VALOR_INVALIDO (tipo, rango o coherencia)

### `api_parametros_listar(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Parametros del sistema con tipo, rango, unidad y ultimo editor, en el orden de la Tabla 4.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER STABLE
- **Roles:** tecnico, administrador (solo lectura)
- **Argumentos:** p_limit (def. 50, max 200), p_offset
- **Forma JSON:** {"total":12,"items":[{"clave":"umbral_similitud","valor":"0.850","tipo":"decimal","minimo":"0.500","maximo":"0.999","unidad":"score","descripcion":"...","actualizado_por":{"id_usuario":3,"correo":"tecnico@example.test"}|null,"fecha_actualizacion":"..."}]}
- **Errores:** NO_AUTORIZADO

### `api_parametros_publicos()`

Parametros del sistema como objeto {clave: valor} (numericos como numero JSON). Cualquier rol activo.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER STABLE

### `api_pase_lista_manual(p_id_sesion integer, p_registros jsonb, p_marcar_restantes boolean DEFAULT false)`

Pase de lista manual por lote, atomico (todo o nada), con origen manual (P-04, RF-09).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** docente (titular del grupo)
- **Argumentos:** p_id_sesion integer, p_registros jsonb = [{id_alumno:int, estado:"presente"|"retardo"|"ausente"|null, hora:timestamptz|null}] (estado null = sugerido por la hora; sin id_alumno repetidos; max 500), p_marcar_restantes boolean (default false: ademas marca a los inscritos activos sin registro con el estado que sugiere la hora de marcado; en sesion automatica omite a quien ya tiene lecturas validas). Aplica las mismas reglas que api_registrar_manual a cada alumno.
- **Forma JSON:** {id_sesion,modo_registro,procesados,creados,actualizados,restantes_marcados,items:[{id_asistencia,id_alumno,estado,origen,hora_registro,sugerido,creado}]}
- **Errores:** NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO (sesion), SESION_NO_ABIERTA, VALIDACION (registro mal formado), REGISTRO_DUPLICADO (alumno repetido en el lote), ALUMNO_NO_INSCRITO, ALUMNO_CON_LECTURAS, ESTADO_INVALIDO, HORA_INVALIDA, REGISTRO_CORREGIDO

### `api_plantilla_alumno(p_id_alumno integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Plantilla facial activa de un alumno (con su version de indice y sus fotos) y las archivadas paginadas. Nunca devuelve rutas objeto_foto: la foto se abre con api_documento_url_autorizar (tipo plantilla o plantilla_foto). coseno_min y coseno_medio son la consistencia entre fotos medida por el servicio al registrar (informativa; null en plantillas de una foto).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador
- **Argumentos:** p_id_alumno, p_limit (def. 50, max 200; aplica a archivadas), p_offset
- **Forma JSON:** {"id_alumno":17,"activa":{"id_plantilla":41,"id_consent":9,"fecha_registro":"...","indexada":true,"id_indice":3,"version_indice":"v003","faiss_id":1042,"en_uso":true,"consentimiento_vigente":true,"n_fotos":5,"coseno_min":0.512|null,"coseno_medio":0.744|null,"fotos":[{"id_foto":101,"orden":1,"principal":true,"calidad":{"brillo":120.5,"nitidez":88.2,"tamano_rostro_px":210,"frontal":true}|null,"coseno_resto":0.812|null}]}|null,"archivadas":{"total":1,"items":[{"id_plantilla":33,"id_consent":4,"fecha_registro":"...","n_fotos":1}]},"indice_en_uso":{"id_indice":3,"version":"v003"}|null}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (alumno)

### `api_plantilla_registrar(p_id_alumno integer, p_id_consent integer, p_objeto_foto text, p_ip inet DEFAULT NULL::inet, p_fotos jsonb DEFAULT NULL::jsonb)`

Da de alta la plantilla facial (RN-12/RN-13), de una foto o de 3 a 8: archiva la activa anterior (con sus fotos, que NO se borran), inserta la nueva sin indexar y asienta alta_plantilla. Atomica: una falla no deja filas en plantilla_foto ni archiva la anterior. El promedio de los embeddings y el descarte de outliers ocurren en el servicio de reconocimiento (los vectores nunca tocan la BD, RNF-03); calidad y coseno_resto los aporta el llamador y son informativos, no verificables en SQL.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador
- **Argumentos:** p_id_alumno, p_id_consent (vigente y del mismo alumno), p_objeto_foto (registro/{id_alumno}/{uuid}.jpg; con p_fotos puede ser NULL o igual a la primera), p_ip (opc.), p_fotos (opc.; arreglo JSON de 3 a 8 objetos EN ORDEN DE CAPTURA, el primero es la foto principal; por elemento: objeto_foto (obligatoria, registro/{id_alumno}/{uuid}.jpg, sin repetidas), calidad (opc., null o {brillo 0..255, nitidez 0..1000000, tamano_rostro_px entero 0..100000, frontal boolean}) y coseno_resto (opc., null o numero entre -1 y 1, se guarda con 3 decimales); cualquier otra clave es invalida; un JSON null equivale a omitirlo)
- **Forma JSON:** {"id_plantilla":41,"id_alumno":17,"id_consent":9,"activa":true,"indexada":false,"plantilla_archivada":33,"fecha_registro":"2026-09-14T09:12:41-06:00","requiere_reconstruccion":true,"n_fotos":5}   (n_fotos = 1 sin p_fotos)
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (alumno o consentimiento), ALUMNO_INACTIVO, VALIDACION (p_fotos: cantidad, forma, repetidas, principal distinta de la primera), RUTA_INVALIDA, RN_13_CONSENTIMIENTO_AJENO, RN_13_CONSENTIMIENTO_NO_VIGENTE

### `api_reanudar_sesion(p_id_sesion integer)`

Reanuda una sesion suspendida (suspendida -> programada): vuelve al denominador de faltas y se recalcula el grupo.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** docente (titular del grupo), administrador
- **Argumentos:** p_id_sesion integer. Idempotente si ya esta programada.
- **Forma JSON:** {id_sesion,estatus:"programada",ya_programada}
- **Errores:** NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO, ESTATUS_INVALIDO (abierta o cerrada)

### `api_registrar_justificante(p_id_sesion integer, p_motivo text, p_objeto_documento text, p_id_alumno integer DEFAULT NULL::integer)`

Registra un justificante pendiente de una falta o retardo de una sesion cerrada (RF-12). El documento debe ser justificantes/<id_alumno>/<uuid>.(pdf|jpg|png).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** alumno (propios), docente titular
- **Argumentos:** p_id_sesion integer; p_motivo text (1..200); p_objeto_documento text (ruta en el bucket); p_id_alumno integer (NULL para alumno; obligatorio para docente)
- **Forma JSON:** {id_justificante, id_sesion, id_alumno, id_asistencia, estado_asistencia, estatus:"pendiente", motivo, objeto_documento, registrado_por_rol, fecha_registro}
- **Errores:** NO_AUTORIZADO (alumno ajeno o grupo no titular), VALIDACION (motivo o alumno), DOCUMENTO_INVALIDO, ASISTENCIA_NO_ENCONTRADA, SESION_NO_CERRADA, ESTADO_NO_JUSTIFICABLE, JUSTIFICANTE_DUPLICADO

### `api_registrar_manual(p_id_sesion integer, p_id_alumno integer, p_estado text, p_hora timestamp with time zone DEFAULT NULL::timestamp with time zone)`

Registra o actualiza con origen manual la asistencia de un alumno en una sesion abierta (RF-09).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** docente (titular del grupo)
- **Argumentos:** p_id_sesion integer, p_id_alumno integer, p_estado text ("presente"|"retardo"|"ausente"; NULL = el sugerido por la hora), p_hora timestamptz (default ahora; no futura). En sesion automatica solo para inscritos sin consentimiento vigente o sin lecturas validas; no cambia el modo de la sesion. Un solo registro por alumno y sesion: si ya hay uno manual (o un automatico de alguien sin consentimiento) se actualiza.
- **Forma JSON:** {id_asistencia,id_sesion,id_alumno,estado,origen:"manual",hora_registro,sugerido,creado}. hora_registro es null si el estado es ausente.
- **Errores:** NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO (sesion), SESION_NO_ABIERTA, ALUMNO_NO_INSCRITO, ALUMNO_CON_LECTURAS (sesion automatica, con consentimiento y lecturas), ESTADO_INVALIDO, HORA_INVALIDA, REGISTRO_CORREGIDO, VALIDACION

### `api_registros_corregibles(p_id_sesion integer, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)`

Registros de asistencia de una sesion propia con su plazo de correccion y si cada uno es corregible.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** docente titular
- **Argumentos:** p_id_sesion integer; p_limit integer (def. 100, max 200); p_offset integer
- **Forma JSON:** {sesion, vence_en, segundos_restantes, dentro_de_plazo, total, items:[{id_asistencia, alumno, estado, origen, hora_registro, conteo_detecciones, justificante_pendiente, corregible}]}
- **Errores:** NO_AUTORIZADO (no es docente), NO_ENCONTRADO (sesion inexistente o ajena)

### `api_reporte_filtros(p_periodo text DEFAULT NULL::text)`

Periodos y grupos accesibles para los filtros de reportes y analitica (docente: solo sus grupos).

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador, docente
- **Argumentos:** p_periodo text opcional (def. el periodo mas reciente accesible)
- **Forma JSON:** {periodo_actual, periodo, periodos:["2026-2"], grupos:[{id_grupo, clave_grupo, periodo, id_materia, materia_clave, materia_nombre, id_docente, docente_nombre, inscritos}]}
- **Errores:** NO_AUTORIZADO (rol distinto de administrador o docente)

### `api_reporte_grupo(p_id_grupo integer, p_id_alumno integer DEFAULT NULL::integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Reporte de asistencia de un grupo (RF-17): KPIs del grupo y una fila por alumno activo con presentes, retardos, ausencias, justificadas, pendientes, faltas equivalentes (RN-10), porcentaje sobre sesiones programadas (RN-11), faltas restantes y derecho a examen. Con p_id_alumno trae solo su fila y su detalle por sesion.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador (todos los grupos), docente (solo los suyos)
- **Argumentos:** p_id_grupo integer; p_id_alumno integer opcional; p_limit integer (def. 50, max 200); p_offset integer
- **Forma JSON:** {generado_en, grupo:{id_grupo, clave_grupo, periodo, id_materia, materia_clave, materia_nombre, id_docente, docente_nombre, id_aula, aula_clave}, limite_pct:20, retardos_por_ausencia:3, kpis:{sesiones_programadas:48, sesiones_cerradas, inscritos, asistencia_promedio:91.5, alumnos_en_limite, alumnos_sin_derecho}, total, items:[{id_alumno, matricula, apellido_paterno, apellido_materno, nombres, nombre_completo, id_inscripcion, sesiones_programadas, presentes, retardos, ausencias, justificadas, pendientes, faltas_equivalentes, porcentaje_faltas:18.75, limite_pct, faltas_maximas_permitidas, faltas_restantes_antes_limite, supera_limite, en_limite, derecho_examen}], detalle:null|[{id_sesion, fecha, hora_inicio, estatus_sesion, estado, origen, hora_registro, justificante_estatus}]}
- **Errores:** NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador; alumno no inscrito), VALIDACION (grupo nulo)

### `api_reporte_periodo(p_periodo text, p_id_grupo integer DEFAULT NULL::integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Reporte por periodo (RF-17): una fila por grupo con inscritos, sesiones programadas y cerradas, asistencia promedio y alumnos en el limite o sin derecho.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador (todos los grupos); docente (solo los suyos, impuesto por la RLS)
- **Argumentos:** p_periodo text (AAAA-1|AAAA-2); p_id_grupo integer opcional; p_limit integer (def. 50, max 200); p_offset integer
- **Forma JSON:** {generado_en, periodo, total, items:[{id_grupo, clave_grupo, periodo, id_materia, materia_clave, materia_nombre, id_docente, docente_nombre, id_aula, inscritos, sesiones_programadas, sesiones_cerradas, asistencia_promedio, alumnos_en_limite, alumnos_sin_derecho}]}
- **Errores:** NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador), VALIDACION (periodo)

### `api_resolver_justificante(p_id_justificante integer, p_aprobar boolean, p_comentario text DEFAULT NULL::text)`

Aprueba o rechaza un justificante pendiente (RF-12, RN-09). Aprobar deja el registro justificado (origen correccion) sin borrar lecturas; asienta bitacora y recalcula el derecho a examen. Sin plazo.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** docente titular del grupo
- **Argumentos:** p_id_justificante integer; p_aprobar boolean; p_comentario text opcional (<= 200)
- **Forma JSON:** {id_justificante, id_asistencia, estatus, estado_asistencia_anterior, estado_asistencia, resuelto_por, fecha_resolucion, id_bitacora, inscripcion:{id_inscripcion, derecho_examen_anterior, derecho_examen}}
- **Errores:** NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO, VALIDACION (p_aprobar nulo o comentario largo), JUSTIFICANTE_YA_RESUELTO, ESTADO_NO_JUSTIFICABLE

### `api_serie_alumno(p_id_grupo integer, p_id_alumno integer DEFAULT NULL::integer)`

Serie de un alumno en un grupo: una entrada por sesion CERRADA (estado null = sin registro) con las ausencias, retardos y faltas equivalentes acumuladas hasta esa sesion, mas su resumen actual. Sin imagenes.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** alumno (solo propios), docente (sus grupos), administrador
- **Argumentos:** p_id_grupo integer; p_id_alumno integer (omitido o propio para el alumno; obligatorio para docente y administrador)
- **Forma JSON:** {id_grupo, id_alumno, periodo, sesiones_programadas, limite_pct, retardos_por_ausencia, resumen:{...}, sesiones:[{id_sesion, fecha, semana_iso, dia_semana, estado, ausencias_acumuladas, retardos_acumulados, faltas_equivalentes_acumuladas}]}
- **Errores:** NO_AUTORIZADO (alumno ajeno, grupo ajeno o sin inscripcion propia), NO_ENCONTRADO (alumno no inscrito en el grupo), VALIDACION (falta p_id_alumno)

### `api_serie_grupo(p_id_grupo integer)`

Serie temporal del grupo para el analisis numerico: una entrada por sesion CERRADA, ordenada por fecha, con conteos por estado y tasa de ausentismo = ausentes / inscritos (fraccion 0-1, 4 decimales). inscritos = registros de asistencia de la sesion.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador, docente (solo sus grupos)
- **Argumentos:** p_id_grupo integer
- **Forma JSON:** {id_grupo, periodo, sesiones_programadas:48, limite_pct:20, retardos_por_ausencia:3, sesiones:[{id_sesion, fecha, semana_iso, anio_iso, dia_semana (1=lunes), inscritos, presentes, retardos, ausentes, justificados, pendientes, tasa_ausentismo:0.0667}]}
- **Errores:** NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador), VALIDACION (grupo nulo)

### `api_sesion_monitor(p_id_sesion integer)`

Monitor en vivo de la sesion (P-03/P-04): sesion con minuto actual, camaras, estado de cada alumno y totales.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** docente (titular del grupo)
- **Argumentos:** p_id_sesion integer. lecturas_validas = capturas DISTINTAS con deteccion valida del alumno; mejor_score = mayor score entre sus detecciones (aunque no alcance el umbral). Lista los inscritos activos y a quien ya tenga registro.
- **Forma JSON:** {sesion:{id_sesion,...,estatus,modo_registro,minuto_actual:9.5,en_ventana:true,fase:"presente"|"retardo"|"fuera_de_ventana"|<estatus>}, camaras:[{id_camara,posicion,tipo,estatus,ultima_captura,capturas}], alumnos:[{id_alumno,matricula,nombre,inscripcion,estado:null|"pendiente"|...,origen,hora_registro,conteo_detecciones,lecturas_validas,mejor_score,consentimiento_vigente}], totales:{inscritos,presentes,retardos,ausentes,pendientes,justificados,registrados,sin_registro,manuales,capturas,detecciones,detecciones_validas}}
- **Errores:** NO_AUTENTICADO, NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO

### `api_sesiones_corregibles(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Sesiones cerradas de los grupos del docente cuyo plazo de correccion (RN-08) sigue abierto.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** docente (solo sus grupos)
- **Argumentos:** p_limit integer (def. 50, max 200); p_offset integer
- **Forma JSON:** {total, items:[{id_sesion, fecha, hora_inicio, hora_fin, modo_registro, grupo, materia, vence_en, segundos_restantes, total_registros, total_pendientes}]}
- **Errores:** NO_AUTORIZADO (no es docente)

### `api_suspender_sesion(p_id_sesion integer, p_motivo text)`

Suspende una sesion programada (extension a la spec): sale del denominador de faltas (RN-11) y se recalcula el grupo.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** docente (titular del grupo), administrador
- **Argumentos:** p_id_sesion integer, p_motivo text (1 a 200 caracteres; queda en bitacora como correccion de sesion_clase). Solo sesiones programadas; idempotente si ya esta suspendida.
- **Forma JSON:** {id_sesion,estatus:"suspendida",ya_suspendida,motivo}
- **Errores:** NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO, VALIDACION (motivo vacio o > 200), ESTATUS_INVALIDO (abierta o cerrada)

### `api_usuario_actualizar(p_id_usuario integer, p jsonb)`

Activa o desactiva una cuenta y/o cambia su rol manteniendo el vinculo coherente (docente exige id_docente, alumno exige id_alumno, administrador y tecnico no llevan vinculo). El correo (identidad en Auth) no se cambia aqui. Un administrador no puede desactivarse ni quitarse el rol a si mismo.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER VOLATILE
- **Roles:** administrador.
- **Argumentos:** p_id_usuario; p {activo?: boolean, rol?, id_docente?, id_alumno?}; al menos un campo.
- **Forma JSON:** {"id_usuario": 5, "correo": "alumno1@susan.test", "rol": "alumno", "activo": false, "id_docente": null, "id_alumno": 4, "cambio": true}
- **Errores:** NO_AUTORIZADO, NO_ENCONTRADO (usuario, docente o alumno; la cuenta de servicio cuenta como inexistente), VALIDACION, ROL_VINCULO_INCOHERENTE, DUPLICADO (el docente o alumno ya tiene cuenta), USUARIO_PROPIO.

### `api_usuarios_listar(p_q text DEFAULT NULL::text, p_rol text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`

Lista las cuentas de usuario (paginada); oculta la cuenta de servicio servicio@susan.local.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE
- **Roles:** administrador.
- **Argumentos:** p_q texto libre (correo, nombre, matricula o numero de empleado; opcional); p_rol administrador|docente|alumno|tecnico (opcional); p_limit def. 50 max 200; p_offset def. 0.
- **Forma JSON:** {"total": 7, "items": [{"id_usuario": 2, "correo": "docente1@susan.test", "rol": "docente", "activo": true, "id_docente": 1, "id_alumno": null, "nombre": "Lopez Ruiz Ana", "vinculo": "D001"}]}
- **Errores:** NO_AUTORIZADO, VALIDACION (rol).

### `api_validar_justificante(p_id_sesion integer, p_id_alumno integer DEFAULT NULL::integer)`

Precomprueba (sin escribir) que se puede registrar un justificante para la sesion y el alumno.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · DEFINER STABLE
- **Roles:** alumno (propios), docente titular
- **Argumentos:** p_id_sesion integer; p_id_alumno integer (NULL para alumno; obligatorio para docente)
- **Forma JSON:** {id_sesion, id_alumno, id_asistencia, estado:"ausente", ya_tuvo_rechazo:false}
- **Errores:** NO_AUTORIZADO, VALIDACION, ASISTENCIA_NO_ENCONTRADA, SESION_NO_CERRADA, ESTADO_NO_JUSTIFICABLE, JUSTIFICANTE_DUPLICADO

### `api_yo()`

Identidad del usuario autenticado: {id_usuario, auth_uid, correo, rol, activo, id_docente, id_alumno, nombre, home}. Errores: NO_AUTENTICADO, CUENTA_NO_VINCULADA.

- **Retorna:** `jsonb`
- **Ejecuta:** authenticated · INVOKER STABLE


## Funciones svc_* (solo servidor, service_role)

### `svc_alumnos_candidatos(p_id_sesion integer)`

Candidatos del reconocimiento para una sesion (RF-04, RNF-06): plantillas activas del indice en uso, de alumnos con inscripcion activa en el grupo y consentimiento vigente.

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER STABLE
- **Roles:** service_role
- **Argumentos:** p_id_sesion integer. Sin indice en uso devuelve faiss_ids vacio e index_version null.
- **Forma JSON:** {index_version:"v001"|null, id_indice:1|null, faiss_ids:[0,3], mapa:[{faiss_id,id_plantilla,id_alumno}]}
- **Errores:** NO_ENCONTRADO (sesion)

### `svc_bloqueo_adquirir(p_clave text, p_dueno text, p_ttl_seg integer DEFAULT 900)`

Arrienda un bloqueo con vencimiento (reconstruccion de indice, jobs). true si lo obtuvo o renovo (mismo dueno); false si otro lo tiene vigente.

- **Retorna:** `boolean`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role
- **Argumentos:** p_clave (indice, job:purgar-recortes, job:recalcular, ...), p_dueno, p_ttl_seg (10-7200, def. 900)
- **Forma JSON:** true | false
- **Errores:** VALIDACION (clave, dueno o ttl)

### `svc_bloqueo_liberar(p_clave text, p_dueno text)`

Libera un bloqueo; true solo si p_dueno es su dueno.

- **Retorna:** `boolean`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role
- **Argumentos:** p_clave, p_dueno
- **Forma JSON:** true | false
- **Errores:** ninguno

### `svc_camara_direccion(p_id_sesion integer, p_id_camara integer)`

Dirección (direccion_ip) de una cámara de tipo 'ip' del aula del grupo de la sesión; la usa el Route Handler de captura para armar camera_url.

- **Retorna:** `text`
- **Ejecuta:** service_role · DEFINER STABLE
- **Roles:** service_role
- **Argumentos:** p_id_sesion integer; p_id_camara integer.
- **Forma JSON:** text (la dirección IP o nombre de host).
- **Errores:** CAMARA_FUERA_DE_AULA (cámara inexistente, de otra aula o de tipo navegador)

### `svc_crear_captura(p_id_sesion integer, p_id_camara integer, p_marca_tiempo timestamp with time zone, p_rostros integer)`

Registra la captura de una camara en una sesion automatica abierta (RF-03). Idempotente por (id_camara, marca_tiempo): devuelve el id existente.

- **Retorna:** `bigint`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role
- **Argumentos:** p_id_sesion integer, p_id_camara integer, p_marca_tiempo timestamptz (<= hora_inicio + tolerancia_min, no futura mas de 5 min), p_rostros integer (0 a 1000). La camara debe ser del aula del grupo y estar activa.
- **Forma JSON:** id_captura bigint
- **Errores:** NO_ENCONTRADO (sesion), CAMARA_NO_ENCONTRADA, CAMARA_FUERA_DE_AULA (RN-06), CAMARA_INACTIVA, SESION_NO_ABIERTA, SESION_NO_AUTOMATICA, FUERA_DE_VENTANA (pasada la tolerancia), MARCA_FUTURA, CAPTURA_EN_OTRA_SESION, VALIDACION

### `svc_indice_activar(p_id_indice integer, p_mapeo jsonb)`

Activa atomicamente una version del indice (RF-16, RN-12, RNF-09): apaga la anterior, asigna id_indice/faiss_id a las plantillas del mapeo y enciende la nueva en una sola transaccion; si algo es invalido no cambia nada. Reintentable (ya_activo).

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role
- **Argumentos:** p_id_indice, p_mapeo (jsonb [{"id_plantilla":12,"faiss_id":1001}], uno por vector; coincide con refs del manifiesto)
- **Forma JSON:** {"id_indice":4,"version":"v004","anterior":{"id_indice":3,"version":"v003"}|null,"plantillas_asignadas":500,"plantillas_pendientes":1,"total_vectores":500,"ya_activo":false,"activado_en":"..."}
- **Errores:** NO_ENCONTRADO (version), INDICE_MAPEO_INVALIDO (estructura, repetidos, faiss_id < 0), INDICE_MAPEO_INCOMPLETO (conteo <> total_vectores), INDICE_DIMENSION_INVALIDA, INDICE_PLAN_OBSOLETO (plantilla archivada o activa indexada ausente del mapeo), RN_12_INDICE_EN_USO_DUPLICADO

### `svc_indice_en_uso()`

Version del indice en uso (para el arranque del servicio de reconocimiento); null si no hay.

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER STABLE
- **Roles:** service_role
- **Argumentos:** ninguno
- **Forma JSON:** {"id_indice":4,"version":"v004","objeto_indice":"indice/v004.json","dimension":512,"total_vectores":500} | null
- **Errores:** ninguno

### `svc_indice_plan(p_completa boolean DEFAULT false)`

Plan de reconstruccion del indice: base (version en uso, o null), todas las plantillas activas con su faiss_id (los nuevos son max historico + posicion, nunca reutilizados), version sugerida y totales. Cada entry nueva trae objetos_foto (todas las fotos de la plantilla por orden, la principal primero; las plantillas de una foto traen un arreglo de 1) y las que estan en la base traen null: el servicio las conserva con keep. Solo plantillas activas; las fotos de plantillas archivadas o revocadas no entran. Solo lectura.

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER STABLE
- **Roles:** service_role
- **Argumentos:** p_completa (true = ignorar la base y reprocesar todas las fotos)
- **Forma JSON:** {"dimension":512,"version_sugerida":"v004","base":{"id_indice":3,"version":"v003","objeto_indice":"indice/v003.json","total_vectores":498}|null,"motivo_sin_base":null|"sin_indice"|"dimension_cambiada"|"completa","totales":{"activas":500,"nuevas":2,"en_base":498,"obsoletas":0},"nada_que_hacer":false,"entries":[{"id_plantilla":12,"id_alumno":3,"faiss_id":1001,"id_indice":3,"en_base":true,"objeto_foto":"registro/3/<uuid>.jpg","objetos_foto":null},{"id_plantilla":41,"id_alumno":17,"faiss_id":1043,"id_indice":null,"en_base":false,"objeto_foto":"registro/17/a.jpg","objetos_foto":["registro/17/a.jpg","registro/17/b.jpg","registro/17/c.jpg"]}]}
- **Errores:** ninguno propio

### `svc_indice_registrar(p_version text, p_dimension integer, p_objeto_indice text, p_total_vectores integer)`

Registra una version del indice ya subida al bucket (en_uso = false). Idempotente si coinciden ruta, dimension y total.

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role
- **Argumentos:** p_version (^[A-Za-z0-9._-]{1,12}$), p_dimension (= dimension_vector), p_objeto_indice (indice/{version}.json), p_total_vectores (>= 0)
- **Forma JSON:** {"id_indice":4,"version":"v004","dimension":512,"objeto_indice":"indice/v004.json","total_vectores":500,"en_uso":false,"fecha_construccion":"...","ya_registrada":false}
- **Errores:** VALIDACION (version o total), RUTA_INVALIDA, INDICE_DIMENSION_INVALIDA, INDICE_VERSION_DUPLICADA (existe con otros datos o en uso)

### `svc_indice_revertir(p_id_indice integer, p_mapeo jsonb)`

Pone en uso una version anterior del indice (atomico, mismo bloqueo que activar). Las plantillas activas que no figuran en el mapeo quedan pendientes de indexar.

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role
- **Argumentos:** p_id_indice (version destino), p_mapeo (jsonb [{"id_plantilla","faiss_id"}] = refs del manifiesto de esa version)
- **Forma JSON:** {"id_indice":3,"version":"v003","anterior":{"id_indice":4,"version":"v004"}|null,"plantillas_asignadas":498,"plantillas_pendientes":2,"ya_activo":false}
- **Errores:** NO_ENCONTRADO (version), INDICE_NO_REVERTIBLE (dimension distinta a dimension_vector), INDICE_MAPEO_INVALIDO

### `svc_job_cerrar_sesiones(p_limit integer DEFAULT 200)`

Job RF-10/RN-07: cierra (app.cerrar_sesion, por el sistema) las sesiones abiertas cuya hora_fin ya paso. Una falla no detiene las demas; las programadas nunca abiertas no se tocan. Idempotente.

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role
- **Argumentos:** p_limit (def. 200, 1 a 1000)
- **Forma JSON:** {"ejecutado_en":"...","candidatas":3,"cerradas":2,"items":[{"id_sesion":88,"resultado":{...}}],"errores":[{"id_sesion":95,"codigo":"VALIDACION","mensaje":"..."}]}
- **Errores:** VALIDACION (p_limit), CUENTA_SERVICIO_AUSENTE

### `svc_job_purgar_recortes_listar(p_limit integer DEFAULT 500)`

Paso 1 de la purga RNF-05: rutas de recortes de capturas estrictamente mas viejas que dias_retencion_recortes (7 dias exactos aun se conservan). Solo lectura.

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER STABLE
- **Roles:** service_role
- **Argumentos:** p_limit (def. 500, max 2000)
- **Forma JSON:** {"corte":"...","dias_retencion":7,"pendientes_total":1240,"items":[{"id_deteccion":90211,"objeto_recorte":"recortes/88/1204/3.jpg"}]}
- **Errores:** ninguno

### `svc_job_purgar_recortes_marcar(p_ids bigint[])`

Paso 3 de la purga RNF-05 (despues de borrar los objetos): pone objeto_recorte = NULL en las detecciones vencidas indicadas. Conserva la fila (id_plantilla, score, es_valida). Idempotente.

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role
- **Argumentos:** p_ids (hasta 5000 id_deteccion)
- **Forma JSON:** {"solicitadas":500,"marcadas":498}
- **Errores:** VALIDACION (nulo o mas de 5000)

### `svc_job_recalcular(p_periodo text DEFAULT NULL::text)`

Job RF-13/RF-14/RN-10/RN-11: vence consentimientos (app.vencer_consentimientos) y recalcula cada grupo del periodo (app.recalcular_grupo). Un grupo con error no detiene a los demas. Idempotente.

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role
- **Argumentos:** p_periodo (AAAA-S; si es NULL, el mayor periodo con sesiones ya ocurridas)
- **Forma JSON:** {"periodo":"2026-2","grupos":18,"recalculados":18,"consentimientos_vencidos":3,"errores":[]}
- **Errores:** VALIDACION (formato de periodo), CUENTA_SERVICIO_AUSENTE

### `svc_job_reconstruir_indice()`

Diagnostico del job reconstruir-indice: si hace falta reconstruir y por que. Solo lectura.

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER STABLE
- **Roles:** service_role
- **Argumentos:** ninguno
- **Forma JSON:** {"requiere":true,"motivo":"sin_indice|dimension_cambiada|pendientes|obsoletas|ninguno","pendientes":2,"obsoletas":0,"en_uso":{"id_indice":3,"version":"v003"}|null}
- **Errores:** ninguno

### `svc_job_resolver_pendientes(p_limit integer DEFAULT 500)`

Job RF-11/RN-08: los pendientes de sesiones cerradas con mas de horas_limite_correccion (estricto) pasan a ausente (origen correccion) con la cuenta de servicio y se recalcula la inscripcion. Idempotente.

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role
- **Argumentos:** p_limit (def. 500, 1 a 5000)
- **Forma JSON:** {"ejecutado_en":"...","candidatas":5,"resueltas":5,"inscripciones_recalculadas":4,"errores":[]}
- **Errores:** VALIDACION (p_limit), CUENTA_SERVICIO_AUSENTE

### `svc_registrar_consulta_revision(p_id_usuario integer, p_entidad text, p_id_registro bigint, p_ip text DEFAULT NULL::text, p_detalle jsonb DEFAULT NULL::jsonb)`

Asienta una consulta (accion consulta) de lecturas/recortes de un caso o del documento de un justificante, a nombre del docente indicado (RF-19).

- **Retorna:** `bigint`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role
- **Argumentos:** p_id_usuario integer (docente activo); p_entidad text (asistencia|justificante); p_id_registro bigint; p_ip text opcional (IP invalida = NULL); p_detalle jsonb opcional (solo ids y contadores)
- **Forma JSON:** id_bitacora bigint
- **Errores:** VALIDACION (entidad), NO_AUTORIZADO (cuenta no es docente activo)

### `svc_registrar_detecciones(p_id_captura bigint, p_detecciones jsonb)`

Registra las detecciones de una captura y aplica el ciclo de vida de la asistencia (RN-02 a RN-05, RF-04 a RF-08).

- **Retorna:** `jsonb`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role
- **Argumentos:** p_id_captura bigint, p_detecciones jsonb = [{faiss_id:int|null, score:numeric|null, objeto_recorte:text|null}] (no mas que los rostros de la captura). Resuelve faiss_id con el indice en uso (sin resolver = sin candidato). Guarda SIEMPRE candidato y score; es_valida = score (a 3 decimales) >= umbral_similitud (0.849 no, 0.850 si) y el candidato esta inscrito, activo y con consentimiento vigente. La 1.a valida de un alumno crea pendiente (origen automatico, hora_registro = marca de la captura); lecturas en capturas distintas suben conteo_detecciones; al llegar a min_detecciones_validas pasa a presente (1.a lectura antes de limite_presente_min) o retardo (hasta tolerancia_min). No pisa registros manuales ni correcciones. Idempotente por captura.
- **Forma JSON:** {id_captura,rostros,validas,no_atribuidas,cambios:[{id_alumno,estado,lecturas_validas,hora_registro,creado,confirmado}],ya_procesada}
- **Errores:** NO_ENCONTRADO (captura), SESION_NO_ABIERTA, SESION_NO_AUTOMATICA, VALIDACION (arreglo mal formado, score fuera de 0..1, mas detecciones que rostros)

### `svc_usuario_crear(p_correo text, p_rol text, p_id_docente integer DEFAULT NULL::integer, p_id_alumno integer DEFAULT NULL::integer, p_auth_uid uuid DEFAULT NULL::uuid)`

Inserta la fila de usuario despues de crear la cuenta en Auth (sin autorregistro). Un usuario por docente o alumno, rol coherente con el vinculo, correo unico. Devuelve id_usuario.

- **Retorna:** `integer`
- **Ejecuta:** service_role · DEFINER VOLATILE
- **Roles:** service_role (Route Handler de administracion de cuentas).
- **Argumentos:** p_correo; p_rol administrador|docente|alumno|tecnico; p_id_docente (solo rol docente); p_id_alumno (solo rol alumno); p_auth_uid uuid de Auth.
- **Forma JSON:** 12 (integer: id_usuario creado)
- **Errores:** VALIDACION (correo, rol, auth_uid), ROL_VINCULO_INCOHERENTE, NO_ENCONTRADO (docente o alumno), DOCENTE_NO_ACTIVO, ALUMNO_NO_ACTIVO, CORREO_RESERVADO, DUPLICADO (correo, auth_uid, docente o alumno ya con cuenta).


## Registro de códigos de error (`app.fallar`)

Se devuelven como `RAISE EXCEPTION ... USING ERRCODE='P0001', HINT='<CODIGO>'`. Además, los triggers rechazan con `23514` y
`CONSTRAINT = rn*_…` y la bitácora con `23000` (ver docs/ARCHITECTURE.md §12).

| Código | Mensaje base | Funciones |
|---|---|---|
| `ALUMNO_INACTIVO` | El alumno no tiene estatus activo. | `api_consentimiento_registrar`, `api_plantilla_registrar` |
| `ALUMNO_NO_ACTIVO` | Solo se crea cuenta para un alumno activo. | `svc_usuario_crear` |
| `AULA_CAPACIDAD_INSUFICIENTE` | Un grupo del aula tiene %s inscritos activos; la capacidad no puede ser menor. | `api_aula_guardar` |
| `CAMARA_FUERA_DE_AULA` | La cámara IP no existe o no pertenece al aula del grupo de la sesión (RN-06). | `svc_camara_direccion`, `svc_crear_captura` |
| `CAMARA_INACTIVA` | La cámara no está activa. | `svc_crear_captura` |
| `CAMARA_IP_REQUERIDA` | Una cámara de tipo ip necesita su dirección IP. | `api_camara_guardar` |
| `CAMARA_NO_ENCONTRADA` | La cámara no existe. | `svc_crear_captura` |
| `CAMARA_POSICION_DUPLICADA` | El aula ya tiene una cámara en la posición %s. | `api_camara_guardar` |
| `CAPTURA_EN_OTRA_SESION` | Esa cámara ya registró una captura en ese instante para otra sesión. | `svc_crear_captura` |
| `CORREO_RESERVADO` | La cuenta de servicio del sistema está reservada. | `svc_usuario_crear` |
| `CUENTA_NO_VINCULADA` | Tu cuenta no está vinculada a un perfil. Contacta al administrador. | `api_yo` |
| `DOCENTE_CON_GRUPOS` | El docente tiene sesiones por impartir; reasigna sus grupos antes de darlo de baja. | `api_docente_cambiar_estatus` |
| `DOCENTE_NO_ACTIVO` | No se puede asignar un grupo a un docente que no está activo. | `api_grupo_guardar`, `svc_usuario_crear` |
| `DOCUMENTO_INVALIDO` | El documento no es válido; súbelo de nuevo. | `api_registrar_justificante` |
| `DUPLICADO` | Ya existe un alumno con la matrícula %s. | `api_alumno_guardar`, `api_aula_guardar`, `api_camara_guardar`, `api_docente_guardar`, `api_grupo_guardar`, `api_importar_inscripciones`, `api_materia_guardar`, `api_usuario_actualizar`, `svc_usuario_crear` |
| `ESTADO_NO_JUSTIFICABLE` | El registro ya no es una ausencia ni un retardo; no se puede justificar. | `api_resolver_justificante` |
| `ESTATUS_INVALIDO` | Solo se reanuda una sesión suspendida (esta está %s). | `api_reanudar_sesion`, `api_suspender_sesion` |
| `FUERA_DE_HORARIO` | La sesión solo puede abrirse de %s a %s del %s (hora del plantel). | `api_abrir_sesion` |
| `FUERA_DE_VENTANA` | La captura excede la ventana de tolerancia de %s minutos de la sesión. | `svc_crear_captura` |
| `GRUPO_CON_HISTORIAL` | El grupo ya tiene inscripciones o sesiones; no se puede cambiar su materia ni su periodo. | `api_grupo_guardar` |
| `GRUPO_SIN_HORARIO` | El grupo no tiene horario; captúralo antes de generar sesiones. | `api_generar_sesiones` |
| `HORARIO_CHOQUE` | El horario del grupo choca en el aula destino con el %s. | `api_grupo_guardar`, `api_horario_guardar` |
| `HORARIO_INVALIDO` | Bloque %s: se esperaba un objeto. | `api_horario_guardar` |
| `INDICE_DIMENSION_INVALIDA` | La dimensión del índice no coincide con dimension_vector. | `svc_indice_activar`, `svc_indice_registrar` |
| `INDICE_MAPEO_INCOMPLETO` | El mapeo no corresponde al total de vectores del índice. | `svc_indice_activar` |
| `INDICE_MAPEO_INVALIDO` | El mapeo id_plantilla/faiss_id es inválido. | `svc_indice_activar`, `svc_indice_revertir` |
| `INDICE_NO_REVERTIBLE` | La versión indicada no puede ponerse en uso. | `svc_indice_revertir` |
| `INDICE_PLAN_OBSOLETO` | El plan cambió mientras se construía el índice; reintente. | `svc_indice_activar` |
| `INDICE_VERSION_DUPLICADA` | La versión del índice ya existe. | `svc_indice_registrar` |
| `JUSTIFICANTE_DUPLICADO` | Ya existe un justificante pendiente para este registro. | `api_registrar_justificante` |
| `JUSTIFICANTE_PENDIENTE` | Hay un justificante pendiente para este registro; resuélvelo antes de marcarlo como presente. | `api_corregir_asistencia` |
| `JUSTIFICANTE_YA_RESUELTO` | Este justificante ya fue resuelto. | `api_resolver_justificante` |
| `MARCA_FUTURA` | La marca de tiempo de la captura está en el futuro. | `svc_crear_captura` |
| `NO_AUTENTICADO` | Debes iniciar sesión. | `api_yo` |
| `NO_AUTORIZADO` | No estás inscrito en este grupo. | `api_alumno_historial`, `api_corregir_asistencia`, `api_registrar_justificante`, `api_resolver_justificante`, `api_serie_alumno`, `svc_registrar_consulta_revision` |
| `NO_ENCONTRADO` | El alumno no existe. | `api_alumno_cambiar_estatus`, `api_alumno_guardar`, `api_alumno_obtener`, `api_aula_guardar`, `api_aula_obtener`, `api_baja_inscripcion`, `api_camara_cambiar_estatus`, `api_camara_guardar`, `api_camaras_listar`, `api_consentimiento_registrar`, `api_consentimiento_revocar`, `api_consentimientos_alumno`, `api_corregir_asistencia`, `api_detecciones_caso`, `api_docente_cambiar_estatus`, `api_docente_guardar`, `api_docente_obtener`, `api_documento_url_autorizar`, `api_generar_sesiones`, `api_grupo_guardar`, `api_grupo_obtener`, `api_horario_guardar`, `api_importar_inscripciones`, `api_inscritos`, `api_justificante_documento`, `api_materia_guardar`, `api_materia_obtener`, `api_plantilla_alumno`, `api_plantilla_registrar`, `api_registros_corregibles`, `api_reporte_grupo`, `api_resolver_justificante`, `api_serie_alumno`, `api_usuario_actualizar`, `svc_alumnos_candidatos`, `svc_crear_captura`, `svc_indice_activar`, `svc_indice_revertir`, `svc_registrar_detecciones`, `svc_usuario_crear` |
| `PARAMETRO_NO_ENCONTRADO` | El parámetro no existe. | `api_parametro_actualizar` |
| `PERIODO_INVALIDO` | El periodo debe tener el formato AAAA-S (S = 1 o 2). | `api_grupo_guardar`, `api_grupos_listar` |
| `REGISTRO_DUPLICADO` | El alumno %s aparece más de una vez en el pase de lista; solo hay un registro por alumno y sesión. | `api_pase_lista_manual` |
| `RN_08_PLAZO_VENCIDO` | El plazo de corrección terminó el %s (%s h después del fin de la sesión). | `api_corregir_asistencia` |
| `RN_12_INDICE_EN_USO_DUPLICADO` | Ya existe una versión del índice en uso. | `svc_indice_activar`, `svc_indice_revertir` |
| `RN_13_CONSENTIMIENTO_AJENO` | El consentimiento pertenece a otro alumno. | `api_plantilla_registrar` |
| `RN_13_CONSENTIMIENTO_NO_VIGENTE` | El consentimiento ya no está vigente (estatus: %s). | `api_consentimiento_revocar`, `api_plantilla_registrar` |
| `ROL_VINCULO_INCOHERENTE` | El rol docente requiere id_docente. | `api_usuario_actualizar`, `svc_usuario_crear` |
| `RUTA_INVALIDA` | La ruta del archivo no es válida para este registro. | `api_consentimiento_registrar`, `api_plantilla_registrar`, `svc_indice_registrar` |
| `SESION_CERRADA` | La sesión ya fue cerrada; no puede abrirse de nuevo. | `api_abrir_sesion` |
| `SESION_NO_ABIERTA` | La sesión no está abierta; no admite capturas. | `svc_crear_captura`, `svc_registrar_detecciones` |
| `SESION_NO_AUTOMATICA` | La sesión es de pase de lista manual; no admite capturas. | `svc_crear_captura`, `svc_registrar_detecciones` |
| `SESION_NO_CERRADA` | La sesión sigue abierta; ciérrala antes de corregir un registro. | `api_corregir_asistencia` |
| `SESION_SUSPENDIDA` | La sesión está suspendida; reanúdala antes de abrirla. | `api_abrir_sesion` |
| `SIN_CAMBIO` | El registro ya está en el estado indicado. | `api_corregir_asistencia` |
| `TRANSICION_NO_PERMITIDA` | Un registro no puede volver a pendiente ni pasar a justificado por corrección; el justificado no se modifica. | `api_corregir_asistencia` |
| `USUARIO_PROPIO` | No puedes desactivar tu cuenta ni quitarte el rol de administrador. | `api_usuario_actualizar` |
| `VALIDACION` | Estatus de alumno no válido. | `api_alumno_cambiar_estatus`, `api_alumno_guardar`, `api_alumnos_listar`, `api_aula_guardar`, `api_bitacora_listar`, `api_camara_cambiar_estatus`, `api_camara_guardar`, `api_cola_revision`, `api_consentimiento_registrar`, `api_corregir_asistencia`, `api_docente_cambiar_estatus`, `api_docente_guardar`, `api_docentes_listar`, `api_documento_url_autorizar`, `api_generar_sesiones`, `api_grupo_guardar`, `api_horario_guardar`, `api_impacto_tiempo`, `api_importar_inscripciones`, `api_inscritos`, `api_materia_guardar`, `api_pase_lista_manual`, `api_plantilla_registrar`, `api_registrar_justificante`, `api_reporte_periodo`, `api_resolver_justificante`, `api_serie_alumno`, `api_suspender_sesion`, `api_usuario_actualizar`, `api_usuarios_listar`, `svc_crear_captura`, `svc_indice_registrar`, `svc_job_cerrar_sesiones`, `svc_job_purgar_recortes_marcar`, `svc_job_recalcular`, `svc_job_resolver_pendientes`, `svc_registrar_consulta_revision`, `svc_registrar_detecciones`, `svc_usuario_crear` |
