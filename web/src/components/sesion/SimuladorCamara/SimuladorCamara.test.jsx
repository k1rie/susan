// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SimuladorCamara from './SimuladorCamara.jsx';

const simulador = (extra = {}) => ({
    habilitado: true,
    camaraDisponible: true,
    encendido: false,
    preparando: false,
    activo: false,
    escenario: 'a_tiempo',
    cambiarEscenario: vi.fn(),
    maxCiclos: 5,
    setMaxCiclos: vi.fn(),
    visitante: true,
    setVisitante: vi.fn(),
    ajustarReloj: true,
    setAjustarReloj: vi.fn(),
    ciclo: 0,
    terminado: false,
    total: 18,
    plan: { ciclo: 0, alumnos: 18, visitantes: 0 },
    intervaloSeg: 9,
    aviso: null,
    alternar: vi.fn(),
    reiniciar: vi.fn(),
    ...extra,
});

describe('SimuladorCamara', () => {
    it('no se pinta si el reloj no es simulado (producción) ni sin simulador', () => {
        const { container, rerender } = render(<SimuladorCamara simulador={simulador({ habilitado: false })} />);
        expect(container).toBeEmptyDOMElement();
        rerender(<SimuladorCamara />);
        expect(container).toBeEmptyDOMElement();
    });

    it('trae el interruptor «Cámara simulada (demostración)», marcado como solo desarrollo, apagado', () => {
        render(<SimuladorCamara simulador={simulador()} />);
        const grupo = screen.getByRole('region', { name: /Cámara simulada \(demostración\)/ });
        expect(within(grupo).getByText('Solo desarrollo')).toBeInTheDocument();
        const interruptor = screen.getByRole('switch', { name: /Cámara simulada \(demostración\)/ });
        expect(interruptor).toHaveAttribute('aria-checked', 'false');
        // El estado también va en texto, no solo en la posición del interruptor.
        expect(screen.getByText('Apagada')).toBeInTheDocument();
    });

    it('al accionar el interruptor pide encender; encendido, apagar', async () => {
        const usuario = userEvent.setup();
        const apagado = simulador();
        const { rerender } = render(<SimuladorCamara simulador={apagado} />);
        await usuario.click(screen.getByRole('switch'));
        expect(apagado.alternar).toHaveBeenCalledWith(true);
        const encendido = simulador({ encendido: true, activo: true });
        rerender(<SimuladorCamara simulador={encendido} />);
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByText('Activa')).toBeInTheDocument();
        await usuario.click(screen.getByRole('switch'));
        expect(encendido.alternar).toHaveBeenCalledWith(false);
    });

    it('ofrece los tres escenarios y el control de ciclos', async () => {
        const usuario = userEvent.setup();
        const s = simulador();
        render(<SimuladorCamara simulador={s} />);
        const escenario = screen.getByRole('combobox', { name: 'Escenario' });
        expect([...escenario.options].map((o) => o.textContent)).toEqual(['Todos llegan a tiempo', 'Llegan escalonados', 'Casos dudosos']);
        await usuario.selectOptions(escenario, 'dudosos');
        expect(s.cambiarEscenario).toHaveBeenCalledWith('dudosos');
        const ciclos = screen.getByRole('combobox', { name: 'Detener después de' });
        expect([...ciclos.options].map((o) => o.textContent)).toEqual(['3 ciclos', '5 ciclos', '8 ciclos', '12 ciclos', 'Sin límite']);
        expect(ciclos).toHaveValue('5');
        await usuario.selectOptions(ciclos, '0');
        expect(s.setMaxCiclos).toHaveBeenCalledWith(0);
    });

    it('las opciones de visitante y de arrancar en el minuto 2 son casillas con nombre', async () => {
        const usuario = userEvent.setup();
        const s = simulador();
        render(<SimuladorCamara simulador={s} />);
        await usuario.click(screen.getByRole('checkbox', { name: 'Que pase un visitante de vez en cuando' }));
        expect(s.setVisitante).toHaveBeenCalledWith(false);
        await usuario.click(screen.getByRole('checkbox', { name: /Empezar en el minuto 2 de la clase/ }));
        expect(s.setAjustarReloj).toHaveBeenCalledWith(false);
    });

    it('dice en lenguaje llano qué se espera ver, según el escenario', () => {
        const { rerender } = render(<SimuladorCamara simulador={simulador()} />);
        expect(screen.getByText(/En unos 20 s todos los alumnos pasan a Presente/)).toBeInTheDocument();
        expect(screen.getByText(/Resultado esperado con 18 alumnos: 18 Presentes/)).toBeInTheDocument();
        rerender(<SimuladorCamara simulador={simulador({ escenario: 'dudosos' })} />);
        expect(screen.getByText(/Pendientes de revisión al cerrar/)).toBeInTheDocument();
        rerender(<SimuladorCamara simulador={simulador({ escenario: 'escalonados' })} />);
        expect(screen.getByText(/tres tandas/)).toBeInTheDocument();
    });

    it('la línea de estado cuenta los ciclos y dice qué viene (aria-live)', () => {
        render(<SimuladorCamara simulador={simulador({ encendido: true, activo: true, ciclo: 2, plan: { ciclo: 2, alumnos: 18, visitantes: 1 } })} />);
        const linea = screen.getByText(/Ciclos enviados: 2 de 5/);
        expect(linea).toHaveAttribute('aria-live', 'polite');
        expect(linea).toHaveTextContent('18 alumnos y un visitante, en unos 9 s');
    });

    it('encendida pero con la sesión fuera de la ventana de tolerancia, lo dice en vez de contar ciclos que no saldrán', () => {
        render(<SimuladorCamara simulador={simulador({ encendido: true, activo: true, fueraDeVentana: true })} />);
        expect(screen.getByText(/fuera de la ventana de tolerancia: no se envían fotogramas/)).toHaveAttribute('aria-live', 'polite');
        expect(screen.queryByText(/Ciclos enviados/)).toBeNull();
    });

    it('con «Sin límite» no inventa un tope', () => {
        render(<SimuladorCamara simulador={simulador({ encendido: true, activo: true, ciclo: 4, maxCiclos: 0 })} />);
        expect(screen.getByText(/Ciclos enviados: 4\./)).toBeInTheDocument();
    });

    it('al terminar los ciclos lo dice y ofrece reiniciar', async () => {
        const usuario = userEvent.setup();
        const s = simulador({ encendido: true, activo: true, ciclo: 5, terminado: true });
        render(<SimuladorCamara simulador={s} />);
        expect(screen.getByText(/Simulación completa: 5 ciclos enviados/)).toBeInTheDocument();
        await usuario.click(screen.getByRole('button', { name: 'Reiniciar ciclos' }));
        expect(s.reiniciar).toHaveBeenCalled();
    });

    it('preparando el reloj: lo dice y bloquea el interruptor', () => {
        render(<SimuladorCamara simulador={simulador({ encendido: true, preparando: true })} />);
        expect(screen.getByText('Preparando el reloj de demostración…')).toBeInTheDocument();
        expect(screen.getByRole('switch')).toBeDisabled();
    });

    it('sin cámara de navegador en el aula explica por qué no se puede y deshabilita el interruptor', () => {
        render(<SimuladorCamara simulador={simulador({ camaraDisponible: false })} />);
        expect(screen.getByText(/no tiene una cámara del navegador activa/)).toBeInTheDocument();
        expect(screen.getByRole('switch')).toBeDisabled();
    });

    it('muestra el aviso del reloj con su tono', () => {
        render(<SimuladorCamara simulador={simulador({ aviso: { tono: 'info', texto: 'El reloj de demostración estaba detenido: lo pusimos en marcha.' } })} />);
        expect(screen.getByRole('status')).toHaveTextContent('lo pusimos en marcha');
    });

    it('con la simulación encendida el ajuste del reloj queda fijo (se aplicó al activar)', () => {
        render(<SimuladorCamara simulador={simulador({ encendido: true, activo: true })} />);
        expect(screen.getByRole('checkbox', { name: /Empezar en el minuto 2/ })).toBeDisabled();
    });
});
