// Utilidades compartidas por los generadores del reporte (solo lectura de la BD local de SUSAN).
// Ejecuta psql y devuelve JSON: asi no hace falta instalar ningun cliente de PostgreSQL para Node.
import { execFileSync } from 'node:child_process';

const PSQL = process.env.PSQL || '/usr/lib/postgresql/16/bin/psql';
const ENTORNO = {
    ...process.env,
    PGHOST: process.env.PGHOST || '127.0.0.1',
    PGPORT: process.env.PGPORT || '54329',
    PGUSER: process.env.PGUSER || 'postgres',
    PGDATABASE: process.env.PGDATABASE || 'susan',
};

// Ejecuta una consulta que devuelve UNA celda de texto (normalmente json_agg) y la parsea.
export function consultaJson(sql) {
    const salida = execFileSync(PSQL, ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
        env: ENTORNO,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    }).trim();
    return salida === '' ? null : JSON.parse(salida);
}

// Consulta escalar (un solo valor de texto).
export function consultaEscalar(sql) {
    return execFileSync(PSQL, ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
        env: ENTORNO,
        encoding: 'utf8',
    }).trim();
}

// Abrevia los nombres de tipo de PostgreSQL para que quepan en una tabla de Word.
export function tipoCorto(t) {
    return t
        .replace('character varying', 'varchar')
        .replace('timestamp with time zone', 'timestamptz')
        .replace('time without time zone', 'time')
        .replace(/^public\./, '');
}

// Sentencia SQL que describe todas las tablas base del esquema public (columnas y restricciones).
export const SQL_COLUMNAS = `
select coalesce(json_agg(x order by x.tabla, x.pos), '[]'::json) from (
  select c.relname as tabla, a.attnum as pos, a.attname as columna,
         format_type(a.atttypid, a.atttypmod) as tipo,
         not a.attnotnull as admite_nulo,
         a.attidentity as identidad,
         pg_get_expr(d.adbin, d.adrelid) as defecto,
         col_description(c.oid, a.attnum) as comentario
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where n.nspname = 'public' and c.relkind in ('r', 'v')
) x`;

export const SQL_TABLAS = `
select coalesce(json_agg(x order by x.tabla), '[]'::json) from (
  select c.relname as tabla, c.relkind as clase, obj_description(c.oid, 'pg_class') as comentario,
         c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'v')
) x`;

export const SQL_RESTRICCIONES = `
select coalesce(json_agg(x order by x.tabla, x.tipo, x.nombre), '[]'::json) from (
  select c.conrelid::regclass::text as tabla, c.conname as nombre, c.contype as tipo,
         pg_get_constraintdef(c.oid) as definicion,
         case when c.contype = 'f' then c.confrelid::regclass::text end as tabla_destino,
         case when c.contype = 'f' then c.confdeltype::text end as al_borrar,
         (select array_agg(a.attname order by k.ord)
            from unnest(c.conkey) with ordinality k(attnum, ord)
            join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as columnas,
         case when c.contype = 'f' then
            (select array_agg(a.attname order by k.ord)
               from unnest(c.confkey) with ordinality k(attnum, ord)
               join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) end as columnas_destino
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
   where n.nspname = 'public' and c.contype in ('p', 'f', 'u', 'c')
) x`;

export const SQL_INDICES = `
select coalesce(json_agg(x order by x.tabla, x.nombre), '[]'::json) from (
  select t.relname as tabla, i.relname as nombre, ix.indisunique as unico, ix.indisprimary as primario,
         (ix.indpred is not null) as parcial,
         exists (select 1 from pg_constraint k where k.conindid = ix.indexrelid) as respalda_restriccion,
         pg_get_indexdef(ix.indexrelid) as definicion
    from pg_index ix
    join pg_class i on i.oid = ix.indexrelid
    join pg_class t on t.oid = ix.indrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
) x`;

export const SQL_TRIGGERS = `
select coalesce(json_agg(x order by x.tabla, x.nombre), '[]'::json) from (
  select c.relname as tabla, t.tgname as nombre, t.tgenabled::text as habilitado,
         pg_get_triggerdef(t.oid) as definicion
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
   where not t.tgisinternal and n.nspname = 'public'
) x`;

