// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTO_RELOJ_CAMBIO } from '@/hooks/data/eventos.js';
import { ApiError } from '@/lib/api/errors.js';

const { refresh, leerRelojDemo, cambiarRelojDemo } = vi.hoisted(() => ({
    refresh: vi.fn(),
    leerRelojDemo: vi.fn(),
    cambiarRelojDemo: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/lib/local/relojCliente.js', () => ({ leerRelojDemo, cambiarRelojDemo }));

const { default: RelojDemo } = await import('./RelojDemo.jsx');

const estado = (extra = {}) => ({
    activo: true,
    corre: false,
    ahora: '2026-09-14T07:12:00-06:00',
    fecha: '2026-09-14',
    hora: '07:12:00',
    inicial: '2026-09-14T07:12:00-06:00',
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

// La hora se pinta junto con "detenido"/"en marcha": se busca por el elemento <time>.
const hora = () => document.querySelector('time');

async function montar(respuesta = estado(), props = {}) {
    leerRelojDemo.mockResolvedValue(respuesta);
    const vista = render(<RelojDemo {...props} />);
    await waitFor(() => expect(hora()).toHaveTextContent(/\d{2}:\d{2}:\d{2}/));
    return vista;
}

beforeEach(() => {
    refresh.mockReset();
    leerRelojDemo.mockReset();
    cambiarRelojDemo.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('RelojDemo', () => {
    it('muestra la fecha y hora simuladas, el estado y los controles', async () => {
        await montar();
        expect(screen.getByRole('region', { name: 'Reloj de demostración' })).toBeInTheDocument();
        expect(hora()).toHaveTextContent('lun 14 sep 2026 · 07:12:00');
        expect(hora()).toHaveTextContent('detenido');
        expect(hora()).toHaveAttribute('datetime', '2026-09-14T07:12:00-06:00');
        for (const nombre of [/\+5 min/, /\+10 min/, /\+30 min/, /Correr/, /Restablecer/, /Fijar hora/]) {
            expect(screen.getByRole('button', { name: nombre })).toBeEnabled();
        }
    });

    it('mientras carga: tarjeta con la hora pendiente y los controles de mover bloqueados (sin salto de maquetacion)', async () => {
        const lectura = diferido();
        leerRelojDemo.mockReturnValue(lectura.promesa);
        render(<RelojDemo />);
        expect(hora()).toHaveTextContent('Cargando…');
        expect(hora()).toHaveAttribute('aria-busy', 'true');
        for (const nombre of [/\+5 min/, /\+30 min/, /Correr/, /Restablecer/, /Fijar hora/]) {
            expect(screen.getByRole('button', { name: nombre })).toBeDisabled();
        }
        await act(async () => lectura.resolver(estado()));
        expect(hora()).toHaveTextContent('07:12:00');
        expect(hora()).toHaveAttribute('aria-busy', 'false');
    });

    it('cada boton lleva un icono Lucide decorativo (aria-hidden) y un nombre accesible con el texto visible', async () => {
        await montar();
        for (const boton of screen.getAllByRole('button')) {
            const svg = boton.querySelector('svg');
            expect(svg, boton.textContent).not.toBeNull();
            expect(svg).toHaveAttribute('aria-hidden', 'true');
        }
        // "+5 min" visible dentro del nombre accesible (etiqueta en el nombre)
        expect(screen.getByRole('button', { name: 'Adelantar el reloj +5 min' })).toBeInTheDocument();
    });

    it('hay un espacio real entre la hora y «detenido» (un lector de pantalla no lee «07:12:00detenido» como una palabra)', async () => {
        await montar();
        expect(hora().textContent).toMatch(/07:12:00 detenido$/);
    });

    it('el color del texto cumple el contraste: titulo en foreground y estado en muted-foreground; el acento ambar solo en el icono', async () => {
        await montar();
        const tarjeta = screen.getByRole('region', { name: 'Reloj de demostración' });
        expect(tarjeta).toHaveClass('text-foreground');
        expect(tarjeta).not.toHaveClass('text-retardo');
        expect(screen.getByText('detenido')).toHaveClass('text-muted-foreground');
        expect(screen.getByText('detenido')).not.toHaveClass('text-retardo');
        expect(tarjeta.querySelector('svg')).toHaveClass('text-retardo');
    });

    it('la hora se anuncia (aria-live polite) cuando esta detenida', async () => {
        await montar();
        expect(hora()).toHaveAttribute('aria-live', 'polite');
        expect(hora()).toHaveAttribute('aria-atomic', 'true');
    });

    it('+10 min: llama al servidor, muestra la hora nueva, avisa a la pantalla (evento global) y refresca', async () => {
        const alCambiar = vi.fn();
        window.addEventListener(EVENTO_RELOJ_CAMBIO, alCambiar);
        try {
            await montar();
            cambiarRelojDemo.mockResolvedValue(estado({ ahora: '2026-09-14T07:22:00-06:00', hora: '07:22:00' }));
            await userEvent.click(screen.getByRole('button', { name: /\+10 min/ }));
            expect(cambiarRelojDemo).toHaveBeenCalledWith({ avanzarMin: 10 });
            await waitFor(() => expect(hora()).toHaveTextContent('07:22:00'));
            expect(alCambiar).toHaveBeenCalledTimes(1);
            expect(alCambiar.mock.calls[0][0].detail.hora).toBe('07:22:00');
            expect(refresh).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener(EVENTO_RELOJ_CAMBIO, alCambiar);
        }
    });

    it('si otra pieza mueve el reloj y lo avisa con el evento global, la tarjeta adopta la hora nueva sin esperar la relectura', async () => {
        await montar(estado({ corre: false }));
        expect(screen.getByText(/detenido/)).toBeInTheDocument();
        act(() => {
            window.dispatchEvent(new CustomEvent(EVENTO_RELOJ_CAMBIO, { detail: estado({ corre: true, ahora: '2026-09-14T07:02:00-06:00', hora: '07:02:00' }) }));
        });
        await waitFor(() => expect(hora()).toHaveTextContent('07:02:'));
        expect(screen.queryByText(/detenido/)).toBeNull();
        expect(leerRelojDemo).toHaveBeenCalledTimes(1); // no hizo falta volver a leer
    });

    it('un evento sin estado (o ajeno) no cambia lo que muestra', async () => {
        await montar();
        act(() => {
            window.dispatchEvent(new CustomEvent(EVENTO_RELOJ_CAMBIO));
            window.dispatchEvent(new CustomEvent(EVENTO_RELOJ_CAMBIO, { detail: { corre: true } }));
        });
        expect(hora()).toHaveTextContent('07:12:00');
        expect(screen.getByText(/detenido/)).toBeInTheDocument();
    });

    it.each([
        ['+5 min', { avanzarMin: 5 }],
        ['+30 min', { avanzarMin: 30 }],
    ])('%s envía avanzarMin', async (nombre, cuerpo) => {
        await montar();
        cambiarRelojDemo.mockResolvedValue(estado());
        await userEvent.click(screen.getByRole('button', { name: new RegExp(`\\${nombre}`) }));
        expect(cambiarRelojDemo).toHaveBeenCalledWith(cuerpo);
    });

    it('los botones se marcan aria-disabled mientras el cambio esta en curso (sin doble envio) y vuelven despues', async () => {
        await montar();
        const cambio = diferido();
        cambiarRelojDemo.mockReturnValue(cambio.promesa);
        await userEvent.click(screen.getByRole('button', { name: /\+5 min/ }));
        expect(screen.getByRole('button', { name: /\+5 min/ })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('button', { name: /Restablecer/ })).toHaveAttribute('aria-disabled', 'true');
        // Un segundo clic (en cualquier boton de mover) se descarta mientras dura la peticion.
        await userEvent.click(screen.getByRole('button', { name: /\+5 min/ }));
        await userEvent.click(screen.getByRole('button', { name: /Restablecer/ }));
        expect(cambiarRelojDemo).toHaveBeenCalledTimes(1);
        await act(async () => cambio.resolver(estado({ ahora: '2026-09-14T07:17:00-06:00', hora: '07:17:00' })));
        expect(screen.getByRole('button', { name: /\+5 min/ })).not.toHaveAttribute('aria-disabled');
        expect(screen.getByRole('button', { name: /\+5 min/ })).toBeEnabled();
        expect(cambiarRelojDemo).toHaveBeenCalledTimes(1);
    });

    // Un boton enfocado que se deshabilita pierde el foco (activeElement pasa a body): con aria-disabled lo conserva.
    it('con teclado, el foco se queda en el boton mientras la peticion esta pendiente y despues', async () => {
        const usuario = userEvent.setup();
        await montar();
        const cambio = diferido();
        cambiarRelojDemo.mockReturnValue(cambio.promesa);
        const boton = screen.getByRole('button', { name: /\+5 min/ });
        await usuario.tab();
        boton.focus();
        expect(boton).toHaveFocus();
        await usuario.keyboard('{Enter}');
        expect(cambiarRelojDemo).toHaveBeenCalledTimes(1);
        expect(boton).toHaveAttribute('aria-disabled', 'true');
        expect(document.activeElement).toBe(boton);
        await usuario.keyboard('{Enter}'); // segundo Enter durante la peticion: no envia otra
        expect(cambiarRelojDemo).toHaveBeenCalledTimes(1);
        await act(async () => cambio.resolver(estado({ ahora: '2026-09-14T07:17:00-06:00', hora: '07:17:00' })));
        expect(document.activeElement).toBe(boton);
    });

    it('Restablecer envia restablecer:true y su ayuda dice a que valor vuelve', async () => {
        await montar(estado({ ahora: '2026-09-14T08:02:00-06:00', hora: '08:02:00' }));
        cambiarRelojDemo.mockResolvedValue(estado());
        const boton = screen.getByRole('button', { name: /Restablecer/ });
        expect(boton).toHaveAttribute('title', 'Volver a lun 14 sep 2026 07:12');
        await userEvent.click(boton);
        expect(cambiarRelojDemo).toHaveBeenCalledWith({ restablecer: true });
        await waitFor(() => expect(hora()).toHaveTextContent('07:12:00'));
    });

    it('Correr echa a andar el reloj, cambia a Pausar, deja de anunciar cada segundo y Pausar lo detiene', async () => {
        await montar();
        cambiarRelojDemo.mockResolvedValueOnce(estado({ corre: true }));
        await userEvent.click(screen.getByRole('button', { name: /Correr/ }));
        expect(cambiarRelojDemo).toHaveBeenLastCalledWith({ correr: true });
        const pausar = await screen.findByRole('button', { name: /Pausar/ });
        expect(hora()).toHaveTextContent('en marcha');
        expect(hora()).toHaveAttribute('aria-live', 'off');

        cambiarRelojDemo.mockResolvedValueOnce(estado({ corre: false }));
        await userEvent.click(pausar);
        expect(cambiarRelojDemo).toHaveBeenLastCalledWith({ correr: false });
        expect(await screen.findByRole('button', { name: /Correr/ })).toBeInTheDocument();
        expect(hora()).toHaveAttribute('aria-live', 'polite');
    });

    describe('fijar la hora', () => {
        it('abre un campo datetime-local con la hora simulada, con etiqueta, y lo cierra al fijar', async () => {
            await montar();
            const abrir = screen.getByRole('button', { name: /Fijar hora/ });
            expect(abrir).toHaveAttribute('aria-expanded', 'false');
            await userEvent.click(abrir);
            expect(abrir).toHaveAttribute('aria-expanded', 'true');

            const campo = screen.getByLabelText(/Fecha y hora simuladas/);
            expect(campo).toHaveAttribute('type', 'datetime-local');
            expect(campo).toHaveValue('2026-09-14T07:12');
            expect(abrir).toHaveAttribute('aria-controls', campo.closest('form').id);

            fireEvent.change(campo, { target: { value: '2026-09-14T07:03' } });
            cambiarRelojDemo.mockResolvedValue(estado({ ahora: '2026-09-14T07:03:00-06:00', hora: '07:03:00' }));
            await userEvent.click(screen.getByRole('button', { name: 'Fijar' }));
            expect(cambiarRelojDemo).toHaveBeenCalledWith({ fijar: '2026-09-14 07:03' });
            await waitFor(() => expect(hora()).toHaveTextContent('07:03:00'));
            expect(screen.queryByLabelText(/Fecha y hora simuladas/)).not.toBeInTheDocument();
            expect(abrir).toHaveAttribute('aria-expanded', 'false');
        });

        it('al fijar con exito el foco pasa al boton «Fijar hora» (el formulario se desmonta; sin esto caeria en <body>)', async () => {
            await montar();
            const abrir = screen.getByRole('button', { name: /Fijar hora/ });
            await userEvent.click(abrir);
            fireEvent.change(screen.getByLabelText(/Fecha y hora simuladas/), { target: { value: '2026-09-14T07:03' } });
            cambiarRelojDemo.mockResolvedValue(estado({ ahora: '2026-09-14T07:03:00-06:00', hora: '07:03:00' }));
            screen.getByRole('button', { name: 'Fijar' }).focus();
            await userEvent.keyboard('{Enter}');
            await waitFor(() => expect(screen.queryByLabelText(/Fecha y hora simuladas/)).not.toBeInTheDocument());
            expect(document.activeElement).toBe(abrir);
        });

        it('mientras se envia, Fijar queda aria-disabled (conserva el foco) y un segundo envio se descarta', async () => {
            await montar();
            await userEvent.click(screen.getByRole('button', { name: /Fijar hora/ }));
            const cambio = diferido();
            cambiarRelojDemo.mockReturnValue(cambio.promesa);
            const fijar = screen.getByRole('button', { name: 'Fijar' });
            await userEvent.click(fijar);
            expect(fijar).toHaveAttribute('aria-disabled', 'true');
            expect(fijar).toBeEnabled();
            fireEvent.submit(fijar.closest('form'));
            expect(cambiarRelojDemo).toHaveBeenCalledTimes(1);
            await act(async () => cambio.resolver(estado()));
        });

        it('sin valor el boton Fijar queda bloqueado y no envia nada', async () => {
            await montar();
            await userEvent.click(screen.getByRole('button', { name: /Fijar hora/ }));
            fireEvent.change(screen.getByLabelText(/Fecha y hora simuladas/), { target: { value: '' } });
            expect(screen.getByRole('button', { name: 'Fijar' })).toBeDisabled();
            fireEvent.submit(screen.getByLabelText(/Fecha y hora simuladas/).closest('form'));
            expect(cambiarRelojDemo).not.toHaveBeenCalled();
        });

        it('si el servidor rechaza la fecha, el campo se queda abierto y se muestra el error', async () => {
            await montar();
            await userEvent.click(screen.getByRole('button', { name: /Fijar hora/ }));
            cambiarRelojDemo.mockRejectedValue(new ApiError({ code: 'FUERA_DE_RANGO', message: 'La fecha simulada debe estar entre los años 2000 y 2099.', status: 400 }));
            await userEvent.click(screen.getByRole('button', { name: 'Fijar' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('entre los años 2000 y 2099');
            expect(screen.getByLabelText(/Fecha y hora simuladas/)).toBeInTheDocument();
        });
    });

    it('un error al mover el reloj se anuncia (role=alert), no avisa a la pantalla y deja reintentar', async () => {
        const alCambiar = vi.fn();
        window.addEventListener(EVENTO_RELOJ_CAMBIO, alCambiar);
        try {
            await montar();
            cambiarRelojDemo.mockRejectedValueOnce(new ApiError({ code: 'ERROR_RED', message: 'No se pudo conectar con el servidor.', status: 503 }));
            await userEvent.click(screen.getByRole('button', { name: /\+5 min/ }));
            expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar');
            expect(alCambiar).not.toHaveBeenCalled();
            expect(refresh).not.toHaveBeenCalled();
            expect(hora()).toHaveTextContent('07:12:00'); // la hora mostrada no cambia
            // reintento: el error desaparece
            cambiarRelojDemo.mockResolvedValueOnce(estado({ ahora: '2026-09-14T07:17:00-06:00', hora: '07:17:00' }));
            await userEvent.click(screen.getByRole('button', { name: /\+5 min/ }));
            await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
            expect(hora()).toHaveTextContent('07:17:00');
        } finally {
            window.removeEventListener(EVENTO_RELOJ_CAMBIO, alCambiar);
        }
    });

    describe('no se muestra fuera del modo local', () => {
        it('si la ruta no existe (404 NO_ENCONTRADO) no pinta nada', async () => {
            leerRelojDemo.mockRejectedValue(new ApiError({ code: 'NO_ENCONTRADO', message: 'No encontrado', status: 404 }));
            const { container } = render(<RelojDemo />);
            await waitFor(() => expect(container).toBeEmptyDOMElement());
        });

        it('si el reloj esta apagado (activo:false) no pinta nada', async () => {
            leerRelojDemo.mockResolvedValue(estado({ activo: false }));
            const { container } = render(<RelojDemo />);
            await waitFor(() => expect(leerRelojDemo).toHaveBeenCalled());
            await waitFor(() => expect(container).toBeEmptyDOMElement());
        });

        it('otro fallo de lectura (red) deja la tarjeta con el aviso, no la oculta', async () => {
            leerRelojDemo.mockRejectedValue(new ApiError({ code: 'ERROR_RED', message: 'Sin conexión.', status: 503 }));
            render(<RelojDemo />);
            expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión.');
            expect(screen.getByRole('region', { name: 'Reloj de demostración' })).toBeInTheDocument();
        });
    });

    it('acepta className para ubicarse en el AppShell', async () => {
        await montar(estado(), { className: 'mb-4' });
        expect(screen.getByRole('region')).toHaveClass('mb-4');
    });

    it('en 360 px los controles envuelven (no desbordan): grupo flex-wrap y tarjeta sin ancho fijo', async () => {
        await montar();
        expect(screen.getByRole('group', { name: 'Mover el reloj' })).toHaveClass('flex-wrap');
        const tarjeta = screen.getByRole('region');
        expect(tarjeta.className).not.toMatch(/\b(w|min-w)-\[?\d/);
    });

    describe('tiempo (temporizadores falsos)', () => {
        const avanzar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

        it('corriendo, la hora visible avanza cada segundo desde la respuesta del servidor', async () => {
            vi.useFakeTimers();
            leerRelojDemo.mockResolvedValue(estado({ corre: true }));
            render(<RelojDemo />);
            await avanzar(0);
            expect(hora()).toHaveTextContent('07:12:00');
            await avanzar(5000);
            expect(hora()).toHaveTextContent('07:12:05');
            // El atributo legible por maquina avanza con el texto (antes se quedaba en el instante recibido del servidor).
            expect(hora()).toHaveAttribute('datetime', '2026-09-14T07:12:05-06:00');
            await avanzar(14_000); // antes de la relectura de los 20 s
            expect(hora()).toHaveTextContent('07:12:19');
        });

        it('detenido, la hora no se mueve sola', async () => {
            vi.useFakeTimers();
            leerRelojDemo.mockResolvedValue(estado());
            render(<RelojDemo />);
            await avanzar(0);
            await avanzar(10_000);
            expect(hora()).toHaveTextContent('07:12:00');
        });

        it('relee el servidor cada 20 s (por si cambio desde otra pestana) y adopta lo nuevo', async () => {
            vi.useFakeTimers();
            leerRelojDemo.mockResolvedValue(estado());
            render(<RelojDemo />);
            await avanzar(0);
            expect(leerRelojDemo).toHaveBeenCalledTimes(1);
            leerRelojDemo.mockResolvedValue(estado({ ahora: '2026-09-14T09:00:00-06:00', hora: '09:00:00' }));
            await avanzar(20_000);
            expect(leerRelojDemo).toHaveBeenCalledTimes(2);
            expect(hora()).toHaveTextContent('09:00:00');
        });

        it('una relectura lenta que llega despues de un cambio del usuario NO lo pisa', async () => {
            vi.useFakeTimers();
            leerRelojDemo.mockResolvedValueOnce(estado());
            render(<RelojDemo />);
            await avanzar(0);

            const lenta = diferido();
            leerRelojDemo.mockReturnValueOnce(lenta.promesa);
            await avanzar(20_000); // sale la relectura (queda pendiente)
            cambiarRelojDemo.mockResolvedValue(estado({ ahora: '2026-09-14T07:42:00-06:00', hora: '07:42:00' }));
            fireEvent.click(screen.getByRole('button', { name: /\+30 min/ }));
            await avanzar(0);
            expect(hora()).toHaveTextContent('07:42:00');

            await act(async () => lenta.resolver(estado())); // respuesta vieja (07:12)
            expect(hora()).toHaveTextContent('07:42:00');
        });

        it('con la pestana oculta no relee', async () => {
            vi.useFakeTimers();
            leerRelojDemo.mockResolvedValue(estado());
            const oculto = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
            render(<RelojDemo />);
            await avanzar(0);
            await avanzar(60_000);
            expect(leerRelojDemo).toHaveBeenCalledTimes(1);
            oculto.mockRestore();
        });

        it('al desmontar deja de sondear y de contar', async () => {
            vi.useFakeTimers();
            leerRelojDemo.mockResolvedValue(estado({ corre: true }));
            const { unmount } = render(<RelojDemo />);
            await avanzar(0);
            unmount();
            await avanzar(120_000);
            expect(leerRelojDemo).toHaveBeenCalledTimes(1);
        });
    });
});
