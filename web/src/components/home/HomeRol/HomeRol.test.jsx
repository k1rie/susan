// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShellContext } from '@/components/layout/ShellContext.jsx';
import HomeRol from './HomeRol.jsx';

const conShell = (me) =>
    render(
        <ShellContext.Provider value={{ me, abrirPaleta: () => {} }}>
            <HomeRol>
                <p>contenido del panel</p>
            </HomeRol>
        </ShellContext.Provider>,
    );

describe('HomeRol', () => {
    it('docente: «Pasar lista» está entre sus herramientas y el panel (children) va antes que ellas', () => {
        conShell({ nombre: 'Patricia Ortega', rol: 'docente' });
        const herramientas = screen.getByRole('heading', { name: 'Tus herramientas' });
        const panel = screen.getByText('contenido del panel');
        expect(panel.compareDocumentPosition(herramientas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByRole('link', { name: /Pasar lista/ })).toHaveAttribute('href', '/docente/pasar-lista');
    });

    it('docente: en teléfono se oculta el campo de búsqueda grande (el buscador está en «Más» y «Pasar lista» es el botón central) para que «Pasar lista» no baje del pliegue', () => {
        conShell({ nombre: 'Patricia Ortega', rol: 'docente' });
        const campo = screen.getByRole('button', { name: 'Buscar o ir a' });
        expect(campo.parentElement).toHaveClass('hidden', 'sm:block');
    });

    it('los demás roles conservan el campo de búsqueda en todos los tamaños', () => {
        conShell({ nombre: 'Ana Admin', rol: 'administrador' });
        expect(screen.getByRole('button', { name: 'Buscar o ir a' }).parentElement).not.toHaveClass('hidden');
    });
});
