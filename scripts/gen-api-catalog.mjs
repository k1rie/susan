#!/usr/bin/env node
// Genera docs/API-RPC.md a partir de la BD local (pg_proc + COMMENT ON FUNCTION).
// El SQL es la fuente de verdad del contrato de RPC (docs/ARCHITECTURE.md §7).
//
// Uso:  node scripts/gen-api-catalog.mjs            (BD: LOCAL_DATABASE_URL o postgres://127.0.0.1:54329/susan)
//       node scripts/gen-api-catalog.mjs --check    (falla si el archivo generado difiere del actual)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'web', 'package.json'));
const { Client } = require('pg');

const OUT = path.join(ROOT, 'docs', 'API-RPC.md');
const URL = process.env.LOCAL_DATABASE_URL || 'postgres://127.0.0.1:54329/susan';

const SQL = `
SELECT n.nspname AS esquema,
       p.proname AS nombre,
       pg_get_function_identity_arguments(p.oid) AS args_identidad,
       pg_get_function_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS retorno,
       p.prosecdef AS definer,
       p.provolatile AS volatilidad,
       p.proretset AS es_set,
       obj_description(p.oid, 'pg_proc') AS comentario,
       p.prosrc AS fuente,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE (n.nspname = 'public' AND (p.proname LIKE 'api\\_%' OR p.proname LIKE 'svc\\_%'))
 ORDER BY p.proname, p.oid`;

const VOL = { i: 'IMMUTABLE', s: 'STABLE', v: 'VOLATILE' };

function parseComentario(c) {
    const out = { desc: '', args: '', returns: '', errores: '', roles: '' };
    if (!c) return out;
    const lines = c.trim().split('\n');
    out.desc = lines[0] || '';
    let cur = null;
    for (const raw of lines.slice(1)) {
        const m = raw.match(/^(ARGS|RETURNS|ERRORES|ROLES):\s*(.*)$/);
        if (m) {
            cur = m[1].toLowerCase();
            out[cur] = m[2];
        } else if (cur) {
            out[cur] += '\n' + raw;
        }
    }
    for (const k of Object.keys(out)) out[k] = out[k].trim();
    return out;
}

const client = new Client({ connectionString: URL });
await client.connect();
const { rows } = await client.query(SQL);
await client.end();

const codigos = new Map(); // CODIGO -> { funciones:Set, mensaje }
for (const r of rows) {
    for (const m of (r.fuente || '').matchAll(/fallar\(\s*'([A-Z0-9_]+)'\s*,\s*(?:format\(\s*)?'((?:[^']|'')*)'/g)) {
        const e = codigos.get(m[1]) || { funciones: new Set(), mensaje: m[2].replace(/''/g, "'") };
        e.funciones.add(r.nombre);
        codigos.set(m[1], e);
    }
}

const fmtFn = (r) => {
    const c = parseComentario(r.comentario);
    const rol = r.nombre.startsWith('svc_') ? 'service_role' : (r.authenticated ? 'authenticated' : '—');
    const modo = `${r.definer ? 'DEFINER' : 'INVOKER'} ${VOL[r.volatilidad] || ''}`;
    return [
        `### \`${r.nombre}(${r.args})\``,
        '',
        `${c.desc || '_Sin descripción_'}`,
        '',
        `- **Retorna:** \`${r.retorno}\`${r.es_set ? ' (setof)' : ''}`,
        `- **Ejecuta:** ${rol} · ${modo}`,
        c.roles ? `- **Roles:** ${c.roles}` : null,
        c.args ? `- **Argumentos:** ${c.args.replace(/\n/g, ' ')}` : null,
        c.returns ? `- **Forma JSON:** ${c.returns.replace(/\n/g, ' ')}` : null,
        c.errores ? `- **Errores:** ${c.errores.replace(/\n/g, ' ')}` : null,
        '',
    ].filter((x) => x !== null).join('\n');
};

const api = rows.filter((r) => r.nombre.startsWith('api_'));
const svc = rows.filter((r) => r.nombre.startsWith('svc_'));

let md = `# Catálogo de RPC de SUSAN (generado)

> **No editar a mano.** Generado por \`node scripts/gen-api-catalog.mjs\` desde \`pg_proc\` y \`COMMENT ON FUNCTION\` de la BD local.
> El SQL es la fuente de verdad (docs/ARCHITECTURE.md §7). Convenciones: \`api_*\` → \`authenticated\`; \`svc_*\` → \`service_role\`.
> En la capa de datos web: \`api_docente_panel\` → \`docentePanel()\`, argumentos sin el prefijo \`p_\` y en camelCase.

- Funciones \`api_*\`: **${api.length}** · Funciones \`svc_*\`: **${svc.length}** · Códigos de error propios: **${codigos.size}**

## Índice

| Función | Argumentos | Retorna | Ejecuta | Modo |
|---|---|---|---|---|
${rows.map((r) => `| \`${r.nombre}\` | ${r.args ? '`' + r.args.replace(/\|/g, '\\|') + '`' : '—'} | \`${r.retorno.replace(/\|/g, '\\|')}\` | ${r.nombre.startsWith('svc_') ? 'service_role' : (r.authenticated ? 'authenticated' : '—')} | ${r.definer ? 'DEFINER' : 'INVOKER'} |`).join('\n')}

## Funciones api_* (usuario autenticado)

${api.map(fmtFn).join('\n')}

## Funciones svc_* (solo servidor, service_role)

${svc.map(fmtFn).join('\n')}

## Registro de códigos de error (\`app.fallar\`)

Se devuelven como \`RAISE EXCEPTION ... USING ERRCODE='P0001', HINT='<CODIGO>'\`. Además, los triggers rechazan con \`23514\` y
\`CONSTRAINT = rn*_…\` y la bitácora con \`23000\` (ver docs/ARCHITECTURE.md §12).

| Código | Mensaje base | Funciones |
|---|---|---|
${[...codigos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `| \`${k}\` | ${v.mensaje.replace(/\|/g, '\\|')} | ${[...v.funciones].sort().map((f) => '`' + f + '`').join(', ')} |`).join('\n')}
`;

if (process.argv.includes('--check')) {
    const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (cur !== md) {
        console.error('docs/API-RPC.md está desactualizado: ejecuta node scripts/gen-api-catalog.mjs');
        process.exit(1);
    }
    console.log('docs/API-RPC.md al día');
} else {
    writeFileSync(OUT, md);
    console.log(`docs/API-RPC.md: ${api.length} api_*, ${svc.length} svc_*, ${codigos.size} códigos de error`);
}
