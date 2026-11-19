## OBJETIVOS.

### 1. Objetivo general.

Diseñar e implementar un sistema centralizado de registro digital de asistencia académica y de análisis del ausentismo mediante métodos numéricos, que combine una aplicación web con formularios, una base de datos relacional, un servicio de reconocimiento facial con consentimiento y una estación de aula con Arduino conectada por puerto serie, para reducir el tiempo de pase de lista en el aula, generar historiales consolidados que permitan identificar patrones de ausentismo y orientar la intervención docente oportuna, y registrar por una vía alterna sin rostro a los alumnos que no otorgaron su consentimiento o cuando la cámara falla.

### 2. Objetivos específicos.

1. Desarrollar una aplicación web con formularios para la gestión académica (alumnos, docentes, materias, grupos, aulas, cámaras, horarios e inscripciones), la apertura y el cierre de la sesión, el pase de lista, la revisión de casos dudosos, los justificantes y los reportes, con acceso según el rol y sin que la interfaz contenga reglas de negocio.
2. Diseñar una base de datos relacional normalizada en PostgreSQL, con restricciones, disparadores y funciones que hagan cumplir las reglas de negocio del proyecto, un solo registro de asistencia por alumno y sesión, y una bitácora de auditoría, sin guardar vectores ni imágenes de rostros en las tablas.
3. Implementar un servicio de reconocimiento que vectorice los rostros capturados, los busque en un índice y atribuya la asistencia solo a alumnos inscritos con consentimiento vigente, de modo que quien no lo otorgue se registre por otra vía.
4. Aplicar métodos numéricos (regresión, suavizado, interpolación, proyección, búsqueda de raíces, control de cambios y puntaje de riesgo) a las series de asistencia para identificar tendencias, el cruce del límite de ausencias y los alumnos en riesgo.
5. Diseñar la estación de aula con Arduino UNO R3, lector RFID MFRC522, pantalla LCD 16x2, tres LED, zumbador y pulsador, que lea la tarjeta personal del alumno, dé aviso inmediato y nunca cierre una sesión.
6. Definir un protocolo serie de líneas ASCII (115200 baudios, 8N1) entre la estación y la computadora del docente, y desarrollar en Node el programa que maneje el puerto serie, valide cada línea recibida y responda con el resultado.
7. Validar cada módulo por separado (pruebas automatizadas de la base de datos, del servicio y del módulo numérico, pruebas de la lógica de la estación en la computadora y pruebas del programa del puerto con una conexión simulada) antes de integrarlos, y dejar documentado lo que aún no se ha probado con el hardware físico.
