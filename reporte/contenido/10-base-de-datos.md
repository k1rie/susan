## ESTRUCTURA DE LA BASE DE DATOS.

La base de datos de SUSAN es el núcleo del sistema: ahí se consolida el registro de asistencia y ahí se aplican las reglas de negocio. Se implementó en PostgreSQL 16 y, para este reporte, sus cifras se obtuvieron consultando el catálogo de la base viva (`pg_class`, `pg_constraint`, `pg_proc`, `pg_policies`, entre otros) y las migraciones del commit `f742bb4`, y no se tomaron de la documentación. El modelo actual tiene **20 tablas** y una vista (`v_resumen_asistencia`) en el esquema `public`, con 135 columnas, 20 llaves primarias, **26 llaves foráneas**, 21 restricciones `UNIQUE`, 35 restricciones `CHECK`, 14 tipos enumerados y 64 índices. La lógica vive en **98 funciones** de `public` (76 `api_*`, que llama la interfaz, y 22 `svc_*`, reservadas al servicio de reconocimiento y a los trabajos programados), 87 funciones internas del esquema `app` y 7 disparadores. Las 20 tablas tienen seguridad a nivel de fila (RLS) con **39 políticas**, todas de lectura. El esquema se construye con **43 migraciones** (43 de 43 aplicadas en la base verificada) y se prueba con **37 archivos de pruebas SQL** que suman 2 461 casos (1 508 positivos y 953 negativos).

La decisión de diseño central es que **la lógica de negocio reside en PostgreSQL** (funciones RPC, disparadores y restricciones) y no en la interfaz: esta solo presenta datos y captura decisiones, y no consulta tablas directamente. Las funciones de escritura son `SECURITY DEFINER` y comprueban el rol y la pertenencia al inicio; las lecturas son en su mayoría `SECURITY INVOKER`, de modo que la RLS decide qué filas ve cada usuario. Los roles `anon` y `authenticated` no tienen privilegios de escritura sobre las tablas (0 concesiones de `anon` y 0 de `authenticated` distintas de `SELECT`), y por el requisito RNF-03 ninguna de las 135 columnas es binaria ni de arreglo: la biometría se limita a identificadores del índice y a rutas de objetos.

### 1. Modelo entidad-relación.

La figura 1 presenta el modelo completo, con las 20 tablas coloreadas por módulo; en ella cada caja muestra solo las llaves y las demás columnas se resumen. Las figuras siguientes detallan cada módulo con todas las columnas y sus tipos.

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/bd/er-general.png" titulo="Modelo entidad-relación — vista general." nota="Nota. Elaboración propia, generado a partir del catálogo de la base de datos. Azul: catálogo académico; verde: operación de la clase; café: captura y biometría; morado: seguridad y configuración. Las líneas discontinuas unen tablas de módulos distintos." ancho=16

Para leer los diagramas, la línea con pata de gallo indica el lado «muchos» de una relación 1:N, un círculo indica que el lado es opcional, y `PK`, `FK` y `UQ` marcan llaves primarias, foráneas y restricciones únicas. Un signo de interrogación junto al nombre de una columna indica que admite nulo. Las cajas grises de borde discontinuo son tablas de otro módulo que se repiten solo con su llave para mostrar la conexión.

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/bd/er-a-academico.png" titulo="Modelo entidad-relación — módulo catálogo académico." nota="Nota. Elaboración propia. `grupo` une materia, docente y aula; `inscripcion` une alumno y grupo." ancho=16

El módulo académico responde quién enseña qué, dónde y cuándo. El `grupo` es la pieza central: referencia a una materia, un docente y un aula, y de él cuelgan sus bloques de `horario_grupo` y las `inscripcion` de los alumnos.

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/bd/er-b-operacion.png" titulo="Modelo entidad-relación — módulo operación de la clase." nota="Nota. Elaboración propia. `justificante` se une a `asistencia` mediante la llave compuesta (id_sesion, id_alumno)." ancho=16

La tabla `asistencia` es el eje del modelo: guarda una fila por alumno y sesión, nace de una `sesion_clase` y puede tener justificantes. Como el justificante referencia la asistencia con llave compuesta, solo se justifica un registro que existe.

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/bd/er-c-biometria.png" titulo="Modelo entidad-relación — módulo captura y biometría." nota="Nota. Elaboración propia. Ninguna tabla almacena vectores ni imágenes; solo rutas de objetos (`objeto_*`) e identificadores del índice." ancho=16

