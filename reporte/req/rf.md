# Estado de los 22 requerimientos funcionales (RF) de SUSAN

Verificado sobre `origin/main` (commit `f742bb4`), contra `docs/spec/Avance1.txt` (Tabla 3 y Tabla 6). Criterio: **Implementado** = el comportamiento del RF existe en código, se alcanza desde la interfaz o la API y hay pruebas automáticas que cubren su criterio de verificación; **Parcial** = falta una parte del texto del RF o no se puede comprobar su criterio; **Pendiente** = nada o solo esquema. Ante la duda se eligió el estado más bajo. Las partes son SW (aplicación web y servicios), BD (lógica en PostgreSQL) e IA (servicio de reconocimiento); la estación Arduino no se evalúa aquí.

**Resultado: 16 Implementado, 6 Parcial, 0 Pendiente (de 22).**

| RF | Prior. | Módulo | Parte | Estado | Requerimiento (resumen) | Evidencia |
|---|---|---|---|---|---|---|
| RF-01 | MUST | M1 | SW + BD | **Parcial** | Alta, consulta, modificación y baja lógica de alumnos, docentes, materias y grupos por periodo sin duplicar matrícula, empleado ni correo | api_alumno/docente/materia/grupo_guardar y *_cambiar_estatus (0201, 0203); UNIQUE en 0003; AlumnoForm, DocenteForm, GrupoForm; api_b1_01 y _03 (matrícula duplicada). |
| RF-02 | MUST | M1 | SW + BD | **Implementado** | Inscribir alumnos en un grupo y darlos de baja (N:M) sin duplicados; solo las inscripciones activas entran a la búsqueda y al cierre | api_inscribir, api_baja_inscripcion, api_inscritos (0204); uq_inscripcion_alumno_grupo; InscribirAlumno, InscripcionesTabla; api_b1_04 (segunda inscripción rechazada). |
| RF-03 | MUST | M3 | SW + IA + BD | **Parcial** | En sesión automática pedir una captura a cada cámara activa cada 15 s hasta el fin de la tolerancia y registrar cámara, hora y rostros | useMuestreoSesion (navegador) -> POST /api/sesiones/[id]/captura -> /v1/recognize -> svc_crear_captura (0135); useMuestreoSesion.test (19), captura.test (22), api_a_sesiones_05. |
| RF-04 | MUST | M3 | IA + SW + BD | **Implementado** | Por cada rostro generar un vector de 512-d y buscar su vecino solo entre plantillas de inscritos con consentimiento; descartar el vector | svc_alumnos_candidatos (0135) -> /v1/recognize (allowed_faiss_ids) -> svc_registrar_detecciones; test_api (no incluido nunca es candidato, sin vector en la respuesta); api_a_sesiones_03. |
| RF-05 | MUST | M3 | BD + IA | **Implementado** | Marcar válida y atribuir la detección solo si el score alcanza el umbral_similitud vigente (0.850); bajo el umbral queda solo de evidencia | svc_registrar_detecciones compara con app.param_num(umbral_similitud); api_a_sesiones_03 y _05 y review_sql_03: 0.849 no válida y no cuenta, 0.850 válida. |
| RF-06 | MUST | M4 | BD + SW | **Implementado** | Un registro de asistencia por alumno y sesión: la primera detección válida lo crea pendiente, las demás suman conteo; en manual, el docente | uq_asistencia_sesion_alumno (0005); svc_registrar_detecciones y app.registrar_asistencia_manual (0132); api_a_sesiones_03 (varias lecturas, un registro) y _02. |
| RF-07 | MUST | M4 | BD | **Implementado** | Confirmar presente o retardo con 3 detecciones válidas en capturas distintas; con 1 o 2 queda pendiente y va a la cola de revisión | app.lecturas_validas (capturas distintas, 0130); confirmación en svc_registrar_detecciones y app.cerrar_sesion; api_a_sesiones_03/_05 (2 lecturas pendiente, 3 presente), review_sql_03. |
| RF-08 | MUST | M4 | BD + SW | **Implementado** | Asignar presente en [0,10) min y retardo en [10,20] min según la primera detección válida; el pase manual sugiere con los mismos límites | app.estado_por_minuto y minuto_de_sesion (0130), estado_sugerido; api_a_sesiones_05 y review_sql_03: 9:59 presente, 10:00 y 20:00 retardo, 20:01 rechazada. |
| RF-09 | MUST | M4 | SW + BD | **Implementado** | Abrir sesión solo en horario y aula del grupo; sin cámaras activas abre en manual; en automática el docente registra a quien no consintió | api_abrir_sesion (0131: FUERA_DE_HORARIO, modo según cámaras activas), app.registrar_asistencia_manual (0132); AbrirSesion, PaseListaManual, RegistroManualDialog; api_a_sesiones_01/_02. |
| RF-10 | MUST | M4 | BD + SW | **Parcial** | Al cerrar la sesión (a su hora de fin o antes por el docente) crear ausentes, dejar pendientes a quien tiene 1-2 lecturas y asentar bitácora | app.cerrar_sesion (0133), api_cerrar_sesion, svc_job_cerrar_sesiones (0234), /api/jobs/cerrar-sesiones; CierreSesionDialog; api_a_sesiones_03/_04, api_b2_05, jobs.test.js (24). |
| RF-11 | MUST | M5 | BD + SW | **Parcial** | El docente corrige un registro (incluido un pendiente) hasta 48 h tras el fin, con bitácora; al vencer, los pendientes pasan a ausente | api_corregir_asistencia (0121, RN_08_PLAZO_VENCIDO), app.resolver_pendientes_vencidos (0120), svc_job_resolver_pendientes; CasoPendiente; api_c_10 (47 h sí, 49 h no), api_c_12. |
| RF-12 | SHOULD | M5 | SW + BD | **Parcial** | Alumno o docente registra un justificante (motivo y documento privado); el docente lo aprueba o rechaza; queda justificado sin borrar nada | api_registrar_justificante, api_resolver_justificante (0121); /api/justificantes/documento; RegistrarJustificanteForm, JustificanteCard; api_c_11 (RES-01 conserva registro y detecciones). |
| RF-13 | SHOULD | M6 | BD + SW | **Implementado** | Calcular por alumno y grupo las faltas equivalentes = ausencias + ⌊retardos ÷ 3⌋, sin alterar los registros y sin contar los justificados | v_resumen_asistencia (0100, faltas_equivalentes); api_reporte_grupo, api_alumno_resumen; api_c_00 («2 ausencias + 7 retardos = 4» y la justificada no cuenta). |
| RF-14 | SHOULD | M6 | BD | **Implementado** | Tras cada cierre, corrección o justificante recalcular el % de faltas; sobre 20 % quitar derecho a examen y notificar; restituirlo si baja | app.recalcular_inscripcion y recalcular_grupo (0100) llamadas desde cerrar_sesion, api_corregir_asistencia, api_resolver_justificante; api_c_00: 9/48 = 18.75 % conserva, 10/48 = 20.83 % pierde. |
| RF-15 | MUST | M2 | SW + BD + IA | **Implementado** | Registrar plantilla facial solo con consentimiento firmado y vigente; foto con un solo rostro vectorizable, guardada en bucket privado | POST /api/alumnos/[id]/plantilla, app.plantilla_registrar (0239, RN_13_CONSENTIMIENTO_NO_VIGENTE), /v1/photo/check-set; api_b2_01/_02, biometria.test.js (50), test_api.py. |
| RF-16 | MUST | M2 | IA + BD + SW | **Implementado** | Al registrar plantilla nueva: archivar la anterior, construir otra versión del índice con faiss_id y activarla de forma atómica | app.plantilla_registrar (archiva); svc_indice_plan/registrar/activar (0233); servicio /v1/index/build y /activate; ux_plantilla_facial_activa, ux_indice_faiss_en_uso; api_b2_04/_06; pytest atómico. |
| RF-17 | MUST | M7 | SW + BD | **Implementado** | Reportes por alumno, grupo y periodo: presentes, retardos, ausencias, justificadas, faltas equiv., % y derecho a examen; pantalla y CSV | api_reporte_filtros/grupo/periodo (0102); ReporteAsistencia, FiltrosReporte, BotonesExportar, reporteCsv.utils; api_c_20 (totales = conteo directo), ReporteAsistencia.test. |
| RF-18 | MUST | M5 | SW + BD | **Implementado** | Cola del docente con pendientes y justificantes de sus grupos, con lecturas, score, recortes por URL firmada y plazo; se resuelve desde ahí | api_cola_revision, api_detecciones_caso (0122); /api/casos/[id]/detecciones (bitácora antes de firmar); ColaRevision, LecturasCaso, RecorteFirmado; revision.test.js, api_c_13, review_sql_01. |
| RF-19 | MUST | M8 | BD + SW | **Parcial** | Limitar al docente a sus grupos y asentar en bitácora cada consulta a datos biométricos o de asistencia con usuario, registro, fecha e IP | RLS en las 20 tablas + app.puede_ver_grupo; review_sql_01 (IDOR en las RPC); svc_registrar_consulta_revision y api_documento_url_autorizar asientan «consulta»; revision.test.js. |
| RF-20 | MUST | M8 | SW + BD | **Implementado** | Autenticar con correo institucional vía Supabase Auth sin contraseñas en el esquema, autorizar por rol; cuentas creadas por el administrador | LoginForm, lib/api/auth.js, proxy.js, app.exigir_rol (CUENTA_INACTIVA); POST /api/admin/usuarios; tabla usuario sin contraseña; auth.test (11), route.test (32), realmode.test (14), api_b1_05. |
| RF-21 | SHOULD | M7 | SW + BD | **Implementado** | El alumno ve en el portal su historial por materia (estado por sesión, acumulados, % de faltas vs. el 20 %), solo lo propio y sin imágenes | api_alumno_resumen, api_alumno_historial (0102); PortalAlumno, HistorialMateria, BarraFaltas; api_c_20 (sin rutas objeto_*, grupo ajeno NO_AUTORIZADO), PortalAlumno.test. |
| RF-22 | MUST | M1 | SW + BD | **Implementado** | Administrar aulas, cámaras (frente o fondo, IP, estatus) y horario semanal del grupo; una cámara por posición y fin posterior al inicio | api_aula_guardar, api_camara_guardar (0202), api_horario_guardar, api_generar_sesiones (0203); uq_camara_aula_posicion; AulaForm, CamaraForm, HorarioEditor; api_b1_02/_03. |

