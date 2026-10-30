# Migraciones de la base de datos de SUSAN

Carpeta `supabase/migrations/` del commit `f742bb4`: **43** archivos, **9946** líneas de SQL. Se aplican en orden lexicográfico; la base local las registra en `supabase_migrations.schema_migrations` (43 filas, una por archivo).
La numeración tiene huecos (por ejemplo no existe 0134 ni 0238) porque se reparte por dominio: 0001-0099 esquema, 01xx API del docente (reportes, revisión, sesiones), 02xx API de administración y biometría (ver `supabase/README.md`). Estos son todos los archivos que existen.
Las columnas de objetos cuentan sentencias `CREATE ...` por búsqueda de texto en el archivo; una `CREATE OR REPLACE FUNCTION` puede redefinir una función ya creada antes.

| Archivo | Líneas | Tablas | Func. | Disp. | Polít. | Índ. | Propósito |
|---|--:|--:|--:|--:|--:|--:|---|
| `0001_esquemas.sql` | 92 |  | 5 |  |  |  | Esquema privado app, privilegios cerrados por omisión, extensiones (pgcrypto, pg_trgm) y reloj único (app.now, app.tz, app.hoy). |
| `0002_tipos.sql` | 24 |  |  |  |  |  | Los 14 tipos ENUM: los 13 dominios de la especificación (Tabla 13) más tipo_camara. |
| `0003_tablas_academico.sql` | 101 | 7 |  |  |  |  | Área A, catálogo académico: alumno, docente, materia, aula, grupo, horario_grupo e inscripcion. |
| `0004_tablas_seguridad.sql` | 59 | 3 |  |  |  |  | Área D, seguridad y configuración: usuario, parametro_sistema y bitacora_auditoria. |
| `0005_tablas_operacion.sql` | 73 | 3 |  |  |  |  | Área B, operación de la clase: sesion_clase, asistencia y justificante. |
| `0006_tablas_biometria.sql` | 102 | 6 |  |  |  |  | Área C, captura y biometría: consentimiento, indice_faiss, plantilla_facial, camara, captura y deteccion. |
| `0007_indices.sql` | 33 |  |  |  |  | 22 | Índices únicos parciales (RN-12, RNF-09) e índices de apoyo ix_* para las llaves foráneas. |
| `0010_app_helpers.sql` | 338 |  | 21 |  |  |  | Funciones del esquema app: identidad y rol, visibilidad por grupo, errores, consentimiento, IP, cuenta de servicio y bitácora. |
| `0020_triggers.sql` | 249 |  | 7 | 6 |  |  | Los seis disparadores de la especificación: RN-01, ciclo de asistencia (RN-02/05/06/07/09), RN-06 de captura, RN-13 y bitácora de solo inserción. |
| `0030_rls_grants.sql` | 191 |  |  |  | 38 |  | Seguridad a nivel de fila (RLS) y privilegios: anon sin acceso; authenticated solo SELECT respaldado por política; service_role. |
| `0040_parametros.sql` | 101 |  | 1 |  |  |  | Los parámetros del sistema (Tabla 4), sus metadatos y validación, y la cuenta de servicio. |
| `0050_api_plataforma.sql` | 106 |  | 3 |  |  |  | RPC de plataforma: api_yo, api_ahora y api_parametros_publicos. |
| `0090_storage_policies.sql` | 34 |  |  |  |  |  | Bucket privado susan-private y política RESTRICTIVE de Storage (solo se aplica si existe storage.objects). |
| `0091_storage_limite_indice.sql` | 13 |  |  |  |  |  | Tope del bucket para el JSON del índice FAISS (50 MiB). |
| `0100_reportes_base.sql` | 143 |  | 2 |  |  |  | Vista v_resumen_asistencia y recálculo del derecho a examen (RF-13, RF-14, RN-10, RN-11). |
| `0101_ayudantes_c.sql` | 68 |  | 8 |  |  |  | Ayudantes internos c1_* (formato de fechas, paginación, JSON de alumno, grupo y sesión) para reportes y revisión. |
| `0102_reportes_rpc.sql` | 396 |  | 7 |  |  |  | RPC de reportes y portal del alumno (RF-13, RF-14, RF-17, RF-21). |
| `0103_series_alertas_rpc.sql` | 325 |  | 5 |  |  |  | Series para el análisis numérico, impacto en tiempo y alertas del docente. |
| `0120_revision_base.sql` | 280 |  | 6 |  |  | 1 | Revisión, base: índice único del justificante pendiente, plazo de corrección (RN-08) y ayudantes de corrección. |
| `0121_revision_escrituras.sql` | 345 |  | 5 |  |  |  | Revisión, escrituras: corregir asistencia, registrar y resolver justificantes, consulta auditada (RF-11, RF-12, RF-19). |
| `0122_revision_lecturas.sql` | 503 |  | 8 |  |  |  | Revisión, lecturas: cola de revisión, justificantes, detecciones de un caso y registros corregibles. |
| `0130_sesiones_helpers.sql` | 121 |  | 6 |  |  |  | Ayudantes de la sesión de clase: minuto de sesión, estado por minuto (RN-03), lecturas válidas y bloqueo de sesión. |
| `0131_api_sesion_docente.sql` | 342 |  | 3 |  |  |  | RPC del docente para la sesión en vivo: panel, apertura en horario (RN-06) y monitor. |
| `0132_api_sesion_manual.sql` | 241 |  | 3 |  |  |  | Registro manual de asistencia y pase de lista (RF-09, RF-06, RF-08, RNF-06). |
| `0133_api_sesion_cierre.sql` | 238 |  | 4 |  |  |  | Cierre de sesión (RF-10, RN-07), suspensión y reanudación. |
| `0135_svc_captura.sql` | 301 |  | 3 |  |  |  | Funciones de servicio del muestreo (solo service_role): candidatos, capturas y detecciones. |
| `0136_svc_camara_direccion.sql` | 33 |  | 1 |  |  |  | Dirección de la cámara IP para el Route Handler de captura (solo service_role). |
| `0200_admin_helpers.sql` | 122 |  | 12 |  |  |  | Ayudantes internos b1_* de la gestión académica. |
| `0201_admin_catalogos.sql` | 569 |  | 11 |  |  |  | Administración de alumnos, docentes y materias (RF-01). |
| `0202_admin_aulas_camaras.sql` | 277 |  | 5 |  |  |  | Administración de aulas y cámaras (RF-22, RN-06). |
| `0203_admin_grupos.sql` | 424 |  | 7 |  |  |  | Administración de grupos, horario semanal y generación de sesiones programadas (RF-01, RF-22, RN-06). |
| `0204_admin_inscripciones.sql` | 260 |  | 5 |  |  |  | Inscripciones (RF-02, RN-01) y carga masiva. |
| `0205_admin_usuarios_bitacora.sql` | 375 |  | 5 |  |  |  | Usuarios (RF-20), consulta de la bitácora (RNF-08) y resumen del administrador. |
| `0230_biometria_soporte.sql` | 130 | 1 | 4 |  |  |  | Soporte interno de biometría: validación de rutas de objetos, bloqueos con arrendamiento y vencimiento de consentimientos. |
| `0231_api_consentimiento_plantilla.sql` | 408 |  | 6 |  |  |  | RPC de consentimiento y plantilla facial (RF-15, RF-16, RN-12, RN-13). |
| `0232_api_indice_parametros_camaras.sql` | 312 |  | 5 |  |  |  | RPC de la consola técnica: estado del índice, parámetros del sistema y cámaras. |
| `0233_svc_indice.sql` | 426 |  | 8 |  |  |  | RPC de servicio del índice FAISS (solo service_role). |
| `0234_svc_jobs.sql` | 281 |  | 6 |  |  |  | Jobs del programador de tareas: cerrar sesiones, resolver pendientes, recalcular, purgar recortes y reconstruir el índice. |
| `0235_plantilla_fotos.sql` | 562 | 1 | 6 | 1 | 1 |  | Extensión 17: plantilla facial de varias fotos; crea la tabla plantilla_foto. |
| `0236_reloj_demo_tabla.sql` | 89 | 1 | 3 |  |  |  | Reloj de demostración en la tabla app.reloj_demo (para Supabase, donde no se puede usar ALTER DATABASE SET). |
| `0237_fotos_registro_efimeras.sql` | 300 |  | 4 |  |  |  | Extensión 18: fotos de registro efímeras (objeto_foto admite nulo cuando la foto ya no se conserva). |
| `0239_autoservicio_registro.sql` | 555 |  | 9 |  |  |  | Extensión 19: autoservicio del alumno (consentimiento y registro del propio rostro); columnas origen y version_aviso. |
| `0990_postgrest_reload.sql` | 4 |  |  |  |  |  | Recarga del esquema de PostgREST (NOTIFY pgrst). |
| **Total** | **9946** | **22** | **194** | **7** | **39** | **23** | |

Otros archivos de la carpeta `supabase/` que completan la base (no son migraciones): `local/00_supabase_stubs.sql` (emula roles, `auth` y `storage` solo en PostgreSQL local), `seed/` (semilla de demostración: catálogo, sesiones, historial, cuentas locales y recálculo) y `tests/` (pruebas SQL).
