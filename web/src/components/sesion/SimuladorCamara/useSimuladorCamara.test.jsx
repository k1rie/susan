// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTO_RELOJ_CAMBIO } from '@/hooks/data/eventos.js';
import { ApiError } from '@/lib/api/errors.js';
import { cambiarRelojDemo, leerRelojDemo } from '@/lib/local/relojCliente.js';
import useSimuladorCamara, { prepararReloj } from './useSimuladorCamara.js';

vi.mock('@/lib/local/relojCliente.js', () => ({ leerRelojDemo: vi.fn(), cambiarRelojDemo: vi.fn() }));

const sesion = { id_sesion: 19, fecha: '2026-09-14', hora_inicio: '07:00:00', limite_presente_min: 10, tolerancia_min: 20, intervalo_muestreo_seg: 15 };
const alumnos = Array.from({ length: 6 }, (_, i) => ({ id_alumno: i + 1, nombre: `Alumno ${i + 1}`, inscripcion: 'activa' }));
const estado = (extra = {}) => ({ activo: true, corre: false, ahora: '2026-09-14T07:12:00-06:00', fecha: '2026-09-14', hora: '07:12:00', inicial: '2026-09-14T07:12:00-06:00', ...extra });
const base = { habilitado: true, camaraDisponible: true, sesion, alumnos };

// jsdom no trae canvas: se anota lo que se pinta y toBlob devuelve un JPEG falso.
let rects;
let textos;
beforeEach(() => {
    rects = [];
    textos = [];
    const ctx = {
        fillStyle: '',
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: vi.fn(),
        fillRect: (x, y, w, h) => rects.push({ x, y, w, h, color: ctx.fillStyle }),
        fillText: (t) => textos.push(t),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function toBlob(cb, tipo, calidad) {
        cb(new Blob(['jpeg'], { type: tipo }));
        toBlob.calidad = calidad;
    });
    leerRelojDemo.mockReset().mockResolvedValue(estado({ corre: true, ahora: '2026-09-14T07:03:00-06:00' }));
    cambiarRelojDemo.mockReset().mockImplementation(async (cuerpo) => estado({ corre: true, ...(cuerpo.fijar ? { ahora: '2026-09-14T07:02:00-06:00' } : {}) }));
});

async function encender(result) {
    await act(async () => {
        await result.current.encender();
    });
}

describe('prepararReloj', () => {
    it('detenido y pasado el límite de Presente: lo pone en marcha y lo lleva al minuto 2, y avisa del cambio', async () => {
        leerRelojDemo.mockResolvedValue(estado({ corre: false }));
        const escuchar = vi.fn();
        window.addEventListener(EVENTO_RELOJ_CAMBIO, escuchar);
        const { avisos } = await prepararReloj({ sesion, escenario: 'a_tiempo', ajustar: true });
        window.removeEventListener(EVENTO_RELOJ_CAMBIO, escuchar);
        expect(cambiarRelojDemo.mock.calls.map(([c]) => c)).toEqual([{ correr: true }, { fijar: '2026-09-14 07:02' }]);
        expect(avisos).toHaveLength(2);
        expect(avisos[0]).toContain('estaba detenido');
        expect(avisos[1]).toContain('minuto 2');
        expect(avisos[1]).toContain('07:02');
        expect(escuchar).toHaveBeenCalledTimes(1);
    });

    it('en marcha y con margen: no toca nada ni emite el evento', async () => {
        const escuchar = vi.fn();
        window.addEventListener(EVENTO_RELOJ_CAMBIO, escuchar);
        const { avisos } = await prepararReloj({ sesion, escenario: 'a_tiempo', ajustar: true });
        window.removeEventListener(EVENTO_RELOJ_CAMBIO, escuchar);
        expect(cambiarRelojDemo).not.toHaveBeenCalled();
        expect(avisos).toEqual([]);
        expect(escuchar).not.toHaveBeenCalled();
    });

    it('sin la opción de ajustar solo lo pone en marcha', async () => {
        leerRelojDemo.mockResolvedValue(estado({ corre: false }));
        await prepararReloj({ sesion, escenario: 'a_tiempo', ajustar: false });
        expect(cambiarRelojDemo.mock.calls.map(([c]) => c)).toEqual([{ correr: true }]);
    });

    it('«Escalonados» siempre arranca en el minuto 2 (sus saltos suponen ese punto de partida)', async () => {
        await prepararReloj({ sesion, escenario: 'escalonados', ajustar: true });
        expect(cambiarRelojDemo.mock.calls.map(([c]) => c)).toEqual([{ fijar: '2026-09-14 07:02' }]);
    });
});