Claves de módulo: M1 = Gestión académica; M2 = Registro biométrico; M3 = Captura y reconocimiento; M4 = Registro de asistencia; M5 = Revisión y justificantes; M6 = Acumulados y alertas; M7 = Reportes y consultas; M8 = Usuarios y seguridad.

## Trazabilidad (Tabla 6 de la especificación)

| RF | RN de origen | BPMN | Pantallas | Tablas principales |
|---|---|---|---|---|
| RF-01 | — (alcance) | BPMN-03 | P-06, P-09 | ALUMNO, DOCENTE, MATERIA, GRUPO |
| RF-02 | RN-01 | — | P-09 | INSCRIPCION, ALUMNO, GRUPO |
| RF-03 | — (alcance) | BPMN-01 | P-02, P-03 | SESION_CLASE, CAMARA, CAPTURA |
| RF-04 | — (alcance) | BPMN-01 | P-03 | CAPTURA, DETECCION, INDICE_FAISS, PLANTILLA_FACIAL, INSCRIPCION, CONSENTIMIENTO |
| RF-05 | RN-04 | BPMN-01 | P-03 | DETECCION, PLANTILLA_FACIAL, PARAMETRO_SISTEMA |
| RF-06 | RN-02 | BPMN-01 | P-03, P-04 | ASISTENCIA, DETECCION |
| RF-07 | RN-05 | BPMN-01 | P-03, P-05 | ASISTENCIA, DETECCION, PARAMETRO_SISTEMA |
| RF-08 | RN-03 | BPMN-01 | P-03, P-04 | ASISTENCIA, SESION_CLASE |
| RF-09 | RN-06 | BPMN-01 | P-02, P-03, P-04 | SESION_CLASE, HORARIO_GRUPO, CAMARA, ASISTENCIA |
| RF-10 | RN-07 | BPMN-01 | P-03, P-04 | SESION_CLASE, INSCRIPCION, ASISTENCIA, BITACORA_AUDITORIA |
| RF-11 | RN-08 | BPMN-02 | P-05 | ASISTENCIA, SESION_CLASE, BITACORA_AUDITORIA |
| RF-12 | RN-09 | BPMN-02 | P-05, P-08 | JUSTIFICANTE, ASISTENCIA, USUARIO, BITACORA_AUDITORIA |
| RF-13 | RN-10 | BPMN-01 | P-07 | ASISTENCIA, INSCRIPCION; vista v_resumen_asistencia |
| RF-14 | RN-11 | BPMN-01 | P-02, P-07 | INSCRIPCION, SESION_CLASE, HORARIO_GRUPO, BITACORA_AUDITORIA; vista v_resumen_asistencia |
| RF-15 | RN-13 | BPMN-03 | P-06 | CONSENTIMIENTO, PLANTILLA_FACIAL |
| RF-16 | RN-12 | BPMN-03 | P-06 | PLANTILLA_FACIAL, INDICE_FAISS |
| RF-17 | — (alcance) | — | P-07 | ASISTENCIA, GRUPO; vista v_resumen_asistencia |
| RF-18 | — (alcance) | BPMN-02 | P-02, P-05 | ASISTENCIA, JUSTIFICANTE, DETECCION |
| RF-19 | — (privacidad) | Transversal | P-01, P-02, P-05 | USUARIO, GRUPO, BITACORA_AUDITORIA |
| RF-20 | — (privacidad) | Transversal | P-01 | USUARIO |
| RF-21 | — (problema 02) | — | P-08 | ASISTENCIA, INSCRIPCION; vista v_resumen_asistencia |
| RF-22 | RN-06 | — | P-09 | AULA, CAMARA, HORARIO_GRUPO, GRUPO, SESION_CLASE |

