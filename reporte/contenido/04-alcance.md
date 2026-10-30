## ALCANCE.

El sistema cubre el registro de asistencia de grupos de una institución con un docente por sesión, una cámara de aula (de red o la cámara del navegador) y una estación de aula conectada por USB a la computadora del docente. La aplicación web, la base de datos, el servicio de reconocimiento y el módulo numérico existen y se pueden demostrar en modo local con datos de prueba; la estación de aula está diseñada y verificada solo en software, y su integración con la base de datos queda como siguiente paso.

<!-- anchos: 50,50 -->
| Incluye | No incluye |
|---|---|
| Aplicación web con nueve pantallas (P-01 a P-09) y acceso por rol (administrador, docente, alumno y técnico) | Aplicación móvil nativa; la interfaz es un portal web responsivo |
| Base de datos PostgreSQL con 20 tablas de datos (las 19 de la especificación y una de fotos de plantilla), disparadores y funciones | Calificaciones, kárdex u otro dato académico distinto de la asistencia |
| Servicio de reconocimiento con índice FAISS y consentimiento previo del alumno | Entrenamiento del modelo de visión; se usa uno preentrenado |
| Pase de lista manual de respaldo para quien no consiente o sin cámara activa | Detección de vida (anti-spoofing); riesgo abierto que atenúa la revisión del docente |
| Revisión del docente, justificantes, acumulados y reportes por alumno, grupo y periodo | Control de acceso físico a edificios o laboratorios |
| Análisis numérico del ausentismo (tendencia, proyección, cruce del límite y riesgo por alumno) | Piloto con grupos reales, medición del ahorro de tiempo y calibración con datos reales |
| Estación de aula: firmware, circuito y protocolo serie, diseñados y verificados en software | Pruebas de la estación con hardware físico (no se han hecho) |
| Programa en Node que maneja el puerto serie de la estación | Tabla de asociación entre el UID de la tarjeta y el alumno, y credenciales de las tarjetas |
| La estación solo lee la tarjeta y muestra el resultado | Registro de asistencia desde la estación en la base de datos (integración por funciones RPC pendiente) |
| Escenario de demostración con cámara y reloj simulados, solo en modo local | Cierre de sesiones desde la estación; no se hará, exige la autenticación del docente |

Nota. El estado de cada elemento procede del repositorio del proyecto y de su documentación. La estación y su programa en Node son trabajo nuevo de este avance y no se han probado con hardware físico. Elaboración propia.

### Supuestos.

- Los horarios, las aulas, las inscripciones y las cámaras se registran antes del periodo, porque una sesión solo se abre en el horario y el aula de su grupo.
- La computadora del docente está junto a la estación y conectada a ella por USB; en el modo local de demostración, la aplicación y la base de datos corren en esa misma computadora.
- Cada alumno que usa la estación tendría una tarjeta RFID personal; la entrega de tarjetas y su asociación con el alumno no están definidas todavía.
- El lector MFRC522 trabaja a 3.3 V, por lo que el circuito prevé divisores de resistencias para las señales de 5 V del Arduino UNO.
- El aviso de privacidad, el formato del consentimiento y su vigencia deben ser aprobados por el área jurídica de la universidad antes de un uso real; mientras tanto, quien no consiente se registra por la vía manual o, cuando exista la integración, por la tarjeta.
- Las cifras de tiempo y de límite de ausencias de la sección anterior son supuestos y estimaciones del análisis del proyecto, no mediciones institucionales.
