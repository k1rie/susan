// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import GuiaPasarLista from './GuiaPasarLista.jsx';

describe('GuiaPasarLista', () => {
    it('automática: tres pasos en una lista ordenada, el 1 ya hecho', () => {
        render(<GuiaPasarLista />);
        const guia = screen.getByRole('region', { name: 'Así se pasa lista' });
        const pasos = within(guia).getAllByRole('listitem');
        expect(pasos).toHaveLength(3);
        expect(pasos[0]).toHaveTextContent('Paso 1, hecho: Sesión abierta');
        expect(pasos[1]).toHaveTextContent('Paso 2: Apunta la cámara al grupo');
        expect(pasos[2]).toHaveTextContent('Paso 3: Revisa y cierra');
        expect(within(guia).getByRole('list').tagName).toBe('OL');
    });

    it('manual: los pasos hablan de marcar y guardar', () => {
        render(<GuiaPasarLista modo="manual" />);
        expect(screen.getByText('Marca a cada alumno')).toBeInTheDocument();
        expect(screen.getByText('Guarda y cierra')).toBeInTheDocument();
        expect(screen.queryByText('Apunta la cámara al grupo')).toBeNull();
    });

    it('un modo desconocido cae en el automático', () => {
        render(<GuiaPasarLista modo="otro" />);
        expect(screen.getByText('Apunta la cámara al grupo')).toBeInTheDocument();
    });

    it('se puede descartar con un botón con nombre', async () => {
        const usuario = userEvent.setup();
        const onDescartar = vi.fn();
        render(<GuiaPasarLista onDescartar={onDescartar} />);
        await usuario.click(screen.getByRole('button', { name: 'Ocultar la guía' }));
        expect(onDescartar).toHaveBeenCalledTimes(1);
    });

    it('sin onDescartar no hay botón; el estado no depende solo del color (el paso hecho dice «hecho»)', () => {
        render(<GuiaPasarLista />);
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByText(/hecho:/)).toHaveClass('sr-only');
    });

    it('los iconos son decorativos', () => {
        const { container } = render(<GuiaPasarLista onDescartar={() => {}} />);
        container.querySelectorAll('svg').forEach((svg) => expect(svg.closest('[aria-hidden="true"]') ?? svg).toHaveAttribute('aria-hidden', 'true'));
    });
});
