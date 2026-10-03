-- Semilla de demostracion · 01 catalogo (escenario de la spec: lunes 14-sep-2026, periodo 2026-2).
-- Determinista: no usa random() ni now(); los datos salen de listas fijas y aritmetica sobre indices.
-- Todos los nombres, matriculas y correos son ficticios (@susan.local).
--
-- Aulas       A-12 (camara frente 'navegador' activa + fondo 'ip' activa) · B-04 (sin camaras activas)
-- Docentes    D0001 (3A y 5C) · D0002 (3B) · D0003 (en licencia, sin grupos)
-- Grupos      3A (ADM301, A-12, lun/mie/vie 07:00)  3B (CON302, A-12, mar/jue/vie 09:00)  5C (MAT501, B-04, lun/mie/vie 09:00)
-- Alumnos     75 (25 por grupo); el ultimo de cada grupo (ordinal 25) tiene la inscripcion en baja
-- Cuentas     admin, tecnico, 3 docentes y los 25 alumnos de 3A (contrasena de desarrollo solo en 10_local_auth.sql)
BEGIN;

INSERT INTO aula (clave, edificio, capacidad) VALUES
    ('A-12', 'Edificio A', 40),
    ('B-04', 'Edificio B', 35);

-- A-12: webcam del navegador al frente y camara IP al fondo, ambas activas (modo automatico).
-- B-04: sin camaras activas => las sesiones de sus grupos son de pase manual (RN-06).
INSERT INTO camara (id_aula, posicion, tipo, direccion_ip, estatus)
SELECT a.id_aula, c.posicion::posicion_camara, c.tipo::tipo_camara, c.ip, c.estatus::estatus_camara
  FROM (VALUES
    ('A-12', 'frente', 'navegador', NULL,          'activa'),
    ('A-12', 'fondo',  'ip',        '10.20.12.2',  'activa'),
    ('B-04', 'frente', 'ip',        '10.20.4.1',   'inactiva'),
    ('B-04', 'fondo',  'ip',        '10.20.4.2',   'mantenimiento')
  ) AS c(aula, posicion, tipo, ip, estatus)
  JOIN aula a ON a.clave = c.aula;

INSERT INTO materia (clave, nombre, creditos, horas_semana) VALUES
    ('ADM301', 'Administración Financiera', 8, 3),
    ('CON302', 'Contabilidad Intermedia', 8, 3),
    ('MAT501', 'Matemáticas Financieras', 6, 3),
    ('ECO101', 'Introducción a la Economía', 6, 3);

INSERT INTO docente (num_empleado, apellido_paterno, apellido_materno, nombres, correo_institucional, estatus) VALUES
    ('D0001', 'Ortega', 'Salinas', 'Patricia', 'docente1@susan.local', 'activo'),
    ('D0002', 'Balderas', 'Quiroz', 'Ernesto', 'docente2@susan.local', 'activo'),
    ('D0003', 'Lozano', 'Pineda', 'Rosa', 'docente3@susan.local', 'licencia');

INSERT INTO grupo (id_materia, id_docente, id_aula, clave_grupo, periodo)
SELECT m.id_materia, d.id_docente, a.id_aula, g.clave_grupo, '2026-2'
  FROM (VALUES
    ('3A', 'ADM301', 'D0001', 'A-12'),
    ('3B', 'CON302', 'D0002', 'A-12'),
    ('5C', 'MAT501', 'D0001', 'B-04')
  ) AS g(clave_grupo, materia, docente, aula)
  JOIN materia m ON m.clave = g.materia
  JOIN docente d ON d.num_empleado = g.docente
  JOIN aula a ON a.clave = g.aula
 ORDER BY g.clave_grupo;

-- Horario semanal: 3 bloques por grupo (de ellos salen las 48 sesiones del periodo).
INSERT INTO horario_grupo (id_grupo, dia_semana, hora_inicio, hora_fin)
SELECT g.id_grupo, h.dia, h.inicio::time, h.fin::time
  FROM (VALUES
    ('3A', 1, '07:00', '08:00'), ('3A', 3, '07:00', '08:00'), ('3A', 5, '07:00', '08:00'),
    ('3B', 2, '09:00', '10:00'), ('3B', 4, '09:00', '10:00'), ('3B', 5, '09:00', '10:00'),
    ('5C', 1, '09:00', '10:00'), ('5C', 3, '09:00', '10:00'), ('5C', 5, '09:00', '10:00')
  ) AS h(clave_grupo, dia, inicio, fin)
  JOIN grupo g ON g.clave_grupo = h.clave_grupo AND g.periodo = '2026-2'
 ORDER BY h.clave_grupo, h.dia;

