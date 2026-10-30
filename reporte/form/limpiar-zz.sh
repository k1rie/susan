#!/usr/bin/env bash
# Elimina los registros «ZZ» que crean las capturas (alumno, docente, materia, aula, cámara, grupo, justificante, consentimiento y cuenta de prueba).
# La bitácora es de solo anexar: lo que ella tenga no se puede borrar (si una cuenta de prueba tiene asientos, se desactiva en lugar de borrarse).
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres
/usr/lib/postgresql/16/bin/psql -X -d susan -At -v ON_ERROR_STOP=1 <<'SQL'
begin;
delete from justificante where motivo like '%ZZ Prueba%' or id_alumno in (select id_alumno from alumno where matricula like 'ZZ%');
delete from plantilla_foto where id_plantilla in (select id_plantilla from plantilla_facial where id_alumno in (select id_alumno from alumno where matricula like 'ZZ%'));
delete from plantilla_facial where id_alumno in (select id_alumno from alumno where matricula like 'ZZ%');
delete from consentimiento where id_alumno in (select id_alumno from alumno where matricula like 'ZZ%');
delete from inscripcion where id_alumno in (select id_alumno from alumno where matricula like 'ZZ%') or id_grupo in (select id_grupo from grupo where clave_grupo like 'ZZ%');
delete from asistencia where id_sesion in (select id_sesion from sesion_clase where id_grupo in (select id_grupo from grupo where clave_grupo like 'ZZ%'));
delete from sesion_clase where id_grupo in (select id_grupo from grupo where clave_grupo like 'ZZ%');
delete from horario_grupo where id_grupo in (select id_grupo from grupo where clave_grupo like 'ZZ%');
delete from grupo where clave_grupo like 'ZZ%';
delete from camara where id_aula in (select id_aula from aula where clave like 'ZZ-%');
delete from aula where clave like 'ZZ-%';
delete from materia where clave like 'ZZ%';
do $$
begin
    delete from usuario where correo like 'zz.%';
    delete from auth.users where email like 'zz.%';
exception when foreign_key_violation then
    update usuario set activo = false where correo like 'zz.%';
    raise notice 'cuenta zz.* desactivada (tiene asientos de bitácora)';
end $$;
delete from alumno a where a.matricula like 'ZZ%' and not exists (select 1 from usuario u where u.id_alumno = a.id_alumno);
delete from docente where num_empleado like 'ZZ%';
commit;
SQL
# Residuo conocido de la corrida de capturas del 2026-10-30: la cuenta zz.prueba.reporte@susan.test aceptó el aviso de consentimiento propio y eso dejó
# un asiento de bitácora (alta_consentimiento, id 148) que referencia a su usuario; la bitácora es de solo anexar, así que ese usuario (inactivo) y el
# alumno ZZPRUEBA1 (baja definitiva) no se pueden borrar. El resto de los registros ZZ sí se elimina con este script.
