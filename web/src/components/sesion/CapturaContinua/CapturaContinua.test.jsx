// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import { enviarCaptura } from '@/lib/http/captura.js';
import { cambiarRelojDemo, leerRelojDemo } from '@/lib/local/relojCliente.js';
import CapturaContinua from './CapturaContinua.jsx';

const camara = vi.hoisted(() => ({ props: null, restart: vi.fn() }));
vi.mock('@/lib/http/captura.js', () => ({ enviarCaptura: vi.fn() }));
vi.mock('@/lib/local/relojCliente.js', () => ({ leerRelojDemo: vi.fn(), cambiarRelojDemo: vi.fn() }));
// Cámara real simulada con un componente de mentira: deja ver con qué props se monta y disparar onReady / onError.
vi.mock('@/components/ui/CameraCapture', async () => {
    const { useImperativeHandle } = await import('react');
    return {
        default: function CamaraFalsa(props) {
            camara.props = props;
            useImperativeHandle(props.ref, () => ({ capture: async () => new Blob(['real'], { type: 'image/jpeg' }), restart: camara.restart }), []);
            return <div data-testid="camara-real" data-activa={String(props.active)} className={props.className} />;
        },
    };
});

const ok = { id_captura: 1, rostros: 6, validas: 5, no_atribuidas: 1, ya_procesada: false, cambios: [] };
const sesion = { id_sesion: 19, estatus: 'abierta', modo_registro: 'automatico', en_ventana: true, fase: 'presente', minuto_actual: 5, fecha: '2026-09-14', hora_inicio: '07:00:00', tolerancia_min: 20, limite_presente_min: 10, intervalo_muestreo_seg: 15 };
const camaraNavegador = { id_camara: 2, tipo: 'navegador', estatus: 'activa', posicion: 'frente' };
const camaraIp = { id_camara: 3, tipo: 'ip', estatus: 'activa', posicion: 'fondo' };
const alumnos = Array.from({ length: 6 }, (_, i) => ({ id_alumno: i + 1, nombre: `Alumno ${i + 1}`, inscripcion: 'activa' }));
const totales = { inscritos: 6, presentes: 2, retardos: 1, sin_registro: 3, pendientes: 0 };

const props = (extra = {}) => ({ sesion, camaras: [camaraNavegador], alumnos, totales, activo: true, onFin: vi.fn(), onRevisar: vi.fn(), onRegistrarManual: vi.fn(), ...extra });
const montar = (extra) => render(<CapturaContinua {...props(extra)} />);
const avanzar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const camaraLista = () => act(() => camara.props.onReady());
const camaraConError = (mensaje) => act(() => camara.props.onError({ message: mensaje }));
const estado = (extra = {}) => ({ activo: true, corre: true, ahora: '2026-09-14T07:03:00-06:00', fecha: '2026-09-14', hora: '07:03:00', inicial: '2026-09-14T07:12:00-06:00', ...extra });

beforeEach(() => {
    vi.useFakeTimers();
    camara.props = null;
    camara.restart.mockReset();
    enviarCaptura.mockReset().mockResolvedValue(ok);
    leerRelojDemo.mockReset().mockResolvedValue(estado());
    cambiarRelojDemo.mockReset().mockImplementation(async () => estado());
    const ctx = {
        fillStyle: '',
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: () => {},
        fillRect: () => {},
        fillText: () => {},
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, tipo) => cb(new Blob(['simulado'], { type: tipo })));
});
afterEach(() => vi.useRealTimers());

