## AVANCE DEL PROYECTO.

Este avance reúne lo que existe hoy en el repositorio del proyecto (rama principal) y el trabajo nuevo de la estación de aula. Cada cifra procede de una consulta o de una ejecución hecha para este reporte, y se indica qué no se ha verificado.

### 1. Estado por parte.

<!-- anchos: 17,13,34,36 -->
| Parte | Materia | Qué está hecho | Verificación |
|---|---|---|---|
| Base de datos | Programación Avanzada | PostgreSQL con 20 tablas de datos, 135 columnas, restricciones, disparadores, funciones y políticas de seguridad por fila | Esquema comparado con la base en ejecución; pruebas SQL del proyecto: 37 archivos, 1508 comprobaciones positivas y 953 negativas, 0 fallos |
| Formularios web | Programación Avanzada | 41 formularios y flujos guiados (acceso, alumnos, grupos, catálogos, justificantes, registro facial) con 114 capturas de pantalla | Pruebas automáticas de formularios: 2008 pruebas, 2007 pasan y 1 falla por un temporizado del detector de rostros; no se corrió la suite completa, ni el análisis de código ni la compilación de producción |
| Servicio de reconocimiento | Programación Avanzada | Servicio con índice FAISS y registro facial con consentimiento | No se ejecutó la verificación de precisión en este avance |
| Estación de aula (Arduino) | Sistemas Digitales | Circuito, firmware, protocolo serie y programa en Node del puerto serie, escritos en este avance | Compila para Arduino UNO sin errores ni avisos y se ejecutó en un simulador de instrucciones; pruebas de lógica en el equipo (65 y 38 casos, 0 fallidos). **No se ha probado con hardware físico** |
| Integración estación y SUSAN | Ambas | Protocolo serie definido; el programa en Node responde a la estación con una sesión simulada | Pendiente: tabla de tarjetas y registro de asistencia en la base de datos |

Nota. Elaboración propia. La verificación de cada requerimiento de la especificación (estado Implementado, Parcial o Pendiente) no se completó en este avance.

### 2. Integración de las materias.

- **Sistemas Digitales:** la estación de aula, con sus entradas y salidas digitales, los buses SPI e I2C, el antirrebote del pulsador y la máquina de estados del firmware.
- **Programación Avanzada:** la aplicación web y sus formularios, la base de datos, el servicio de reconocimiento y el programa que maneja el puerto serie en la computadora.

### 3. Próximos pasos.

1. Armar la estación con los componentes de la lista de materiales y probar el cableado, la lectura de tarjetas, la dirección de la pantalla y el antirrebote reales.
2. Crear en la base de datos la tabla que asocia cada tarjeta con un alumno y una función que registre la asistencia desde la estación.
3. Conectar el programa en Node con esa función y probar el flujo completo con una sesión abierta.
4. Completar la verificación de cada requerimiento funcional, no funcional y regla de negocio de la especificación.
5. Correr la suite completa de pruebas, el análisis de código y la compilación de producción de la aplicación web.
6. Medir la precisión del reconocimiento y el ahorro de tiempo en un piloto con un grupo.