## Detalle de los requerimientos que no están Implementados

### RF-01 — Parcial (SW + BD)

**Texto:** Alta, consulta, modificación y baja lógica de alumnos, docentes, materias y grupos por periodo sin duplicar matrícula, empleado ni correo

**Qué hay:** api_alumno/docente/materia/grupo_guardar y *_cambiar_estatus (0201, 0203); UNIQUE en 0003; AlumnoForm, DocenteForm, GrupoForm; api_b1_01 y _03 (matrícula duplicada).

**Qué falta:** Falta la baja de materias y de grupos: no existe RPC, botón ni DELETE para ellos (solo hay modificar y, en el grupo, dar de baja a sus inscritos). Alta, consulta, modificación y baja lógica de alumnos y docentes, y el rechazo de duplicados (matrícula, empleado, correo, clave por materia y periodo), sí están completos y probados. Es una carencia menor.

**Nota:** La baja de un docente se rechaza si aún tiene sesiones por impartir (DOCENTE_CON_GRUPOS). Las altas y bajas de catálogo no dejan bitácora (DECISIONS §3.5); RF-01 no lo exige.

### RF-03 — Parcial (SW + IA + BD)

**Texto:** En sesión automática pedir una captura a cada cámara activa cada 15 s hasta el fin de la tolerancia y registrar cámara, hora y rostros

