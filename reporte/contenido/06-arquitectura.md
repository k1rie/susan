## ARQUITECTURA GENERAL DEL SISTEMA.

El sistema se organiza en cuatro niveles unidos por enlaces de distinto tipo (Figura 1). En el aula están la estación de aula, con Arduino UNO R3, y la cámara IP. La estación se comunica por USB con el programa en Node de la computadora del docente mediante líneas de texto ASCII (Arduino, s. f.-b). En esa misma computadora el docente usa el navegador para abrir la aplicación web, hecha con Next.js (Vercel, s. f.), cuyas páginas y Route Handlers son el núcleo del sistema: autentican al docente, validan cada entrada y llaman a las funciones de la base de datos con supabase-js. Para el reconocimiento facial, la aplicación llama por HTTP al servicio de reconocimiento (FastAPI y FAISS), que vectoriza los rostros del fotograma y los busca en un índice (Deng et al., 2019; Johnson et al., 2021). Los datos viven en PostgreSQL 16 de Supabase: tablas, funciones RPC, seguridad por filas (RLS) y un Storage privado (PostgreSQL Global Development Group, s. f.; Supabase, s. f.-a).

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/figuras/arquitectura.png" titulo="Arquitectura general del sistema SUSAN." nota="Nota. Elaboración propia. La línea discontinua marca el enlace pendiente entre la estación y la base de datos; su ruta exacta (por un Route Handler o desde el navegador) está por decidir." ancho=15

La estación solo conoce al puente serie y el navegador solo conoce a la aplicación web. La aplicación web es la que llama al servicio de reconocimiento y a las funciones de la base de datos, de modo que las reglas de negocio no viven en la interfaz. El enlace de la estación con el puente está diseñado y se probó solo en software; el de la estación con la base de datos, en línea discontinua, todavía no existe: hoy el puente reconoce la tarjeta con una tabla de demostración y no escribe nada en la base de datos.

### 1. Protocolo serie.

USB a 115200 baudios, 8 bits, sin paridad, 1 bit de paro (8N1). Todas las tramas son líneas de texto ASCII terminadas en salto de línea (`\n`; se tolera `\r\n`), de 64 bytes como máximo sin el salto, lo que permite probarlas con cualquier monitor serie. Al abrir el puerto, la placa se reinicia y envía `HELLO`.

<!-- anchos: 14,30,36,20 -->

| Dirección | Trama | Significado | Ejemplo |
|---|---|---|---|
| Estación → PC | `HELLO estacion-aula 1.0` | Fin del arranque; se repite cada vez que la placa se reinicia | `HELLO estacion-aula 1.0` |
| Estación → PC | `UID <HEX>` | Tarjeta leída; HEX en mayúsculas y sin separadores (UID de 4, 7 o 10 bytes) | `UID 04A1B2C3` |
| Estación → PC | `BTN` | Pulsación del botón, que solo cambia la página de la pantalla | `BTN` |
| Estación → PC | `PONG` | Respuesta a `PING` | `PONG` |
| PC → estación | `PING` | Comprobación del enlace | `PING` |
| PC → estación | `SES <grupo>\|<materia>\|<presentes>/<total>` | Estado de la sesión para la pantalla; `SES \|\|0/0` indica que no hay sesión abierta | `SES 3o N\|Programacion Ava\|0/30` |
| PC → estación | `RES OK <nombre-corto>` | Tarjeta registrada: LED verde y un pitido corto | `RES OK Ana Demo` |
| PC → estación | `RES DUP [nombre-corto]` | Tarjeta ya registrada: LED ámbar y dos pitidos cortos | `RES DUP Ana Demo` |
| PC → estación | `RES NOREG` | Tarjeta no registrada: LED rojo y un pitido largo y grave | `RES NOREG` |
| PC → estación | `RES ERR [motivo]` | Error: LED rojo intermitente y sin sonido | `RES ERR` |

Nota. Las tramas y el ejemplo de `UID` se tomaron de la documentación de la estación y se comprobaron contra las constantes y el analizador de comandos de `protocolo.h`. Los ejemplos de `SES` y `RES` son los que arma el puente con la sesión y las tarjetas de demostración, que son datos ficticios. Los textos se recortan a 16 columnas y se transliteran a ASCII porque la pantalla solo garantiza ASCII. Elaboración propia.

Una línea de más de 64 bytes, con caracteres de control, con un verbo desconocido o mal formada se descarta entera y se ignora; nunca se interpreta un fragmento. El mismo UID se ignora si la lectura anterior fue hace menos de 2 s, y además la tarjeta debe retirarse antes de que su siguiente lectura cuente. Si la computadora no envía ningún comando reconocido (`PING`, `SES` o `RES`) en 30 s, la estación muestra «Sin conexion» y enciende el LED ámbar de forma intermitente. Si después de un `UID` no llega `RES` en 3 s, la estación avisa por su cuenta con el LED rojo y el mensaje «Sin respuesta».

### 2. Secuencia de un registro por tarjeta.