El módulo biométrico enlaza el consentimiento del alumno con su plantilla facial y sus fotos, la versión del índice FAISS en uso, y la cadena cámara, captura y detección que alimenta la asistencia automática. La plantilla exige un consentimiento propio (`id_consent`), lo que sostiene la regla RN-13.

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/bd/er-d-seguridad.png" titulo="Modelo entidad-relación — módulo seguridad y configuración." nota="Nota. Elaboración propia. `usuario` se vincula a Supabase Auth mediante `auth_uid`; la contraseña nunca se guarda en esta base." ancho=14

El módulo de seguridad concentra las cuentas (`usuario`, ligada a un docente o a un alumno según su rol), los parámetros calibrables del sistema y la bitácora de auditoría, que registra quién hizo qué y con qué valor anterior y nuevo.

:::salto

### 2. Tablas.

Las tablas se agrupan por módulo. Se listan los campos principales y las llaves y restricciones con sus nombres reales del catálogo; el diccionario completo (tipos, nulos, valores por omisión, índices y políticas) está en el archivo de anexos.

**Catálogo académico.** Siete tablas con los datos maestros de personas, materias, aulas y grupos.

<!-- anchos: 16,44,40 -->
| Tabla | Campos principales | Llaves y restricciones |
|---|---|---|
| `alumno` | matrícula, nombres, apellidos, correo, estatus | PK id_alumno; UQ matrícula y correo |
| `docente` | núm. de empleado, nombres, apellidos, correo, estatus | PK id_docente; UQ núm. de empleado y correo |
| `materia` | clave, nombre, créditos, horas por semana | PK id_materia; UQ clave; CHECK créditos > 0 |
| `aula` | clave, edificio, capacidad | PK id_aula; UQ clave; CHECK capacidad > 0 |
| `grupo` | clave de grupo, periodo, materia, docente, aula | PK id_grupo; 3 FK; UQ (materia, grupo, periodo) |
| `horario_grupo` | día de la semana, hora de inicio y fin | PK id_horario; FK a grupo (CASCADE); CHECK de día y horas |
| `inscripcion` | alumno, grupo, fecha de alta, estatus, derecho a examen | PK id_inscripcion; 2 FK; UQ (alumno, grupo) |

Nota. Elaboración propia a partir del diccionario de datos generado del catálogo. FK: llave foránea; UQ: restricción única; todas las FK son `ON DELETE RESTRICT` salvo la indicada.

**Operación de la clase.** Tres tablas que registran lo que ocurre en cada sesión.

<!-- anchos: 16,44,40 -->
| Tabla | Campos principales | Llaves y restricciones |
|---|---|---|
| `sesion_clase` | grupo, fecha, horas, tolerancia, límite de presente, modo, estatus | PK id_sesion; FK grupo; UQ (grupo, fecha, hora); 3 CHECK |
| `asistencia` | sesión, alumno, estado, hora de registro, origen, conteo de lecturas | PK id_asistencia; 2 FK; UQ (sesión, alumno); 4 CHECK |
| `justificante` | motivo, documento, estatus, registró, resolvió, fechas | PK id_justificante; FK compuesta a asistencia; 2 FK a usuario; 2 CHECK |

Nota. Elaboración propia. La vista `v_resumen_asistencia` calcula faltas equivalentes y porcentaje en cada consulta; no es una tabla.

**Captura y biometría.** Siete tablas; solo guardan rutas y valores numéricos, nunca imágenes ni vectores.

<!-- anchos: 16,44,40 -->
| Tabla | Campos principales | Llaves y restricciones |
|---|---|---|
| `consentimiento` | alumno, fecha de firma, vigencia, documento, estatus, origen | PK id_consent; FK alumno; 2 CHECK (origen, vigencia) |
| `indice_faiss` | versión, dimensión, objeto del índice, total de vectores, en uso | PK id_indice; UQ versión; índice único parcial de una sola versión en uso |
| `plantilla_facial` | alumno, consentimiento, índice, `faiss_id`, activa, origen | PK id_plantilla; 3 FK; UQ (índice, faiss_id); 3 CHECK |
| `plantilla_foto` | plantilla, orden, ruta de la foto, calidad, coseno | PK id_foto; FK plantilla; UQ (plantilla, orden); 3 CHECK |
| `camara` | aula, posición, tipo, dirección IP, estatus | PK id_camara; FK aula; UQ (aula, posición) y UQ de IP; CHECK de IP |
| `captura` | cámara, sesión, marca de tiempo, rostros detectados | PK id_captura; 2 FK; UQ (cámara, marca); CHECK de rostros |
| `deteccion` | captura, plantilla, score de similitud, es válida, recorte | PK id_deteccion; 2 FK; CHECK de score y de candidato |