describe('CapturaContinua: el panel de pase de lista', () => {
    it('reúne vista de cámara, cifra, última captura y acciones, con un título accesible', () => {
        montar();
        const panel = screen.getByRole('region', { name: 'Pase de lista con cámara' });
        expect(within(panel).getByRole('status')).toHaveTextContent('En pausa'); // la cámara aún no está lista
        expect(within(panel).getByText(/de/, { selector: 'p[aria-live] span' })).toBeInTheDocument();
        expect(within(panel).getByText('Esperando la primera captura…')).toBeInTheDocument();
        expect(within(panel).getByRole('button', { name: 'Revisar y cerrar' })).toBeInTheDocument();
        expect(within(panel).getByRole('button', { name: 'Registrar manualmente' })).toBeInTheDocument();
        // El cierre vive en la revisión (paso 3): aquí solo se pasa a ella.
        expect(within(panel).queryByRole('button', { name: 'Cerrar pase de lista' })).toBeNull();
    });

    it('la vista de cámara es 16:9 y se oculta el aviso propio de CameraCapture (el panel da el suyo, con salidas)', () => {
        montar();
        expect(screen.getByTestId('camara-real').className).toContain('[&>div.relative]:aspect-video');
        expect(screen.getByTestId('camara-real').className).toContain('[&>[role=alert]]:hidden');
    });

    it('con la cámara lista y en ventana: «Reconociendo», y la etiqueta de la cámara', async () => {
        montar();
        await camaraLista();
        expect(screen.getAllByRole('status')[0]).toHaveTextContent('Reconociendo');
        expect(screen.getByText('Cámara frente')).toBeInTheDocument();
    });

    it('fuera de la ventana: «Fuera de la ventana» y la cámara se apaga', () => {
        const p = props({ activo: false, sesion: { ...sesion, en_ventana: false } });
        render(<CapturaContinua {...p} />);
        expect(screen.getAllByRole('status')[0]).toHaveTextContent('Fuera de la ventana');
        expect(screen.getByTestId('camara-real')).toHaveAttribute('data-activa', 'false');
    });

    it('«Revisar y cerrar» está disponible aun en plena tolerancia (revisar no cierra nada) y no trae notas de cierre', () => {
        const p = props();
        render(<CapturaContinua {...p} />);
        const revisar = screen.getByRole('button', { name: 'Revisar y cerrar' });
        expect(revisar).toBeEnabled();
        expect(revisar).not.toHaveAccessibleDescription();
        expect(screen.queryByText(/El cierre se habilita/)).toBeNull();
        fireEvent.click(revisar);
        expect(p.onRevisar).toHaveBeenCalledTimes(1);
    });

    it('revisar y registrar manualmente llaman a sus acciones', () => {
        const p = props({ sesion: { ...sesion, en_ventana: false }, activo: false });
        render(<CapturaContinua {...p} />);
        fireEvent.click(screen.getByRole('button', { name: 'Revisar y cerrar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Registrar manualmente' }));
        expect(p.onRevisar).toHaveBeenCalledTimes(1);
        expect(p.onRegistrarManual).toHaveBeenCalledTimes(1);
    });

    it('con ?pasar-lista=1 (enfocar) el panel recibe el foco al montarse; sin él, no', () => {
        const { unmount } = montar({ enfocar: true });
        expect(screen.getByRole('region', { name: 'Pase de lista con cámara' })).toHaveFocus();
        unmount();
        montar({ enfocar: false });
        expect(screen.getByRole('region', { name: 'Pase de lista con cámara' })).not.toHaveFocus();
    });

    it('con una cámara IP y sin cámara del navegador: sin vista previa, pero reconociendo', async () => {
        montar({ camaras: [camaraIp] });
        await avanzar(1);
        expect(screen.queryByTestId('camara-real')).toBeNull();
        expect(screen.getByText('Sin vista previa: se toman fotogramas de las cámaras IP del aula.')).toBeInTheDocument();
        expect(screen.getByText('Cámaras IP activas: 1.')).toBeInTheDocument();
        expect(screen.getAllByRole('status')[0]).toHaveTextContent('Reconociendo');
        expect(enviarCaptura).toHaveBeenCalledWith(expect.objectContaining({ idCamara: 3, imagen: null }));
    });

    it('sin ninguna fuente lo dice y deja registrar a mano', () => {
        montar({ camaras: [] });
        expect(screen.getByText(/Sin fuentes de captura activas/)).toBeInTheDocument();
        expect(screen.getByText('No hay una cámara activa en este dispositivo.')).toBeInTheDocument();
    });

    it('con varias cámaras del aula se elige cuál usar', () => {
        montar({ camaras: [camaraNavegador, { ...camaraNavegador, id_camara: 7, posicion: 'fondo' }] });
        const selector = screen.getByRole('combobox', { name: 'Cámara del aula a usar' });
        expect([...selector.options].map((o) => o.textContent)).toEqual(['Cámara frente', 'Cámara fondo']);
        fireEvent.change(selector, { target: { value: '7' } });
        expect(screen.getByText('Cámara fondo', { selector: 'span.truncate' })).toBeInTheDocument();
    });

    it('«Usar la cámara de este dispositivo» se puede desmarcar', () => {
        montar();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Usar la cámara de este dispositivo' }));
        expect(screen.queryByTestId('camara-real')).toBeNull();
    });

    it('la cifra viene de los totales del monitor', () => {
        const { container } = montar();
        expect(container.querySelector('p[aria-live]')).toHaveTextContent('2 de 6 presentes');
    });
});

