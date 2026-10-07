// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import usePlantillaFacial from '../PlantillaFacialPanel/usePlantillaFacial.js';
import RegistroFacialGuiado from './RegistroFacialGuiado.jsx';
import { RANGOS_POSE, SIGNO } from './registroGuiado.pose.js';

vi.setConfig({ testTimeout: 20000 });

const mocks = vi.hoisted(() => ({
    consentimientosAlumno: vi.fn(),
    plantillaAlumno: vi.fn(),
    verificarFoto: vi.fn(),
    verificarFotos: vi.fn(),
    registrarPlantilla: vi.fn(),
    capture: vi.fn(),
    restart: vi.fn(),
    camara: vi.fn(),
}));
vi.mock('@/lib/api/biometria.js', () => ({ consentimientosAlumno: mocks.consentimientosAlumno, plantillaAlumno: mocks.plantillaAlumno }));
vi.mock('@/lib/http/biometria.js', () => ({ verificarFoto: mocks.verificarFoto, verificarFotos: mocks.verificarFotos, registrarPlantilla: mocks.registrarPlantilla }));
// La cámara real necesita getUserMedia: se sustituye el hook por un objeto con la misma forma (y controlable por prueba).
vi.mock('@/components/ui/CameraCapture', () => ({ default: () => null, useCameraCapture: (opciones) => mocks.camara(opciones) }));

const CON_CONSENT = { vigente: true, consentimiento_vigente: { id_consent: 9, vigencia_hasta: '2027-01-01', dias_restantes: 90 }, items: [] };
const SIN_PLANTILLA = { activa: null, archivadas: { total: 0, items: [] } };
const ACTIVA = { id_plantilla: 5, indexada: true, version_indice: 'v004', fecha_registro: '2026-09-14', n_fotos: 5, coseno_min: 0.5, coseno_medio: 0.7, fotos: [] };

const calidad = { brillo: 120, nitidez: 80, tamano_rostro_px: 200, frontal: true };
const fotoOk = (i, extra = {}) => ({ indice: i, estado: 'aceptada', rostros: 1, un_solo_rostro: true, calidad, motivo_rechazo: null, motivo_codigo: null, coseno_resto: 0.8, duplicada_de: null, ...extra });
// Respuesta de /api/plantilla/verificar para n fotos; `fotos` sustituye a las generadas.
const conjunto = (n, extra = {}) => ({
    total: n, aceptadas: n, minimo: 3, maximo: 8, suficiente: n >= 3, consistente: true, ambiguo: false, umbral_coseno: 0.35,
    coseno_min: 0.5, coseno_medio: 0.7, coseno_max_par: 0.9, advertencias: [],
    fotos: Array.from({ length: n }, (_, i) => fotoOk(i)),
    ...extra,
});
// Conjunto de n fotos donde la última se rechaza por `motivo` (código del servicio).
const conUltimaRechazada = (n, motivo, estado = 'calidad') => conjunto(n, {
    aceptadas: n - 1, suficiente: false,
    fotos: Array.from({ length: n }, (_, i) => (i === n - 1 ? fotoOk(i, { estado, motivo_codigo: motivo, motivo_rechazo: 'x' }) : fotoOk(i))),
});
// Control de calidad de UNA foto (el que dispara la toma automática): `calidadEnVivo` decide si las muestras pasan o con qué motivo fallan.
const calidadEnVivo = { motivo: null, pose: null };
const respuestaCalidad = () => ({
    rostros: 1, un_solo_rostro: true, calidad: calidadEnVivo.pose ? { ...calidad, pose: calidadEnVivo.pose } : calidad,
    motivo_rechazo: calidadEnVivo.motivo ? 'frase del servicio' : null, motivo_codigo: calidadEnVivo.motivo,
});
// Mientras haya un motivo, ninguna muestra pasa: sirve para «detener» el asistente en un paso. `null` lo deja pasar.
const ponerCalidad = (motivo) => {
    calidadEnVivo.motivo = motivo;
};
// Pose que «ve» el servicio, dicha en el marco de la persona (giro > 0: a su izquierda; cabeceo > 0: arriba) y convertida con
// SIGNO a lo que manda el servicio: así las pruebas no dependen del signo que fije la calibración. `null`: sin pose.
const ponerPose = (giro, cabeceo = 0, alabeo = 0) => {
    calidadEnVivo.pose = giro === null ? null : { giro: giro / SIGNO.giro, cabeceo: cabeceo / SIGNO.cabeceo, alabeo };
};

// Ritmos de prueba (objetos fijos: el asistente los usa como dependencia). Tras cambiar de paso quedan 150 ms para llamar a
// `ponerCalidad` antes de la primera muestra; sin límite de fallos para no ofrecer la toma manual por accidente.
const RITMO = { esperaPrimero: 0, esperaPaso: 150, intervalo: 15, aciertos: 2, demoraAceptada: 0, demoraRechazo: 60000, manualTrasFallos: 1000 };
const RITMO_REINTENTO = { ...RITMO, demoraRechazo: 20 };
const RITMO_MANUAL = { ...RITMO, manualTrasFallos: 3 };

const diferido = () => {
    let resolver;
    const promesa = new Promise((res) => {
        resolver = res;
    });
    return { promesa, resolver };
};

beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.consentimientosAlumno.mockResolvedValue(CON_CONSENT);
    mocks.plantillaAlumno.mockResolvedValue(SIN_PLANTILLA);
    ponerCalidad(null);
    ponerPose(null);
    mocks.verificarFoto.mockImplementation(async () => respuestaCalidad());
    mocks.verificarFotos.mockImplementation(async (blobs) => conjunto(blobs.length));
    // Cada fotograma es un Blob distinto: así se sabe cuál de las muestras terminó entregada como toma.
    mocks.capture.mockImplementation(async () => ({ blob: new Blob([`fotograma-${mocks.capture.mock.calls.length}`], { type: 'image/jpeg' }), meta: {} }));
    mocks.camara.mockImplementation(() => ({ videoRef: { current: null }, capture: mocks.capture, restart: mocks.restart, estado: 'ready', error: null, dispositivos: [] }));
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
});

// El asistente opera sobre el estado de usePlantillaFacial: el arnés lo crea igual que el panel. Las tomas se disparan solas, así
// que las pruebas no pulsan nada: esperan a que el asistente llegue al paso siguiente.
function Arnes({ onClose = () => {}, onCambio, ritmo = RITMO, depuracion }) {
    const p = usePlantillaFacial({ idAlumno: 1, onCambio });
    return p.vigente ? <RegistroFacialGuiado p={p} nombreAlumno="Ana Pérez" onClose={onClose} ritmo={ritmo} depuracion={depuracion} /> : null;
}

const abrir = async (props) => {
    render(<Arnes {...props} />);
    return screen.findByRole('dialog', { name: 'Registro facial' });
};
const comenzar = async (props) => {
    await abrir(props);
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    return screen.findByRole('heading', { name: 'De frente' });
};
const esperarPaso = (titulo) => screen.findByRole('heading', { name: titulo }, { timeout: 4000 });
const PASOS = ['De frente', 'Gira a la izquierda', 'Gira a la derecha', 'Inclina hacia arriba', 'Otra expresión o luz'];
// Espera a que las primeras n fotos se tomen solas (cada una pasa a la siguiente); con 5 llega a la revisión.
const tomarPasos = async (n) => {
    for (let i = 0; i < n; i += 1) {
        await (i === 4 ? screen.findByRole('heading', { name: 'Revisa tus tomas' }, { timeout: 4000 }) : esperarPaso(PASOS[i + 1]));
    }
};
const omitir = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Omitir esta toma (opcional)' }));
};
// Llega a la revisión con las 3 tomas obligatorias y las dos opcionales omitidas. Al abrirse el paso 4 se corta la calidad.
const aRevisionCon3 = async () => {
    await comenzar();
    await tomarPasos(3);
    ponerCalidad('POCA_LUZ');
    await omitir();
    await esperarPaso('Otra expresión o luz');
    await omitir();
    await screen.findByRole('heading', { name: 'Revisa tus tomas' });
    ponerCalidad(null);
};
const aRevisionCon5 = async (props) => {
    await comenzar(props);
    await tomarPasos(5);
};
const botonRegistrar = (nombre = /^Registrar plantilla con|^Reemplazar plantilla con/) => screen.getByRole('button', { name: nombre });
const esperarRegistrable = (nombre) => waitFor(() => expect(botonRegistrar(nombre)).toBeEnabled(), { timeout: 3000 });
const fila = (nombre) => screen.getByRole('listitem', { name: nombre });

