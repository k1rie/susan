## VIABILIDAD TÉCNICA Y RIESGOS.

La propuesta es viable con material de un laboratorio de sistemas digitales y con software gratuito o libre. La aplicación web, el servicio de reconocimiento y la base de datos ya se ejecutan y se prueban en el repositorio del proyecto. La estación de aula con Arduino es trabajo nuevo de este avance y se diseñó y verificó solo en software: la lógica de su protocolo se probó en el equipo de desarrollo y el firmware se compila para el microcontrolador del UNO, pero la estación no se ha probado en hardware físico. Por eso el riesgo principal no es de software, sino la disponibilidad del material y la validación del circuito armado, junto con la calibración del reconocimiento facial con datos reales, que sigue pendiente.

### 1. Materiales y software.

<!-- anchos: 28,44,28 -->

| Elemento | Uso | Disponibilidad |
|---|---|---|
| Arduino UNO R3 | Microcontrolador de la estación de aula (ATmega328P, 5 V) | Por confirmar con el laboratorio |
| Módulo lector MFRC522 | Lectura del UID de la tarjeta por SPI (lógica de 3.3 V) | Por confirmar |
| Tarjetas o llaveros RFID | Credencial personal del alumno sin consentimiento facial | Por confirmar |
| Pantalla LCD 16x2 con módulo I2C | Muestra la sesión, la última lectura y el estado de la estación | Por confirmar |
| LEDs, resistencias, zumbador, pulsador y protoboard | Indicadores, divisores de tensión, aviso sonoro y botón | Por confirmar |
| Cable USB | Alimentación y enlace serie con el equipo del docente | Por confirmar |
| Computadora del docente | Navegador, aplicación web y programa en Node del puerto serie | Equipo del laboratorio o de un integrante |
| Arduino IDE o arduino-cli | Compilar y cargar el firmware en el UNO | Software libre |
| Librerías MFRC522 y LiquidCrystal I2C | Control del lector y de la pantalla desde el firmware | Descarga gratuita |
| avr-gcc, avr-libc y g++ | Compilar el firmware sin el IDE y probar la lógica del protocolo en el PC | Software libre |
| Node.js 20.9 o superior | Ejecuta la aplicación web y el programa del puerto serie | Software libre |
| Paquete `serialport` de npm | Acceso al puerto serie desde Node | Software libre |
| Next.js 16.3.8, React 19.2.8 y Tailwind CSS 4 | Aplicación web (App Router) | Software libre |
| Supabase (`@supabase/supabase-js` ^2.117.2) | Autenticación, almacenamiento y API sobre PostgreSQL | Modo local sin cuenta; en la nube, cuenta por confirmar |
| PostgreSQL 16 (entorno local de pruebas; la configuración de Supabase declara la versión 17) | Base de datos: 20 tablas, funciones RPC, RLS y triggers | Software libre |
| Python 3.12, FastAPI y Uvicorn | Servicio de reconocimiento facial | Software libre |
| FAISS (`faiss-cpu` 1.9 o superior) | Índice de búsqueda por similitud de vectores de 512 dimensiones | Software libre |
| InsightFace (modelo `buffalo_s`) y ONNX Runtime | Detección y vectorización de rostros (ArcFace, 512 dimensiones) | Descarga gratuita; modelos solo para uso no comercial |
| Vitest y pytest | Pruebas de la aplicación web y del servicio de reconocimiento | Software libre |
| Playwright con Chromium | Capturas automáticas de pantallas y diagramas de este reporte | Software libre |

Nota. Las versiones del software provienen de `web/package.json`, `recognition-service/requirements.txt` y los scripts del repositorio. Las características eléctricas del lector se toman de NXP Semiconductors (2016) y las de la placa y de los buses SPI e I2C (Wire), de Arduino (s. f.-a, s. f.-c, s. f.-d). La disponibilidad del material se confirmará con el laboratorio.

### 2. Riesgos.

<!-- anchos: 24,30,46 -->

