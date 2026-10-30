// Genera resumen.md, funciones.md, migraciones.md y conteos.json a partir de la BD viva, de las migraciones y de
// pruebas-sql.txt. Todas las cifras salen de consultas que este script ejecuta (y que imprime en el documento);
// las reglas de negocio citadas se comprueban contra el catalogo y el script falla si un nombre no existe.
//
// Uso: node generar-resumen.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREAS, consultaEscalar, consultaJson } from './bd-lib.mjs';
import { PROPOSITO } from './migraciones-info.mjs';
import { COMMIT } from './cuerpo-manifiesto.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const REPO = join(AQUI, '..', '..');
const MIGRACIONES = join(REPO, 'supabase', 'migrations');
const ahora = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

const esc = (s) => String(s).replace(/\|/g, '\\|');
const num = (sql) => Number(consultaEscalar(sql));

// ------------------------------------------------------------------------------------------------
// 1. Conteos (cada uno con su consulta)
// ------------------------------------------------------------------------------------------------
const DESDE_COLS = `from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped`;
const CONSULTAS = [
    ['Esquemas (sin los del sistema)', "select count(*) from pg_namespace where nspname not like 'pg\\_%' and nspname <> 'information_schema'"],
    ['Tablas base en `public`', "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'"],
    ['Vistas en `public`', "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v'"],
    ['Tablas base en `app` (internas)', "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'app' and c.relkind = 'r'"],
    ['Columnas de las tablas de `public`', `select count(*) ${DESDE_COLS}`],
    ['Columnas NOT NULL', `select count(*) ${DESDE_COLS} and a.attnotnull`],
    ['Columnas GENERATED ALWAYS AS IDENTITY', `select count(*) ${DESDE_COLS} and a.attidentity = 'a'`],
    ['Columnas binarias o de arreglo (RNF-03)', `select count(*) ${DESDE_COLS} and exists (select 1 from pg_type t where t.oid = a.atttypid and (t.typname = 'bytea' or t.typcategory = 'A'))`],
    ['Llaves primarias', "select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'p'"],
    ['Llaves foráneas', "select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'f'"],
    ['  de ellas ON DELETE RESTRICT', "select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'f' and c.confdeltype = 'r'"],
    ['  de ellas ON DELETE CASCADE', "select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'f' and c.confdeltype = 'c'"],
    ['Restricciones UNIQUE', "select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'u'"],
    ['Restricciones CHECK', "select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'c'"],
    ['Índices en `public` (todos)', "select count(*) from pg_index i join pg_class t on t.oid = i.indrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public'"],
    ['  únicos parciales (sin restricción)', "select count(*) from pg_index i join pg_class t on t.oid = i.indrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and i.indisunique and i.indpred is not null"],
    ['  de apoyo no únicos (ix_*)', "select count(*) from pg_index i join pg_class t on t.oid = i.indrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and not i.indisunique"],
    ['Tipos ENUM', "select count(distinct t.oid) from pg_type t join pg_namespace n on n.oid = t.typnamespace join pg_enum e on e.enumtypid = t.oid where n.nspname = 'public'"],
    ['Valores en total de los ENUM', "select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'"],
    ['Funciones en `public` (RPC)', "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'"],
    ['  prefijo api_ (las llama la interfaz)', "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'api\\_%'"],
    ['  prefijo svc_ (solo service_role)', "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'svc\\_%'"],
    ['  SECURITY DEFINER', "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef"],
    ['  SECURITY INVOKER', "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and not p.prosecdef"],
    ['Funciones en `app` (lógica interna)', "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app'"],
    ['  de ellas funciones de disparador (trg_*)', "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.prorettype = 'trigger'::regtype"],
    ['Disparadores (no internos) en `public`', "select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname = 'public'"],
    ['Tablas con RLS habilitado en `public`', "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity"],
    ['Políticas RLS en `public`', "select count(*) from pg_policies where schemaname = 'public'"],
    ['Políticas en `storage` (RESTRICTIVE)', "select count(*) from pg_policies where schemaname = 'storage'"],
    ['Privilegios de `anon` sobre tablas de `public`', "select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'"],
    ['Privilegios de `authenticated` distintos de SELECT', "select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and privilege_type <> 'SELECT'"],
    ['`service_role` puede INSERT en bitacora_auditoria (0 = no)', "select has_table_privilege('service_role', 'public.bitacora_auditoria', 'INSERT')::int"],
    ['Parámetros en parametro_sistema', 'select count(*) from public.parametro_sistema'],
    ['Migraciones registradas', 'select count(*) from supabase_migrations.schema_migrations'],
];
const conteos = {};
for (const [nombre, sql] of CONSULTAS) conteos[nombre] = { sql, valor: num(sql) };
const C = (nombre) => conteos[nombre].valor;