La tarjeta RFID es la vía de registro del alumno que no otorgó su consentimiento para el reconocimiento facial, o de cualquier alumno cuando la cámara falla. La secuencia prevista es la siguiente; los pasos 4 y 5 son la integración con la base de datos y todavía no existen.

1. El alumno acerca su tarjeta al lector MFRC522; la estación solo lee el UID de la tarjeta.
2. El firmware descarta los rebotes, envía la trama `UID` y muestra «Tarjeta leida» en la pantalla mientras espera la respuesta.
3. El puente valida la línea y decide con lo que tiene en memoria: sin sesión abierta responde `RES ERR`, con un UID que no está en su tabla responde `RES NOREG` y con un alumno que ya figura presente responde `RES DUP`. Hoy la tabla UID-alumno es un archivo CSV con tarjetas ficticias y la sesión es un archivo JSON de demostración.
4. **A implementar.** El puente buscaría el UID en una tabla `credencial` (UID y alumno), que aún no existe, y registraría la asistencia con la función `api_registrar_manual`, la misma del pase de lista manual (RF-09). Hoy `registrarPresencia()` es un sustituto que solo escribe en pantalla.
5. **A implementar.** La función aplicaría las reglas del esquema: sesión abierta y alumno inscrito, que en una sesión automática sea sin consentimiento vigente o sin lecturas válidas, y un solo registro por alumno y sesión. Como la función exige al docente titular, la llamada debe hacerse con su sesión autenticada y sin guardar la clave `service_role` en el puente.
6. El puente responde `RES OK`, `RES DUP`, `RES NOREG` o `RES ERR` y la estación muestra el resultado con la pantalla, el LED y el zumbador; después el puente envía `SES` con los presentes y el total actualizados.

Esta secuencia valida la lógica, no el hardware. Se probó en la computadora de desarrollo: pruebas de la lógica y del sketch con hardware simulado (65 y 38 casos), el firmware compilado para el UNO (14 122 bytes de memoria de programa y 1 227 de SRAM) y ejecutado en un simulador de instrucciones, y el puente (42 pruebas automáticas, 41 aprobadas y 1 omitida), con un recorrido completo por un puerto serie virtual. Falta probar con la placa, el lector y tarjetas reales, en particular la regla de retirada de la tarjeta, que depende de cómo respondan las tarjetas físicas.

### 3. Secuencia del pase de lista con cámara.

Este es el flujo principal de SUSAN. Está implementado en la aplicación y cubierto por pruebas automáticas; su demostración usa una cámara y un reloj simulados, solo en modo local, y no se ha medido con grupos reales.

1. El docente abre la sesión de clase en la aplicación web. La función `api_abrir_sesion` solo lo permite dentro del horario del grupo y fija el modo de registro: automático si el aula tiene al menos una cámara activa, manual en caso contrario (RN-06).
2. En modo automático y durante la ventana de tolerancia, la página de la sesión envía `POST /api/sesiones/{id}/captura` cada `intervalo_muestreo_seg`: con el fotograma de la cámara del navegador o, para una cámara IP, sin imagen, porque el servicio de reconocimiento toma el fotograma de la cámara.
3. El Route Handler autentica al docente y `api_sesion_monitor` confirma que es el titular del grupo, que la sesión está abierta, es automática y sigue en ventana, y que la cámara es del aula y está activa.
4. `svc_alumnos_candidatos` entrega los identificadores FAISS de los alumnos inscritos con consentimiento vigente: quien no está inscrito o no consintió nunca es candidato (RF-04, RNF-06).
5. El servicio de reconocimiento (`POST /v1/recognize`) detecta los rostros, calcula el vector de cada uno solo en memoria, busca en el índice FAISS restringido a esos candidatos, sube los recortes al Storage privado y devuelve para cada rostro el candidato y su similitud, sin el vector. Si el servicio falla, la aplicación responde 503 sin escribir en la base de datos y la sesión sigue operable en manual.
6. `svc_crear_captura` y `svc_registrar_detecciones` guardan la captura y las detecciones: aplican el umbral de similitud y las reglas RN-02 a RN-05, y crean o actualizan un solo registro de asistencia por alumno y sesión.
7. El docente sigue el avance en la pantalla de la sesión (P-03) y puede registrar a mano a quien no consintió o no fue reconocido.
8. Al cerrar la sesión se consolidan las lecturas, se confirma presente o retardo a quien alcanzó el mínimo de lecturas válidas, se crea el registro de ausente de cada inscrito activo sin registro, se anota la bitácora y se recalculan los acumulados. Los alumnos con pocas lecturas quedan pendientes en la cola de revisión (P-05), donde el docente los confirma o corrige. El cierre lo hace el docente con `api_cerrar_sesion` o la tarea `/api/jobs/cerrar-sesiones`.

Nota. La captura la dispara el navegador del docente, no el servidor: si cierra la pestaña, el muestreo se detiene. La tarea de cierre automático existe, pero ningún programador de tareas del repositorio la ejecuta todavía. La ruta de la cámara IP solo se probó con pruebas automáticas, nunca con una cámara real. Elaboración propia.
