import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));

import { getAdminBackend, getServerBackend } from '@/lib/backend';
import { MAX_ARCHIVO_BYTES, reiniciarCacheVigencia } from '@/lib/server/storage';
import { BYTES_JPEG, BYTES_PDF, BYTES_PNG, YO, archivo, conParams, crearBackend, errorDeNegocio, pedir } from '@/lib/server/testing';
import { GET as getDetecciones } from './casos/[id]/detecciones/route.js';
import { POST as postDocumento } from './justificantes/documento/route.js';
import { GET as getDocumento } from './justificantes/[id]/documento/route.js';

const CASO = {
    id_usuario: 7,
    vigencia_url_firmada_seg: 900, // un parámetro mal configurado: el tope duro de 300 s manda
    asistencia: { estado: 'pendiente', origen: 'automatico', hora_registro: '2026-09-14T07:04:55-06:00', conteo_detecciones: 2 },
    alumno: { id_alumno: 41, matricula: 'A230417', nombre_completo: 'Hernández Ruiz, Mariana' },
    sesion: { id_sesion: 188, fecha: '2026-09-14' },
    objeto_foto_registro: 'registro/41/0f8e1c2a-aaaa-4bbb-8ccc-123456789abc.jpg',
    total: 2,
    lecturas: [
        { id_deteccion: 90017, id_captura: 4101, marca_tiempo: 't', minuto_sesion: 4.9, camara_posicion: 'frente', score_similitud: 0.912, es_valida: true, tiene_recorte: true, objeto_recorte: 'recortes/188/4101/2.jpg' },
        { id_deteccion: 90188, id_captura: 4115, marca_tiempo: 't', minuto_sesion: 5.4, camara_posicion: 'frente', score_similitud: 0.801, es_valida: false, tiene_recorte: false, objeto_recorte: null },
    ],
};

let eventos;
let usuario;
let admin;

function preparar({ usuarioRpcs = {}, adminRpcs = {}, storage = {}, me = YO.docente } = {}) {
    eventos = [];
    usuario = crearBackend({
        rpcs: {
            api_yo: () => me,
            api_detecciones_caso: () => { eventos.push('api_detecciones_caso'); return CASO; },
            api_justificante_documento: () => { eventos.push('api_justificante_documento'); return { id_usuario: 7, vigencia_url_firmada_seg: 300, id_justificante: 15, id_asistencia: 345, objeto_documento: 'justificantes/44/5b3c0a9e-72d4-4f1b-9c1e-0d2f6a8b4e11.pdf' }; },
            api_validar_justificante: () => ({ id_sesion: 188, id_alumno: 44, id_asistencia: 345, estado: 'ausente' }),
            ...usuarioRpcs,
        },
    });
    admin = crearBackend({
        rpcs: { svc_registrar_consulta_revision: () => { eventos.push('bitacora'); return 991; }, ...adminRpcs },
        storage: {
            createSignedUrl: vi.fn(async (ruta, seg) => { eventos.push('firmar'); return { data: { signedUrl: `https://f.test/opaca/${eventos.length}?s=${seg}` }, error: null }; }),
            upload: vi.fn(async () => { eventos.push('subir'); return { error: null }; }),
            ...storage,
        },
    });
    getServerBackend.mockResolvedValue(usuario);
    getAdminBackend.mockResolvedValue(admin);
}

beforeEach(() => {
    reiniciarCacheVigencia();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    preparar();
});

const ver = (url = '/api/casos/345/detecciones', headers = { 'x-forwarded-for': '203.0.113.9' }) => getDetecciones(pedir(url, { method: 'GET', headers }), conParams({ id: '345' }));

