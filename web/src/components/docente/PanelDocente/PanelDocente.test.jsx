// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PanelDocente from './PanelDocente.jsx';
import { docentePanel } from '@/lib/api/sesiones.js';
import { ahora } from '@/lib/api/plataforma.js';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/docente' }));
vi.mock('@/lib/api/sesiones.js', () => ({ docentePanel: vi.fn(), abrirSesion: vi.fn() }));
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: vi.fn() }));

const base = { fecha: '2026-09-14', sesiones_hoy: [], pendientes: 2, justificantes_por_resolver: 1, alertas: [], grupos: [] };

describe('PanelDocente', () => {
    it('sin alertas no hay gráfica de faltas', async () => {
        ahora.mockResolvedValue({ reloj_simulado: false });
        docentePanel.mockResolvedValue(base);
        render(<PanelDocente encabezado={false} />);
        await waitFor(() => expect(screen.getByText('Sin alertas')).toBeInTheDocument());
        expect(screen.queryByRole('group', { name: 'Faltas vs límite' })).toBeNull();
    });

    it('con alertas muestra la lista compacta y la gráfica Faltas vs límite', async () => {
        ahora.mockResolvedValue({ reloj_simulado: false });
        docentePanel.mockResolvedValue({
            ...base,
            alertas: [{ tipo: 'sin_derecho', id_grupo: 1, id_alumno: 1, matricula: 'E1', nombre: 'Ana Perez', materia: 'Finanzas', clave_grupo: '3A', porcentaje_faltas: 25, limite_pct: 20, mensaje: 'texto largo repetido' }],
        });
        render(<PanelDocente encabezado={false} />);
        await waitFor(() => expect(screen.getByRole('group', { name: 'Faltas vs límite' })).toBeInTheDocument());
        expect(screen.getAllByText('Ana Perez').length).toBeGreaterThan(0);
        expect(screen.getByText('Sin derecho a examen')).toBeInTheDocument();
        expect(screen.queryByText('texto largo repetido')).toBeNull();
    });

    describe('tarjeta «Pasar lista» (acción principal)', () => {
        const ses = (id, extra = {}) => ({
            id_sesion: id, id_grupo: 1, materia: 'Finanzas', clave_grupo: '3A', aula: 'A-101', fecha: '2026-09-14',
            hora_inicio: '07:00:00', hora_fin: '08:00:00', estatus: 'programada', modo_previsto: 'automatico', camaras_activas: 1, abrible: false, ...extra,
        });
        const RELOJ = { reloj_simulado: false, fecha: '2026-09-14', hora: '07:12:00' };

        it('es lo PRIMERO del panel: va antes de los pendientes de revisión y de la lista de sesiones', async () => {
            ahora.mockResolvedValue(RELOJ);
            docentePanel.mockResolvedValue({ ...base, sesiones_hoy: [ses(19, { estatus: 'abierta' }), ses(115, { hora_inicio: '09:00:00', hora_fin: '10:00:00' })] });
            render(<PanelDocente encabezado={false} />);
            const hero = await screen.findByRole('region', { name: 'Pasar lista' });
            const pendientes = screen.getByText('Registros pendientes de revisión');
            const lista = screen.getByRole('heading', { name: 'Todas las sesiones de hoy' });
            expect(hero.compareDocumentPosition(pendientes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            expect(hero.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            // y es la primera sección del contenido del panel
            expect(hero.parentElement.firstElementChild).toBe(hero);
        });

        it('con una sesión abierta ofrece «Continuar pase de lista» (con ?pasar-lista=1) y enlaza a las demás', async () => {
            ahora.mockResolvedValue(RELOJ);
            docentePanel.mockResolvedValue({ ...base, sesiones_hoy: [ses(19, { estatus: 'abierta' }), ses(115, { hora_inicio: '09:00:00', hora_fin: '10:00:00' })] });
            render(<PanelDocente encabezado={false} />);
            const hero = await screen.findByRole('region', { name: 'Pasar lista' });
            expect(within(hero).getByRole('link', { name: 'Continuar pase de lista' })).toHaveAttribute('href', '/docente/sesiones/19?pasar-lista=1');
            expect(within(hero).getByRole('link', { name: /Otras sesiones de hoy \(1\)/ })).toHaveAttribute('href', '#sesiones-hoy');
            // la lista completa sigue debajo, con el botón «Pasar lista» de la sesión abierta
            const lista = screen.getByRole('heading', { name: 'Todas las sesiones de hoy' }).closest('section');
            expect(within(lista).getByRole('link', { name: 'Pasar lista' })).toHaveAttribute('href', '/docente/sesiones/19?pasar-lista=1');
            expect(lista).toHaveAttribute('id', 'sesiones-hoy');
        });

        it('lee la hora del plantel (api_ahora): una programada futura queda «Disponible a las HH:MM» y deshabilitada', async () => {
            ahora.mockResolvedValue(RELOJ);
            docentePanel.mockResolvedValue({ ...base, sesiones_hoy: [ses(115, { hora_inicio: '09:00:00', hora_fin: '10:00:00' })] });
            render(<PanelDocente encabezado={false} />);
            expect(await screen.findByRole('button', { name: 'Disponible a las 09:00' })).toBeDisabled();
        });

        it('una programada dentro de su horario ofrece «Abrir y pasar lista» hacia /docente/pasar-lista?sesion=<id>', async () => {
            ahora.mockResolvedValue(RELOJ);
            docentePanel.mockResolvedValue({ ...base, sesiones_hoy: [ses(115, { abrible: true })] });
            render(<PanelDocente encabezado={false} />);
            const hero = await screen.findByRole('region', { name: 'Pasar lista' });
            expect(within(hero).getByRole('link', { name: 'Abrir y pasar lista' })).toHaveAttribute('href', '/docente/pasar-lista?sesion=115');
        });

        it('sin sesiones hoy muestra el estado vacío amable (y sigue el resto del panel)', async () => {
            ahora.mockResolvedValue(RELOJ);
            docentePanel.mockResolvedValue(base);
            render(<PanelDocente encabezado={false} />);
            const hero = await screen.findByRole('region', { name: 'Pasar lista' });
            expect(within(hero).getByText('Hoy no tienes clases programadas')).toBeInTheDocument();
            expect(screen.getByText('Registros pendientes de revisión')).toBeInTheDocument();
        });

        it('si falla la hora del plantel, la tarjeta igual se muestra (sin afirmar antes/después)', async () => {
            ahora.mockRejectedValue(new Error('sin reloj'));
            docentePanel.mockResolvedValue({ ...base, sesiones_hoy: [ses(115, { hora_inicio: '09:00:00', hora_fin: '10:00:00' })] });
            render(<PanelDocente encabezado={false} />);
            expect(await screen.findByRole('button', { name: 'Disponible de 09:00 a 10:00' })).toBeDisabled();
        });

        it('se refresca sola cada 30 s (el botón deshabilitado se activa al llegar la hora sin recargar)', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            try {
                ahora.mockResolvedValueOnce({ ...RELOJ, hora: '06:59:30' }).mockResolvedValue({ ...RELOJ, hora: '07:00:10' });
                docentePanel
                    .mockResolvedValueOnce({ ...base, sesiones_hoy: [ses(115)] })
                    .mockResolvedValue({ ...base, sesiones_hoy: [ses(115, { abrible: true })] });
                render(<PanelDocente encabezado={false} />);
                expect(await screen.findByRole('button', { name: 'Disponible a las 07:00' })).toBeDisabled();
                await act(async () => {
                    await vi.advanceTimersByTimeAsync(31_000);
                });
                expect(await screen.findByRole('link', { name: 'Abrir y pasar lista' })).toHaveAttribute('href', '/docente/pasar-lista?sesion=115');
                expect(docentePanel).toHaveBeenCalledTimes(2);
            } finally {
                vi.useRealTimers();
            }
        });
    });
});