-- 75 alumnos ficticios. Los indices 7, 11 y 3 son primos con 25: cada lista se recorre completa sin repetir.
INSERT INTO alumno (matricula, apellido_paterno, apellido_materno, nombres, correo_institucional, estatus)
SELECT 'E26' || lpad(i::text, 4, '0'),
       (ARRAY['García','Hernández','López','Martínez','González','Pérez','Rodríguez','Sánchez','Ramírez','Flores','Gómez','Díaz','Cruz',
              'Morales','Reyes','Gutiérrez','Ortiz','Jiménez','Torres','Vázquez','Mendoza','Castillo','Ruiz','Aguilar','Vargas'])[(i * 11) % 25 + 1],
       (ARRAY['Moreno','Rojas','Silva','Castro','Ramos','Medina','Salazar','Cortés','Guzmán','Núñez','Ríos','Herrera','Navarro','Domínguez',
              'Figueroa','Luna','Ibarra','Campos','Paredes','Velasco','Solís','Cabrera','Lara','Peña','Montes'])[(i * 3) % 25 + 1],
       (ARRAY['Ana','Luis','María','José','Carmen','Jorge','Laura','Miguel','Sofía','Daniel','Valeria','Andrés','Paola','Ricardo','Fernanda',
              'Héctor','Gabriela','Óscar','Natalia','Iván','Renata','Emilio','Daniela','Mauricio','Camila'])[(i * 7) % 25 + 1],
       'e26' || lpad(i::text, 4, '0') || '@susan.local',
       'activo'
  FROM generate_series(1, 75) AS i
 ORDER BY i;

-- 25 alumnos por grupo, en el orden de las matriculas; el ordinal 25 de cada grupo esta en baja
-- (conserva su historial hasta la sesion 8).
INSERT INTO inscripcion (id_alumno, id_grupo, fecha_alta, estatus, derecho_examen)
SELECT a.id_alumno, g.id_grupo, DATE '2026-08-03',
       CASE WHEN ((substr(a.matricula, 4)::int - 1) % 25) + 1 = 25 THEN 'baja' ELSE 'activa' END::estatus_inscripcion,
       true
  FROM alumno a
  JOIN grupo g ON g.clave_grupo = (ARRAY['3A', '3B', '5C'])[((substr(a.matricula, 4)::int - 1) / 25) + 1] AND g.periodo = '2026-2'
 ORDER BY a.id_alumno;

-- Consentimientos para el dato facial (RN-13): todos vigentes salvo uno revocado (3A, ordinal 5) y uno
-- vencido (3B, ordinal 6). Esos dos se registran a mano aunque la sesion sea automatica (RF-09, RNF-06).
-- Los documentos son rutas ficticias: el objeto no existe en el bucket.
INSERT INTO consentimiento (id_alumno, fecha_firma, vigencia_hasta, objeto_documento, estatus)
SELECT a.id_alumno,
       CASE WHEN n = 31 THEN DATE '2025-09-01' ELSE DATE '2026-08-01' END,
       CASE WHEN n = 31 THEN DATE '2026-08-31' ELSE DATE '2027-08-01' END,
       'consentimientos/' || a.id_alumno || '/' || md5('seed-consent-' || a.matricula)::uuid || '.pdf',
       (CASE n WHEN 5 THEN 'revocado' WHEN 31 THEN 'vencido' ELSE 'vigente' END)::estatus_consentimiento
  FROM (SELECT a.*, substr(a.matricula, 4)::int AS n FROM alumno a) AS a
 ORDER BY a.id_alumno;

-- Cuentas de acceso (la contrasena de desarrollo solo se crea en 10_local_auth.sql, en base local).
-- auth_uid determinista: md5 del correo con forma de uuid.
INSERT INTO usuario (auth_uid, correo, rol, id_docente, id_alumno, activo)
SELECT md5('susan-demo-' || u.correo)::uuid, u.correo, u.rol::rol_usuario, d.id_docente, a.id_alumno, true
  FROM (
        SELECT 'admin@susan.local' AS correo, 'administrador' AS rol, NULL AS num_empleado, NULL AS matricula
        UNION ALL SELECT 'tecnico@susan.local', 'tecnico', NULL, NULL
        UNION ALL SELECT correo_institucional, 'docente', num_empleado, NULL FROM docente
        UNION ALL SELECT correo_institucional, 'alumno', NULL, matricula FROM alumno WHERE substr(matricula, 4)::int <= 25
       ) AS u
  LEFT JOIN docente d ON d.num_empleado = u.num_empleado
  LEFT JOIN alumno a ON a.matricula = u.matricula
 ORDER BY u.rol, u.correo;

COMMIT;
