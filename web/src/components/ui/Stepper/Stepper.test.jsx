// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Stepper from './Stepper.jsx';
import { normalizarPasos, textoPaso } from './stepper.utils.js';

const PASOS = [
    { id: 'datos', label: 'Datos' },
    { id: 'horario', label: 'Horario', description: 'Días y horas de clase' },
    { id: 'aula', label: 'Aula' },
    { id: 'revision', label: 'Revisión' },
];

describe('normalizarPasos / textoPaso', () => {
    it('deduce el estado por posición y respeta el estado explícito', () => {
        const { pasos, indiceActual, total } = normalizarPasos([...PASOS.slice(0, 3), { id: 'x', label: 'X', estado: 'error' }], 'horario');
        expect(indiceActual).toBe(1);
        expect(total).toBe(4);
        expect(pasos.map((p) => p.estado)).toEqual(['hecho', 'actual', 'pendiente', 'error']);
    });

    it('acepta un índice, y un índice igual al total deja todo hecho', () => {
        expect(normalizarPasos(PASOS, 2).indiceActual).toBe(2);
        expect(normalizarPasos(PASOS, 4).pasos.every((p) => p.estado === 'hecho')).toBe(true);
        expect(normalizarPasos(PASOS, 'no-existe').indiceActual).toBe(0);
    });

    it('textoPaso arma «Paso 2 de 4 · Horario»', () => {
        expect(textoPaso(1, 4, 'Horario')).toBe('Paso 2 de 4 · Horario');
        expect(textoPaso(0, 3)).toBe('Paso 1 de 3');
    });
});

describe('Stepper', () => {
    it('lista los pasos con aria-current en el actual y el texto «Paso N de M · título»', () => {
        render(<Stepper steps={PASOS} current="horario" />);
        const nav = screen.getByRole('navigation', { name: 'Progreso' });
        const items = within(nav).getAllByRole('listitem');
        expect(items).toHaveLength(4);
        expect(items[1]).toHaveAttribute('aria-current', 'step');
        expect(items[0]).not.toHaveAttribute('aria-current');
        expect(screen.getByText('Paso 2 de 4 · Horario')).toBeInTheDocument();
        expect(screen.getByText('Días y horas de clase')).toBeInTheDocument();
    });

    it('cada paso dice su estado con texto para lectores de pantalla (no solo color)', () => {
        render(<Stepper steps={PASOS} current="horario" />);
        const items = screen.getAllByRole('listitem');
        expect(items[0]).toHaveTextContent('completado');
        expect(items[1]).toHaveTextContent('paso actual');
        expect(items[2]).toHaveTextContent('pendiente');
    });

    it('los pasos hechos llevan una palomita de Lucide (aria-hidden) y los pendientes su número', () => {
        render(<Stepper steps={PASOS} current="aula" />);
        const items = screen.getAllByRole('listitem');
        expect(items[0].querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        expect(items[3]).toHaveTextContent('4');
    });

    it('un paso con error muestra icono y texto', () => {
        render(<Stepper steps={[{ id: 'a', label: 'A', estado: 'error' }, { id: 'b', label: 'B' }]} current="b" />);
        expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('con errores');
    });

    it('onSelect hace clic en pasos recorridos, no en pendientes ni deshabilitados', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(
            <Stepper
                steps={[{ id: 'a', label: 'Uno' }, { id: 'b', label: 'Dos', disabled: true }, { id: 'c', label: 'Tres' }, { id: 'd', label: 'Cuatro' }]}
                current="c"
                onSelect={onSelect}
            />,
        );
        const botones = screen.getAllByRole('button');
        expect(botones).toHaveLength(2);
        expect(botones[0]).toHaveAccessibleName('Uno, completado');
        expect(botones[1]).toHaveAccessibleName('Tres, paso actual');
        await user.click(botones[0]);
        expect(onSelect).toHaveBeenCalledWith('a');
    });

    it('sin onSelect no hay botones', () => {
        render(<Stepper steps={PASOS} current="datos" />);
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('compact controla qué versión se ve: indicador, círculos o ambas según el ancho', () => {
        const { container, rerender } = render(<Stepper steps={PASOS} current="datos" compact />);
        expect(container.querySelector('p').className).not.toContain('hidden');
        expect(container.querySelector('li > div').className).toContain('hidden');
        rerender(<Stepper steps={PASOS} current="datos" compact={false} />);
        expect(container.querySelector('p').className).toContain('hidden');
        expect(container.querySelector('li > div').className).not.toContain('hidden');
        rerender(<Stepper steps={PASOS} current="datos" />);
        expect(container.querySelector('p').className).toContain('sm:hidden');
        expect(container.querySelector('li > div').className).toContain('sm:flex');
    });
});