| Riesgo | Efecto | Mitigación |
|---|---|---|
| La estación no se ha probado en hardware físico | Pueden aparecer diferencias entre lo simulado y lo real: cableado, tiempos de la librería del lector y de la pantalla, zumbador | Se entrega validada en software; el armado y la prueba en el laboratorio quedan como paso siguiente. Sin la estación, el pase manual y la cámara siguen funcionando |
| El MFRC522 trabaja a 3.3 V y el UNO a 5 V | Una señal de 5 V sin reducir puede dañar el módulo | Divisores resistivos en las líneas que salen del UNO hacia el módulo; alimentar el módulo desde el pin de 3.3 V y revisar el cableado antes de energizar (NXP Semiconductors, 2016) |
| El UID de una tarjeta puede copiarse y el sistema no detecta si una foto sustituye al rostro | Un alumno podría registrar a otro con una tarjeta copiada o prestada, o con una fotografía | La tarjeta es un respaldo de conveniencia, no autenticación fuerte. Lo atenúan la supervisión del docente, la corrección de registros (RN-08), las 3 lecturas en capturas distintas y la cola de revisión. La detección de vida queda como riesgo abierto |
| El UID aún no se asocia a un alumno en la base de datos | La estación lee y envía el UID, pero todavía no se asienta asistencia con ella | Siguientes pasos: tabla de credenciales UID-alumno y una función RPC con el mismo patrón del esquema (RLS y bitácora). La estación nunca cierra sesiones |
| Permisos, controladores y puerto serie ocupado | Node no abre el puerto y la estación queda sin enlace con la aplicación | Dar al usuario permiso sobre el dispositivo serie, instalar el controlador si la placa lo requiere y cerrar el monitor serie del IDE. Tras 30 s sin tráfico válido, el firmware lo indica con el LED ámbar |
| Precisión del reconocimiento y condiciones de luz | Un umbral exigente llena la cola de revisión; uno laxo causa atribuciones equivocadas | Umbral (0.700 desde el 2026-10-03), mínimo de 3 lecturas e intervalo de 15 s son parámetros calibrables. Las mediciones usan variantes de una foto por persona, no fotos independientes; la calibración de campo en un piloto de 1 o 2 grupos está pendiente |
| Tratamiento del rostro como dato sensible y revisión jurídica pendiente | Reconocer sin consentimiento vigente o filtrar datos biométricos | Ningún vector ni imagen en tablas relacionales (RNF-03); sin consentimiento hay pase manual o tarjeta RFID (RN-13, RNF-06); objetos solo por URL firmada de hasta 300 s (Supabase, s. f.-b). El aviso y la vigencia del consentimiento los debe aprobar el área jurídica de la UNACH (INAI, 2018; LGPDPPSO, 2025; LPDPPSOCH, 2025) |
| Disponibilidad de la cámara del aula | Sin cámara no hay reconocimiento automático en esa sesión | Cámara de tipo `navegador` (webcam del equipo del docente), prevista para un piloto sin cámaras IP; respaldo con pase manual (RF-09) y con la estación RFID |
| Presupuesto de rendimiento de la interfaz | Carga inicial más lenta de lo previsto en algunas pantallas | `/docente` quedó en 226.1 KB comprimidos (+8.0 %), dentro del límite de +15 %. `/alumno`, `/reportes` y `/docente/sesiones/[id]` lo superan y no tienen presupuesto propio; falta repetir la medición del tiempo de ejecución con `next start` |
| El reloj y la cámara de demostración solo existen en modo local | Los resultados de la demostración (hora fija, rostros sintéticos) no prueban la precisión real | Se activan solo con `SUSAN_LOCAL=1` y el reloj simulado habilitado en la base, nunca en Supabase real. Con rostros reales se usa el modo `insightface`; la precisión se valida en el piloto |

Nota. Los riesgos del reconocimiento, la privacidad y el rendimiento provienen de `docs/DECISIONS.md`, de `docs/DESIGN_PROGRESS.md` y de la especificación del primer avance. Los de la estación son de diseño y no se han observado en hardware. Los modelos preentrenados de InsightFace son de uso no comercial, algo compatible con un proyecto académico pero que debe revisarse si el sistema se desplegara fuera de ese ámbito.