describe('CapturaContinua: sin acceso a la cámara', () => {
    it('avisa con claridad y ofrece las salidas que hay', async () => {
        const p = props({ camaras: [camaraNavegador, camaraIp] });
        render(<CapturaContinua {...p} />);
        await camaraConError('Permiso denegado: permite el acceso a la cámara en el navegador.');
        const aviso = screen.getByRole('alert');
        expect(aviso).toHaveTextContent('No se pudo usar la cámara de este dispositivo');
        expect(aviso).toHaveTextContent('Permiso denegado');
        expect(within(aviso).getByRole('button', { name: 'Reintentar con la cámara' })).toBeInTheDocument();
        expect(within(aviso).getByRole('button', { name: 'Seguir con la cámara IP del aula' })).toBeInTheDocument();
        expect(within(aviso).getByRole('button', { name: 'Registrar manualmente' })).toBeInTheDocument();
        // Sin reloj simulado (producción) no se ofrece la cámara simulada.
        expect(within(aviso).queryByRole('button', { name: 'Usar la cámara simulada' })).toBeNull();
        fireEvent.click(within(aviso).getByRole('button', { name: 'Registrar manualmente' }));
        expect(p.onRegistrarManual).toHaveBeenCalledTimes(1);
    });

    it('con la cámara en error la vista conserva su marco 16:9 y dice por qué no hay imagen (no se colapsa bajo los chips)', async () => {
        montar();
        expect(screen.queryByText(/^Sin imagen/)).toBeNull();
        await camaraConError('Sin cámara.');
        const marco = screen.getByText(/^Sin imagen/).closest('p').parentElement.parentElement;
        expect(marco.className).toContain('aspect-video');
        expect(within(marco).getByRole('status')).toHaveTextContent('En pausa');
        // «Reintentar» devuelve la cámara y quita el mensaje.
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar con la cámara' }));
        expect(screen.queryByText(/^Sin imagen/)).toBeNull();
    });

    it('«Reintentar» limpia el aviso y reinicia la cámara', async () => {
        montar();
        await camaraConError('Sin cámara.');
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar con la cámara' }));
        expect(camara.restart).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('«Seguir con la cámara IP» deja de pedir la cámara de este dispositivo y sigue muestreando con la IP', async () => {
        montar({ camaras: [camaraNavegador, camaraIp] });
        await camaraConError('Sin cámara.');
        fireEvent.click(screen.getByRole('button', { name: 'Seguir con la cámara IP del aula' }));
        expect(screen.queryByTestId('camara-real')).toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
        await avanzar(1);
        expect(enviarCaptura).toHaveBeenCalledWith(expect.objectContaining({ idCamara: 3, imagen: null }));
    });

    it('con el reloj simulado ofrece la cámara simulada y, al elegirla, la activa', async () => {
        leerRelojDemo.mockResolvedValue(estado({ corre: true }));
        montar({ simulado: true });
        await camaraConError('Sin cámara.');
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Usar la cámara simulada' }));
        });
        expect(screen.getByRole('switch', { name: /Cámara simulada \(demostración\)/ })).toHaveAttribute('aria-checked', 'true');
        expect(screen.queryByTestId('camara-real')).toBeNull();
    });
});

