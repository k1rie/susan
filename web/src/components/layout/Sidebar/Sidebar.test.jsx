// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar.jsx';
import { NAV_POR_ROL, itemActivo, navParaRol } from './navItems.js';

describe('navegación por rol', () => {
    it('define los ítems de cada rol según plataforma.md', () => {
        expect(navParaRol('administrador')).toHaveLength(11);
        expect(navParaRol('docente').map((i) => i.href)).toEqual(['/docente', '/docente/revision', '/reportes', '/analitica']);
        expect(navParaRol('alumno').map((i) => i.href)).toEqual(['/alumno']);
        expect(navParaRol('tecnico').map((i) => i.label)).toEqual(['Consola técnica']);
        expect(navParaRol('otro')).toEqual([]);
        for (const items of Object.values(NAV_POR_ROL)) for (const i of items) expect(i.icon).toBeTruthy();
    });

    it('el ítem activo es la coincidencia más larga', () => {
        const items = navParaRol('docente');
        expect(itemActivo(items, '/docente/revision')).toBe('/docente/revision');
        expect(itemActivo(items, '/docente/sesiones/5')).toBe('/docente');
        expect(itemActivo(items, '/docenteX')).toBeNull();
    });
});

describe('Sidebar', () => {
    it('pinta los ítems del rol y marca aria-current', () => {
        render(<Sidebar items={navParaRol('docente')} pathname="/docente/revision" open={false} onClose={() => {}} />);
        const nav = screen.getByRole('navigation', { name: 'Principal' });
        expect(within(nav).getAllByRole('link')).toHaveLength(4);
        expect(within(nav).getByText('Revisión').closest('a')).toHaveAttribute('aria-current', 'page');
        expect(within(nav).getByText('Panel').closest('a')).not.toHaveAttribute('aria-current');
    });

    it('abierto cierra con Escape y al elegir un ítem', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Sidebar items={navParaRol('alumno')} pathname="/" open onClose={onClose} />);
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
        await user.click(screen.getByText('Mi asistencia'));
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
