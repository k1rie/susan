// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar.jsx';
import { ACCION_CENTRAL_POR_ROL, NAV_POR_ROL, accionCentralParaRol, itemActivo, navParaRol } from './navItems.js';

describe('navegación por rol', () => {
    it('define los ítems de cada rol según plataforma.md', () => {
        expect(navParaRol('administrador')).toHaveLength(11);
        // «Pasar lista» va justo después del Panel (la acción diaria del docente no se esconde en un grupo)
        expect(navParaRol('docente').map((i) => i.href)).toEqual(['/docente', '/docente/pasar-lista', '/docente/revision', '/reportes', '/analitica']);
        expect(navParaRol('alumno').map((i) => i.href)).toEqual(['/alumno']);
        expect(navParaRol('tecnico').map((i) => i.label)).toEqual(['Consola técnica']);
        expect(navParaRol('otro')).toEqual([]);
        for (const items of Object.values(NAV_POR_ROL)) for (const i of items) expect(i.icon).toBeTruthy();
    });

    it('el ítem activo es la coincidencia más larga', () => {
        const items = navParaRol('docente');
        expect(itemActivo(items, '/docente/revision')).toBe('/docente/revision');
        expect(itemActivo(items, '/docente/pasar-lista')).toBe('/docente/pasar-lista');
        expect(itemActivo(items, '/docente/sesiones/5')).toBe('/docente');
        expect(itemActivo(items, '/docenteX')).toBeNull();
    });
});

describe('acción central de la barra inferior (por rol)', () => {
    it('el docente tiene «Pasar lista» como acción central y es un destino de su navegación', () => {
        const accion = accionCentralParaRol('docente');
        expect(accion).toMatchObject({ href: '/docente/pasar-lista', label: 'Pasar lista' });
        expect(accion.icon).toBeTruthy();
        expect(navParaRol('docente').map((i) => i.href)).toContain(accion.href);
    });
    it('los demás roles (y los desconocidos) usan la búsqueda por omisión: null', () => {
        for (const rol of ['administrador', 'alumno', 'tecnico', 'otro', undefined]) expect(accionCentralParaRol(rol)).toBeNull();
    });
    it('toda acción central apunta a un destino de la navegación de su rol', () => {
        for (const [rol, accion] of Object.entries(ACCION_CENTRAL_POR_ROL)) {
            expect(accion.href).toMatch(/^\//);
            expect(accion.label.length).toBeGreaterThan(2);
            expect(navParaRol(rol).map((i) => i.href), rol).toContain(accion.href);
        }
    });
});

describe('Sidebar', () => {
    it('pinta los ítems del rol y marca aria-current', () => {
        render(<Sidebar items={navParaRol('docente')} pathname="/docente/revision" open={false} onClose={() => {}} />);
        const nav = screen.getByRole('navigation', { name: 'Principal' });
        expect(within(nav).getAllByRole('link')).toHaveLength(5);
        expect(within(nav).getByText('Pasar lista').closest('a')).toHaveAttribute('href', '/docente/pasar-lista');
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