describe('GET /api/casos/{id}/detecciones', () => {
    it('la bitácora se asienta ANTES de firmar y con la IP de origen', async () => {
        const res = await ver();
        expect(res.status).toBe(200);
        expect(eventos[0]).toBe('api_detecciones_caso');
        expect(eventos[1]).toBe('bitacora');
        expect(eventos.slice(2).every((e) => e === 'firmar')).toBe(true);
        expect(eventos.filter((e) => e === 'firmar')).toHaveLength(2); // foto de registro + 1 recorte
        const args = admin.rpc.mock.calls.find(([n]) => n === 'svc_registrar_consulta_revision')[1];
        expect(args).toEqual({
            p_id_usuario: 7, p_entidad: 'asistencia', p_id_registro: 345, p_ip: '203.0.113.9',
            p_detalle: { ids_deteccion: [90017, 90188], recortes: 1, foto_registro: true },
        });
    });

    it('si la bitácora falla NO se devuelve ninguna URL y no se firma nada (falla cerrado, 503)', async () => {
        preparar({ adminRpcs: { svc_registrar_consulta_revision: () => ({ __error: { code: 'XX000', message: 'caída', hint: null, details: null } }) } });
        const res = await ver();
        const texto = await res.text();
        expect(res.status).toBe(503);
        expect(JSON.parse(texto).error.code).toBe('BITACORA_NO_DISPONIBLE');
        expect(admin.bucket.createSignedUrl).not.toHaveBeenCalled();
        expect(texto).not.toMatch(/https?:|recortes\/|registro\//);
    });

    it('si la RPC de lecturas falla (ajeno/no existe) no se asienta ni se firma nada', async () => {
        preparar({ usuarioRpcs: { api_detecciones_caso: () => errorDeNegocio('NO_ENCONTRADO', 'El caso no existe.') } });
        const res = await ver();
        expect(res.status).toBe(404);
        expect(admin.rpc).not.toHaveBeenCalled();
        expect(admin.bucket.createSignedUrl).not.toHaveBeenCalled();
    });

    it('el TTL de las URL firmadas nunca supera 300 s', async () => {
        await ver();
        const ttls = admin.bucket.createSignedUrl.mock.calls.map(([, seg]) => seg);
        expect(ttls.length).toBeGreaterThan(0);
        expect(Math.max(...ttls)).toBeLessThanOrEqual(300);
        const cuerpo = await (await ver()).json();
        expect(cuerpo.vigencia_seg).toBeLessThanOrEqual(300);
    });

    it('no reenvía rutas objeto_*; marca recorte_disponible y devuelve url/expira_en', async () => {
        const cuerpo = await (await ver()).json();
        expect(JSON.stringify(cuerpo)).not.toMatch(/objeto_|recortes\/188|registro\/41\/0f8e/);
        expect(cuerpo.foto_registro.url).toMatch(/^https:\/\/f\.test\//);
        expect(cuerpo.lecturas[0]).toMatchObject({ id_deteccion: 90017, recorte_disponible: true });
        expect(cuerpo.lecturas[0].recorte.url).toMatch(/^https:\/\/f\.test\/opaca\//);
        expect(cuerpo.lecturas[1]).toMatchObject({ recorte_disponible: false, recorte: null });
        expect(cuerpo.alumno.matricula).toBe('A230417');
    });

    it('una firma individual que falla no aborta la respuesta (url null + error)', async () => {
        preparar({ storage: { createSignedUrl: vi.fn(async (r) => (r.startsWith('recortes') ? { data: null, error: { message: 'x' } } : { data: { signedUrl: 'https://f.test/ok' }, error: null })) } });
        const cuerpo = await (await ver()).json();
        expect(cuerpo.lecturas[0].recorte).toEqual({ url: null, expira_en: null, error: true });
        expect(cuerpo.foto_registro.url).toBe('https://f.test/ok');
    });

    it('sin plantilla: foto_registro null y no se firma foto', async () => {
        preparar({ usuarioRpcs: { api_detecciones_caso: () => ({ ...CASO, objeto_foto_registro: null }) } });
        const cuerpo = await (await ver()).json();
        expect(cuerpo.foto_registro).toBeNull();
        expect(admin.bucket.createSignedUrl).toHaveBeenCalledTimes(1);
    });

    it('valida la query (limit <= 100) y solo permite al docente', async () => {
        expect((await ver('/api/casos/345/detecciones?limit=101')).status).toBe(422);
        expect((await ver('/api/casos/345/detecciones?solo_validas=tal')).status).toBe(422);
        const ok = await ver('/api/casos/345/detecciones?solo_validas=true&limit=10&offset=5');
        expect(ok.status).toBe(200);
        expect(usuario.rpc.mock.calls.find(([n]) => n === 'api_detecciones_caso')[1]).toEqual({ p_id_asistencia: 345, p_solo_validas: true, p_limit: 10, p_offset: 5 });
        preparar({ me: YO.alumno });
        expect((await ver()).status).toBe(403);
    });
});

describe('GET /api/justificantes/{id}/documento', () => {
    const pedirDoc = () => getDocumento(pedir('/api/justificantes/15/documento', { method: 'GET', headers: { 'x-real-ip': '198.51.100.2' } }), conParams({ id: '15' }));

    it('asienta la consulta (entidad justificante) antes de firmar y devuelve el tipo sin la ruta', async () => {
        const res = await pedirDoc();
        const cuerpo = await res.json();
        expect(res.status).toBe(200);
        expect(eventos).toEqual(['api_justificante_documento', 'bitacora', 'firmar']);
        expect(admin.rpc.mock.calls.find(([n]) => n === 'svc_registrar_consulta_revision')[1]).toMatchObject({
            p_entidad: 'justificante', p_id_registro: 15, p_ip: '198.51.100.2', p_detalle: { id_asistencia: 345 },
        });
        expect(cuerpo).toMatchObject({ id_justificante: 15, tipo: 'pdf', vigencia_seg: 300 });
        expect(JSON.stringify(cuerpo)).not.toContain('justificantes/44');
        expect(admin.bucket.createSignedUrl.mock.calls[0][1]).toBeLessThanOrEqual(300);
    });

    it('si la bitácora falla: 503 sin URL', async () => {
        preparar({ adminRpcs: { svc_registrar_consulta_revision: () => ({ __error: { code: 'XX000', message: 'x', hint: null, details: null } }) } });
        const res = await pedirDoc();
        expect(res.status).toBe(503);
        expect(admin.bucket.createSignedUrl).not.toHaveBeenCalled();
    });

    it('si Storage no firma: 502 ALMACENAMIENTO_NO_DISPONIBLE', async () => {
        preparar({ storage: { createSignedUrl: vi.fn(async () => ({ data: null, error: { message: 'x' } })) } });
        const res = await pedirDoc();
        expect(res.status).toBe(502);
        expect((await res.json()).error.code).toBe('ALMACENAMIENTO_NO_DISPONIBLE');
    });
});

describe('POST /api/justificantes/documento (subidas)', () => {
    const subir = (form) => postDocumento(pedir('/api/justificantes/documento', { form }));
    const valido = (extra = {}) => ({ archivo: archivo(BYTES_PDF, 'application/pdf', 'mi justificante.pdf'), id_sesion: '188', ...extra });

    it('docente: valida con la RPC, construye la ruta en servidor y responde 201', async () => {
        preparar({ me: YO.docente });
        const res = await subir(valido({ id_alumno: '44' }));
        const cuerpo = await res.json();
        expect(res.status).toBe(201);
        expect(cuerpo).toMatchObject({ tipo: 'pdf', bytes: BYTES_PDF.length, id_alumno: 44 });
        expect(cuerpo.objeto_documento).toMatch(/^justificantes\/44\/[0-9a-f-]{36}\.pdf$/);
        expect(usuario.rpc.mock.calls.find(([n]) => n === 'api_validar_justificante')[1]).toEqual({ p_id_sesion: 188, p_id_alumno: 44 });
        const [ruta, , opts] = admin.bucket.upload.mock.calls[0];
        expect(ruta).toBe(cuerpo.objeto_documento);
        expect(opts).toEqual({ contentType: 'application/pdf', upsert: false });
    });

    it('la ruta NO depende del nombre del archivo ni de campos del cliente; la extensión sale del tipo detectado', async () => {
        preparar({ me: YO.alumno });
        const res = await subir({
            archivo: archivo(BYTES_PNG, 'image/png', '../../etc/passwd.pdf'), id_sesion: '188',
        });
        const cuerpo = await res.json();
        expect(res.status).toBe(201);
        expect(cuerpo.objeto_documento).toMatch(/^justificantes\/44\/[0-9a-f-]{36}\.png$/);
        expect(cuerpo.objeto_documento).not.toMatch(/passwd|\.\./);
    });

    it('alumno: la RPC recibe NULL (el cliente nunca decide id_alumno) y otro id da 403', async () => {
        preparar({ me: YO.alumno });
        await subir(valido());
        expect(usuario.rpc.mock.calls.find(([n]) => n === 'api_validar_justificante')[1]).toEqual({ p_id_sesion: 188, p_id_alumno: null });
        const ajeno = await subir(valido({ id_alumno: '999' }));
        expect(ajeno.status).toBe(403);
    });

    it('docente sin id_alumno -> 422', async () => {
        preparar({ me: YO.docente });
        expect((await subir(valido())).status).toBe(422);
    });

    it('firma binaria falsa: 422 ARCHIVO_INVALIDO y NO se sube nada', async () => {
        preparar({ me: YO.alumno });
        const res = await subir({ archivo: archivo(new TextEncoder().encode('MZ\x90 ejecutable'), 'application/pdf', 'x.pdf'), id_sesion: '188' });
        expect(res.status).toBe(422);
        expect((await res.json()).error.code).toBe('ARCHIVO_INVALIDO');
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('tipo no permitido: 415; más de 5 MiB: 413; sin archivo: 422', async () => {
        preparar({ me: YO.alumno });
        expect((await subir({ archivo: archivo(BYTES_JPEG, 'image/gif'), id_sesion: '188' })).status).toBe(415);
        const grande = new Uint8Array(MAX_ARCHIVO_BYTES + 1);
        grande.set(BYTES_PDF);
        const g = await subir({ archivo: archivo(grande, 'application/pdf'), id_sesion: '188' });
        expect(g.status).toBe(413);
        expect(admin.bucket.upload).not.toHaveBeenCalled();
        expect((await subir({ id_sesion: '188' })).status).toBe(422);
    });

    it('exactamente 5 MiB pasa', async () => {
        preparar({ me: YO.alumno });
        const justo = new Uint8Array(MAX_ARCHIVO_BYTES);
        justo.set(BYTES_PDF);
        expect((await subir({ archivo: archivo(justo, 'application/pdf'), id_sesion: '188' })).status).toBe(201);
    });

    it('si la RPC de precomprobación falla no se sube nada', async () => {
        preparar({ me: YO.alumno, usuarioRpcs: { api_validar_justificante: () => errorDeNegocio('ESTADO_NO_JUSTIFICABLE', 'No justificable.') } });
        const res = await subir(valido());
        expect(res.status).toBe(409);
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('fallo de Storage -> 502 ALMACENAMIENTO_NO_DISPONIBLE', async () => {
        preparar({ me: YO.alumno, storage: { upload: vi.fn(async () => ({ error: { message: 'x' } })) } });
        const res = await subir(valido());
        expect(res.status).toBe(502);
        expect((await res.json()).error.code).toBe('ALMACENAMIENTO_NO_DISPONIBLE');
    });

    it('el rol docente/alumno es obligatorio: administrador recibe 403', async () => {
        preparar({ me: YO.admin });
        expect((await subir(valido())).status).toBe(403);
    });
});