describe('useSimuladorCamara', () => {
    it('apagada por omisión: sin simulación activa', () => {
        const { result } = renderHook(() => useSimuladorCamara(base));
        expect(result.current.encendido).toBe(false);
        expect(result.current.activo).toBe(false);
        expect(result.current.escenario).toBe('a_tiempo');
        expect(result.current.maxCiclos).toBe(5);
        expect(result.current.total).toBe(6);
    });

    it('el ritmo de muestreo es el mínimo seguro del servidor: 9 s con un intervalo de 15 s', () => {
        const { result } = renderHook(() => useSimuladorCamara(base));
        expect(result.current.intervaloSeg).toBe(9);
    });

    it('al encender prepara el reloj ANTES de activarse y después queda activa', async () => {
        leerRelojDemo.mockResolvedValue(estado({ corre: false }));
        const { result } = renderHook(() => useSimuladorCamara(base));
        let promesa;
        act(() => {
            promesa = result.current.encender();
        });
        // Mientras prepara el reloj no hay captura posible: no se mandan lecturas con la hora equivocada.
        expect(result.current.encendido).toBe(true);
        expect(result.current.preparando).toBe(true);
        expect(result.current.activo).toBe(false);
        await act(async () => {
            await promesa;
        });
        expect(result.current.preparando).toBe(false);
        expect(result.current.activo).toBe(true);
        expect(result.current.aviso.tono).toBe('info');
        expect(result.current.aviso.texto).toContain('en marcha');
    });

    it('si el reloj no se puede preparar avisa, pero la simulación queda activa', async () => {
        leerRelojDemo.mockRejectedValue(new ApiError({ code: 'NO_ENCONTRADO', message: 'El recurso no existe.', status: 404 }));
        const { result } = renderHook(() => useSimuladorCamara(base));
        await encender(result);
        expect(result.current.activo).toBe(true);
        expect(result.current.aviso.tono).toBe('warning');
        expect(result.current.aviso.texto).toContain('El recurso no existe.');
    });

    it('sin reloj simulado (producción) o sin cámara de navegador nunca se activa', async () => {
        const produccion = renderHook(() => useSimuladorCamara({ ...base, habilitado: false }));
        await encender(produccion.result);
        expect(produccion.result.current.activo).toBe(false);
        expect(produccion.result.current.encendido).toBe(false);
        const sinCamara = renderHook(() => useSimuladorCamara({ ...base, camaraDisponible: false }));
        await encender(sinCamara.result);
        expect(sinCamara.result.current.activo).toBe(false);
    });

    it('apagarla mientras se prepara el reloj descarta el resultado tardío (no deja un aviso ni se reactiva)', async () => {
        leerRelojDemo.mockResolvedValue(estado({ corre: false }));
        let liberar;
        // La primera llamada (poner en marcha) queda pendiente hasta que el test la libere; las siguientes responden de inmediato.
        cambiarRelojDemo.mockImplementationOnce(() => new Promise((resolver) => { liberar = () => resolver(estado({ corre: true })); })).mockImplementation(async () => estado());
        const { result } = renderHook(() => useSimuladorCamara(base));
        let promesa;
        act(() => {
            promesa = result.current.encender();
        });
        await vi.waitFor(() => expect(cambiarRelojDemo).toHaveBeenCalled());
        act(() => result.current.apagar());
        await act(async () => {
            liberar();
            await promesa;
        });
        expect(result.current.encendido).toBe(false);
        expect(result.current.activo).toBe(false);
        expect(result.current.preparando).toBe(false);
        expect(result.current.aviso).toBeNull();
    });

    it('en producción (sin reloj simulado) encender no toca nada: ni estado ni la ruta del reloj', async () => {
        const { result } = renderHook(() => useSimuladorCamara({ ...base, habilitado: false }));
        await encender(result);
        expect(result.current.encendido).toBe(false);
        expect(leerRelojDemo).not.toHaveBeenCalled();
        expect(cambiarRelojDemo).not.toHaveBeenCalled();
        expect(result.current.total).toBe(0);
    });

    it('apagar desactiva y limpia el aviso', async () => {
        leerRelojDemo.mockResolvedValue(estado({ corre: false }));
        const { result } = renderHook(() => useSimuladorCamara(base));
        await encender(result);
        act(() => result.current.alternar(false));
        expect(result.current.encendido).toBe(false);
        expect(result.current.activo).toBe(false);
        expect(result.current.aviso).toBeNull();
    });

    it('capturar() devuelve un JPEG dibujado con los rostros del ciclo y avanza el ciclo', async () => {
        const { result } = renderHook(() => useSimuladorCamara({ ...base, alumnos }));
        await encender(result);
        let blob;
        await act(async () => {
            blob = await result.current.capturar();
        });
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('image/jpeg');
        expect(result.current.ciclo).toBe(1);
        // Ciclo 0 de «a_tiempo»: los 6 alumnos, sin visitante (pasa en el ciclo 1): marco + interior por rostro.
        expect(rects).toHaveLength(12);
        expect(textos).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
        expect(rects[0].color).toBe('rgb(255, 0, 255)');
        await act(async () => {
            await result.current.capturar();
        });
        expect(result.current.ciclo).toBe(2);
        expect(textos.at(-1)).toBe('Visita');
    });

    it('al llegar al límite de ciclos devuelve null y marca la simulación como completa', async () => {
        const { result } = renderHook(() => useSimuladorCamara(base));
        act(() => result.current.setMaxCiclos(3));
        await encender(result);
        for (let i = 0; i < 3; i += 1) {
            await act(async () => {
                expect(await result.current.capturar()).toBeInstanceOf(Blob);
            });
        }
        expect(result.current.terminado).toBe(true);
        let cuarto;
        await act(async () => {
            cuarto = await result.current.capturar();
        });
        expect(cuarto).toBeNull();
        expect(result.current.ciclo).toBe(3);
    });

    it('«Sin límite» no se detiene', async () => {
        const { result } = renderHook(() => useSimuladorCamara(base));
        act(() => result.current.setMaxCiclos(0));
        await encender(result);
        for (let i = 0; i < 7; i += 1) {
            await act(async () => {
                expect(await result.current.capturar()).toBeInstanceOf(Blob);
            });
        }
        expect(result.current.terminado).toBe(false);
    });

    it('reiniciar vuelve al ciclo 0 y permite repetir; cambiar de escenario también reinicia', async () => {
        const { result } = renderHook(() => useSimuladorCamara(base));
        await encender(result);
        await act(async () => {
            await result.current.capturar();
        });
        act(() => result.current.reiniciar());
        expect(result.current.ciclo).toBe(0);
        await act(async () => {
            await result.current.capturar();
        });
        expect(result.current.ciclo).toBe(1);
        act(() => result.current.cambiarEscenario('dudosos'));
        expect(result.current.escenario).toBe('dudosos');
        expect(result.current.ciclo).toBe(0);
    });

    it('«Escalonados» adelanta el reloj antes de cada ciclo menos el primero', async () => {
        const { result } = renderHook(() => useSimuladorCamara(base));
        act(() => result.current.cambiarEscenario('escalonados'));
        await encender(result);
        cambiarRelojDemo.mockClear();
        await act(async () => {
            await result.current.capturar();
        });
        expect(cambiarRelojDemo).not.toHaveBeenCalled();
        await act(async () => {
            await result.current.capturar();
        });
        expect(cambiarRelojDemo).toHaveBeenCalledWith({ avanzarMin: 4 });
    });

    it('una captura que estaba en camino cuando se reinició no mueve el contador de la simulación nueva', async () => {
        const { result } = renderHook(() => useSimuladorCamara(base));
        act(() => result.current.cambiarEscenario('escalonados'));
        await encender(result);
        await act(async () => {
            await result.current.capturar(); // ciclo 0: sin salto de reloj
        });
        // El ciclo 1 se queda esperando al reloj; mientras tanto el docente cambia de escenario (reinicia).
        let soltar;
        cambiarRelojDemo.mockImplementationOnce(() => new Promise((r) => { soltar = () => r(estado({ corre: true })); }));
        let enCamino;
        act(() => {
            enCamino = result.current.capturar();
        });
        act(() => result.current.cambiarEscenario('a_tiempo'));
        let blob;
        await act(async () => {
            soltar();
            blob = await enCamino;
        });
        expect(blob).toBeNull();
        expect(result.current.ciclo).toBe(0);
    });

    it('apagarla mientras una captura espera al reloj la descarta', async () => {
        const { result } = renderHook(() => useSimuladorCamara(base));
        act(() => result.current.cambiarEscenario('escalonados'));
        await encender(result);
        await act(async () => {
            await result.current.capturar();
        });
        let soltar;
        cambiarRelojDemo.mockImplementationOnce(() => new Promise((r) => { soltar = () => r(estado({ corre: true })); }));
        let enCamino;
        act(() => {
            enCamino = result.current.capturar();
        });
        act(() => result.current.apagar());
        let blob;
        await act(async () => {
            soltar();
            blob = await enCamino;
        });
        expect(blob).toBeNull();
    });

    it('en producción (sin reloj simulado) no calcula quién estaría en el aula', () => {
        const { result } = renderHook(() => useSimuladorCamara({ ...base, habilitado: false }));
        expect(result.current.plan).toEqual({ ciclo: 0, rostros: [], alumnos: 0, visitantes: 0 });
        expect(result.current.total).toBe(0);
    });

    it('si adelantar el reloj falla, el fotograma sale igual y se avisa', async () => {
        const { result } = renderHook(() => useSimuladorCamara(base));
        act(() => result.current.cambiarEscenario('escalonados'));
        await encender(result);
        cambiarRelojDemo.mockRejectedValue(new ApiError({ code: 'RELOJ_NO_ACTIVO', message: 'El reloj está apagado.', status: 409 }));
        await act(async () => {
            await result.current.capturar();
        });
        let blob;
        await act(async () => {
            blob = await result.current.capturar();
        });
        expect(blob).toBeInstanceOf(Blob);
        expect(result.current.aviso.tono).toBe('warning');
        expect(result.current.aviso.texto).toContain('El reloj está apagado.');
    });

    it('si no se puede dibujar, avisa y omite el ciclo (null) en vez de fallar en silencio', async () => {
        const { result } = renderHook(() => useSimuladorCamara(base));
        await encender(result);
        HTMLCanvasElement.prototype.getContext.mockReturnValue(null);
        let blob;
        await act(async () => {
            blob = await result.current.capturar();
        });
        expect(blob).toBeNull();
        expect(result.current.aviso.texto).toContain('No se pudo generar el fotograma simulado');
        expect(result.current.ciclo).toBe(0);
    });

    it('ponerRelojEnMarcha pide correr y avisa a las pantallas', async () => {
        const escuchar = vi.fn();
        window.addEventListener(EVENTO_RELOJ_CAMBIO, escuchar);
        const { result } = renderHook(() => useSimuladorCamara(base));
        await act(async () => {
            await result.current.ponerRelojEnMarcha();
        });
        window.removeEventListener(EVENTO_RELOJ_CAMBIO, escuchar);
        expect(cambiarRelojDemo).toHaveBeenCalledWith({ correr: true });
        expect(escuchar).toHaveBeenCalledTimes(1);
        expect(result.current.aviso.texto).toContain('en marcha');
    });

    it('informa si la sesión ya está fuera de la ventana de tolerancia', () => {
        const dentro = renderHook(() => useSimuladorCamara(base));
        expect(dentro.result.current.fueraDeVentana).toBe(false);
        const fuera = renderHook(() => useSimuladorCamara({ ...base, sesion: { ...sesion, en_ventana: false } }));
        expect(fuera.result.current.fueraDeVentana).toBe(true);
    });

    it('la descripción del fotograma cuenta alumnos y visitantes', () => {
        const { result } = renderHook(() => useSimuladorCamara(base));
        expect(result.current.descripcion).toContain('ciclo 1: 6 alumnos');
    });
});
