// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlantillaFacialPanel from './PlantillaFacialPanel.jsx';

const mocks = vi.hoisted(() => ({
    consentimientosAlumno: vi.fn(),
    plantillaAlumno: vi.fn(),
    verificarFotos: vi.fn(),
    registrarPlantilla: vi.fn(),
    solicitarUrlDocumento: vi.fn(),
    capture: vi.fn(),
}));
vi.mock('@/lib/api/biometria.js', () => ({ consentimientosAlumno: mocks.consentimientosAlumno, plantillaAlumno: mocks.plantillaAlumno }));
vi.mock('@/lib/http/biometria.js', () => ({
    verificarFotos: mocks.verificarFotos,
    registrarPlantilla: mocks.registrarPlantilla,
    solicitarUrlDocumento: mocks.solicitarUrlDocumento,
}));
// La cámara real necesita getUserMedia: se sustituye por un objeto con la API de ref (capture).
vi.mock('@/components/ui/CameraCapture', async () => {
    const { useImperativeHandle } = await import('react');
    return {
        default: function CamaraSimulada({ ref }) {
            useImperativeHandle(ref, () => ({ capture: mocks.capture }));
            return <div data-testid="camara" />;
        },
    };
});

const CON_CONSENT = { vigente: true, consentimiento_vigente: { id_consent: 9, vigencia_hasta: '2027-01-01', dias_restantes: 90 }, items: [] };
const SIN_CONSENT = { vigente: false, consentimiento_vigente: null, items: [] };
const SIN_PLANTILLA = { activa: null, archivadas: { total: 0, items: [] } };
const ACTIVA = { id_plantilla: 5, indexada: true, version_indice: 'v004', fecha_registro: '2026-09-14', n_fotos: 5, coseno_min: 0.512, coseno_medio: 0.744, fotos: [1, 2, 3, 4, 5].map((o) => ({ id_foto: 100 + o, orden: o, principal: o === 1, calidad: null, coseno_resto: 0.7 })) };

const calidad = { brillo: 120, nitidez: 80, tamano_rostro_px: 200, frontal: true };
const fotoOk = (i, extra = {}) => ({ indice: i, estado: 'aceptada', rostros: 1, un_solo_rostro: true, calidad, motivo_rechazo: null, motivo_codigo: null, coseno_resto: 0.8, duplicada_de: null, ...extra });
// Respuesta de /api/plantilla/verificar para n fotos; `fotos` sustituye a las generadas.
const conjunto = (n, extra = {}) => ({
    total: n, aceptadas: n, minimo: 3, maximo: 8, suficiente: n >= 3, consistente: true, ambiguo: false, umbral_coseno: 0.35,
    coseno_min: 0.5, coseno_medio: 0.7, coseno_max_par: 0.9, advertencias: [],
    fotos: Array.from({ length: n }, (_, i) => fotoOk(i)),
    ...extra,
});
const diferido = () => {
    let resolver;
    let rechazar;
    const promesa = new Promise((res, rej) => {
        resolver = res;
        rechazar = rej;
    });
    return { promesa, resolver, rechazar };
};

beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.consentimientosAlumno.mockResolvedValue(CON_CONSENT);
    mocks.plantillaAlumno.mockResolvedValue(SIN_PLANTILLA);
    mocks.verificarFotos.mockImplementation(async (blobs) => conjunto(blobs.length));
    mocks.capture.mockImplementation(async () => new Blob(['x'], { type: 'image/jpeg' }));
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
});

const montar = async (props = {}) => {
    render(<PlantillaFacialPanel idAlumno={1} {...props} />);
    return screen.findByRole('button', { name: /^Capturar toma/ });
};
const capturar = async (n = 1) => {
    for (let i = 0; i < n; i += 1) {
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /^Capturar toma/ }));
        });
    }
};
const botonRegistrar = (nombre = /^Registrar plantilla con|^Reemplazar plantilla/) => screen.getByRole('button', { name: nombre });
const esperarRegistrable = (nombre) => waitFor(() => expect(botonRegistrar(nombre)).toBeEnabled());
// El contador está dos veces: visible (<p>) y en la región de estado para lectores de pantalla (sr-only).
const contador = (texto) => screen.getByText(texto, { selector: 'p' });
const fila = (nombre) => screen.getByRole('listitem', { name: nombre });

