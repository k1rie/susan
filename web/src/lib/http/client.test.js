// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, EVENTO_SESION_EXPIRADA } from '@/lib/api/errors';
import {
    armarUrl, deleteJSON, getJSON, patchJSON, postForm, postJSON, requestJSON,
} from './client.js';
import {
    crearUsuario, detallesCaso, documentoJustificante, enviarCaptura, estadoIndice, obtenerDeteccionesCaso,
    probarCamara, reconstruirIndice, registrarConsentimiento, registrarPlantilla, restablecerUsuario,
    revertirIndice, sincronizarIndice, solicitarUrlDocumento, subirDocumentoJustificante, verificarFoto, verificarFotos,
} from './index.js';

const respuesta = (cuerpo, status = 200) => new Response(cuerpo === null ? null : JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
const simular = (...respuestas) => {
    const f = vi.fn(async () => (respuestas.length > 1 ? respuestas.shift() : respuestas[0].clone()));
    vi.stubGlobal('fetch', f);
    return f;
};
afterEach(() => vi.unstubAllGlobals());

describe('client', () => {
    it('GET: same-origin, sin caché, Accept JSON y query sin undefined/null', async () => {
        const f = simular(respuesta({ ok: 1 }));
        expect(await getJSON('/api/x', { query: { a: 1, b: undefined, c: null, d: ['x', 'y'], e: false } })).toEqual({ ok: 1 });
        const [url, init] = f.mock.calls[0];
        expect(url).toBe('/api/x?a=1&d=x&d=y&e=false');
        expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        expect(init.headers.Accept).toBe('application/json');
    });

    it('POST JSON serializa el cuerpo con Content-Type; FormData no fija Content-Type (lo pone el navegador)', async () => {
        const f = simular(respuesta({ ok: 1 }));
        await postJSON('/api/x', { a: 1 });
        expect(f.mock.calls[0][1].body).toBe('{"a":1}');
        expect(f.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
        const fd = new FormData();
        fd.append('a', '1');
        await postForm('/api/x', fd);
        expect(f.mock.calls[1][1].body).toBe(fd);
        expect(f.mock.calls[1][1].headers['Content-Type']).toBeUndefined();
        await patchJSON('/api/x', { a: 1 });
        await deleteJSON('/api/x');
        expect(f.mock.calls[2][1].method).toBe('PATCH');
        expect(f.mock.calls[3][1].method).toBe('DELETE');
    });

    it('204 devuelve null', async () => {
        simular(respuesta(null, 204));
        expect(await requestJSON('DELETE', '/api/x')).toBeNull();
    });

    it('una respuesta de error { error } se vuelve ApiError con code, message, status y details', async () => {
        simular(respuesta({ error: { code: 'VALIDACION', message: 'Revisa los datos.', details: { campos: [{ campo: 'a', mensaje: 'x' }] } } }, 422));
        const e = await getJSON('/api/x').catch((x) => x);
        expect(e).toBeInstanceOf(ApiError);
        expect(e).toMatchObject({ code: 'VALIDACION', message: 'Revisa los datos.', status: 422, details: { campos: [{ campo: 'a', mensaje: 'x' }] } });
    });

    it('un error sin cuerpo JSON (proxy) se deduce por status', async () => {
        simular(new Response('<html>413</html>', { status: 413 }));
        expect(await postJSON('/api/x', {}).catch((x) => x)).toMatchObject({ code: 'LIMITE_EXCEDIDO', status: 413 });
        simular(new Response('boom', { status: 500 }));
        expect(await getJSON('/api/x').catch((x) => x)).toMatchObject({ code: 'ERROR_INTERNO', status: 500 });
    });

    it('un fetch que lanza es ERROR_RED; AbortError se relanza tal cual', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        expect(await getJSON('/api/x').catch((x) => x)).toMatchObject({ code: 'ERROR_RED', status: 503 });
        const aborto = Object.assign(new Error('abortado'), { name: 'AbortError' });
        vi.stubGlobal('fetch', vi.fn(async () => { throw aborto; }));
        expect(await getJSON('/api/x').catch((x) => x)).toBe(aborto);
    });

    it('un 401 emite el evento de sesión expirada', async () => {
        const escucha = vi.fn();
        window.addEventListener(EVENTO_SESION_EXPIRADA, escucha);
        simular(respuesta({ error: { code: 'NO_AUTENTICADO', message: 'Debes iniciar sesión.' } }, 401));
        await getJSON('/api/x').catch(() => {});
        window.removeEventListener(EVENTO_SESION_EXPIRADA, escucha);
        expect(escucha).toHaveBeenCalledTimes(1);
    });

    it('armarUrl respeta una query previa', () => {
        expect(armarUrl('/a?x=1', { y: 2 })).toBe('/a?x=1&y=2');
        expect(armarUrl('/a', {})).toBe('/a');
    });
});

describe('clientes tipados', () => {
    it('enviarCaptura: multipart con la imagen (webcam) o JSON sin imagen (cámara IP)', async () => {
        const f = simular(respuesta({ id_captura: 1 }));
        const imagen = new Blob(['x'], { type: 'image/jpeg' });
        await enviarCaptura({ idSesion: 12, idCamara: 3, imagen, marcaTiempo: new Date('2026-09-14T13:05:00Z') });
        const [url, init] = f.mock.calls[0];
        expect(url).toBe('/api/sesiones/12/captura');
        expect(init.body.get('id_camara')).toBe('3');
        expect(init.body.get('marca_tiempo')).toBe('2026-09-14T13:05:00.000Z');
        expect(init.body.get('image')).toBeInstanceOf(Blob);
        await enviarCaptura({ idSesion: 12, idCamara: 4 });
        expect(f.mock.calls[1][1].body).toBe('{"id_camara":4}');
    });

    it('revisión: detallesCaso / obtenerDeteccionesCaso, subir documento y obtener documento', async () => {
        const f = simular(respuesta({ ok: 1 }));
        await obtenerDeteccionesCaso(345, { soloValidas: true, limit: 10 });
        expect(f.mock.calls[0][0]).toBe('/api/casos/345/detecciones?solo_validas=true&limit=10');
        await detallesCaso(345);
        expect(f.mock.calls[1][0]).toBe('/api/casos/345/detecciones');
        await subirDocumentoJustificante({ archivo: new File(['x'], 'j.pdf', { type: 'application/pdf' }), idSesion: 188, idAlumno: 44 });
        const form = f.mock.calls[2][1].body;
        expect(f.mock.calls[2][0]).toBe('/api/justificantes/documento');
        expect([form.get('id_sesion'), form.get('id_alumno')]).toEqual(['188', '44']);
        expect(form.get('archivo')).toBeInstanceOf(Blob);
        await subirDocumentoJustificante({ archivo: new File(['x'], 'j.pdf'), idSesion: 188 });
        expect(f.mock.calls[3][1].body.has('id_alumno')).toBe(false);
        await documentoJustificante(15);
        expect(f.mock.calls[4][0]).toBe('/api/justificantes/15/documento');
    });

    it('biometría con varias fotos: repite el campo "fotos" en el orden dado y manda alumno y consentimiento', async () => {
        const f = simular(respuesta({ ok: 1 }));
        const blobs = [new Blob(['a']), new Blob(['b']), new Blob(['c'])];
        await verificarFotos(blobs, { idAlumno: 17, idConsent: 9 });
        const [url, init] = f.mock.calls[0];
        expect(url).toBe('/api/plantilla/verificar');
        expect(init.method).toBe('POST');
        expect(init.headers['Content-Type']).toBeUndefined(); // multipart: el boundary lo pone el navegador
        expect(init.body.getAll('fotos')).toHaveLength(3);
        expect(init.body.getAll('fotos').map((x) => x.name)).toEqual(['foto-1.jpg', 'foto-2.jpg', 'foto-3.jpg']);
        expect(init.body.get('id_alumno')).toBe('17');
        expect(init.body.get('id_consent')).toBe('9');
        expect(init.body.get('foto')).toBeNull();

        await registrarPlantilla({ idAlumno: 17, idConsent: 9, fotos: blobs });
        expect(f.mock.calls[1][0]).toBe('/api/alumnos/17/plantilla');
        expect(f.mock.calls[1][1].body.getAll('fotos')).toHaveLength(3);
        expect(f.mock.calls[1][1].body.get('foto')).toBeNull();
        expect(f.mock.calls[1][1].body.get('id_consent')).toBe('9');

        await registrarPlantilla({ idAlumno: 17, idConsent: 9, foto: blobs[0] });
        expect(f.mock.calls[2][1].body.get('foto')).toBeInstanceOf(Blob);
        expect(f.mock.calls[2][1].body.getAll('fotos')).toEqual([]);

        await solicitarUrlDocumento({ tipo: 'plantilla_foto', idRegistro: 101 });
        expect(f.mock.calls[3][0]).toBe('/api/documentos/plantilla_foto/101');
    });

    it('un FOTOS_RECHAZADAS del servidor llega como ApiError con sus details por foto', async () => {
        simular(respuesta({ error: { code: 'FOTOS_RECHAZADAS', message: 'Algunas fotos no sirven.', details: { fotos: [{ indice: 4, estado: 'inconsistente' }] } } }, 422));
        const e = await registrarPlantilla({ idAlumno: 17, idConsent: 9, fotos: [new Blob(['a']), new Blob(['b'])] }).catch((x) => x);
        expect(e).toBeInstanceOf(ApiError);
        expect(e).toMatchObject({ code: 'FOTOS_RECHAZADAS', status: 422 });
        expect(e.details.fotos[0].indice).toBe(4);
    });

    it('biometría: consentimiento, plantilla, verificar, documentos e índice', async () => {
        const f = simular(respuesta({ ok: 1 }));
        await registrarConsentimiento({ idAlumno: 17, fechaFirma: '2026-08-24', vigenciaHasta: '2027-08-23', documento: new File(['%PDF-'], 'c.pdf') });
        expect(f.mock.calls[0][0]).toBe('/api/consentimientos');
        expect(f.mock.calls[0][1].body.get('id_alumno')).toBe('17');
        const fd = new FormData();
        await registrarConsentimiento(fd);
        expect(f.mock.calls[1][1].body).toBe(fd);
        await registrarPlantilla({ idAlumno: 17, idConsent: 9, foto: new Blob(['x']) });
        expect(f.mock.calls[2][0]).toBe('/api/alumnos/17/plantilla');
        expect(f.mock.calls[2][1].body.get('id_consent')).toBe('9');
        await verificarFoto(new Blob(['x']));
        expect(f.mock.calls[3][0]).toBe('/api/plantilla/verificar');
        expect(f.mock.calls[3][1].body.get('foto')).toBeInstanceOf(Blob);
        await solicitarUrlDocumento({ tipo: 'consentimiento', idRegistro: 9 });
        expect(f.mock.calls[4][0]).toBe('/api/documentos/consentimiento/9');
        await estadoIndice({ limit: 5 });
        expect(f.mock.calls[5][0]).toBe('/api/indice?limit=5');
        await reconstruirIndice({ completa: true });
        expect(f.mock.calls[6][1].body).toBe('{"completa":true}');
        await sincronizarIndice();
        expect(f.mock.calls[7][0]).toBe('/api/indice/sincronizar');
        await revertirIndice({ idIndice: 3 });
        expect(f.mock.calls[8][1].body).toBe('{"id_indice":3}');
    });

    it('administración: crear/restablecer usuario y probar cámara', async () => {
        const f = simular(respuesta({ ok: 1 }));
        await crearUsuario({ correo: 'a@x.mx', rol: 'docente', idDocente: 12 });
        expect(f.mock.calls[0][0]).toBe('/api/admin/usuarios');
        expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ correo: 'a@x.mx', rol: 'docente', id_docente: 12 });
        await restablecerUsuario({ idUsuario: 31 });
        expect(f.mock.calls[1][0]).toBe('/api/admin/usuarios/31/restablecer');
        await probarCamara({ idCamara: 4 });
        expect(f.mock.calls[2][0]).toBe('/api/admin/camaras/4/probar');
    });
});