Nota. Elaboración propia. `plantilla_foto` es la única tabla que no figuraba en la especificación del Avance 1.

**Seguridad y configuración.** Tres tablas de cuentas, parámetros y auditoría.

<!-- anchos: 16,44,40 -->
| Tabla | Campos principales | Llaves y restricciones |
|---|---|---|
| `usuario` | `auth_uid`, correo, rol, docente o alumno asociado, activo | PK id_usuario; UQ de auth_uid, correo, docente y alumno; 2 CHECK |
| `bitacora_auditoria` | usuario, acción, entidad, registro, valor anterior y nuevo, fecha, IP | PK id_bitacora; FK usuario; CHECK de entidad y de valores |
| `parametro_sistema` | clave, valor, descripción, actualizado por, fecha | PK clave; FK usuario; 12 parámetros calibrables |
| Internas del esquema `app` | `bloqueo` y `reloj_demo` (2 tablas) | No se exponen por la API; apoyan arrendamientos y el reloj de demostración |

Nota. Elaboración propia. Con estas tablas y las anteriores se completan las 20 tablas de `public`; las dos de `app` son internas.

### 3. Reglas de negocio en la base de datos.

Las reglas de la especificación se aplican en la base, de modo que ningún cliente puede saltárselas. Cada nombre de la tabla se comprobó contra el catálogo de la base viva. Los rechazos de los disparadores empiezan con el nombre de la regla y devuelven el código `23514`, igual que una restricción `CHECK`.

<!-- anchos: 12,40,48 -->
| Regla | Mecanismo | Nombre real |
|---|---|---|
| RN-01 Solo con inscripción activa | Disparador | `trg_asistencia_rn01`; error `rn01_asistencia_inscripcion_activa` |
| RN-02 Un registro por alumno y sesión | Restricción única | `uq_asistencia_sesion_alumno` |
| RN-03 Presente o retardo según el minuto | Función y CHECK | `app.estado_por_minuto`; `ck_sesion_ventana` |
| RN-07 Cierre: inscritos sin registro quedan ausentes | Funciones | `app.cerrar_sesion`; `public.api_cerrar_sesion` |
| RN-08 Corrección dentro de 48 h con bitácora | Función y parámetro | `app.limite_correccion`; `horas_limite_correccion` |
| RN-12 Una plantilla activa por alumno | Índices únicos parciales | `ux_plantilla_facial_activa`; `ux_indice_faiss_en_uso` |
| RN-13 Sin plantilla sin consentimiento vigente | Disparador | `trg_plantilla_rn13`; error `rn13_plantilla_consentimiento_vencido` |
| RNF-08 Bitácora de solo inserción | Disparadores y política RLS | `trg_bitacora_sin_cambios`; `trg_bitacora_sin_truncate` |

Nota. Elaboración propia a partir del catálogo de la base. Los umbrales (por ejemplo `limite_presente_min` o `tolerancia_min`) viven en `parametro_sistema` y no en el código; la sesión los copia al programarse, por lo que un ajuste posterior no altera las sesiones ya registradas.

### 4. Código de base de datos.

Los fragmentos siguientes son copias literales de las migraciones del commit `f742bb4`; no son ejecutables por separado porque dependen de objetos creados en otras migraciones. El DDL completo y los extractos adicionales se incluyen en el archivo de anexos.

La tabla `asistencia` es el eje del modelo. Sus restricciones codifican varias reglas: una fila por alumno y sesión (RN-02), un pendiente solo si es automático y tiene lecturas (RN-05) y un estado de presencia que exige hora salvo corrección (RN-03).

:::codigo etiqueta="Código SQL." archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/bd/codigo-cuerpo.sql" lineas="31-56"

El disparador de la regla RN-01 se ejecuta antes de insertar una asistencia, exige una inscripción activa del alumno en el grupo de la sesión y la bloquea hasta el fin de la transacción para que una baja simultánea no se cuele.

