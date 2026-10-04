// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AppShell from './AppShell.jsx';

// La tarjeta del reloj habla con /api/_local/reloj: aquí solo importa que el armazón la monte (su propia prueba cubre el resto).
vi.mock('../RelojDemo/RelojDemo.jsx', () => ({ default: () => <div data-testid="reloj-demo" /> }));

let rutaActual = '/docente';
vi.mock('next/navigation', () => ({
    usePathname: () => rutaActual,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const DOCENTE = { nombre: 'Patricia Ortega Salinas', rol: 'docente', id_usuario: 2 };
const ADMIN = { nombre: 'Ana Admin', rol: 'administrador', id_usuario: 1 };
const ALUMNO = { nombre: 'Mauricio González', rol: 'alumno', id_usuario: 3 };

const barraInferior = () => screen.getByRole('navigation', { name: 'Navegación inferior' });
const riel = () => screen.getByRole('navigation', { name: 'Principal' });

describe('AppShell: acción central de la barra inferior por rol', () => {
    it('docente: el botón central es «Pasar lista» (enlace a /docente/pasar-lista) y el riel lo lista tras el Panel', () => {
        rutaActual = '/docente';
        render(<AppShell me={DOCENTE}>contenido</AppShell>);
        const centro = within(barraInferior()).getByRole('link', { name: 'Pasar lista' });
        expect(centro).toHaveAttribute('href', '/docente/pasar-lista');
        // el buscador queda en la barra superior; ya no hay botón de búsqueda en la barra inferior
        expect(within(barraInferior()).queryByRole('button', { name: 'Buscar o ir a' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Buscar o ir a' })).toBeInTheDocument(); // TopbarMovil
        // riel lateral: Panel y luego Pasar lista
        const enlaces = within(riel()).getAllByRole('link').map((a) => a.textContent.trim());
        expect(enlaces.slice(0, 2)).toEqual(['Panel', 'Pasar lista']);
    });

    it('docente en /docente/pasar-lista: el botón central y el ítem del riel quedan activos', () => {
        rutaActual = '/docente/pasar-lista';
        render(<AppShell me={DOCENTE}>contenido</AppShell>);
        expect(within(barraInferior()).getByRole('link', { name: 'Pasar lista' })).toHaveAttribute('aria-current', 'page');
        expect(within(riel()).getByRole('link', { name: 'Pasar lista' })).toHaveAttribute('aria-current', 'page');
        expect(within(riel()).getByRole('link', { name: 'Panel' })).not.toHaveAttribute('aria-current');
    });

    it('administrador: el botón central sigue siendo «Buscar o ir a» y abre la paleta de comandos', async () => {
        rutaActual = '/admin';
        render(<AppShell me={ADMIN}>contenido</AppShell>);
        const centro = within(barraInferior()).getByRole('button', { name: 'Buscar o ir a' });
        expect(within(barraInferior()).queryByRole('link', { name: 'Pasar lista' })).toBeNull();
        await userEvent.click(centro);
        // la paleta se carga en diferido (React.lazy): aparece en cuanto llega su módulo
        expect(await screen.findByRole('combobox')).toBeInTheDocument();
    });

    it('alumno (un solo destino): no hay barra inferior ni «Pasar lista» en ninguna parte', () => {
        rutaActual = '/alumno';
        render(<AppShell me={ALUMNO}>contenido</AppShell>);
        expect(screen.queryByRole('navigation', { name: 'Navegación inferior' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'Pasar lista' })).toBeNull();
    });

    it('docente: «Pasar lista» también se encuentra en la paleta de comandos (⌘K)', async () => {
        rutaActual = '/docente';
        render(<AppShell me={DOCENTE}>contenido</AppShell>);
        await userEvent.keyboard('{Control>}k{/Control}');
        const lista = await screen.findByRole('listbox');
        expect(within(lista).getByRole('option', { name: /Pasar lista/ })).toBeInTheDocument();
    });

    it('reloj simulado: la tarjeta del reloj de demostración se monta solo cuando el reloj simulado está activo', async () => {
        rutaActual = '/docente';
        const { rerender } = render(<AppShell me={DOCENTE}>contenido</AppShell>);
        expect(screen.queryByTestId('reloj-demo')).toBeNull();
        rerender(<AppShell me={DOCENTE} relojSimulado>contenido</AppShell>);
        expect(await screen.findByTestId('reloj-demo')).toBeInTheDocument();
    });
});