// Filas por tabla. La base compartida puede contener filas de prueba creadas al ejercitar los formularios de
// administracion (prefijo ZZ); se cuentan aparte para que las cifras de la semilla no se contaminen.
const tablasPublic = consultaJson("select coalesce(json_agg(relname order by relname), '[]'::json) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'");
const SIN_PRUEBA = {
    alumno: "matricula not like 'ZZ%'",
    docente: "num_empleado not like 'ZZ%'",
    materia: "clave not like 'ZZ%'",
    aula: "clave not like 'ZZ%'",
    camara: "id_aula not in (select id_aula from public.aula where clave like 'ZZ%')",
    grupo: "clave_grupo not like 'ZZ%'",
    horario_grupo: "id_grupo not in (select id_grupo from public.grupo where clave_grupo like 'ZZ%')",
};
const filas = {}; // total en la base ahora
const filasSemilla = {}; // sin las filas ZZ
for (const t of tablasPublic) {
    filas[t] = num(`select count(*) from public.${t}`);
    filasSemilla[t] = SIN_PRUEBA[t] ? num(`select count(*) from public.${t} where ${SIN_PRUEBA[t]}`) : filas[t];
}
const filasPrueba = {
    alumno: consultaJson("select coalesce(json_agg(matricula), '[]'::json) from public.alumno where matricula like 'ZZ%'"),
    docente: consultaJson("select coalesce(json_agg(num_empleado), '[]'::json) from public.docente where num_empleado like 'ZZ%'"),
    materia: consultaJson("select coalesce(json_agg(clave), '[]'::json) from public.materia where clave like 'ZZ%'"),
    aula: consultaJson("select coalesce(json_agg(clave), '[]'::json) from public.aula where clave like 'ZZ%'"),
    grupo: consultaJson("select coalesce(json_agg(clave_grupo), '[]'::json) from public.grupo where clave_grupo like 'ZZ%'"),
};
const hayPrueba = Object.values(filasPrueba).some((l) => l.length) || tablasPublic.some((t) => filas[t] !== filasSemilla[t]);

// Prefijos de nombres de restricciones e indices
const prefijos = consultaJson(`
select json_object_agg(p, n) from (
  select split_part(nombre, '_', 1) as p, count(*) as n from (
    select conname as nombre from pg_constraint c join pg_namespace s on s.oid = c.connamespace where s.nspname = 'public'
    union all
    select i.relname from pg_index x join pg_class i on i.oid = x.indexrelid join pg_class t on t.oid = x.indrelid
      join pg_namespace s on s.oid = t.relnamespace where s.nspname = 'public' and not x.indisprimary
        and not exists (select 1 from pg_constraint k where k.conindid = x.indexrelid)
  ) q group by 1
) z`);

// ------------------------------------------------------------------------------------------------
// 2. Migraciones y pruebas SQL
// ------------------------------------------------------------------------------------------------
const archivosMig = readdirSync(MIGRACIONES).filter((f) => f.endsWith('.sql')).sort();
const infoMig = archivosMig.map((f) => {
    const txt = readFileSync(join(MIGRACIONES, f), 'utf8');
    return {
        archivo: f,
        lineas: txt.split('\n').length - (txt.endsWith('\n') ? 1 : 0),
        bytes: statSync(join(MIGRACIONES, f)).size,
        tablas: (txt.match(/^CREATE TABLE /gim) || []).length,
        funciones: (txt.match(/^CREATE (OR REPLACE )?FUNCTION /gim) || []).length,
        politicas: (txt.match(/^CREATE POLICY /gim) || []).length,
        disparadores: (txt.match(/^CREATE TRIGGER /gim) || []).length,
        indices: (txt.match(/^CREATE (UNIQUE )?INDEX /gim) || []).length,
        tipos: (txt.match(/^CREATE TYPE /gim) || []).length,
        texto: txt,
    };
});
const faltaProposito = archivosMig.filter((f) => !PROPOSITO[f]);
if (faltaProposito.length) throw new Error('Migraciones sin propósito en migraciones-info.mjs: ' + faltaProposito.join(', '));
const sobra = Object.keys(PROPOSITO).filter((f) => !archivosMig.includes(f));
if (sobra.length) throw new Error('migraciones-info.mjs menciona archivos inexistentes: ' + sobra.join(', '));
const totalLineasMig = infoMig.reduce((n, m) => n + m.lineas, 0);

const salidaPruebas = readFileSync(join(AQUI, 'pruebas-sql.txt'), 'utf8').split('\n');
const archivosPrueba = salidaPruebas.map((l) => /^ok\s+(\S+\.sql)\s+pos=(\d+) neg=(\d+)/.exec(l)).filter(Boolean)
    .map((m) => ({ archivo: m[1], pos: Number(m[2]), neg: Number(m[3]) }));
