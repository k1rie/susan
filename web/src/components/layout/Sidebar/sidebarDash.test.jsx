// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { modulosProximos } from '@/lib/modulos.js';
import MenuCuenta from '../MenuCuenta/MenuCuenta.jsx';
import Sidebar from './Sidebar.jsx';
import { agruparNav, navParaRol } from './navItems.js';

describe('agruparNav', () => {
    it('separa el inicio y agrupa el resto conservando el orden', () => {
        const { inicio, grupos } = agruparNav(navParaRol('administrador'));
        expect(inicio.href).toBe('/admin');
        expect(grupos.map((g) => g.grupo)).toEqual(['Catálogos', 'Cuentas y auditoría', 'Análisis', 'Sistema']);
        expect(grupos[0].items.map((i) => i.label)).toEqual(['Grupos', 'Alumnos', 'Docentes', 'Materias', 'Aulas']);
    });
    it('docente: «Pasar lista» queda en un grupo sin título, antes de «Asistencia» (justo bajo el Panel)', () => {
        const { inicio, grupos } = agruparNav(navParaRol('docente'));
        expect(inicio.href).toBe('/docente');
        expect(grupos.map((g) => g.grupo)).toEqual(['', 'Asistencia', 'Análisis']);
        expect(grupos[0].items.map((i) => i.label)).toEqual(['Pasar lista']);
    });
    it('un rol con un solo ítem no tiene grupos; sin ítems no falla', () => {
        expect(agruparNav(navParaRol('alumno')).grupos).toEqual([]);
        expect(agruparNav([])).toEqual({ inicio: null, grupos: [] });
    });
});

describe('Sidebar estilo Dash', () => {
    const ME = { nombre: 'Patricia Ortega Salinas', rol: 'docente' };
    const props = { items: navParaRol('docente'), pathname: '/docente/revision', open: true, onClose: () => {}, proximos: modulosProximos('docente').slice(0, 4), me: ME };

    it('pinta títulos de sección, Próximamente con candado y los enlaces de pie', () => {
        render(<Sidebar {...props} />);
        expect(screen.getByText('Asistencia')).toBeInTheDocument();
        expect(screen.getByText('Análisis')).toBeInTheDocument();
        const prox = screen.getByRole('navigation', { name: 'Próximamente' });
        expect(within(prox).getAllByRole('link').length).toBeGreaterThanOrEqual(4);
        expect(within(prox).getByText('Asistente SUSAN').closest('a')).toHaveAttribute('href', '/modulos/asistente');
        expect(screen.getByRole('link', { name: 'Módulos' })).toHaveAttribute('href', '/modulos');
    });
    it('«Pasar lista» aparece justo después de «Buscar», antes del título «Asistencia»', () => {
        render(<Sidebar {...props} />);
        const nav = screen.getByRole('navigation', { name: 'Principal' });
        const orden = [...nav.querySelectorAll('a, button, p')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
        expect(orden.slice(0, 5)).toEqual(['Panel', expect.stringMatching(/^Buscar/), 'Pasar lista', 'Asistencia', 'Revisión']);
    });
    it('«Buscar» abre la paleta y cierra el cajón', async () => {
        const onBuscar = vi.fn();
        const onClose = vi.fn();
        render(<Sidebar {...props} onBuscar={onBuscar} onClose={onClose} />);
        await userEvent.click(screen.getByRole('button', { name: /Buscar/ }));
        expect(onBuscar).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalled();
    });
    it('«Módulos» queda activo en /modulos', () => {
        render(<Sidebar {...props} pathname="/modulos" />);
        expect(screen.getByRole('link', { name: 'Módulos' })).toHaveAttribute('aria-current', 'page');
    });
});

describe('MenuCuenta', () => {
    const ME = { nombre: 'Mauricio González Campos', rol: 'alumno', id_usuario: 3 };
    it('abre con el botón, ofrece bienvenida, contraseña y salir; Esc cierra', async () => {
        const onSalir = vi.fn();
        render(<MenuCuenta me={ME} onSalir={onSalir} />);
        await userEvent.click(screen.getByRole('button', { name: /Cuenta de Mauricio/ }));
        expect(screen.getByRole('menuitem', { name: /Ver bienvenida/ })).toHaveAttribute('href', '/bienvenida');
        expect(screen.getByRole('menuitem', { name: /Cambiar contraseña/ })).toHaveAttribute('href', '/cambiar-contrasena');
        await userEvent.click(screen.getByRole('menuitem', { name: /Salir/ }));
        expect(onSalir).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: /Cuenta de Mauricio/ }));
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).toBeNull();
    });
});
