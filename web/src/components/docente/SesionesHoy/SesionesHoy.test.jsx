// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { abrirSesion } from '@/lib/api/sesiones.js';
import SesionesHoy from './SesionesHoy.jsx';

const push = vi.fn();
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/api/sesiones.js', () => ({ abrirSesion: vi.fn() }));

const ses = (id, extra = {}) => ({
    id_sesion: id, id_grupo: 1, materia: 'Finanzas', clave_grupo: '3A', aula: 'A-101', fecha: '2026-09-14',
    hora_inicio: '07:00:00', hora_fin: '08:00:00', estatus: 'programada', modo_previsto: 'automatico', camaras_activas: 1, abrible: false, ...extra,
});

describe('SesionesHoy: lista completa debajo de la tarjeta principal', () => {
    it('se llama «Todas las sesiones de hoy» y es el ancla #sesiones-hoy del panel', () => {
        const { container } = render(<SesionesHoy sesiones={[ses(1)]} />);
        expect(screen.getByRole('heading', { level: 2, name: 'Todas las sesiones de hoy' })).toBeInTheDocument();
        expect(container.querySelector('#sesiones-hoy')).toBeInTheDocument();
    });

    it('el ancla deja 16 px de aire al saltar: ya no hay una barra superior fija que la tape', () => {
        const { container } = render(<SesionesHoy sesiones={[ses(1)]} />);
        const ancla = container.querySelector('#sesiones-hoy');
        expect(ancla).toHaveClass('scroll-mt-4');
        expect(ancla).not.toHaveClass('scroll-mt-20');
    });

    it('sin sesiones: aviso amable', () => {
        render(<SesionesHoy sesiones={[]} />);
        expect(screen.getByText('Sin sesiones hoy')).toBeInTheDocument();
    });

    it('sesión ABIERTA (aunque abrible=false, como la manda el servidor): botón «Pasar lista» a la sesión con ?pasar-lista=1', () => {
        render(<SesionesHoy sesiones={[ses(19, { estatus: 'abierta', abrible: false })]} />);
        expect(screen.getByRole('link', { name: 'Pasar lista' })).toHaveAttribute('href', '/docente/sesiones/19?pasar-lista=1');
    });

    it('sesión abierta en modo manual: también «Pasar lista»', () => {
        render(<SesionesHoy sesiones={[ses(20, { estatus: 'abierta', modo_previsto: 'manual', camaras_activas: 0 })]} />);
        expect(screen.getByRole('link', { name: 'Pasar lista' })).toHaveAttribute('href', '/docente/sesiones/20?pasar-lista=1');
    });

    it('programada dentro de su horario: «Abrir y pasar lista» abre la sesión y navega con ?pasar-lista=1', async () => {
        abrirSesion.mockResolvedValue({ id_sesion: 115, estatus: 'abierta' });
        render(<SesionesHoy sesiones={[ses(115, { abrible: true })]} />);
        await userEvent.click(screen.getByRole('button', { name: 'Abrir y pasar lista' }));
        await waitFor(() => expect(push).toHaveBeenCalledWith('/docente/sesiones/115?pasar-lista=1'));
        expect(abrirSesion).toHaveBeenCalledWith({ idSesion: 115 });
    });

    it('si abrir falla no navega y el botón vuelve a estar disponible', async () => {
        abrirSesion.mockRejectedValue(Object.assign(new Error('fuera de horario'), { code: 'FUERA_DE_HORARIO' }));
        render(<SesionesHoy sesiones={[ses(115, { abrible: true })]} />);
        await userEvent.click(screen.getByRole('button', { name: 'Abrir y pasar lista' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir y pasar lista' })).toBeEnabled());
        expect(push).not.toHaveBeenCalled();
    });

    it('programada que aún no se puede abrir: sin botón de acción (la tarjeta principal explica la ventana)', () => {
        render(<SesionesHoy sesiones={[ses(115)]} />);
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('cerrada y suspendida: «Ver sesión» sin ?pasar-lista', () => {
        render(<SesionesHoy sesiones={[ses(1, { estatus: 'cerrada' }), ses(2, { estatus: 'suspendida' })]} />);
        const enlaces = screen.getAllByRole('link', { name: 'Ver sesión' });
        expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['/docente/sesiones/1', '/docente/sesiones/2']);
    });

    describe('sin sitio (360 px, o dos columnas en tableta): el botón baja bajo el texto en lugar de recortar título y aula', () => {
        // jsdom no calcula CSS: se comprueba que las clases de apilado existan y que sus selectores (hijos directos de la tarjeta) den
        // exactamente en la columna de texto y en la acción, nunca en la ficha del icono (también es un span.shrink-0).
        const tarjeta = () => screen.getByRole('listitem').firstElementChild;

        it('la tarjeta envuelve a cualquier ancho (sin volver a nowrap desde sm) y la columna de texto reserva 13 rem', () => {
            render(<SesionesHoy sesiones={[ses(19, { estatus: 'abierta' })]} />);
            const clases = tarjeta().className.split(/\s+/);
            expect(clases).toEqual(expect.arrayContaining([
                'flex-wrap',
                '[&>span.flex-1]:min-w-[13rem]',
                '[&>span.shrink-0:last-child]:max-sm:ml-14',
            ]));
            // Con nowrap (o min-w-0) desde sm, a 768 px (2 columnas de ~360 px) el título volvía a recortarse.
            expect(clases).not.toContain('sm:flex-nowrap');
            expect(clases).not.toContain('sm:[&>span.flex-1]:min-w-0');
        });

        it('el selector de la acción da solo en el botón (no en la ficha del icono) y el de la columna de texto, en ella', () => {
            render(<SesionesHoy sesiones={[ses(19, { estatus: 'abierta' })]} />);
            const acciones = tarjeta().querySelectorAll(':scope > span.shrink-0:last-child');
            expect(acciones).toHaveLength(1);
            expect(within(acciones[0]).getByRole('link', { name: 'Pasar lista' })).toBeInTheDocument();
            const columnas = tarjeta().querySelectorAll(':scope > span.flex-1');
            expect(columnas).toHaveLength(1);
            expect(within(columnas[0]).getByText('Finanzas (3A)')).toBeInTheDocument();
        });

        it('sin botón no se monta contenedor de acción: la tarjeta solo tiene ficha y texto (si no, bajaría de línea y estiraría la fila)', () => {
            render(<SesionesHoy sesiones={[ses(115)]} />);
            expect(tarjeta().children).toHaveLength(2);
            expect(tarjeta().querySelectorAll(':scope > span.shrink-0:last-child')).toHaveLength(0);
        });
    });

    it('cada fila muestra materia, horario, aula, estado y modo', () => {
        render(<SesionesHoy sesiones={[ses(19, { estatus: 'abierta' })]} />);
        const fila = screen.getByRole('listitem');
        expect(within(fila).getByText('Finanzas (3A)')).toBeInTheDocument();
        expect(within(fila).getByText(/07:00 - 08:00 · Aula A-101/)).toBeInTheDocument();
        expect(within(fila).getByText('Abierta')).toBeInTheDocument();
        expect(within(fila).getByText('Automático')).toBeInTheDocument();
    });
});