**Qué hay:** useMuestreoSesion (navegador) -> POST /api/sesiones/[id]/captura -> /v1/recognize -> svc_crear_captura (0135); useMuestreoSesion.test (19), captura.test (22), api_a_sesiones_05.

**Qué falta:** El muestreo lo dispara el navegador del docente (no hay temporizador en el servidor): si cierra la pestaña se detiene. Cada ciclo espera el intervalo DESPUÉS de terminar el envío, así que el periodo real es mayor que 15 s: con ~0.5 s de latencia salen ~78 capturas en 20 min, no 80 ± 1 (cálculo a partir del código, no medición). El criterio «80 ± 1 capturas por cámara» no tiene prueba ni medición: la BD de demostración solo trae 13 capturas de semilla. Además, la ruta de cámara IP nunca se probó con una cámara real (DEMO.md §7); solo con pruebas automáticas.

**Nota:** Registro de cámara, marca de tiempo y número de rostros: implementado y probado (idempotente por cámara y marca; rechaza fuera de la ventana de tolerancia). Las cámaras IP se atienden en serie dentro del mismo ciclo.

### RF-10 — Parcial (BD + SW)

**Texto:** Al cerrar la sesión (a su hora de fin o antes por el docente) crear ausentes, dejar pendientes a quien tiene 1-2 lecturas y asentar bitácora