export const SQL_POLITICAS = `
select coalesce(json_agg(x order by x.tabla, x.nombre), '[]'::json) from (
  select tablename as tabla, policyname as nombre, cmd, roles::text as roles, permissive, qual as usando
    from pg_policies where schemaname = 'public'
) x`;

// Areas funcionales del modelo. La agrupacion es la de las cabeceras de las migraciones
// 0003 (Area A), 0005 (Area B), 0006 (Area C), 0004 (Area D) y 0235 (plantilla_foto, area C).
// El generador falla si la BD tiene una tabla que no figura aqui.
export const AREAS = [
    {
        id: 'A', nombre: 'Catálogo académico', fuente: '0003_tablas_academico.sql',
        tablas: ['alumno', 'docente', 'materia', 'aula', 'grupo', 'horario_grupo', 'inscripcion'],
    },
    {
        id: 'B', nombre: 'Operación de la clase', fuente: '0005_tablas_operacion.sql',
        tablas: ['sesion_clase', 'asistencia', 'justificante'],
    },
    {
        id: 'C', nombre: 'Captura y módulo biométrico', fuente: '0006_tablas_biometria.sql y 0235_plantilla_fotos.sql',
        tablas: ['consentimiento', 'indice_faiss', 'plantilla_facial', 'plantilla_foto', 'camara', 'captura', 'deteccion'],
    },
    {
        id: 'D', nombre: 'Seguridad y configuración', fuente: '0004_tablas_seguridad.sql',
        tablas: ['usuario', 'bitacora_auditoria', 'parametro_sistema'],
    },
];

export function areaDe(tabla) {
    return AREAS.find((a) => a.tablas.includes(tabla)) || null;
}

// Lee el esquema relacional de la especificacion (seccion 3.4.1 de Avance1.txt) y devuelve
// { TABLA: Set(columnas) } para poder comparar con la BD real.
import { readFileSync } from 'node:fs';
export function columnasDeLaSpec(rutaSpec) {
    const lineas = readFileSync(rutaSpec, 'utf8').split('\n');
    const ini = lineas.findIndex((l) => /^3\.4\.1 Esquema relacional/.test(l));
    const fin = lineas.findIndex((l, i) => i > ini && /^En USUARIO , las columnas/.test(l));
    if (ini < 0 || fin < 0) throw new Error('No se encontro la seccion 3.4.1 en la especificacion');
    const bloque = lineas.slice(ini, fin);
    const resultado = {};
    for (let i = 0; i < bloque.length; i++) {
        const m = /^\s{2}([A-Z_]+)\((.*)$/.exec(bloque[i]);
        if (!m) continue;
        let texto = m[2];
        let profundidad = 1;
        let j = i;
        const cierra = (s) => { for (const ch of s) { if (ch === '(') profundidad++; else if (ch === ')') profundidad--; } };
        cierra(texto);
        while (profundidad > 0 && j + 1 < bloque.length) {
            j++;
            texto += ' ' + bloque[j].trim();
            cierra(bloque[j]);
        }
        // Quita el ")" que cierra la lista de atributos.
        texto = texto.replace(/\)\s*(UQ:.*)?$/, '').replace(/\s+UQ:.*$/, '');
        // Divide por comas de profundidad 0.
        const items = [];
        let actual = ''; let p = 0;
        for (const ch of texto) {
            if (ch === '(') p++;
            if (ch === ')') p--;
            if (ch === ',' && p === 0) { items.push(actual); actual = ''; } else actual += ch;
        }
        if (actual.trim()) items.push(actual);
        const cols = new Set();
        for (let it of items) {
            it = it.replace(/→.*$/, '').trim();
            if (it.startsWith('(')) {
                it.replace(/[()]/g, '').split(',').forEach((c) => c.trim() && cols.add(c.trim()));
            } else if (it) cols.add(it);
        }
        resultado[m[1].toLowerCase()] = cols;
    }
    return resultado;
}
