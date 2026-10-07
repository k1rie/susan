// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PasosPaseLista from './PasosPaseLista.jsx';
import { estadoPaso, pasosDe } from './pasosPaseLista.utils.js';

describe('PasosPaseLista', () => {
    it('tres pasos en una lista ordenada dentro de una navegación con nombre', () => {
        render(<PasosPaseLista />);
        const nav = screen.getByRole('navigation', { name: 'Pasos para pasar lista' });
        const pasos = within(nav).getAllByRole('listitem');
        expect(within(nav).getByRole('list').tagName).toBe('OL');
        expect(pasos).toHaveLength(3);
        expect(pasos[0]).toHaveTextContent('Abrir la sesión');
        expect(pasos[1]).toHaveTextContent('Pasar lista');
        expect(pasos[2]).toHaveTextContent('Revisar y cerrar');
    });

    it('marca el paso actual con aria-current y dice «hecho» o «pendiente» sin depender del color', () => {
        render(<PasosPaseLista actual={2} />);
        const pasos = screen.getAllByRole('listitem');
        expect(pasos[0]).toHaveTextContent('Hecho: Abrir la sesión');
        expect(pasos[1]).toHaveTextContent('Paso actual: Pasar lista');
        expect(pasos[2]).toHaveTextContent('Pendiente: Revisar y cerrar');
        expect(pasos[1].querySelector('[aria-current="step"]')).not.toBeNull();
        expect(pasos[0].querySelector('[aria-current]')).toBeNull();
        expect(pasos[2].querySelector('[aria-current]')).toBeNull();
        // Testing Library recorta los espacios: «Hecho: » se busca como «Hecho:».
        const lectores = screen.getAllByText(/^(Hecho|Paso actual|Pendiente):$/);
        expect(lectores).toHaveLength(3);
        lectores.forEach((n) => expect(n).toHaveClass('sr-only'));
    });

    it('la línea de detalle es la del paso actual (y se puede apagar)', () => {
        const { rerender } = render(<PasosPaseLista actual={2} />);
        expect(screen.getByText('Apunta la cámara al grupo: el sistema reconoce a los alumnos solo.')).toBeInTheDocument();
        rerender(<PasosPaseLista actual={3} />);
        expect(screen.getByText('Revisa quién falta y cierra el pase de lista.')).toBeInTheDocument();
        rerender(<PasosPaseLista actual={3} conDetalle={false} />);
        expect(screen.queryByText('Revisa quién falta y cierra el pase de lista.')).toBeNull();
    });

    it('manual: los pasos hablan de marcar y guardar', () => {
        render(<PasosPaseLista modo="manual" actual={2} />);
        expect(screen.getByText('Marcar alumnos')).toBeInTheDocument();
        expect(screen.getByText('Guardar y cerrar')).toBeInTheDocument();
        expect(screen.queryByText('Revisar y cerrar')).toBeNull();
        expect(screen.getByText('Marca a cada alumno: presente, retardo o ausente.')).toBeInTheDocument();
    });

    it('un modo desconocido cae en el de cámara', () => {
        render(<PasosPaseLista modo="otro" />);
        expect(screen.getByText('Pasar lista')).toBeInTheDocument();
    });

    it('sin onIrA solo informa: no hay botones', () => {
        render(<PasosPaseLista />);
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('con onIrA los pasos 2 y 3 son botones que avisan a cuál ir; el 1 (ya hecho) no', async () => {
        const usuario = userEvent.setup();
        const onIrA = vi.fn();
        render(<PasosPaseLista actual={2} onIrA={onIrA} />);
        const botones = screen.getAllByRole('button');
        expect(botones).toHaveLength(2);
        await usuario.click(screen.getByRole('button', { name: /Revisar y cerrar/ }));
        expect(onIrA).toHaveBeenLastCalledWith(3);
        await usuario.click(screen.getByRole('button', { name: /Pasar lista/ }));
        expect(onIrA).toHaveBeenLastCalledWith(2);
        expect(screen.getByRole('button', { name: /Pasar lista/ })).toHaveAttribute('aria-current', 'step');
    });

    it('los iconos son decorativos', () => {
        const { container } = render(<PasosPaseLista actual={3} />);
        container.querySelectorAll('svg').forEach((svg) => expect(svg.closest('[aria-hidden="true"]') ?? svg).toHaveAttribute('aria-hidden', 'true'));
    });
});

describe('pasosPaseLista.utils', () => {
    it('estadoPaso compara con el paso actual', () => {
        expect(estadoPaso(1, 2)).toBe('hecho');
        expect(estadoPaso(2, 2)).toBe('actual');
        expect(estadoPaso(3, 2)).toBe('pendiente');
    });

    it('pasosDe devuelve tres pasos numerados del 1 al 3 en ambos modos', () => {
        for (const modo of ['automatico', 'manual']) expect(pasosDe(modo).map((p) => p.id)).toEqual([1, 2, 3]);
    });
});
