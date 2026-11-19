// Límites REALES de la base de datos, verificados en supabase/migrations (0003_tablas_academico.sql, 0004_tablas_seguridad.sql y
// las RPC de 0201, 0202, 0203 y 0205). Se usan como `maxLength` y en los contadores para que el campo no deje escribir algo
// que el servidor va a rechazar. Si la base cambia, se cambia aquí y en `docs/api/*`.
//
// Cada clave tiene dos formas para que cada pantalla use la que prefiera:
//   plana  -> LIMITES.materia_clave
//   anidada -> LIMITES.materia.clave
export const LIMITES = Object.freeze({
    matricula: 10, // alumno.matricula varchar(10)
    num_empleado: 10, // docente.num_empleado varchar(10)
    nombres: 60, // alumno/docente.nombres varchar(60)
    apellidos: 40, // apellido_paterno y apellido_materno varchar(40)
    correo: 120, // correo_institucional y usuario.correo varchar(120)
    clave_grupo: 8, // grupo.clave_grupo varchar(8)
    // La columna es varchar(10), pero ck_grupo_periodo (^[0-9]{4}-[12]$) lo fija en 6 caracteres: AAAA-S.
    periodo: 6,
    materia_clave: 8, // materia.clave varchar(8)
    materia_nombre: 80, // materia.nombre varchar(80)
    aula_clave: 10, // aula.clave varchar(10)
    aula_edificio: 40, // aula.edificio varchar(40)
    materia: Object.freeze({ clave: 8, nombre: 80 }),
    aula: Object.freeze({ clave: 10, edificio: 40 }),
});

// Formato que exigen las RPC, evaluado sobre el valor YA en mayúsculas (el servidor hace upper() antes de comprobar).
// Sirve para dar el mensaje correcto al salir del campo; la fuente de verdad sigue siendo el servidor.
export const PATRONES = Object.freeze({
    matricula: /^[A-Z0-9]{1,10}$/,
    num_empleado: /^[A-Z0-9]{1,10}$/,
    materia_clave: /^[A-Z0-9]{1,8}$/,
    aula_clave: /^[A-Z0-9][A-Z0-9-]{0,9}$/,
    clave_grupo: /^[A-Z0-9][A-Z0-9-]{0,7}$/,
    periodo: /^[0-9]{4}-[12]$/,
});