describe('CapturaContinua: avisos del muestreo', () => {
    it('servicio de reconocimiento no disponible: el aviso está dentro del panel y el chip pasa a «En pausa»', async () => {
        enviarCaptura.mockRejectedValue(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'caído', status: 503 }));
        montar();
        await camaraLista();
        await avanzar(1);
        const panel = screen.getByRole('region', { name: 'Pase de lista con cámara' });
        expect(within(panel).getByRole('alert')).toHaveTextContent('Reconocimiento no disponible');
        expect(within(panel).getByRole('alert')).toHaveTextContent('Registra manualmente a quien falte.');
        expect(within(panel).getAllByRole('status')[0]).toHaveTextContent('En pausa');
    });

    it('MARCA_FUTURA: un solo aviso claro con «Reintentar»; el muestreo se detiene y no insiste', async () => {
        enviarCaptura.mockRejectedValue(new ApiError({ code: 'MARCA_FUTURA', message: 'La marca de tiempo de la captura está en el futuro.', status: 400 }));
        montar();
        await camaraLista();
        await avanzar(1);
        const aviso = screen.getByRole('alert');
        expect(aviso).toHaveTextContent('La hora de la captura no es válida');
        expect(aviso).toHaveTextContent('La marca de tiempo de la captura está en el futuro.');
        await avanzar(120000);
        expect(enviarCaptura).toHaveBeenCalledTimes(1);
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        // «Reintentar» vuelve a probar (aquí sigue fallando: vuelve el mismo aviso, uno solo).
        await act(async () => {
            fireEvent.click(within(aviso).getByRole('button', { name: 'Reintentar' }));
        });
        await avanzar(1);
        expect(enviarCaptura).toHaveBeenCalledTimes(2);
        expect(screen.getAllByRole('alert')).toHaveLength(1);
    });

    it('con el reloj simulado, el aviso de hora apunta a la tarjeta del reloj', async () => {
        enviarCaptura.mockRejectedValue(new ApiError({ code: 'MARCA_FUTURA', message: 'x', status: 400 }));
        montar({ simulado: true });
        await camaraLista();
        await avanzar(1);
        expect(screen.getByText(/usa Restablecer o Correr/)).toBeInTheDocument();
    });

    it('no manda la hora del equipo en ninguna captura', async () => {
        montar({ camaras: [camaraNavegador, camaraIp] });
        await camaraLista();
        await avanzar(1);
        expect(enviarCaptura).toHaveBeenCalledTimes(2);
        for (const [args] of enviarCaptura.mock.calls) expect(args).not.toHaveProperty('marcaTiempo');
    });

    it('con el reloj de demostración detenido las capturas se repiten: lo explica y ofrece ponerlo en marcha', async () => {
        enviarCaptura.mockResolvedValue({ ...ok, ya_procesada: true });
        montar({ simulado: true });
        await camaraLista();
        await avanzar(1);
        await avanzar(15000);
        const aviso = screen.getByRole('alert');
        expect(aviso).toHaveTextContent('Las capturas no suman');
        await act(async () => {
            fireEvent.click(within(aviso).getByRole('button', { name: 'Poner en marcha el reloj' }));
        });
        expect(cambiarRelojDemo).toHaveBeenCalledWith({ correr: true });
    });

    it('esa advertencia no sale en producción (sin reloj simulado)', async () => {
        enviarCaptura.mockResolvedValue({ ...ok, ya_procesada: true });
        montar({ simulado: false });
        await camaraLista();
        await avanzar(1);
        await avanzar(15000);
        expect(screen.queryByText('Las capturas no suman')).toBeNull();
    });

    it('un 429 no es una alarma: una línea discreta, sin alerta', async () => {
        enviarCaptura.mockRejectedValue(new ApiError({ code: 'DEMASIADOS_INTENTOS', message: 'espera', status: 429 }));
        montar();
        await camaraLista();
        await avanzar(1);
        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.getByText(/pidió espaciar las capturas/)).toBeInTheDocument();
    });

    it('fin de muestreo: avisa al padre y deja el aviso informativo', async () => {
        enviarCaptura.mockRejectedValue(new ApiError({ code: 'FUERA_DE_VENTANA', message: 'fin', status: 409, details: { fin_muestreo: true } }));
        const p = props();
        render(<CapturaContinua {...p} />);
        await camaraLista();
        await avanzar(1);
        expect(p.onFin).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Muestreo detenido')).toBeInTheDocument();
    });

    it('la última captura se muestra con rostros, válidos y cuánto hace', async () => {
        montar();
        await camaraLista();
        await avanzar(1);
        await avanzar(1); // el «hace X s» arranca con su primer tic
        expect(screen.getByText(/Última captura/).closest('p')).toHaveTextContent('Última captura: 6 rostros · 5 válidos · hace');
    });
});

