// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResumenPaseLista from './ResumenPaseLista.jsx';

const totales = { inscritos: 18, presentes: 5, retardos: 2, sin_registro: 11, pendientes: 0 };

describe('ResumenPaseLista', () => {
    it('la cifra grande dice «N de M presentes» y es la única región aria-live', () => {
        const { container } = render(<ResumenPaseLista totales={totales} />);
        const cifra = container.querySelector('[aria-live]');
        expect(cifra).toHaveTextContent('5 de 18 presentes');
        expect(cifra).toHaveAttribute('aria-live', 'polite');
        expect(cifra).toHaveAttribute('aria-atomic', 'true');
        expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
    });

    it('la barra fina lleva presentes, retardos y sin registro en texto', () => {
        render(<ResumenPaseLista totales={totales} />);
        const barra = screen.getByRole('img');
        expect(barra).toHaveAccessibleName('Presentes: 5 (28 %); Retardos: 2 (11 %); Sin registro: 11 (61 %); Pendientes: 0 (0 %)');
    });

    it('debajo de la cifra cuenta retardos y sin registro; los pendientes solo si hay', () => {
        const { rerender } = render(<ResumenPaseLista totales={totales} />);
        expect(screen.getByText(/con retardo/).closest('p')).toHaveTextContent('2 con retardo · 11 sin registro');
        expect(screen.queryByText(/por revisar/)).toBeNull();
        rerender(<ResumenPaseLista totales={{ ...totales, pendientes: 3 }} />);
        expect(screen.getByText(/con retardo/).closest('p')).toHaveTextContent('2 con retardo · 11 sin registro · 3 por revisar');
    });

    it('sin inscritos no inventa una barra: avisa', () => {
        const { container } = render(<ResumenPaseLista totales={{}} />);
        expect(screen.getByRole('img')).toHaveAccessibleName('Aún no hay alumnos inscritos');
        expect(container.querySelector('[aria-live]')).toHaveTextContent('0 de 0 presentes');
    });

    it('cifras raras (texto, negativos) se tratan como 0', () => {
        const { container } = render(<ResumenPaseLista totales={{ inscritos: 'x', presentes: -2, retardos: null }} />);
        expect(container.querySelector('[aria-live]')).toHaveTextContent('0 de 0 presentes');
    });

    describe('última captura', () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        it('antes de la primera dice que espera, o que envía', () => {
            const { rerender } = render(<ResumenPaseLista totales={totales} />);
            expect(screen.getByText('Esperando la primera captura…')).toBeInTheDocument();
            rerender(<ResumenPaseLista totales={totales} enviando />);
            expect(screen.getByText('Enviando la primera captura…')).toBeInTheDocument();
        });

        it('fuera de la ventana lo dice con todas sus letras', () => {
            render(<ResumenPaseLista totales={totales} activo={false} />);
            expect(screen.getByText('Fuera de la ventana de tolerancia: ya no se toman capturas.')).toBeInTheDocument();
        });

        it('«N rostros · V válidos · hace X s», y la cuenta avanza sola', async () => {
            vi.setSystemTime(new Date('2026-09-14T13:00:00Z'));
            render(<ResumenPaseLista totales={totales} ultima={{ rostros: 14, validas: 11, cambios: [], recibida: Date.now() }} />);
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1);
            });
            const linea = screen.getByText(/Última captura/).closest('p');
            expect(linea).toHaveTextContent('Última captura: 14 rostros · 11 válidos · hace 0 s');
            await act(async () => {
                await vi.advanceTimersByTimeAsync(8000);
            });
            expect(linea).toHaveTextContent('Última captura: 14 rostros · 11 válidos · hace 8 s');
            await act(async () => {
                await vi.advanceTimersByTimeAsync(60000);
            });
            expect(linea).toHaveTextContent('hace 1 min');
        });

        it('suma los registros nuevos y avisa cuando hay un envío en camino', async () => {
            vi.setSystemTime(new Date('2026-09-14T13:00:00Z'));
            render(<ResumenPaseLista totales={totales} enviando ultima={{ rostros: 3, validas: 3, cambios: [{ creado: true }, { confirmado: true }, { creado: false, confirmado: false }], recibida: Date.now() }} />);
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1);
            });
            const linea = screen.getByText(/Última captura/).closest('p');
            expect(linea).toHaveTextContent('3 rostros · 3 válidos · +2 registros · hace 0 s · enviando…');
        });

        it('un solo registro nuevo va en singular', async () => {
            render(<ResumenPaseLista totales={totales} ultima={{ rostros: 3, validas: 3, cambios: [{ creado: true }], recibida: Date.now() }} />);
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1);
            });
            expect(screen.getByText(/Última captura/).closest('p')).toHaveTextContent('+1 registro');
        });

        it('los alumnos que solo sumaron una lectura no cuentan como registros nuevos', async () => {
            render(<ResumenPaseLista totales={totales} ultima={{ rostros: 3, validas: 3, cambios: [{ creado: false, confirmado: false }, { creado: false, confirmado: false }], recibida: Date.now() }} />);
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1);
            });
            expect(screen.getByText(/Última captura/).closest('p')).not.toHaveTextContent('registro');
        });

        it('la línea de la última captura no es una región en vivo (no interrumpe en cada ciclo)', () => {
            render(<ResumenPaseLista totales={totales} ultima={{ rostros: 3, validas: 3, cambios: [], recibida: 0 }} />);
            expect(screen.getByText(/Última captura/).closest('p')).not.toHaveAttribute('aria-live');
        });
    });
});