describe('PlantillaFacialPanel: captura y verificación', () => {
    it('sin consentimiento vigente deshabilita la captura', async () => {
        mocks.consentimientosAlumno.mockResolvedValue(SIN_CONSENT);
        render(<PlantillaFacialPanel idAlumno={1} />);
        expect(await screen.findByText(/Registre un consentimiento vigente/)).toBeInTheDocument();
        expect(screen.queryByTestId('camara')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Capturar toma/ })).not.toBeInTheDocument();
        expect(screen.getByText(/Sin plantilla facial/)).toBeInTheDocument();
    });

    it('con 2 tomas aceptadas el registro está deshabilitado y con 3 se habilita', async () => {
        await montar();
        expect(contador('Captura al menos 3 tomas.')).toBeInTheDocument();
        await capturar(2);
        await waitFor(() => expect(mocks.verificarFotos).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(fila(/^Toma 1 de 5/)).toHaveAccessibleName(/Aceptada/));
        expect(contador('Tomas aceptadas: 2 de 2 (mínimo 3). Falta 1 toma aceptada para registrar.')).toBeInTheDocument();
        expect(botonRegistrar()).toBeDisabled();
        await capturar();
        await esperarRegistrable(/Registrar plantilla con 3 fotos/);
        expect(contador('Tomas aceptadas: 3 de 3 (mínimo 3).')).toBeInTheDocument();
    });

    it('verifica con TODAS las fotos y con idAlumno e idConsent', async () => {
        await montar();
        await capturar(3);
        await waitFor(() => expect(mocks.verificarFotos).toHaveBeenCalledTimes(1));
        const [blobs, opciones] = mocks.verificarFotos.mock.calls[0];
        expect(blobs).toHaveLength(3);
        expect(opciones).toMatchObject({ idAlumno: 1, idConsent: 9 });
        expect(opciones.signal).toBeInstanceOf(AbortSignal);
    });

    it('5 capturas seguidas dentro del debounce producen UNA sola llamada', async () => {
        await montar();
        await capturar(5);
        await esperarRegistrable(/Registrar plantilla con 5 fotos/);
        await new Promise((r) => setTimeout(r, 450));
        expect(mocks.verificarFotos).toHaveBeenCalledTimes(1);
        expect(mocks.verificarFotos.mock.calls[0][0]).toHaveLength(5);
    });

    it('stale-while-revalidate: las tomas ya resueltas no vuelven a «Verificando»', async () => {
        await montar();
        await capturar(3);
        await esperarRegistrable(/Registrar plantilla con 3 fotos/);
        const segunda = diferido();
        mocks.verificarFotos.mockImplementationOnce(() => segunda.promesa);
        await capturar();
        await waitFor(() => expect(mocks.verificarFotos).toHaveBeenCalledTimes(2));
        expect(screen.getAllByText('Verificando…')).toHaveLength(1);
        expect(fila(/^Toma 4 de 5/)).toHaveAccessibleName(/Verificando/);
        expect(fila(/^Toma 1 de 5/)).toHaveAccessibleName(/Aceptada/);
        expect(botonRegistrar()).toBeDisabled();
        await act(async () => segunda.resolver(conjunto(4)));
        await esperarRegistrable(/Registrar plantilla con 4 fotos/);
        expect(screen.queryByText('Verificando…')).not.toBeInTheDocument();
    });

    it('aplica el resultado por el snapshot de ids aunque haya huecos al repetir', async () => {
        await montar();
        await capturar(3);
        await esperarRegistrable(/Registrar plantilla con 3 fotos/);
        fireEvent.click(screen.getByRole('button', { name: 'Repetir toma 2' }));
        // Quedan las tomas de los pasos 1 y 3: la respuesta trae 2 fotos, la segunda con mala calidad.
        mocks.verificarFotos.mockImplementationOnce(async () => conjunto(2, { aceptadas: 1, suficiente: false, fotos: [fotoOk(0), fotoOk(1, { estado: 'calidad', motivo_codigo: 'BORROSA', motivo_rechazo: 'La foto esta desenfocada.', coseno_resto: null })] }));
        await waitFor(() => expect(mocks.verificarFotos).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(fila(/^Toma 3 de 5/)).toHaveAccessibleName(/borrosa/));
        expect(fila(/^Toma 1 de 5/)).toHaveAccessibleName(/Aceptada/);
        expect(fila(/^Toma 2 de 5/)).toHaveAccessibleName(/pendiente/);
        expect(screen.getByText(/Repite o quita las tomas marcadas/, { selector: 'p' })).toBeInTheDocument();
        expect(botonRegistrar()).toBeDisabled();
    });

    it('una toma rechazada deja el registro deshabilitado y el contador pide repetir o quitar', async () => {
        mocks.verificarFotos.mockImplementation(async (blobs) =>
            conjunto(blobs.length, { aceptadas: blobs.length - 1, fotos: blobs.map((_, i) => (i === 1 ? fotoOk(i, { estado: 'calidad', motivo_codigo: 'POCA_LUZ', motivo_rechazo: 'La foto esta muy oscura.', coseno_resto: null }) : fotoOk(i))) }));
        await montar();
        await capturar(3);
        await waitFor(() => expect(fila(/^Toma 2 de 5/)).toHaveAccessibleName(/Falta iluminación/));
        expect(contador('Tomas aceptadas: 2 de 3 (mínimo 3). Repite o quita las tomas marcadas.')).toBeInTheDocument();
        expect(botonRegistrar()).toBeDisabled();
        expect(mocks.registrarPlantilla).not.toHaveBeenCalled();
    });

    it('tras repetir una toma el foco pasa al botón de captura', async () => {
        await montar();
        await capturar(3);
        await esperarRegistrable();
        fireEvent.click(screen.getByRole('button', { name: 'Repetir toma 2' }));
        expect(screen.getByRole('button', { name: 'Capturar toma 2 de 5' })).toHaveFocus();
    });

    it('anuncia los cambios a lectores de pantalla en una región de estado', async () => {
        mocks.verificarFotos.mockImplementation(async (blobs) =>
            conjunto(blobs.length, { fotos: blobs.map((_, i) => (i === 2 ? fotoOk(i, { estado: 'calidad', motivo_codigo: 'POCA_LUZ', motivo_rechazo: 'x', coseno_resto: null }) : fotoOk(i))) }));
        await montar();
        await capturar(3);
        await waitFor(() => {
            const region = screen.getAllByRole('status').find((e) => e.classList.contains('sr-only'));
            expect(region).toHaveTextContent('Toma 1 aceptada. Toma 2 aceptada. Toma 3 no aceptada: falta iluminación.');
        });
    });

    it('cambiar de modo conserva las tomas', async () => {
        await montar();
        await capturar(2);
        await waitFor(() => expect(fila(/^Toma 2 de 5/)).toHaveAccessibleName(/Aceptada/));
        fireEvent.click(screen.getByRole('button', { name: 'Subir fotos' }));
        expect(screen.getByRole('button', { name: 'Subir fotos' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Agregar fotos (JPG)' })).toBeInTheDocument();
        expect(screen.getByText('Elige de 3 a 8 fotos distintas del mismo alumno.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Quitar toma 1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Quitar toma 2' })).toBeInTheDocument();
        expect(contador('Tomas aceptadas: 2 de 2 (mínimo 3). Falta 1 toma aceptada para registrar.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Usar cámara' }));
        expect(screen.getByRole('button', { name: 'Capturar toma 3 de 5' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Repetir toma 2' })).toBeInTheDocument();
    });

    it('muestra la advertencia de diversidad baja y el aviso de tomas que no coinciden', async () => {
        mocks.verificarFotos.mockImplementation(async (blobs) => conjunto(blobs.length, { advertencias: ['DIVERSIDAD_BAJA'] }));
        await montar();
        await capturar(3);
        expect(await screen.findByText('Las tomas son casi idénticas; varía el ángulo, la expresión o la luz.')).toBeInTheDocument();
        // El conjunto sigue siendo registrable: la advertencia no bloquea.
        expect(botonRegistrar()).toBeEnabled();

        mocks.verificarFotos.mockImplementation(async (blobs) =>
            conjunto(blobs.length, { ambiguo: true, consistente: false, aceptadas: 0, fotos: blobs.map((_, i) => fotoOk(i, { estado: 'inconsistente', motivo_codigo: 'CONJUNTO_AMBIGUO', coseno_resto: 0.1 })) }));
        await capturar();
        expect(await screen.findByText('Las tomas no coinciden entre sí. Revisa que todas sean del mismo alumno.')).toBeInTheDocument();
        expect(screen.getAllByText('Las tomas no coinciden entre sí').length).toBeGreaterThan(0);
        expect(botonRegistrar()).toBeDisabled();
    });

    it('un solo bloque «Ver detalles de calidad» con un resumen por toma y su coseno', async () => {
        await montar();
        await capturar(3);
        await esperarRegistrable();
        expect(screen.getAllByText('Ver detalles de calidad')).toHaveLength(1);
        expect(screen.getByText('Toma 1')).toBeInTheDocument();
        expect(screen.getAllByText('Parecido con las demás fotos', { exact: false })).toHaveLength(3);
    });

    it('si la verificación falla ofrece reintentar y las tomas siguen verificándose', async () => {
        mocks.verificarFotos.mockRejectedValueOnce(Object.assign(new Error('caído'), { status: 503, code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE' }));
        await montar();
        await capturar(3);
        expect(await screen.findByText(/El servicio de reconocimiento no responde; reintente\./)).toBeInTheDocument();
        expect(screen.getAllByText('Verificando…')).toHaveLength(3);
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar verificación' }));
        await esperarRegistrable(/Registrar plantilla con 3 fotos/);
        expect(mocks.verificarFotos).toHaveBeenCalledTimes(2);
    });
});

describe('PlantillaFacialPanel: registro', () => {
    const registrarCon5 = async () => {
        await montar();
        await capturar(5);
        await esperarRegistrable(/Registrar plantilla con 5 fotos/);
        fireEvent.click(botonRegistrar());
    };

    it('éxito: registra con todas las fotos en orden y muestra el índice listo', async () => {
        mocks.plantillaAlumno.mockResolvedValueOnce(SIN_PLANTILLA).mockResolvedValue({ activa: ACTIVA, archivadas: { total: 0, items: [] } });
        mocks.registrarPlantilla.mockResolvedValue({ id_plantilla: 5, n_fotos: 5, indice: { estado: 'activada', version: 'v004' }, muestra: { total: 5, usadas: 5, descartadas: [] } });
        const onCambio = vi.fn();
        await montar({ onCambio });
        await capturar(5);
        await esperarRegistrable(/Registrar plantilla con 5 fotos/);
        fireEvent.click(botonRegistrar());
        expect(await screen.findByText('Plantilla registrada con 5 fotos. Índice listo, versión v004.')).toBeInTheDocument();
        const arg = mocks.registrarPlantilla.mock.calls[0][0];
        expect(arg).toMatchObject({ idAlumno: 1, idConsent: 9 });
        expect(arg.fotos).toHaveLength(5);
        expect(arg.foto).toBeUndefined();
        expect(onCambio).toHaveBeenCalled();
        // El conjunto se limpia al terminar.
        expect(contador('Captura al menos 3 tomas.')).toBeInTheDocument();
        expect(screen.getByText('Fotos: 5')).toBeInTheDocument();
    });

    it('mientras sube avisa, bloquea los controles y pide confirmación al cerrar la pestaña', async () => {
        const envio = diferido();
        mocks.registrarPlantilla.mockImplementation(() => envio.promesa);
        await registrarCon5();
        expect(await screen.findByText('Subiendo 5 fotos y actualizando el índice. Puede tardar un minuto; no cierres esta ventana.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Repetir toma 1' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Usar cámara' })).toBeDisabled();
        const evento = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(evento);
        expect(evento.defaultPrevented).toBe(true);
        mocks.plantillaAlumno.mockResolvedValue({ activa: { ...ACTIVA, indexada: true }, archivadas: { total: 0, items: [] } });
        await act(async () => envio.resolver({ n_fotos: 5, indice: { estado: 'activada', version: 'v004' } }));
        await screen.findByText(/Índice listo/);
        const otro = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(otro);
        expect(otro.defaultPrevented).toBe(false);
    });

    it('avisa cuando el índice quedó pendiente y cuando descartó fotos al promediar', async () => {
        mocks.registrarPlantilla.mockResolvedValue({
            n_fotos: 5, indice: { estado: 'pendiente', version: null, error: { code: 'X' } },
            muestra: { total: 5, usadas: 4, descartadas: [{ indice: 2, motivo: 'inconsistente', coseno_resto: 0.2 }] },
        });
        await registrarCon5();
        expect(await screen.findByText('Plantilla guardada, índice pendiente')).toBeInTheDocument();
        expect(screen.getByText(/pide a un técnico que lo reconstruya/)).toBeInTheDocument();
        expect(screen.getByText('El índice descartó 1 foto al promediar; revisa la consistencia.')).toBeInTheDocument();
    });

    it('FOTOS_RECHAZADAS marca las tomas correctas y permite repetirlas', async () => {
        mocks.registrarPlantilla.mockRejectedValue(Object.assign(new Error('rechazo'), {
            code: 'FOTOS_RECHAZADAS',
            details: { fotos: [0, 1, 2, 3, 4].map((i) => (i === 3 ? fotoOk(i, { estado: 'inconsistente', motivo_codigo: 'NO_COINCIDE', coseno_resto: 0.12 }) : fotoOk(i))) },
        }));
        await registrarCon5();
        expect(await screen.findByText('Algunas fotos no sirven: repite las tomas marcadas.')).toBeInTheDocument();
        expect(fila(/^Toma 4 de 5/)).toHaveAccessibleName(/No parece la misma persona/);
        expect(fila(/^Toma 3 de 5/)).toHaveAccessibleName(/Aceptada/);
        expect(botonRegistrar()).toBeDisabled();
        expect(screen.getByText(/Repite o quita las tomas marcadas/, { selector: 'p' })).toBeInTheDocument();
    });

    it('FOTOS_DUPLICADAS marca la toma repetida con el número de la original', async () => {
        mocks.registrarPlantilla.mockRejectedValue(Object.assign(new Error('dup'), { code: 'FOTOS_DUPLICADAS', details: { duplicadas: [{ indice: 2, de: 0 }] } }));
        await registrarCon5();
        expect(await screen.findByText('Hay fotos repetidas: usa tomas distintas.')).toBeInTheDocument();
        expect(fila(/^Toma 3 de 5/)).toHaveAccessibleName(/Igual a la toma 1/);
    });

    it('FOTOS_INSUFICIENTES usa el mínimo del servidor', async () => {
        mocks.registrarPlantilla.mockRejectedValue(Object.assign(new Error('x'), { code: 'FOTOS_INSUFICIENTES', details: { minimo: 4, recibidas: 3 } }));
        await registrarCon5();
        expect(await screen.findByText('Se necesitan al menos 4 fotos.')).toBeInTheDocument();
    });

    it('error 503 al registrar ofrece reintento y reintenta el mismo camino', async () => {
        mocks.registrarPlantilla.mockRejectedValueOnce(Object.assign(new Error('caído'), { status: 503, code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE' }));
        mocks.registrarPlantilla.mockResolvedValueOnce({ n_fotos: 5, indice: { estado: 'activada', version: 'v005' } });
        mocks.plantillaAlumno.mockResolvedValueOnce(SIN_PLANTILLA).mockResolvedValue({ activa: { ...ACTIVA, indexada: true, version_indice: 'v005' }, archivadas: { total: 0, items: [] } });
        await registrarCon5();
        expect(await screen.findByText(/no responde; reintente/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(await screen.findByText(/Índice listo, versión v005/)).toBeInTheDocument();
        expect(mocks.registrarPlantilla).toHaveBeenCalledTimes(2);
    });

    it('con una sola toma aceptada ofrece registrar con una foto por el campo heredado', async () => {
        mocks.registrarPlantilla.mockResolvedValue({ n_fotos: 1, indice: { estado: 'activada', version: 'v004' } });
        mocks.plantillaAlumno.mockResolvedValueOnce(SIN_PLANTILLA).mockResolvedValue({ activa: { ...ACTIVA, n_fotos: 1, coseno_medio: null, coseno_min: null, fotos: [] }, archivadas: { total: 0, items: [] } });
        await montar();
        expect(screen.queryByRole('button', { name: /Registrar con una sola foto/ })).not.toBeInTheDocument();
        await capturar();
        const una = await screen.findByRole('button', { name: 'Registrar con una sola foto' });
        await waitFor(() => expect(una).toBeEnabled());
        expect(botonRegistrar()).toBeDisabled();
        fireEvent.click(una);
        expect(await screen.findByText(/Plantilla registrada con 1 foto\./)).toBeInTheDocument();
        const arg = mocks.registrarPlantilla.mock.calls[0][0];
        expect(arg.foto).toBeInstanceOf(Blob);
        expect(arg.fotos).toBeUndefined();
    });

    it('con plantilla activa el botón dice que la anterior se archivará', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: ACTIVA, archivadas: { total: 0, items: [] } });
        await montar();
        await capturar(3);
        await esperarRegistrable(/^Reemplazar plantilla$/);
        expect(screen.getByText(/La plantilla anterior se archivará/)).toBeInTheDocument();
    });

    // 360 px: ui/Button lleva whitespace-nowrap, así que una etiqueta de más de ~36 caracteres (~250 px a 14 px) se sale
    // de la tarjeta (en jsdom no hay layout; se vigila el largo de las etiquetas en los dos casos que fallaron en el navegador).
    it('las etiquetas de los botones de registro caben en 360 px (con plantilla activa y con una toma aceptada)', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: ACTIVA, archivadas: { total: 0, items: [] } });
        await montar();
        await capturar();
        await screen.findByRole('button', { name: 'Registrar con una sola foto' });
        const MAX_CARACTERES = 36;
        const largos = screen.getAllByRole('button').filter((b) => b.className.includes('whitespace-nowrap') && b.textContent.trim().length > MAX_CARACTERES);
        expect(largos.map((b) => b.textContent)).toEqual([]);
        expect(screen.getByRole('button', { name: 'Reemplazar plantilla' })).toBeInTheDocument();
    });
});

describe('PlantillaFacialPanel: plantilla actual', () => {
    it('muestra el número de fotos y la consistencia medida', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: ACTIVA, archivadas: { total: 1, items: [] } });
        await montar();
        expect(screen.getByText('Fotos: 5')).toBeInTheDocument();
        expect(screen.getByText('Consistencia entre fotos')).toBeInTheDocument();
        expect(screen.getByText(/cada foto se parecía en promedio 0\.74 a las demás \(mínimo 0\.51\)/)).toBeInTheDocument();
        expect(screen.getByText('1 plantilla(s) archivada(s)')).toBeInTheDocument();
        expect(screen.queryByText(/Plantilla de una sola foto/)).not.toBeInTheDocument();
    });

    it('una plantilla de una foto sugiere registrar de 3 a 5 tomas', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: { id_plantilla: 5, indexada: true, version_indice: 'v001', fecha_registro: '2026-09-01', n_fotos: 1, coseno_min: null, coseno_medio: null, fotos: [{ id_foto: 1, orden: 1, principal: true }] }, archivadas: { total: 0, items: [] } });
        await montar();
        expect(screen.getByText('Fotos: 1')).toBeInTheDocument();
        expect(screen.getByText('Plantilla de una sola foto: se recomienda registrar de 3 a 5 tomas.')).toBeInTheDocument();
        expect(screen.queryByText('Consistencia entre fotos')).not.toBeInTheDocument();
        expect(screen.queryByText(/Ver las .* fotos/)).not.toBeInTheDocument();
    });

    it('una plantilla heredada sin los campos nuevos se muestra como de una foto', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: { id_plantilla: 5, indexada: true, version_indice: 'v001', fecha_registro: '2026-09-01' }, archivadas: { total: 0, items: [] } });
        await montar();
        expect(screen.getByText('Fotos: 1')).toBeInTheDocument();
        expect(screen.getByText(/Plantilla de una sola foto/)).toBeInTheDocument();
    });

    it('«Ver foto» pide la principal y «Abrir foto K» pide tipo plantilla_foto con el id de la foto', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: ACTIVA, archivadas: { total: 0, items: [] } });
        mocks.solicitarUrlDocumento.mockImplementation(async ({ tipo, idRegistro }) => ({ url: `https://firmada/${tipo}/${idRegistro}` }));
        await montar();
        fireEvent.click(screen.getByRole('button', { name: 'Ver foto' }));
        expect(await screen.findByText('Abrir foto (el enlace caduca en 5 minutos)')).toHaveAttribute('href', 'https://firmada/plantilla/5');
        expect(screen.getByText('Ver las 5 fotos')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Abrir foto 3' }));
        const enlace = await screen.findByText('Abrir foto 3 (el enlace caduca en 5 minutos)');
        expect(enlace).toHaveAttribute('href', 'https://firmada/plantilla_foto/103');
        expect(mocks.solicitarUrlDocumento).toHaveBeenLastCalledWith({ tipo: 'plantilla_foto', idRegistro: 103 });
    });

    it('explica por qué varias fotos en un solo bloque plegable', async () => {
        await montar();
        expect(within(screen.getByText('¿Por qué varias fotos?').closest('div')).getByText('SUSAN promedia las fotos para reconocer mejor con distintos ángulos y luz.')).toBeInTheDocument();
    });
});