:::codigo etiqueta="Código SQL." archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/bd/codigo-cuerpo.sql" lineas="205-234"

La función `app.estado_por_minuto` implementa la ventana de RN-03: presente antes del límite, retardo hasta la tolerancia y nulo fuera de ella.

:::codigo etiqueta="Código SQL." archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/bd/codigo-cuerpo.sql" lineas="294-304"

La RPC `api_cerrar_sesion` es la puerta que usa la interfaz: comprueba el rol docente, bloquea la sesión y delega el cierre (RN-07) en la función interna.

:::codigo etiqueta="Código SQL." archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/bd/codigo-cuerpo.sql" lineas="426-437"

Las políticas de seguridad a nivel de fila de `asistencia` definen quién lee qué: el administrador todo, el docente solo los grupos que le corresponden y el alumno únicamente lo propio.

:::codigo etiqueta="Código SQL." archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/bd/codigo-cuerpo.sql" lineas="274-284"

Por último, los disparadores de la bitácora impiden modificar, borrar o vaciar la tabla de auditoría (RNF-08), incluso durante cargas masivas.

:::codigo etiqueta="Código SQL." archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/bd/codigo-cuerpo.sql" lineas="238-270"

### 5. Estado de verificación.

**Pruebas SQL.** El 30 de octubre de 2026 se ejecutó `scripts/test-sql.sh` sobre el commit `f742bb4` contra PostgreSQL 16 local, con una base temporal que el propio script crea y elimina. El resultado fue de **37 archivos, 0 con fallas, 1 508 pruebas positivas y 953 negativas, 0 fallos** (13.2 s). Las positivas comprueban que lo permitido funciona; las negativas, que la base rechaza lo prohibido con la restricción o el código de error esperado.

**Cotejo contra la base viva.** Las cifras de este apartado salen de consultas al catálogo de la base `susan` (PostgreSQL 16.14, 43 de 43 migraciones registradas). Además: (a) los 12 extractos del archivo de código resultaron idénticos, byte a byte (21 174 bytes), a sus rangos de líneas en `supabase/migrations/`; (b) el cuerpo de las 6 funciones citadas en esos extractos coincide con el que corre en la base (`pg_proc.prosrc`, una sola versión de cada una); y (c) todos los nombres de restricciones, disparadores, funciones, índices y parámetros de la tabla de reglas existen en el catálogo.

**Diferencias frente a la especificación.** La especificación del Avance 1 describe 19 tablas y 125 columnas; la base actual tiene 20 tablas y 135 columnas. La comparación columna por columna arrojó 0 columnas de la especificación ausentes en la base; las diferencias son ampliaciones:

- Una tabla nueva, `plantilla_foto` (6 columnas), con su llave primaria, llave foránea, restricción única, tres `CHECK` y un disparador.
- Cuatro columnas nuevas en tablas existentes: `camara.tipo`, `consentimiento.origen`, `consentimiento.version_aviso` y `plantilla_facial.origen`.
- 7 disparadores en lugar de 6, 14 tipos enumerados en lugar de 13 y 12 parámetros del sistema en lugar de 11. El tipo `accion_bitacora` tiene 10 valores: los 8 de la especificación más las altas y revocaciones de consentimiento.
- `objeto_foto` admite nulo en `plantilla_facial` y `plantilla_foto` (en la especificación era obligatorio): cuando el vector ya está en el índice en uso, la foto de registro se descarta.
- Las reglas que dependen de la hora o del usuario autenticado (apertura en horario, plazo de 48 h) viven dentro de funciones y no como restricciones `CHECK`.
- La lista de entidades auditables de la bitácora (`ck_bitacora_entidad`, 18 entidades) no incluye `plantilla_foto`.

**Limitaciones.** La base compartida contiene algunas filas de prueba con prefijo `ZZ` que no pertenecen a la semilla y no se borraron; no afectan las cifras de esquema. Las pruebas SQL se ejecutaron sobre una base temporal y no sobre la base compartida. La integración entre la estación de aula con tarjeta RFID y estas funciones aún no existe, por lo que no forma parte de lo verificado aquí.

El DDL completo generado con `pg_dump`, el diccionario de datos por tabla, la lista de migraciones y las firmas de las 185 funciones se encuentran en el archivo de anexos.
