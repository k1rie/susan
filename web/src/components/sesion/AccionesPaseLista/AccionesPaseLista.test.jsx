// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClipboardCheck } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import AccionesPaseLista from './AccionesPaseLista.jsx';

describe('AccionesPaseLista', () => {
    it('una acción primaria y las secundarias, cada una con su nombre', async () => {
        const usuario = userEvent.setup();
        const cerrar = vi.fn();
        const manual = vi.fn();
        render(<AccionesPaseLista primaria={{ etiqueta: 'Cerrar pase de lista', onClick: cerrar, icono: <ClipboardCheck aria-hidden="true" /> }} secundarias={[{ etiqueta: 'Registrar manualmente', onClick: manual }]} />);
        await usuario.click(screen.getByRole('button', { name: 'Cerrar pase de lista' }));
        await usuario.click(screen.getByRole('button', { name: 'Registrar manualmente' }));
        expect(cerrar).toHaveBeenCalledTimes(1);
        expect(manual).toHaveBeenCalledTimes(1);
    });

    it('la primaria va primero (es lo que se busca) y es la única negra', () => {
        render(<AccionesPaseLista primaria={{ etiqueta: 'Cerrar' }} secundarias={[{ etiqueta: 'Otra' }, { etiqueta: 'Otra más' }]} />);
        const botones = screen.getAllByRole('button');
        expect(botones.map((b) => b.textContent)).toEqual(['Cerrar', 'Otra', 'Otra más']);
        expect(botones[0]).toHaveClass('bg-primary');
        expect(botones[1]).not.toHaveClass('bg-primary');
        expect(botones[2]).not.toHaveClass('bg-primary');
    });

    it('en teléfono las acciones ocupan todo el ancho; desde sm van en fila (o siguen apiladas con `apilado`)', () => {
        const { container, rerender } = render(<AccionesPaseLista primaria={{ etiqueta: 'Cerrar' }} secundarias={[{ etiqueta: 'Otra' }]} />);
        screen.getAllByRole('button').forEach((b) => expect(b).toHaveClass('w-full'));
        expect(container.querySelector('.sm\\:flex-row')).not.toBeNull();
        rerender(<AccionesPaseLista apilado primaria={{ etiqueta: 'Cerrar' }} secundarias={[{ etiqueta: 'Otra' }]} />);
        expect(container.querySelector('.sm\\:flex-row')).toBeNull();
        expect(screen.getByRole('button', { name: 'Cerrar' })).not.toHaveClass('sm:w-auto');
    });

    it('bloqueada, la nota explica por qué y es la descripción accesible del botón', () => {
        render(<AccionesPaseLista primaria={{ etiqueta: 'Cerrar pase de lista', disabled: true }} nota="El cierre se habilita al terminar la tolerancia: faltan 14 min." />);
        const boton = screen.getByRole('button', { name: 'Cerrar pase de lista' });
        expect(boton).toBeDisabled();
        expect(boton).toHaveAccessibleDescription('El cierre se habilita al terminar la tolerancia: faltan 14 min.');
        expect(screen.getByText(/faltan 14 min/)).toBeVisible();
    });

    it('sin nota no hay descripción', () => {
        render(<AccionesPaseLista primaria={{ etiqueta: 'Cerrar' }} />);
        expect(screen.getByRole('button', { name: 'Cerrar' })).not.toHaveAttribute('aria-describedby');
    });

    it('loading deshabilita sin cambiar el nombre', () => {
        render(<AccionesPaseLista primaria={{ etiqueta: 'Guardar y cerrar', loading: true }} />);
        expect(screen.getByRole('button', { name: /Guardar y cerrar/ })).toBeDisabled();
    });
});