**Qué hay:** app.cerrar_sesion (0133), api_cerrar_sesion, svc_job_cerrar_sesiones (0234), /api/jobs/cerrar-sesiones; CierreSesionDialog; api_a_sesiones_03/_04, api_b2_05, jobs.test.js (24).

**Qué falta:** La ejecución periódica del cierre no está configurada: el repositorio no trae vercel.json, flujo de GitHub Actions ni pg_cron, y RUNBOOK §4 solo la sugiere. Sin ella la sesión no se cierra sola a su hora de fin. El cierre por el docente y el job (idéntico efecto) sí están implementados y probados.

**Nota:** Pasa a Implementado en cuanto se programe /api/jobs/cerrar-sesiones (p. ej. cada 5 min); no hay que escribir lógica nueva.

### RF-11 — Parcial (BD + SW)

**Texto:** El docente corrige un registro (incluido un pendiente) hasta 48 h tras el fin, con bitácora; al vencer, los pendientes pasan a ausente

**Qué hay:** api_corregir_asistencia (0121, RN_08_PLAZO_VENCIDO), app.resolver_pendientes_vencidos (0120), svc_job_resolver_pendientes; CasoPendiente; api_c_10 (47 h sí, 49 h no), api_c_12.

**Qué falta:** La resolución automática de pendientes vencidos depende de /api/jobs/resolver-pendientes y nada la programa en el repositorio (mismo faltante que RF-10). La corrección manual dentro de las 48 h, con origen «corrección» y bitácora del valor anterior y nuevo, está completa y probada.

**Nota:** Solo se puede corregir en sesiones cerradas (SESION_NO_CERRADA). Pasa a Implementado al programar el job.

### RF-12 — Parcial (SW + BD)

**Texto:** Alumno o docente registra un justificante (motivo y documento privado); el docente lo aprueba o rechaza; queda justificado sin borrar nada

**Qué hay:** api_registrar_justificante, api_resolver_justificante (0121); /api/justificantes/documento; RegistrarJustificanteForm, JustificanteCard; api_c_11 (RES-01 conserva registro y detecciones).

**Qué falta:** El docente no tiene pantalla para registrar un justificante en nombre del alumno: la RPC (p_id_alumno), la ruta de subida y el cliente http lo admiten y están probados, pero ningún componente los invoca (solo el portal del alumno). El flujo alumno registra y docente aprueba o rechaza funciona de punta a punta.

### RF-19 — Parcial (BD + SW)

**Texto:** Limitar al docente a sus grupos y asentar en bitácora cada consulta a datos biométricos o de asistencia con usuario, registro, fecha e IP

**Qué hay:** RLS en las 20 tablas + app.puede_ver_grupo; review_sql_01 (IDOR en las RPC); svc_registrar_consulta_revision y api_documento_url_autorizar asientan «consulta»; revision.test.js.

**Qué falta:** Solo se asientan las consultas de recortes, de documentos de justificantes y de fotos y consentimientos. Las lecturas de asistencia (reportes, historial, monitor) no dejan asiento «consulta»: es una decisión de diseño documentada en 0102 (son RPC de solo lectura). La IP se toma de x-forwarded-for y solo es confiable si el proxy la reescribe (DECISIONS §4).

**Nota:** Los dos criterios de verificación del RF (grupo ajeno rechazado; abrir un recorte deja asiento en bitácora) sí están cubiertos por pruebas.

## Notas de los requerimientos Implementados

Observaciones que no cambian el estado pero que conviene conocer al redactar el reporte.

