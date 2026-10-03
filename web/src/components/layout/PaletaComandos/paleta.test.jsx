// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { modulosActivos, modulosProximos } from '@/lib/modulos.js';
import { navParaRol } from '../Sidebar/navItems.js';
import PaletaComandos from './PaletaComandos.jsx';
import { agruparComandos, construirComandos, filtrarComandos, normalizar } from './paleta.utils.js';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const comandosDocente = () => construirComandos({ nav: navParaRol('docente'), activos: modulosActivos('docente'), proximos: modulosProximos('docente') });

describe('utilidades de la paleta', () => {
    it('normalizar quita acentos y mayúsculas', () => {
        expect(normalizar('  Analítica  ')).toBe('analitica');
        expect(normalizar(null)).toBe('');
    });
    it('construye navegación, módulos próximos y cuenta, con descripción tomada del módulo activo', () => {
        const c = comandosDocente();
        expect(c.filter((x) => x.grupo === 'Ir a').map((x) => x.href)).toEqual(['/docente', '/docente/revision', '/reportes', '/analitica', '/modulos']);
        expect(c.find((x) => x.href === '/analitica').descripcion).toMatch(/proyección/i);
        expect(c.filter((x) => x.pronto).every((x) => x.href.startsWith('/modulos/'))).toBe(true);
        expect(c.at(-1)).toMatchObject({ accion: 'salir' });
    });
    it('filtra por todas las palabras sin acentos y ordena título que empieza > contiene > resto', () => {
        const c = comandosDocente();
        expect(filtrarComandos(c, '')).toHaveLength(c.length);
        expect(filtrarComandos(c, 'analitica')[0].titulo).toBe('Analítica');
        expect(filtrarComandos(c, 'riesgo numericos').map((x) => x.titulo)).toContain('Analítica');
        expect(filtrarComandos(c, 'zzzz')).toEqual([]);
        const r = filtrarComandos([{ id: 'a', titulo: 'Mis reportes', grupo: 'x' }, { id: 'b', titulo: 'Reportes', grupo: 'x' }, { id: 'c', titulo: 'Otro', descripcion: 'reportes varios', grupo: 'x' }], 'report');
        expect(r.map((x) => x.id)).toEqual(['b', 'a', 'c']);
    });
    it('agrupa conservando el orden', () => {
        expect(agruparComandos(comandosDocente()).map((g) => g.grupo)).toEqual(['Ir a', 'Próximamente', 'Cuenta']);
    });
});

describe('PaletaComandos', () => {
    it('cerrada no pinta nada', () => {
        const { container } = render(<PaletaComandos open={false} onClose={() => {}} comandos={comandosDocente()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('combobox accesible: flechas mueven la opción activa, Enter navega y cierra', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        push.mockClear();
        render(<PaletaComandos open onClose={onClose} comandos={comandosDocente()} />);
        const campo = screen.getByRole('combobox');
        expect(campo).toHaveFocus();
        const opciones = screen.getAllByRole('option');
        expect(opciones[0]).toHaveAttribute('aria-selected', 'true');
        expect(campo).toHaveAttribute('aria-activedescendant', opciones[0].id);
        await user.keyboard('{ArrowDown}');
        expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
        await user.keyboard('{Enter}');
        expect(push).toHaveBeenCalledWith('/docente/revision');
        expect(onClose).toHaveBeenCalled();
    });

    it('escribir filtra, muestra el mensaje sin resultados y Esc cierra', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<PaletaComandos open onClose={onClose} comandos={comandosDocente()} />);
        await user.type(screen.getByRole('combobox'), 'tutor');
        const lista = screen.getByRole('listbox');
        expect(within(lista).getAllByRole('option')).toHaveLength(1);
        expect(within(lista).getByText('Pronto')).toBeInTheDocument();
        await user.type(screen.getByRole('combobox'), 'zzz');
        expect(screen.getByText(/Sin resultados/)).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalled();
    });

    it('"Salir" ejecuta onSalir en vez de navegar', async () => {
        const user = userEvent.setup();
        const onSalir = vi.fn();
        push.mockClear();
        render(<PaletaComandos open onClose={() => {}} comandos={comandosDocente()} onSalir={onSalir} />);
        await user.click(screen.getByRole('option', { name: /Salir/ }));
        expect(onSalir).toHaveBeenCalledTimes(1);
        expect(push).not.toHaveBeenCalled();
    });
});