const resumenPruebas = /archivos=(\d+) con_fallas=(\d+) \| pruebas positivas=(\d+) negativas=(\d+) fallos=(\d+)/.exec(salidaPruebas.join('\n'));
const tiempoPruebas = /real\s+(\S+)/.exec(salidaPruebas.join('\n'));
const cabeceraPruebas = salidaPruebas[0].replace(/^# /, '');
if (!resumenPruebas) throw new Error('No se pudo leer el resumen de pruebas-sql.txt');
const [, nArchivos, nConFallas, nPos, nNeg, nFallos] = resumenPruebas.map(Number);
const sumaPos = archivosPrueba.reduce((n, a) => n + a.pos, 0);
const sumaNeg = archivosPrueba.reduce((n, a) => n + a.neg, 0);
if (archivosPrueba.length !== nArchivos || sumaPos !== nPos || sumaNeg !== nNeg) {
    throw new Error(`pruebas-sql.txt inconsistente: ${archivosPrueba.length}/${nArchivos} archivos, ${sumaPos}/${nPos} pos, ${sumaNeg}/${nNeg} neg`);
}
const gruposPrueba = {};
for (const a of archivosPrueba) {
    const g = a.archivo.replace(/_\d+.*$/, '').replace(/\.sql$/, '');
    gruposPrueba[g] ||= { archivos: 0, pos: 0, neg: 0 };
    gruposPrueba[g].archivos++; gruposPrueba[g].pos += a.pos; gruposPrueba[g].neg += a.neg;
}
const archivosTestsEnDisco = readdirSync(join(REPO, 'supabase', 'tests')).filter((f) => /\.sql$/.test(f) && !f.startsWith('_'));

// ------------------------------------------------------------------------------------------------
// 3. Reglas de negocio: mecanismo y nombres reales (se verifican contra el catalogo)
// ------------------------------------------------------------------------------------------------
const REGLAS = [
    ['RN-01', 'Solo hay asistencia en grupos con inscripción activa.',
        [['trigger', 'trg_asistencia_rn01'], ['error', 'rn01_asistencia_inscripcion_activa'], ['constraint', 'uq_inscripcion_alumno_grupo']]],
    ['RN-02', 'Un solo registro de asistencia por alumno y sesión.',
        [['constraint', 'uq_asistencia_sesion_alumno']]],
    ['RN-03', 'Presente en los primeros 10 min, retardo hasta el minuto 20 (por la primera lectura válida).',
        [['funcion', 'app.estado_por_minuto'], ['constraint', 'ck_sesion_ventana'], ['constraint', 'ck_asistencia_hora_presencia'],
            ['parametro', 'limite_presente_min'], ['parametro', 'tolerancia_min']]],
    ['RN-04', 'Una lectura se atribuye solo si su score alcanza el umbral (0.850).',
        [['parametro', 'umbral_similitud'], ['constraint', 'ck_deteccion_score'], ['constraint', 'ck_deteccion_candidato'], ['funcion', 'public.svc_registrar_detecciones']]],
    ['RN-05', 'Se confirma con al menos 3 lecturas válidas; con 1 o 2 queda pendiente.',
        [['trigger', 'trg_asistencia_ciclo'], ['error', 'rn05_asistencia_confirmacion_lecturas'], ['constraint', 'ck_asistencia_pendiente'], ['parametro', 'min_detecciones_validas']]],
    ['RN-06', 'La cámara de una captura es del aula del grupo; sin cámaras activas, pase manual.',
        [['trigger', 'trg_captura_rn06'], ['error', 'rn06_captura_camara_aula'], ['error', 'rn06_asistencia_automatico_en_sesion_manual'],
            ['constraint', 'uq_camara_aula_posicion'], ['funcion', 'public.api_abrir_sesion']]],
    ['RN-07', 'Al cerrar la sesión, los inscritos sin registro quedan ausentes.',
        [['funcion', 'app.cerrar_sesion'], ['funcion', 'public.api_cerrar_sesion'], ['funcion', 'public.svc_job_cerrar_sesiones']]],
    ['RN-08', 'Corrección hasta 48 h después de la sesión, con valor anterior y nuevo en bitácora.',
        [['funcion', 'app.limite_correccion'], ['parametro', 'horas_limite_correccion'], ['constraint', 'ck_bitacora_valores'], ['funcion', 'public.api_corregir_asistencia']]],
    ['RN-09', 'Un justificante aprobado pasa el registro a justificado sin borrarlo ni borrar sus lecturas.',
        [['constraint', 'fk_justificante_asistencia'], ['error', 'rn09_asistencia_justificado_inmutable'], ['index', 'ux_justificante_pendiente'],
            ['constraint', 'ck_justificante_resolucion'], ['funcion', 'public.api_resolver_justificante']]],
    ['RN-10', 'Tres retardos equivalen a una ausencia.',
        [['vista', 'v_resumen_asistencia'], ['parametro', 'retardos_por_ausencia']]],
    ['RN-11', 'Superar el 20 % de faltas equivalentes quita el derecho a examen.',
        [['vista', 'v_resumen_asistencia'], ['funcion', 'app.recalcular_inscripcion'], ['parametro', 'porcentaje_max_ausencias']]],
    ['RN-12', 'Una sola plantilla activa por alumno y una sola versión del índice en uso.',
        [['index', 'ux_plantilla_facial_activa'], ['index', 'ux_indice_faiss_en_uso'], ['constraint', 'uq_plantilla_indice_faiss_id'], ['constraint', 'ck_plantilla_indexada']]],
    ['RN-13', 'No hay plantilla sin consentimiento propio, vigente y en fecha.',
        [['trigger', 'trg_plantilla_rn13'], ['error', 'rn13_plantilla_consentimiento_vencido'], ['constraint', 'fk_plantilla_consent'], ['constraint', 'ck_consentimiento_vigencia']]],
    ['RNF-08', 'La bitácora de auditoría es de solo inserción.',
        [['trigger', 'trg_bitacora_sin_cambios'], ['trigger', 'trg_bitacora_sin_truncate'], ['politica', 'admin_ve_todo@bitacora_auditoria']]],
];
const existe = (tipo, nombre) => {
    switch (tipo) {
        case 'constraint': return num(`select count(*) from pg_constraint where conname = '${nombre}'`) > 0;
        case 'trigger': return num(`select count(*) from pg_trigger where tgname = '${nombre}' and not tgisinternal`) > 0;
        case 'index': return num(`select count(*) from pg_class where relkind = 'i' and relname = '${nombre}'`) > 0;
        case 'vista': return num(`select count(*) from pg_class where relkind = 'v' and relname = '${nombre}'`) > 0;
        case 'funcion': { const [e, f] = nombre.split('.'); return num(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = '${e}' and p.proname = '${f}'`) > 0; }
        case 'parametro': return num(`select count(*) from public.parametro_sistema where clave = '${nombre}'`) > 0;
        case 'error': return num(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('app', 'public') and position('${nombre}' in p.prosrc) > 0`) > 0;
        case 'politica': { const [p, t] = nombre.split('@'); return num(`select count(*) from pg_policies where policyname = '${p}' and tablename = '${t}'`) > 0; }
        default: throw new Error('tipo desconocido ' + tipo);
    }
};
const inexistentes = [];
for (const [rn, , objs] of REGLAS) for (const [tipo, nombre] of objs) if (!existe(tipo, nombre)) inexistentes.push(`${rn}: ${tipo} ${nombre}`);
if (inexistentes.length) throw new Error('Nombres citados que no existen en la BD:\n' + inexistentes.join('\n'));

// ------------------------------------------------------------------------------------------------
// 4. Diferencias con la especificacion (cifras del Avance 1: secciones 3.4.1, 3.4.3 y objetivo OE-3)
// ------------------------------------------------------------------------------------------------
const dif = JSON.parse(readFileSync(join(AQUI, 'diferencias-spec.json'), 'utf8'));
const valoresEnum = C('Valores en total de los ENUM');
const COMPARACION = [
    ['Tablas', 19, C('Tablas base en `public`'), '+ plantilla_foto (migración 0235, extensión 17)'],
    ['Atributos (columnas)', 125, C('Columnas de las tablas de `public`'),
        `+ ${dif.columnas_extra.map((e) => `${e.tabla}.${e.columna}`).join(', ')} y las 6 de plantilla_foto`],
    ['Llaves primarias', 19, C('Llaves primarias'), '+ pk_plantilla_foto'],
    ['Llaves foráneas', 25, C('Llaves foráneas'), '+ fk_plantilla_foto_plantilla'],
    ['Restricciones UNIQUE', 20, C('Restricciones UNIQUE'), '+ uq_plantilla_foto_orden'],
    ['Restricciones CHECK', 29, C('Restricciones CHECK'), '+ ck_camara_ip, ck_consentimiento_origen, ck_plantilla_origen y 3 de plantilla_foto'],
    ['Índices únicos parciales', 2, C('  únicos parciales (sin restricción)'), '+ ux_justificante_pendiente (migración 0120)'],
    ['Tipos ENUM', 13, C('Tipos ENUM'), '+ tipo_camara; accion_bitacora gana 2 valores (0239)'],
    ['Disparadores', 6, C('Disparadores (no internos) en `public`'), '+ trg_plantilla_foto_principal (0235)'],
    ['Parámetros del sistema', 11, C('Parámetros en parametro_sistema'), 'la spec dice 11 claves (RNF-02); la base tiene 12'],
];

// ------------------------------------------------------------------------------------------------
// 5. funciones.md (firmas por esquema y migración)
// ------------------------------------------------------------------------------------------------
const funcs = consultaJson(`
select coalesce(json_agg(x order by x.esquema, x.nombre, x.args), '[]'::json) from (
  select n.nspname as esquema, p.proname as nombre, pg_get_function_identity_arguments(p.oid) as args,
         pg_get_function_result(p.oid) as retorno, p.prosecdef as definer,
         case p.provolatile when 'i' then 'IMMUTABLE' when 's' then 'STABLE' else 'VOLATILE' end as volatilidad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'app')
) x`);
// Migracion que define cada funcion (la ultima que la menciona con CREATE ... FUNCTION esquema.nombre()
const definidaEn = {};
for (const m of infoMig) {
    for (const mt of m.texto.matchAll(/CREATE (?:OR REPLACE )?FUNCTION\s+(public|app)\.([a-z0-9_]+)\s*\(/gi)) {
        definidaEn[`${mt[1].toLowerCase()}.${mt[2].toLowerCase()}`] = m.archivo;
    }
}
const sinArchivo = funcs.filter((f) => !definidaEn[`${f.esquema}.${f.nombre}`]);
const F = [];
F.push('# Funciones de la base de datos de SUSAN (firmas reales)');
F.push('');
F.push(`Generado por \`generar-resumen.mjs\` desde \`pg_proc\` (${ahora}). Total: **${funcs.length}** funciones propias: **${funcs.filter((f) => f.esquema === 'public').length}** en \`public\` (RPC que expone la API) y **${funcs.filter((f) => f.esquema === 'app').length}** en \`app\` (lógica interna, no expuesta).`);
F.push('Cada firma se muestra como \`nombre(argumentos) → resultado\`; **D** = SECURITY DEFINER, **I** = SECURITY INVOKER (con RLS de quien llama). Se agrupan por la migración que las define.');
F.push('');
for (const esq of ['public', 'app']) {
    F.push(`## Esquema \`${esq}\``);
    F.push('');
    const delEsq = funcs.filter((f) => f.esquema === esq);
    const porMig = {};
    for (const f of delEsq) (porMig[definidaEn[`${esq}.${f.nombre}`] || '(sin archivo identificado)'] ||= []).push(f);
    for (const mig of Object.keys(porMig).sort()) {
        F.push(`### ${mig.replace('.sql', '')} (${porMig[mig].length})`);
        F.push('');
        if (PROPOSITO[mig]) { F.push(`_${PROPOSITO[mig]}_`); F.push(''); }
        for (const f of porMig[mig]) {
            F.push(`- \`${f.nombre}(${f.args.replace(/\s+/g, ' ')}) → ${f.retorno.replace(/\s+/g, ' ')}\` · ${f.definer ? 'D' : 'I'} · ${f.volatilidad}`);
        }
        F.push('');
    }
}
writeFileSync(join(AQUI, 'funciones.md'), F.join('\n'));

// ------------------------------------------------------------------------------------------------
// 6. migraciones.md
// ------------------------------------------------------------------------------------------------
const M = [];
M.push('# Migraciones de la base de datos de SUSAN');
M.push('');
M.push(`Carpeta \`supabase/migrations/\` del commit \`${COMMIT}\`: **${infoMig.length}** archivos, **${totalLineasMig}** líneas de SQL. Se aplican en orden lexicográfico; la base local las registra en \`supabase_migrations.schema_migrations\` (${C('Migraciones registradas')} filas, una por archivo).`);
M.push('La numeración tiene huecos (por ejemplo no existe 0134 ni 0238) porque se reparte por dominio: 0001-0099 esquema, 01xx API del docente (reportes, revisión, sesiones), 02xx API de administración y biometría (ver `supabase/README.md`). Estos son todos los archivos que existen.');
M.push('Las columnas de objetos cuentan sentencias `CREATE ...` por búsqueda de texto en el archivo; una `CREATE OR REPLACE FUNCTION` puede redefinir una función ya creada antes.');
M.push('');
M.push('| Archivo | Líneas | Tablas | Func. | Disp. | Polít. | Índ. | Propósito |');
M.push('|---|--:|--:|--:|--:|--:|--:|---|');
for (const m of infoMig) {
    M.push(`| \`${m.archivo}\` | ${m.lineas} | ${m.tablas || ''} | ${m.funciones || ''} | ${m.disparadores || ''} | ${m.politicas || ''} | ${m.indices || ''} | ${esc(PROPOSITO[m.archivo])} |`);
}
M.push(`| **Total** | **${totalLineasMig}** | **${infoMig.reduce((n, m) => n + m.tablas, 0)}** | **${infoMig.reduce((n, m) => n + m.funciones, 0)}** | **${infoMig.reduce((n, m) => n + m.disparadores, 0)}** | **${infoMig.reduce((n, m) => n + m.politicas, 0)}** | **${infoMig.reduce((n, m) => n + m.indices, 0)}** | |`);
M.push('');
M.push('Otros archivos de la carpeta `supabase/` que completan la base (no son migraciones): `local/00_supabase_stubs.sql` (emula roles, `auth` y `storage` solo en PostgreSQL local), `seed/` (semilla de demostración: catálogo, sesiones, historial, cuentas locales y recálculo) y `tests/` (pruebas SQL).');
M.push('');
writeFileSync(join(AQUI, 'migraciones.md'), M.join('\n'));

// ------------------------------------------------------------------------------------------------
// 7. resumen.md
// ------------------------------------------------------------------------------------------------
const R = [];
const filasArea = (a) => a.tablas.map((t) => `${t} (${filasSemilla[t]})`).join(', ');
R.push('# SUSAN · Base de datos: resumen verificado');
R.push('');
R.push(`Material para la sección «Esquema de base de datos y código de base de datos» del reporte de avances. Todo sale de la base viva (PostgreSQL ${consultaEscalar('show server_version').split(' ')[0]}, base \`susan\`, 43 de 43 migraciones aplicadas) y de las migraciones del commit \`${COMMIT}\` de \`origin/main\`. Generado el ${ahora} con \`generar-resumen.mjs\`; las consultas están en la tabla de la sección 1.`);
R.push('');
R.push('## 1. Cifras verificadas');
R.push('');
R.push('Consultas ejecutadas con `psql` contra el catálogo de PostgreSQL (`pg_class`, `pg_attribute`, `pg_constraint`, `pg_index`, `pg_proc`, `pg_trigger`, `pg_policies`, `pg_enum`). La columna «Consulta» es el SQL exacto que se ejecutó.');
R.push('');
R.push('| Concepto | Valor | Consulta |');
R.push('|---|--:|---|');
for (const [nombre, sql] of CONSULTAS) {
    R.push(`| ${nombre} | **${conteos[nombre].valor}** | \`${esc(sql.replace(/\s+/g, ' ').replace(/`/g, "'"))}\` |`);
}
R.push('');
R.push(`Esquemas que existen en la base local: \`app\`, \`public\`, \`extensions\` (pgcrypto y pg_trgm) y, solo en local, \`auth\`, \`storage\` y \`supabase_migrations\`, que emula \`supabase/local/00_supabase_stubs.sql\` (en Supabase real los provee la plataforma). El modelo de SUSAN vive en \`public\` y \`app\`.`);
R.push('');
R.push('Nombres de restricciones e índices por prefijo (convención del proyecto): ' + Object.entries(prefijos).sort().map(([p, n]) => `\`${p}_\` ${n}`).join(' · ') + '. Solo objetos del esquema `public`; los índices que respaldan una restricción (PK, UNIQUE) se cuentan como la restricción.');
R.push('');
R.push('### Datos de demostración cargados en la base de esta verificación');
R.push('');
R.push('Tras la semilla y `seed-demo.sh --reset` (datos ficticios `@susan.local`; no son datos reales). La columna «Semilla» excluye las filas de prueba con prefijo `ZZ`; «Ahora» es el total que tiene la base en el momento de generar este documento.');
R.push('');
R.push('| Tabla | Semilla | Ahora | Tabla | Semilla | Ahora |');
R.push('|---|--:|--:|---|--:|--:|');
const ft = Object.keys(filas);
const celda = (t) => (t ? `\`${t}\` | ${filasSemilla[t]} | ${filas[t]}` : ' | | ');
for (let i = 0; i < ft.length; i += 2) R.push(`| ${celda(ft[i])} | ${celda(ft[i + 1])} |`);
R.push('');
if (hayPrueba) {
    const lista = Object.entries(filasPrueba).filter(([, l]) => l.length).map(([t, l]) => `${t} ${l.map((x) => `\`${x}\``).join(', ')}`).join('; ');
    R.push(`**Aviso:** la base compartida contiene filas de prueba con prefijo ZZ (${lista}; además una cámara y 3 bloques de horario del grupo de prueba). No pertenecen a la semilla; parecen haberse creado desde los formularios de administración mientras se preparaba este reporte (no se verificó quién las creó) y no se borraron. Las cifras de esquema (tablas, columnas, restricciones, funciones) no dependen de las filas.`);
    R.push('');
}
R.push('## 2. Cómo está organizada la base');
R.push('');
R.push('**Dos esquemas propios.** `public` guarda las tablas y las funciones que la aplicación puede llamar (`api_*` para la interfaz, `svc_*` solo para el servicio de reconocimiento y los trabajos programados). `app` guarda la lógica interna (reloj único, identidad y rol del usuario, funciones de disparador, núcleos de las RPC) y no se expone por la API. Por regla del proyecto (`CLAUDE.md`), la interfaz no consulta tablas: usa las RPC.');
R.push('');
R.push(`**Cuatro áreas funcionales** (las mismas de la especificación, con una tabla más en el área C):`);
R.push('');
R.push('| Área | Qué guarda | Tablas (filas de la semilla) |');
R.push('|---|---|---|');
const QUE = {
    A: 'Quién, qué, dónde y cuándo se enseña: personas, materias, aulas, grupos, horarios e inscripciones.',
    B: 'Lo que ocurre en cada clase: la sesión, el registro de asistencia por alumno y los justificantes.',
    C: 'Consentimiento, plantillas faciales (y sus fotos), versiones del índice FAISS, cámaras, capturas y detecciones. No hay vectores ni imágenes: solo rutas y números.',
    D: 'Cuentas de acceso (ligadas a Supabase Auth), parámetros calibrables y bitácora de auditoría.',
};
for (const a of AREAS) R.push(`| ${a.id} · ${a.nombre} | ${QUE[a.id]} | ${filasArea(a)} |`);
R.push('');
R.push('**El eje del modelo** es `asistencia`: una fila por alumno y sesión (`uq_asistencia_sesion_alumno`). Se llega a ella desde `inscripcion` (alumno en grupo), `sesion_clase` (una clase concreta generada del `horario_grupo`) y, en el caso automático, desde `captura` y `deteccion` (lo que vio la cámara). `justificante` se cuelga de la asistencia con una llave compuesta (`fk_justificante_asistencia`), de modo que solo se justifica un registro que existe. `v_resumen_asistencia` es una vista, no una tabla: calcula faltas equivalentes y porcentaje en cada consulta.');
R.push('');
R.push(`**La lógica de negocio vive en PostgreSQL.** Hay ${C('Funciones en `public` (RPC)')} funciones en \`public\` (${C('  prefijo api_ (las llama la interfaz)')} \`api_*\` y ${C('  prefijo svc_ (solo service_role)')} \`svc_*\`), ${C('Funciones en `app` (lógica interna)')} en \`app\` y ${C('Disparadores (no internos) en `public`')} disparadores. Las RPC de escritura son \`SECURITY DEFINER\` y comprueban rol y pertenencia al principio (\`app.exigir_rol\`); la mayoría de las lecturas son \`SECURITY INVOKER\` y dejan que la RLS decida qué filas ve cada quien (algunas lecturas agregadas son DEFINER con comprobación explícita de rol). Las funciones que escriben en \`bitacora_auditoria\` lo hacen con \`app.bitacora()\`: cierres de sesión, correcciones, aprobación o rechazo de justificantes, consultas auditadas, cambios de parámetro y altas o revocaciones de consentimiento.`);
R.push('');
R.push(`**Seguridad por diseño.** Las ${C('Tablas con RLS habilitado en `public`')} tablas de \`public\` tienen RLS (${C('Políticas RLS en `public`')} políticas, todas \`SELECT\` para el rol \`authenticated\`). \`anon\` no tiene ningún privilegio sobre las tablas (${C('Privilegios de `anon` sobre tablas de `public`')} concesiones); \`authenticated\` solo tiene SELECT (${C('Privilegios de `authenticated` distintos de SELECT')} concesiones de otro tipo; toda escritura pasa por RPC); \`service_role\` es la cuenta de los servicios y tampoco puede escribir en la bitácora (INSERT = ${C('`service_role` puede INSERT en bitacora_auditoria (0 = no)')}). Por RNF-03 no hay columnas binarias ni de arreglo (${C('Columnas binarias o de arreglo (RNF-03)')} en las ${C('Columnas de las tablas de `public`')} columnas); la biometría se limita a \`faiss_id\` y rutas \`objeto_*\`.`);
R.push('');
R.push('**Bajas lógicas y evidencia protegida.** Todas las llaves foráneas son `ON DELETE RESTRICT` salvo `fk_horario_grupo` (CASCADE: el horario es parte de la definición del grupo). No se borra en cascada ninguna evidencia (captura, detección, asistencia, justificante, bitácora).');
R.push('');
R.push('**Reloj único.** Toda la lógica usa `app.now()` y no `now()` directamente; así las pruebas y la demostración pueden fijar la hora (solo en bases locales o de demostración).');
R.push('');
R.push('## 3. Reglas de negocio que aplica la base');
R.push('');
R.push('Cada nombre de la tabla se comprobó contra el catálogo de la base viva (el script falla si alguno no existe). Los rechazos de los disparadores empiezan con el nombre de la regla y devuelven `ERRCODE 23514` con `CONSTRAINT = <regla>`, igual que un CHECK; la bitácora usa `23000`.');
R.push('');
R.push('| Regla | Qué exige | Mecanismo real en la base (nombres del catálogo) |');
R.push('|---|---|---|');
const ROT = { constraint: 'restricción', trigger: 'disparador', index: 'índice', vista: 'vista', funcion: 'función', parametro: 'parámetro', error: 'error', politica: 'política' };
for (const [rn, texto, objs] of REGLAS) {
    R.push(`| ${rn} | ${esc(texto)} | ${objs.map(([t, n]) => `${ROT[t]} \`${n}\``).join('; ')} |`);
}
R.push('');
R.push('Notas: (a) los parámetros (`umbral_similitud`, `limite_presente_min`, etc.) están en `parametro_sistema` y no en el código; la sesión copia `tolerancia_min`, `limite_presente_min` e `intervalo_muestreo_seg` al programarse, de modo que un ajuste posterior no altera las sesiones ya registradas. (b) La especificación (3.4.3) deja las reglas que dependen de la hora o del usuario autenticado (apertura en horario RN-06, plazo de 48 h RN-08) a la capa de servicios; en la base viven dentro de funciones (`api_abrir_sesion`, `app.limite_correccion`), no como CHECK.');
R.push('');
R.push('## 4. Diferencias frente a la especificación (Avance 1)');
R.push('');
R.push('La especificación (`docs/spec/Avance1.txt`) describe **19 tablas**. La base actual tiene **' + C('Tablas base en `public`') + '**, más una vista. Cifras de la spec tomadas de sus secciones 3.4.1 (esquema relacional, que este material parseó y comparó columna por columna), 3.4.3 y OE-3; cifras actuales, de la base viva.');
R.push('');
R.push('| Elemento | Spec (Avance 1) | Base actual | Qué cambió |');
R.push('|---|--:|--:|---|');
for (const [e, s, a, q] of COMPARACION) R.push(`| ${e} | ${s} | **${a}** | ${esc(q)} |`);
R.push('');
R.push(`Comparación columna por columna (spec 3.4.1 contra la base): ${dif.totales.tablas_spec} tablas y ${dif.totales.columnas_spec} columnas en la spec; **${dif.columnas_faltantes.length}** columnas de la spec faltan en la base; **${dif.columnas_extra.length}** columnas existen en tablas de la spec sin figurar en ella (${dif.columnas_extra.map((e) => `\`${e.tabla}.${e.columna}\``).join(', ')}); y **${dif.tablas_fuera_de_la_spec.length}** tabla nueva (\`plantilla_foto\`, ${dif.tablas_fuera_de_la_spec[0].columnas} columnas).`);
R.push('');
R.push('Otras diferencias que se verificaron en la base:');
R.push('');
R.push('- `plantilla_facial.objeto_foto` y `plantilla_foto.objeto_foto` admiten nulo (migración 0237, extensión 18): cuando el vector ya vive en el índice FAISS en uso, la foto de registro se descarta. En la spec era NOT NULL.');
R.push('- `ck_bitacora_entidad` enumera 18 entidades auditables (las de la spec); `plantilla_foto` no está en esa lista.');
R.push('- `accion_bitacora` tiene 10 valores: los 8 de la spec más `alta_consentimiento` y `revocacion_consentimiento` (0239). `estatus_sesion` incluye `suspendida`, valor que agrega una extensión documentada (0002) y que se excluye del denominador de RN-11.');
R.push('- `camara.tipo` (`ip` o `navegador`) y `ck_camara_ip`: permiten que la cámara sea la webcam del navegador del docente; la dirección IP solo es obligatoria para el tipo `ip`.');
R.push('- La spec contaba 6 disparadores y 16 pruebas positivas y 46 negativas; la base actual tiene 7 disparadores y el conjunto de pruebas SQL de la sección 5.');
R.push('');
R.push('## 5. Pruebas SQL');
R.push('');
R.push(`Salida de \`scripts/test-sql.sh\` (conservada en \`pruebas-sql.txt\`): ${cabeceraPruebas}`);
R.push('');
R.push(`**${nArchivos} archivos, ${nConFallas} con fallas; ${nPos} pruebas positivas y ${nNeg} negativas; ${nFallos} fallos** (${tiempoPruebas ? tiempoPruebas[1] : 's/d'} de ejecución). Las pruebas positivas comprueban que lo permitido funciona; las negativas, que la base rechaza lo prohibido con la restricción o el código de error esperado. El script crea una base temporal, aplica stubs, migraciones y fixtures, y la elimina al terminar.`);
R.push('');
R.push('| Grupo de archivos | Archivos | Positivas | Negativas |');
R.push('|---|--:|--:|--:|');
for (const [g, v] of Object.entries(gruposPrueba)) R.push(`| \`${g}\` | ${v.archivos} | ${v.pos} | ${v.neg} |`);
R.push(`| **Total** | **${nArchivos}** | **${nPos}** | **${nNeg}** |`);
R.push('');
R.push(`Los archivos de \`supabase/tests/\` que no empiezan con guion bajo son ${archivosTestsEnDisco.length}, los mismos ${nArchivos} de la salida${archivosTestsEnDisco.length === nArchivos ? '' : ' (REVISAR: no coinciden)'}. Los grupos son: \`schema_*\` (estructura, restricciones, disparadores, RLS, ayudantes, Storage), \`api_a_*\` (sesiones), \`api_b1/b2/b3_*\` (administración, biometría, autoservicio), \`api_c_*\` (recálculo, revisión, reportes) y \`review_sql_*\` (IDOR, reglas, límites de la spec, auditoría, abuso).`);
R.push('');
R.push('## 6. Archivos de este material');
R.push('');
R.push('`diccionario.md` (diccionario de datos por tabla, generado), `er-general.png`, `er-a-academico.png`, `er-b-operacion.png`, `er-c-biometria.png`, `er-d-seguridad.png` (+ `.svg`), `codigo-cuerpo.sql` (extractos verificados), `codigo-anexo.sql` (DDL completo con pg_dump), `migraciones.md`, `funciones.md` (firmas de las ' + funcs.length + ' funciones) y los scripts que los generan.');
R.push('');
R.push('Para regenerar todo (requiere la base local en `127.0.0.1:54329`, usuario `postgres`, base `susan`): `node generar-diccionario.mjs && node generar-er.mjs && node generar-cuerpo.mjs && node verificar-cuerpo.mjs && node verificar-contra-bd.mjs && node generar-anexo.mjs && node generar-resumen.mjs`. `verificacion.txt` guarda la salida de las dos verificaciones del código.');
R.push('');
writeFileSync(join(AQUI, 'resumen.md'), R.join('\n'));

writeFileSync(join(AQUI, 'conteos.json'), JSON.stringify({
    generado: ahora, commit: COMMIT, conteos, filas_por_tabla_ahora: filas, filas_por_tabla_semilla: filasSemilla, filas_de_prueba: filasPrueba, prefijos, migraciones: infoMig.length, lineas_migraciones: totalLineasMig,
    pruebas: { archivos: nArchivos, positivas: nPos, negativas: nNeg, fallos: nFallos }, funciones_sin_archivo: sinArchivo.map((f) => `${f.esquema}.${f.nombre}`),
}, null, 2) + '\n');

console.log(`resumen.md ${R.length} líneas · funciones.md ${F.length} · migraciones.md ${M.length}`);
console.log('Funciones sin archivo identificado:', sinArchivo.length);
