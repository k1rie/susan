import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as admin from './admin.js';
import * as biometria from './biometria.js';
import * as errores from './errors.js';
import * as plataforma from './plataforma.js';
import * as reportes from './reportes.js';
import * as revision from './revision.js';
import * as sesiones from './sesiones.js';

const catalogo = fs.readFileSync(path.resolve(import.meta.dirname, '../../../../docs/API-RPC.md'), 'utf8');
const camel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const modulos = [plataforma, sesiones, revision, reportes, admin, biometria];

const apis = [...catalogo.matchAll(/^### `(api_[a-z0-9_]+)\(/gm)].map((m) => m[1]);

describe('sincronia con docs/API-RPC.md', () => {
    it('el catalogo tiene las 76 api_* (72 + las 4 api_mi_* del autoservicio)', () => expect(apis.length).toBe(76));

    it.each(apis)('%s tiene envoltorio exportado', (nombre) => {
        const fn = camel(nombre.replace(/^api_/, ''));
        const dueños = modulos.filter((m) => typeof m[fn] === 'function');
        expect(dueños.length, `falta o esta duplicado ${fn}`).toBe(1);
    });

    it('cada envoltorio llama a su RPC (el nombre SQL aparece en el codigo)', () => {
        const fuente = ['plataforma', 'sesiones', 'revision', 'reportes', 'admin', 'biometria']
            .map((n) => fs.readFileSync(path.resolve(import.meta.dirname, `${n}.js`), 'utf8')).join('\n');
        for (const nombre of apis) expect(fuente).toContain(`callRpc('${nombre}'`);
    });

    it('todo codigo del registro y de las lineas Errores tiene status explicito', () => {
        const registro = [...catalogo.split('## Registro de códigos')[1].matchAll(/^\| `([A-Z0-9_]+)` \|/gm)].map((m) => m[1]);
        expect(registro.length).toBeGreaterThanOrEqual(54);
        const enErrores = catalogo.split('\n').filter((l) => l.startsWith('- **Errores:**'))
            .flatMap((l) => l.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b(?:VALIDACION|DUPLICADO)\b/g) ?? []);
        for (const codigo of new Set([...registro, ...enErrores])) {
            expect(errores.STATUS_POR_CODIGO[codigo], codigo).toBeTypeOf('number');
        }
    });
});