describe('CapturaContinua: cámara simulada (solo con reloj simulado)', () => {
    it('en producción (reloj real) no existe en el DOM', () => {
        montar({ simulado: false });
        expect(screen.queryByRole('switch')).toBeNull();
        expect(screen.queryByText(/Cámara simulada/)).toBeNull();
    });

    it('con el reloj simulado aparece, apagada, y sin tocar la cámara real', () => {
        montar({ simulado: true });
        const interruptor = screen.getByRole('switch', { name: /Cámara simulada \(demostración\)/ });
        expect(interruptor).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByTestId('camara-real')).toBeInTheDocument();
    });

    it('al activarla: pone el reloj en marcha, reemplaza la cámara por el lienzo y envía fotogramas JPEG con los rostros de los alumnos', async () => {
        leerRelojDemo.mockResolvedValue(estado({ corre: false, ahora: '2026-09-14T07:12:00-06:00' }));
        cambiarRelojDemo.mockImplementation(async (cuerpo) => estado({ ahora: cuerpo.fijar ? '2026-09-14T07:02:00-06:00' : '2026-09-14T07:12:00-06:00' }));
        montar({ simulado: true });
        await camaraLista();
        await avanzar(1);
        enviarCaptura.mockClear();
        await act(async () => {
            fireEvent.click(screen.getByRole('switch', { name: /Cámara simulada \(demostración\)/ }));
        });
        await avanzar(1);
        // Reloj: detenido -> en marcha, y a las 07:12 (después del límite de Presente) -> minuto 2 de la clase.
        expect(cambiarRelojDemo.mock.calls.map(([c]) => c)).toEqual([{ correr: true }, { fijar: '2026-09-14 07:02' }]);
        // La cámara real se apaga (se desmonta) y su lugar lo toma el lienzo, que es la vista previa.
        expect(screen.queryByTestId('camara-real')).toBeNull();
        expect(screen.getByRole('img', { name: /Vista previa de la cámara simulada, ciclo \d: 6 alumnos/ })).toBeInTheDocument();
        expect(screen.getByText('Cámara simulada', { selector: 'span.truncate' })).toBeInTheDocument();
        // Se envió un fotograma JPEG de la cámara del navegador del aula.
        expect(enviarCaptura).toHaveBeenCalledTimes(1);
        const envio = enviarCaptura.mock.calls[0][0];
        expect(envio.idCamara).toBe(2);
        expect(envio.imagen).toBeInstanceOf(Blob);
        expect(envio.imagen.type).toBe('image/jpeg');
        expect(screen.getAllByRole('status')[0]).toHaveTextContent('Reconociendo');
    });

    it('muestrea al ritmo mínimo seguro del servidor (9 s con 15 s), no cada 5 s', async () => {
        montar({ simulado: true });
        await camaraLista();
        await act(async () => {
            fireEvent.click(screen.getByRole('switch', { name: /Cámara simulada \(demostración\)/ }));
        });
        await avanzar(1);
        const antes = enviarCaptura.mock.calls.length;
        expect(antes).toBeGreaterThanOrEqual(1);
        await avanzar(5000);
        expect(enviarCaptura).toHaveBeenCalledTimes(antes);
        await avanzar(4100);
        expect(enviarCaptura).toHaveBeenCalledTimes(antes + 1);
    });

    it('apagarla devuelve la cámara real', async () => {
        montar({ simulado: true });
        await act(async () => {
            fireEvent.click(screen.getByRole('switch', { name: /Cámara simulada \(demostración\)/ }));
        });
        expect(screen.queryByTestId('camara-real')).toBeNull();
        await act(async () => {
            fireEvent.click(screen.getByRole('switch', { name: /Cámara simulada \(demostración\)/ }));
        });
        expect(screen.getByTestId('camara-real')).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: /cámara simulada/ })).toBeNull();
    });

    it('sin cámara del navegador en el aula no se puede simular (el servidor no admite imagen para una cámara IP)', () => {
        montar({ simulado: true, camaras: [camaraIp] });
        expect(screen.getByRole('switch', { name: /Cámara simulada \(demostración\)/ })).toBeDisabled();
        expect(screen.getByText(/no tiene una cámara del navegador activa/)).toBeInTheDocument();
    });

    it('al terminar los ciclos pedidos el chip pasa a «En pausa»', async () => {
        montar({ simulado: true });
        await act(async () => {
            fireEvent.change(screen.getByRole('combobox', { name: 'Detener después de' }), { target: { value: '3' } });
        });
        await act(async () => {
            fireEvent.click(screen.getByRole('switch', { name: /Cámara simulada \(demostración\)/ }));
        });
        await avanzar(1);
        await avanzar(9000);
        await avanzar(9000);
        expect(enviarCaptura).toHaveBeenCalledTimes(3);
        await avanzar(9000);
        expect(enviarCaptura).toHaveBeenCalledTimes(3);
        expect(screen.getByText(/Simulación completa: 3 ciclos enviados/)).toBeInTheDocument();
        expect(screen.getAllByRole('status')[0]).toHaveTextContent('En pausa');
    });
});