describe('RegistroFacialGuiado: portada', () => {
    it('presenta el registro con el nombre, los consejos y las dos formas de empezar, sin encender la cámara', async () => {
        await abrir();
        expect(screen.getByText('Registra el rostro en 5 tomas')).toBeInTheDocument();
        expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
        expect(screen.getByText('Busca buena luz')).toBeInTheDocument();
        expect(screen.getByText('Rostro descubierto')).toBeInTheDocument();
        expect(screen.getByText('Tu privacidad')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Comenzar' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Subir fotos en lugar de usar la cámara' })).toBeEnabled();
        // La cámara (y su luz) solo se activan en las tomas.
        expect(mocks.camara).toHaveBeenLastCalledWith(expect.objectContaining({ active: false }));
    });

    it('es un diálogo modal con el foco dentro y se cierra con la X', async () => {
        const onClose = vi.fn();
        const dialogo = await abrir({ onClose });
        expect(dialogo).toHaveAttribute('aria-modal', 'true');
        expect(dialogo.contains(document.activeElement)).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar el registro facial' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('RegistroFacialGuiado: tomas automáticas', () => {
    it('Comenzar enciende la cámara y muestra el primer paso; no hay botón para tomar la foto', async () => {
        ponerCalidad('POCA_LUZ'); // el paso se queda buscando
        await comenzar();
        expect(mocks.camara).toHaveBeenLastCalledWith(expect.objectContaining({ active: true, facingMode: 'user' }));
        expect(screen.getByText('Toma 1 de 5')).toBeInTheDocument();
        expect(screen.getByText('La foto se toma sola cuando todo esté bien.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Tomar foto/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Omitir/ })).not.toBeInTheDocument();
    });

    it('toma la foto sola tras 2 muestras buenas seguidas y entrega esa muestra como toma del paso', async () => {
        await comenzar();
        await esperarPaso('Gira a la izquierda');
        expect(screen.getByText('Toma 2 de 5')).toBeInTheDocument();
        expect(mocks.verificarFoto.mock.calls.length).toBeGreaterThanOrEqual(2);
        const [blobs] = mocks.verificarFotos.mock.calls[0];
        expect(blobs).toHaveLength(1);
        // La toma es la muestra que completó la racha (la 2.ª comprobación), no un fotograma nuevo.
        expect(blobs[0]).toBe(mocks.verificarFoto.mock.calls[1][0]);
    });

    it('la comprobación de calidad es la de UNA foto y se manda con su señal de cancelación', async () => {
        await comenzar();
        await esperarPaso('Gira a la izquierda');
        const [blob, opciones] = mocks.verificarFoto.mock.calls[0];
        expect(blob).toBeInstanceOf(Blob);
        expect(opciones.signal).toBeInstanceOf(AbortSignal);
    });

    it('un fallo reinicia la racha: hacen falta 2 muestras buenas seguidas después de él', async () => {
        mocks.verificarFoto
            .mockImplementationOnce(async () => respuestaCalidad())
            .mockResolvedValueOnce({ rostros: 1, un_solo_rostro: true, calidad, motivo_rechazo: 'x', motivo_codigo: 'BORROSA' });
        await comenzar();
        await esperarPaso('Gira a la izquierda');
        // Buena, mala, buena, buena -> se entrega la 4.ª.
        const [blobs] = mocks.verificarFotos.mock.calls[0];
        expect(blobs[0]).toBe(mocks.verificarFoto.mock.calls[3][0]);
    });

    it('mientras no pasa el control de calidad dice el motivo en vivo y no toma nada', async () => {
        ponerCalidad('POCA_LUZ');
        await comenzar();
        expect(await screen.findByText('Hay poca luz. Busca un lugar más iluminado.')).toBeInTheDocument();
        expect(mocks.verificarFotos).not.toHaveBeenCalled();
        ponerCalidad('ROSTRO_PEQUENO');
        expect(await screen.findByText('Acércate un poco más a la cámara.')).toBeInTheDocument();
        ponerCalidad(null);
        await esperarPaso('Gira a la izquierda');
        expect(mocks.verificarFotos).toHaveBeenCalledTimes(1);
    });

    it('en el paso de frente, «no frontal» pide mirar de frente', async () => {
        ponerCalidad('NO_FRONTAL');
        await comenzar();
        expect(await screen.findByText('Mira de frente a la cámara, sin girar la cabeza.')).toBeInTheDocument();
    });

    it('con una muestra buena dice que mantenga la posición hasta completar la racha', async () => {
        const segunda = diferido();
        mocks.verificarFoto.mockImplementationOnce(async () => respuestaCalidad()).mockImplementationOnce(() => segunda.promesa);
        await comenzar();
        expect(await screen.findByText('Muy bien, mantén la posición…')).toBeInTheDocument();
        expect(mocks.verificarFotos).not.toHaveBeenCalled();
        await act(async () => segunda.resolver(respuestaCalidad()));
        await esperarPaso('Gira a la izquierda');
    });

    it('cada toma se verifica con TODAS las anteriores y, aceptada, pasa sola al siguiente paso', async () => {
        await comenzar();
        await tomarPasos(2);
        expect(mocks.verificarFotos).toHaveBeenCalledTimes(2);
        const [blobs, opciones] = mocks.verificarFotos.mock.calls[1];
        expect(blobs).toHaveLength(2);
        expect(opciones).toMatchObject({ idAlumno: 1, idConsent: 9 });
        expect(opciones.signal).toBeInstanceOf(AbortSignal);
    });

    it('mientras se verifica la toma muestra el avance y deja de muestrear', async () => {
        const espera = diferido();
        mocks.verificarFotos.mockImplementationOnce(() => espera.promesa);
        await comenzar();
        expect(await screen.findByRole('heading', { name: 'Verificando…' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Verificando…' })).toBeDisabled();
        const muestras = mocks.verificarFoto.mock.calls.length;
        await new Promise((r) => setTimeout(r, 120));
        expect(mocks.verificarFoto.mock.calls.length).toBe(muestras);
        await act(async () => espera.resolver(conjunto(1)));
        await esperarPaso('Gira a la izquierda');
    });

    it('una toma que se rechaza al compararla con las anteriores dice el motivo y reintenta sola', async () => {
        mocks.verificarFotos.mockResolvedValueOnce(conUltimaRechazada(1, 'NO_COINCIDE', 'inconsistente'));
        await comenzar({ ritmo: { ...RITMO_REINTENTO, demoraRechazo: 150 } });
        expect(await screen.findByRole('heading', { name: 'Esta toma no sirve' })).toBeInTheDocument();
        expect(screen.getByText(/No parece la misma persona que en las tomas anteriores/)).toBeInTheDocument();
        expect(screen.getByText('Toma 1 de 5')).toBeInTheDocument();
        // Sin pulsar nada: se libera el paso, se vuelve a buscar la foto y esta vez se acepta.
        await esperarPaso('Gira a la izquierda');
        expect(mocks.verificarFotos).toHaveBeenCalledTimes(2);
    });

    it('«Intentar de nuevo» libera el mismo paso sin esperar el reintento automático', async () => {
        mocks.verificarFotos.mockResolvedValueOnce(conUltimaRechazada(1, 'POCA_LUZ'));
        await comenzar();
        expect(await screen.findByRole('heading', { name: 'Esta toma no sirve' })).toBeInTheDocument();
        expect(screen.getByText('Hay poca luz. Busca un lugar más iluminado.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
        await esperarPaso('Gira a la izquierda');
    });

    it('si en el primer paso la toma sale girada, el motivo se lo dice a la persona', async () => {
        mocks.verificarFotos.mockResolvedValueOnce(conUltimaRechazada(1, 'NO_FRONTAL'));
        await comenzar();
        expect(await screen.findByText('Mira de frente a la cámara, sin girar la cabeza.')).toBeInTheDocument();
    });

    it('una toma que no coincide con las anteriores se marca como otra persona', async () => {
        await comenzar();
        await tomarPasos(2);
        mocks.verificarFotos.mockResolvedValueOnce(conUltimaRechazada(3, 'NO_COINCIDE', 'inconsistente'));
        expect(await screen.findByText(/No parece la misma persona que en las tomas anteriores/)).toBeInTheDocument();
    });

    it('si el servicio falla al verificar la toma, lo dice y «Reintentar verificación» vuelve a pedirla', async () => {
        mocks.verificarFotos.mockRejectedValueOnce(Object.assign(new Error('caído'), { status: 503, code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE' }));
        await comenzar();
        expect(await screen.findByRole('heading', { name: 'No pudimos verificar la toma' })).toBeInTheDocument();
        expect(screen.getByText(/no responde; reintente/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar verificación' }));
        await esperarPaso('Gira a la izquierda');
        expect(mocks.verificarFotos).toHaveBeenCalledTimes(2);
    });

    it('si el control de calidad en vivo no responde ofrece «Tomar foto ahora», que toma la foto sin esperar', async () => {
        mocks.verificarFoto.mockRejectedValue(Object.assign(new Error('caído'), { status: 503, code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE' }));
        await comenzar();
        expect(await screen.findByText('No se pudo comprobar la calidad en vivo. Puedes tomar la foto tú.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Tomar foto ahora' }));
        await esperarPaso('Gira a la izquierda');
        expect(mocks.verificarFotos).toHaveBeenCalledTimes(1);
        expect(mocks.verificarFotos.mock.calls[0][0]).toHaveLength(1);
    });

    it('tras varios intentos sin éxito ofrece la toma manual', async () => {
        ponerCalidad('POCA_LUZ');
        await comenzar({ ritmo: RITMO_MANUAL });
        expect(await screen.findByRole('button', { name: 'Tomar foto ahora' })).toBeEnabled();
        // Con el servicio funcionando no hace falta explicar nada más: solo el botón.
        expect(screen.queryByText(/No se pudo comprobar la calidad en vivo/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Tomar foto ahora' }));
        await esperarPaso('Gira a la izquierda');
    });

    it('si la cámara aún no entrega fotograma no comprueba nada ni muestra errores', async () => {
        mocks.capture.mockRejectedValue(new Error('no listo'));
        await comenzar();
        await new Promise((r) => setTimeout(r, 120));
        expect(mocks.verificarFoto).not.toHaveBeenCalled();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'De frente' })).toBeInTheDocument();
    });

    it('no muestrea hasta que la cámara esté lista', async () => {
        mocks.camara.mockImplementation(() => ({ videoRef: { current: null }, capture: mocks.capture, restart: mocks.restart, estado: 'starting', error: null, dispositivos: [] }));
        await comenzar();
        expect(screen.getByText('Esperando la cámara…')).toBeInTheDocument();
        await new Promise((r) => setTimeout(r, 120));
        expect(mocks.verificarFoto).not.toHaveBeenCalled();
    });

    it('las tomas 4 y 5 son opcionales: se pueden omitir y quedan marcadas en la revisión', async () => {
        await comenzar();
        await tomarPasos(3);
        ponerCalidad('POCA_LUZ');
        expect(screen.getByText('Opcional')).toBeInTheDocument();
        await omitir();
        await esperarPaso('Otra expresión o luz');
        await omitir();
        expect(await screen.findByRole('heading', { name: 'Revisa tus tomas' })).toBeInTheDocument();
        expect(fila(/^Toma 4,/)).toHaveAccessibleName(/Omitida/);
        expect(fila(/^Toma 5,/)).toHaveAccessibleName(/Omitida/);
        expect(screen.getByRole('button', { name: 'Agregar toma 4' })).toBeInTheDocument();
        await esperarRegistrable(/Registrar plantilla con 3 fotos/);
    });
});

describe('RegistroFacialGuiado: pose de cada paso', () => {
    it('de frente: con la cabeza girada dice cómo corregir y no toma la foto hasta que esté de frente', async () => {
        ponerPose(40);
        await comenzar();
        expect(await screen.findByText('Mira de frente: gira un poco hacia tu derecha.')).toBeInTheDocument();
        expect(mocks.verificarFotos).not.toHaveBeenCalled();
        ponerPose(2);
        await esperarPaso('Gira a la izquierda');
    });

    it('no toma una foto de frente en el paso de girar: pide girar más y solo la toma al girar', async () => {
        await comenzar();
        await tomarPasos(1);
        ponerPose(0); // sigue de frente: la indicación pide girar a la izquierda
        expect(await screen.findByText('Gira un poco más hacia tu izquierda.')).toBeInTheDocument();
        const tomasAntes = mocks.verificarFotos.mock.calls.length;
        await new Promise((r) => setTimeout(r, 120));
        expect(mocks.verificarFotos.mock.calls.length).toBe(tomasAntes);
        ponerPose(20);
        await esperarPaso('Gira a la derecha');
    });

    it('si gira demasiado lo dice, y si gira hacia el lado contrario pide el lado correcto', async () => {
        await comenzar();
        await tomarPasos(1);
        ponerPose(45);
        expect(await screen.findByText('Giraste demasiado; vuelve un poco hacia el centro.')).toBeInTheDocument();
        ponerPose(-20); // giró a su derecha en el paso de la izquierda
        expect(await screen.findByText('Gira un poco más hacia tu izquierda.')).toBeInTheDocument();
        ponerPose(20);
        await esperarPaso('Gira a la derecha');
        ponerPose(20); // en el paso de la derecha sigue girado a la izquierda
        expect(await screen.findByText('Gira un poco más hacia tu derecha.')).toBeInTheDocument();
        ponerPose(-20);
        await esperarPaso('Inclina hacia arriba');
    });

    it('arriba: pide levantar la barbilla y la toma cuando la levanta', async () => {
        await comenzar();
        await tomarPasos(3);
        ponerPose(0, 0); // de frente y a la altura de los ojos: aún no levanta la barbilla
        expect(await screen.findByText('Levanta un poco más la barbilla.')).toBeInTheDocument();
        ponerPose(0, 18);
        await esperarPaso('Otra expresión o luz');
    });

    it('la cabeza ladeada se corrige antes de tomar la foto', async () => {
        ponerPose(0, 0, 40);
        await comenzar();
        expect(await screen.findByText('Endereza la cabeza.')).toBeInTheDocument();
        ponerPose(0, 0, 3);
        await esperarPaso('Gira a la izquierda');
    });

    it('sin pose del servicio (embedder fake) basta la calidad: los cinco pasos avanzan sin exigir ángulos', async () => {
        ponerPose(null);
        await aRevisionCon5();
        expect(screen.getByText('Tomas aceptadas: 5 de 5 (mínimo 3).')).toBeInTheDocument();
    });

    it('si la calidad falla, manda el motivo de calidad aunque la pose también esté mal', async () => {
        ponerPose(40);
        ponerCalidad('POCA_LUZ');
        await comenzar();
        expect(await screen.findByText('Hay poca luz. Busca un lugar más iluminado.')).toBeInTheDocument();
    });

    it('una pose imposible de lograr acaba ofreciendo la toma manual', async () => {
        ponerPose(60);
        await comenzar({ ritmo: RITMO_MANUAL });
        expect(await screen.findByRole('button', { name: 'Tomar foto ahora' })).toBeEnabled();
    });
});

describe('RegistroFacialGuiado: panel de pose (depuración)', () => {
    const escribir = vi.fn();
    beforeEach(() => {
        escribir.mockReset().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true });
    });

    it('por omisión (fuera del modo local) no se muestra', async () => {
        await comenzar();
        expect(screen.queryByRole('region', { name: 'Pose (depuración)' })).not.toBeInTheDocument();
    });

    it('muestra los ángulos del servicio y de la persona, el rango del paso, la latencia y si está en rango', async () => {
        ponerPose(8, -4, 2);
        ponerCalidad(null);
        mocks.verificarFoto.mockImplementation(async () => respuestaCalidad());
        // Pausada la toma automática, el paso se queda en pantalla para leer los valores.
        await comenzar({ depuracion: true });
        const panel = await screen.findByRole('region', { name: 'Pose (depuración)' });
        fireEvent.click(within(panel).getByRole('button', { name: 'Pausar toma automática' }));
        await waitFor(() => expect(within(panel).getByText('En rango')).toBeInTheDocument());
        expect(within(panel).getByText(/Servicio: giro/).parentElement).toHaveTextContent(`${(8 / SIGNO.giro) >= 0 ? '+' : '−'}${Math.abs(8 / SIGNO.giro).toFixed(1)}°`);
        expect(within(panel).getByText(/Tú: giro/).parentElement).toHaveTextContent('+8.0°');
        expect(within(panel).getByText(/Tú: cabeceo/).parentElement).toHaveTextContent('−4.0°');
        expect(within(panel).getByText('Comprobación').parentElement).toHaveTextContent(/\d+ ms/);
        expect(within(panel).getByText(/Tú: giro/).parentElement).toHaveTextContent(`[${RANGOS_POSE.frente.giro.join(', ')}]`);
    });

    it('«Pausar toma automática» deja de tomar fotos aunque la pose sea buena y «Reanudar» continúa', async () => {
        await comenzar({ depuracion: true });
        const panel = await screen.findByRole('region', { name: 'Pose (depuración)' });
        fireEvent.click(within(panel).getByRole('button', { name: 'Pausar toma automática' }));
        const muestras = mocks.verificarFoto.mock.calls.length;
        await waitFor(() => expect(mocks.verificarFoto.mock.calls.length).toBeGreaterThan(muestras + 3));
        expect(mocks.verificarFotos).not.toHaveBeenCalled();
        expect(screen.getByRole('heading', { name: 'De frente' })).toBeInTheDocument();
        fireEvent.click(within(panel).getByRole('button', { name: 'Reanudar toma automática' }));
        await esperarPaso('Gira a la izquierda');
    });

    it('«Copiar muestras» entrega un JSON con la pose, la etiqueta puesta, los signos y los rangos', async () => {
        ponerPose(25, 5);
        await comenzar({ depuracion: true });
        const panel = await screen.findByRole('region', { name: 'Pose (depuración)' });
        fireEvent.click(within(panel).getByRole('button', { name: 'Pausar toma automática' }));
        fireEvent.change(within(panel).getByRole('combobox', { name: 'Etiqueta de las muestras' }), { target: { value: 'izquierda' } });
        await waitFor(() => expect(within(panel).getByRole('button', { name: /Copiar muestras \([1-9]/ })).toBeInTheDocument());
        await act(async () => {
            fireEvent.click(within(panel).getByRole('button', { name: /Copiar muestras/ }));
        });
        expect(escribir).toHaveBeenCalledTimes(1);
        const datos = JSON.parse(escribir.mock.calls[0][0]);
        expect(datos.signo).toEqual(SIGNO);
        expect(datos.rangos.izquierda.giro).toBeDefined();
        const ultima = datos.muestras.at(-1);
        expect(ultima).toMatchObject({ paso: 'frente', etiqueta: 'izquierda', rostros: 1, calidadOk: true });
        expect(ultima.pose).toEqual({ giro: 25 / SIGNO.giro, cabeceo: 5 / SIGNO.cabeceo, alabeo: 0 });
        expect(typeof ultima.ms).toBe('number');
        expect(within(panel).getByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    });

    it('«Borrar» vacía las muestras acumuladas', async () => {
        await comenzar({ depuracion: true });
        const panel = await screen.findByRole('region', { name: 'Pose (depuración)' });
        fireEvent.click(within(panel).getByRole('button', { name: 'Pausar toma automática' }));
        await waitFor(() => expect(within(panel).getByRole('button', { name: /Copiar muestras \([1-9]/ })).toBeInTheDocument());
        fireEvent.click(within(panel).getByRole('button', { name: 'Borrar' }));
        expect(within(panel).getByRole('button', { name: 'Copiar muestras (0)' })).toBeInTheDocument();
    });
});

describe('RegistroFacialGuiado: cámara con problemas', () => {
    it('sin permiso explica qué hacer, deja reintentar y ofrece subir fotos', async () => {
        mocks.camara.mockImplementation(() => ({
            videoRef: { current: null }, capture: mocks.capture, restart: mocks.restart, estado: 'error', dispositivos: [],
            error: { code: 'PERMISO_DENEGADO', message: 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.' },
        }));
        await comenzar().catch(() => null);
        expect(await screen.findByRole('heading', { name: 'No pudimos abrir la cámara' })).toBeInTheDocument();
        expect(screen.getByText(/Permiso de cámara denegado/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(mocks.restart).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Subir fotos en lugar de usar la cámara' }));
        expect(await screen.findByRole('heading', { name: 'Subir fotos' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Revisar fotos' })).toBeDisabled();
    });
});

describe('RegistroFacialGuiado: revisión', () => {
    it('muestra las 5 tomas aceptadas y habilita el registro', async () => {
        await aRevisionCon5();
        expect(screen.getByText('Tomas aceptadas: 5 de 5 (mínimo 3).')).toBeInTheDocument();
        expect(fila(/^Toma 1,/)).toHaveAccessibleName(/De frente, Aceptada/);
        expect(fila(/^Toma 5,/)).toHaveAccessibleName(/Otra expresión o luz, Aceptada/);
        await esperarRegistrable(/Registrar plantilla con 5 fotos/);
        expect(screen.queryByRole('button', { name: /Registrar con una sola foto/ })).not.toBeInTheDocument();
    });

    it('«Repetir» vuelve a esa toma y, al aceptarla, regresa a la revisión', async () => {
        await aRevisionCon5();
        fireEvent.click(screen.getByRole('button', { name: 'Repetir toma 2' }));
        expect(await screen.findByRole('heading', { name: 'Gira a la izquierda' })).toBeInTheDocument();
        expect(screen.getByText('Toma 2 de 5')).toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: 'Revisa tus tomas' }, { timeout: 4000 })).toBeInTheDocument();
        await esperarRegistrable(/Registrar plantilla con 5 fotos/);
    });

    it('«Agregar» una toma omitida la captura y vuelve a la revisión con una foto más', async () => {
        await aRevisionCon3();
        fireEvent.click(screen.getByRole('button', { name: 'Agregar toma 4' }));
        expect(await screen.findByRole('heading', { name: 'Inclina hacia arriba' })).toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: 'Revisa tus tomas' }, { timeout: 4000 })).toBeInTheDocument();
        await esperarRegistrable(/Registrar plantilla con 4 fotos/);
    });

    it('si el servicio marca una toma anterior como otra persona, el registro queda bloqueado y se puede repetir', async () => {
        await comenzar();
        await tomarPasos(2);
        mocks.verificarFotos.mockImplementation(async (blobs) => conjunto(blobs.length, {
            aceptadas: blobs.length - 1, suficiente: false,
            fotos: Array.from({ length: blobs.length }, (_, i) => (i === 1 ? fotoOk(i, { estado: 'inconsistente', motivo_codigo: 'NO_COINCIDE', coseno_resto: 0.1 }) : fotoOk(i))),
        }));
        // La toma 3 es válida, pero la 2 quedó marcada: se avanza y la revisión pide repetirla.
        await esperarPaso('Inclina hacia arriba');
        ponerCalidad('POCA_LUZ');
        await omitir();
        await esperarPaso('Otra expresión o luz');
        await omitir();
        expect(await screen.findByRole('heading', { name: 'Revisa tus tomas' })).toBeInTheDocument();
        expect(fila(/^Toma 2,/)).toHaveAccessibleName(/No parece la misma persona/);
        expect(screen.getByText(/Repite o quita las tomas marcadas/, { selector: 'p' })).toBeInTheDocument();
        expect(botonRegistrar()).toBeDisabled();
    });

    it('muestra la advertencia de diversidad baja y el aviso de tomas que no coinciden', async () => {
        mocks.verificarFotos.mockImplementation(async (blobs) => conjunto(blobs.length, { ambiguo: blobs.length >= 5, advertencias: blobs.length >= 5 ? ['DIVERSIDAD_BAJA'] : [] }));
        await aRevisionCon5();
        expect(await screen.findByText('Las tomas no coinciden entre sí. Revisa que todas sean de la misma persona.')).toBeInTheDocument();
        expect(screen.getByText('Las tomas son casi idénticas; varía el ángulo, la expresión o la luz.')).toBeInTheDocument();
        expect(botonRegistrar()).toBeDisabled();
    });

    it('«Empezar de nuevo» descarta las tomas y regresa al primer paso', async () => {
        await aRevisionCon5();
        fireEvent.click(screen.getByRole('button', { name: 'Empezar de nuevo' }));
        expect(await screen.findByRole('heading', { name: 'De frente' })).toBeInTheDocument();
        expect(screen.getByText('Toma 1 de 5')).toBeInTheDocument();
    });
});

describe('RegistroFacialGuiado: registro', () => {
    const registrarCon5 = async (props) => {
        await aRevisionCon5(props);
        await esperarRegistrable(/Registrar plantilla con 5 fotos/);
        fireEvent.click(botonRegistrar());
    };

    it('éxito: registra con todas las fotos en orden y muestra la pantalla de listo con el índice', async () => {
        mocks.plantillaAlumno.mockResolvedValueOnce(SIN_PLANTILLA).mockResolvedValue({ activa: ACTIVA, archivadas: { total: 0, items: [] } });
        mocks.registrarPlantilla.mockResolvedValue({ id_plantilla: 5, n_fotos: 5, indice: { estado: 'activada', version: 'v004' }, muestra: { total: 5, usadas: 5, descartadas: [] } });
        const onCambio = vi.fn();
        await registrarCon5({ onCambio });
        expect(await screen.findByRole('heading', { name: 'Rostro registrado' })).toBeInTheDocument();
        expect(screen.getByText(/Plantilla creada con 5 fotos/)).toBeInTheDocument();
        expect(screen.getByText('Índice listo, versión v004.')).toBeInTheDocument();
        const arg = mocks.registrarPlantilla.mock.calls[0][0];
        expect(arg).toMatchObject({ idAlumno: 1, idConsent: 9 });
        expect(arg.fotos).toHaveLength(5);
        expect(arg.foto).toBeUndefined();
        expect(onCambio).toHaveBeenCalled();
        // Terminada la pantalla, la cámara sigue apagada y «Terminar» cierra sin pedir confirmación.
        expect(mocks.camara).toHaveBeenLastCalledWith(expect.objectContaining({ active: false }));
    });

    it('«Terminar» cierra el asistente sin confirmación', async () => {
        mocks.registrarPlantilla.mockResolvedValue({ n_fotos: 5, indice: { estado: 'activada', version: 'v004' } });
        const onClose = vi.fn();
        await registrarCon5({ onClose });
        fireEvent.click(await screen.findByRole('button', { name: 'Terminar' }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('¿Salir del registro facial?')).not.toBeInTheDocument();
    });

    it('mientras guarda avisa, no deja cerrar y pide confirmación al cerrar la pestaña', async () => {
        const envio = diferido();
        mocks.registrarPlantilla.mockImplementation(() => envio.promesa);
        await registrarCon5();
        expect(await screen.findByText('Subiendo 5 fotos y actualizando el índice. Puede tardar un minuto; no cierres esta ventana.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cerrar el registro facial' })).toBeDisabled();
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

    it('FOTOS_RECHAZADAS regresa a la revisión y marca la toma correcta', async () => {
        mocks.registrarPlantilla.mockRejectedValue(Object.assign(new Error('rechazo'), {
            code: 'FOTOS_RECHAZADAS',
            details: { fotos: [0, 1, 2, 3, 4].map((i) => (i === 3 ? fotoOk(i, { estado: 'inconsistente', motivo_codigo: 'NO_COINCIDE', coseno_resto: 0.12 }) : fotoOk(i))) },
        }));
        await registrarCon5();
        expect(await screen.findByText('Algunas fotos no sirven: repite las tomas marcadas.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Revisa tus tomas' })).toBeInTheDocument();
        expect(fila(/^Toma 4,/)).toHaveAccessibleName(/No parece la misma persona/);
        expect(fila(/^Toma 3,/)).toHaveAccessibleName(/Aceptada/);
        expect(botonRegistrar()).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Repetir toma 4' })).toBeEnabled();
    });

    it('FOTOS_DUPLICADAS marca la toma repetida con el número de la original', async () => {
        mocks.registrarPlantilla.mockRejectedValue(Object.assign(new Error('dup'), { code: 'FOTOS_DUPLICADAS', details: { duplicadas: [{ indice: 2, de: 0 }] } }));
        await registrarCon5();
        expect(await screen.findByText('Hay fotos repetidas: usa tomas distintas.')).toBeInTheDocument();
        expect(fila(/^Toma 3,/)).toHaveAccessibleName(/Igual a la toma 1/);
    });

    it('error 503 al registrar vuelve a la revisión, ofrece reintento y reintenta el mismo camino', async () => {
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
        await comenzar();
        await tomarPasos(3);
        // El servicio marca las tres primeras como otra persona y acepta solo la 4.ª: queda una única toma aceptada.
        mocks.verificarFotos.mockImplementation(async (blobs) => conjunto(blobs.length, {
            aceptadas: 1, suficiente: false,
            fotos: Array.from({ length: blobs.length }, (_, i) => (i < blobs.length - 1 ? fotoOk(i, { estado: 'inconsistente', motivo_codigo: 'NO_COINCIDE' }) : fotoOk(i))),
        }));
        await esperarPaso('Otra expresión o luz');
        ponerCalidad('POCA_LUZ');
        await omitir();
        await screen.findByRole('heading', { name: 'Revisa tus tomas' });
        expect(botonRegistrar()).toBeDisabled();
        const una = await screen.findByRole('button', { name: 'Registrar con una sola foto' });
        await waitFor(() => expect(una).toBeEnabled());
        fireEvent.click(una);
        expect(await screen.findByText(/Plantilla creada con 1 foto\./)).toBeInTheDocument();
        const arg = mocks.registrarPlantilla.mock.calls[0][0];
        expect(arg.foto).toBeInstanceOf(Blob);
        expect(arg.fotos).toBeUndefined();
    });

    it('con plantilla activa el botón dice que reemplaza y la nota explica que la anterior se archivará', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: ACTIVA, archivadas: { total: 0, items: [] } });
        await aRevisionCon5();
        await esperarRegistrable(/^Reemplazar plantilla con 5 fotos$/);
        expect(screen.getByText(/La plantilla anterior se archivará/)).toBeInTheDocument();
    });

    // 360 px: ui/Button lleva whitespace-nowrap, así que una etiqueta de más de ~36 caracteres (~250 px a 14 px) se sale
    // de la pantalla (en jsdom no hay layout; se vigila el largo de las etiquetas de los botones del pie).
    it('las etiquetas de los botones de la revisión caben en 360 px', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: ACTIVA, archivadas: { total: 0, items: [] } });
        await aRevisionCon5();
        await esperarRegistrable(/Reemplazar plantilla con 5 fotos/);
        const MAX_CARACTERES = 36;
        const largos = screen.getAllByRole('button').filter((b) => b.className.includes('whitespace-nowrap') && b.textContent.trim().length > MAX_CARACTERES);
        expect(largos.map((b) => b.textContent)).toEqual([]);
    });
});

describe('RegistroFacialGuiado: cerrar', () => {
    it('con tomas pide confirmación: «Cancelar» sigue y «Salir y descartar» cierra y limpia', async () => {
        const onClose = vi.fn();
        await comenzar({ onClose });
        await tomarPasos(1);
        ponerCalidad('POCA_LUZ');
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar el registro facial' }));
        expect(await screen.findByText('¿Salir del registro facial?')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        await waitFor(() => expect(screen.queryByText('¿Salir del registro facial?')).not.toBeInTheDocument());
        expect(screen.getByRole('heading', { name: 'Gira a la izquierda' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar el registro facial' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Salir y descartar' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Esc con tomas pide confirmación en vez de cerrar', async () => {
        const onClose = vi.fn();
        await comenzar({ onClose });
        await tomarPasos(1);
        ponerCalidad('POCA_LUZ');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(await screen.findByText('¿Salir del registro facial?')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });
});

describe('RegistroFacialGuiado: subir fotos', () => {
    it('la portada lleva a «Subir fotos», que pide al menos 3 antes de revisar', async () => {
        await abrir();
        fireEvent.click(screen.getByRole('button', { name: 'Subir fotos en lugar de usar la cámara' }));
        expect(await screen.findByRole('heading', { name: 'Subir fotos' })).toBeInTheDocument();
        expect(screen.getByText('Sube al menos 3 fotos.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Agregar fotos (JPG)' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Revisar fotos' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
        expect(await screen.findByText('Registra el rostro en 5 tomas')).toBeInTheDocument();
    });
});

describe('RegistroFacialGuiado: autoservicio (propio)', () => {
    // Las funciones de la API van a useApiQuery: deben ser estables, así que se arman una vez, fuera del arnés.
    const apiPropia = {
        consentimientos: mocks.consentimientosAlumno,
        plantilla: mocks.plantillaAlumno,
        verificar: mocks.verificarFotos,
        registrar: mocks.registrarPlantilla,
        permiteUna: false,
    };
    function ArnesPropio() {
        const p = usePlantillaFacial({ api: apiPropia });
        return p.vigente ? <RegistroFacialGuiado p={p} propio nombreAlumno="Ana Pérez" onClose={() => {}} ritmo={RITMO} /> : null;
    }

    it('la portada no ofrece subir fotos y le habla al alumno en segunda persona', async () => {
        render(<ArnesPropio />);
        await screen.findByRole('dialog', { name: 'Registro facial' });
        expect(screen.queryByRole('button', { name: 'Subir fotos en lugar de usar la cámara' })).not.toBeInTheDocument();
        expect(screen.getByText(/Mírate en la cámara/)).toBeInTheDocument();
        expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Comenzar' })).toBeEnabled();
    });

    it('sin permiso de cámara solo ofrece reintentar: no hay salida por archivo', async () => {
        mocks.camara.mockImplementation(() => ({
            videoRef: { current: null }, capture: mocks.capture, restart: mocks.restart, estado: 'error', dispositivos: [],
            error: { code: 'PERMISO_DENEGADO', message: 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.' },
        }));
        render(<ArnesPropio />);
        await screen.findByRole('dialog', { name: 'Registro facial' });
        fireEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
        expect(await screen.findByRole('heading', { name: 'No pudimos abrir la cámara' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'Subir fotos en lugar de usar la cámara' })).not.toBeInTheDocument();
    });
});