- **RF-02.** Extensión: la reinscripción tras una baja reactiva la misma fila; importación masiva por CSV (api_importar_inscripciones).
- **RF-04.** Las pruebas pytest usan el embedder determinista «fake»; las 6 con InsightFace real (-m ml) no se ejecutaron aquí. El equipo reporta pruebas con rostros reales de la librería (DEMO.md §7, DECISIONS §6.3), pero no con una webcam física del plantel ni con 20 000 plantillas; no lo verifiqué.
- **RF-05.** El score es (coseno+1)/2 (DECISIONS #4). La semilla trae 0.850; en la demostración local se calibró a 0.700 (DEMO.md §9, RUNBOOK §5).
- **RF-08.** Pasada la tolerancia el pase manual sugiere «ausente» (DECISIONS #11).
- **RF-09.** En sesión automática el registro manual se rechaza si el alumno tiene consentimiento y lecturas válidas (ALUMNO_CON_LECTURAS).
- **RF-14.** La «notificación» es un asiento de bitácora (accion = notificacion, solo cuando el derecho cambia) más alertas en el panel del docente (api_alertas_docente); no hay correo ni push (módulo Notificaciones marcado «pronto»).
- **RF-15.** Extensiones: plantilla de 3 a 8 fotos promediadas y autoservicio del alumno (DECISIONS §6 y §9). El texto del aviso de privacidad es borrador y falta la revisión jurídica (DECISIONS §3.3). No se ejecutaron las pruebas pytest con modelo real.
- **RF-16.** El índice vive en memoria de un solo proceso: con varias instancias hay que activar la versión en cada una (DECISIONS §3.7). Tras purgar las fotos de registro ya no hay reconstrucción COMPLETA, solo incremental (DECISIONS §8).
- **RF-17.** El CSV se arma en el navegador con los datos cargados (recorre todas las páginas) y neutraliza fórmulas. Además se puede imprimir o guardar como PDF.
- **RF-18.** Las URL firmadas (300 s como máximo) no se probaron contra Supabase Storage real (ver salvedad 1).
- **RF-20.** Salvedad: probado con el adaptador local y un GoTrue simulado (scripts/fake-supabase.mjs); la introducción del RUNBOOK dice que no se ha ejecutado contra un proyecto Supabase real. Una cuenta inactiva es rechazada en el login y la sesión se cierra.
- **RF-22.** Extensión: cámara tipo «navegador» (webcam del docente) además de la IP (DECISIONS #2). Las sesiones se generan cuando el administrador lo pide, rango de hasta 366 días.

## Salvedades que afectan a varios requerimientos

1. **Supabase real no probado.** `docs/RUNBOOK.md` (líneas 3-4) indica que el camino contra un proyecto Supabase vivo nunca se ejecutó. Las migraciones y las RPC corren en PostgreSQL 16 real; Auth, Storage y las URL firmadas se probaron con el adaptador local y con un servidor simulado (`scripts/fake-supabase.mjs`, 14 pruebas en `realmode.test.js`). Toca a RF-12, RF-15, RF-16, RF-18, RF-19 y RF-20; no se rebajó su estado porque es el mismo código con otro transporte, pero no debe presentarse como «probado en Supabase».
2. **Programador de tareas sin configurar.** Los seis jobs existen como `/api/jobs/*` con secreto Bearer y están probados, pero nada los dispara (sin `vercel.json`, sin flujo de GitHub Actions, sin `pg_cron`). Por eso RF-10 y RF-11 quedan Parcial. También depende de él la purga de recortes (RNF-05), que no es un RF.
3. **Reconocimiento con modelo real.** Las pruebas de `recognition-service` usan el embedder determinista; las 6 pruebas con InsightFace (`pytest -m ml`) requieren descargar modelos y no se ejecutaron. Las cifras de calibración con rostros reales (DECISIONS §6.3) son del equipo y no las verifiqué.
4. **Aviso de privacidad y consentimiento** (RF-15): el texto es un borrador técnico que debe revisar el área jurídica de la UNACH (DECISIONS §3.3 y §9).
5. **Desviaciones documentadas respecto de la especificación** (DECISIONS §1): 20 tablas en lugar de 19 (`plantilla_foto`), 10 acciones de bitácora en lugar de 8, cámara tipo «navegador», estatus de sesión «suspendida», score normalizado, plantilla de 3 a 8 fotos y autoservicio del alumno.
