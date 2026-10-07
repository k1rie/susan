// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CierreSesionDialog from './CierreSesionDialog.jsx';

const api = vi.hoisted(() => ({ cerrarSesion: vi.fn() }));
vi.mock('@/lib/api/sesiones.js', () => api);

const TOTALES = { inscritos: 24, presentes: 18, retardos: 2, sin_registro: 3, pendientes: 1 };

beforeEach(() => {
    api.cerrarSesion.mockReset().mockResolvedValue({ ausentes_creados: 3, pendientes: 1 });
});

describe('CierreSesionDialog', () => {
    it('el título y el botón llevan tilde y el diálogo explica qué pasa con quien no tiene registro', () => {
        render(<CierreSesionDialog open idSesion={19} totales={TOTALES} onCancel={() => {}} />);
        const dialogo = screen.getByRole('dialog', { name: 'Cerrar sesión de clase' });
        expect(within(dialogo).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
        expect(within(dialogo).getByText('Los alumnos sin lecturas quedan como ausentes.')).toBeInTheDocument();
        expect(within(dialogo).getByText('Los alumnos con 1 o 2 lecturas quedan como pendientes de revisión.')).toBeInTheDocument();
        expect(screen.queryByText(/sesion/i, { selector: 'h2, h3, button' })).toBeNull();
    });

    it('resume lo que se cierra: presentes, retardos, quién quedará ausente y qué pasa a Revisión', () => {
        render(<CierreSesionDialog open idSesion={19} totales={TOTALES} onCancel={() => {}} />);
        const resumen = screen.getByRole('dialog').querySelector('dl');
        expect(resumen).toHaveAccessibleName('Resumen de lo que se cierra');
        expect(resumen).toHaveTextContent(/Presentes\s*18/);
        expect(resumen).toHaveTextContent(/Retardos\s*2/);
        expect(resumen).toHaveTextContent(/Sin registro\s*3Quedarán como ausentes/);
        expect(resumen).toHaveTextContent(/Pendientes\s*1Pasan a Revisión/);
    });

    it('oculta lo que no aplica (sin pendientes ni ausentes marcados) y no inventa cifras que no recibió', () => {
        render(<CierreSesionDialog open idSesion={19} totales={{ presentes: 5, retardos: 0, sin_registro: 2, pendientes: 0 }} onCancel={() => {}} />);
        const resumen = screen.getByRole('dialog').querySelector('dl');
        expect(resumen).not.toHaveTextContent('Pendientes');
        expect(resumen).not.toHaveTextContent('Ausentes marcados');
        expect(resumen).toHaveTextContent(/Retardos\s*0/);
    });

    it('sin totales no pinta resumen', () => {
        render(<CierreSesionDialog open idSesion={19} onCancel={() => {}} />);
        expect(screen.getByRole('dialog').querySelector('dl')).toBeNull();
    });

    it('en modo manual habla de marcas, no de lecturas de la cámara', () => {
        render(<CierreSesionDialog open idSesion={19} modo="manual" totales={{ presentes: 10, retardos: 1, ausentes: 2, sin_registro: 1, pendientes: 0 }} onCancel={() => {}} />);
        const dialogo = screen.getByRole('dialog');
        expect(within(dialogo).getByText('Los alumnos sin marcar quedan como ausentes.')).toBeInTheDocument();
        expect(within(dialogo).getByText('Se guardan las marcas que tienes en pantalla.')).toBeInTheDocument();
        expect(within(dialogo).queryByText(/lecturas/)).toBeNull();
        expect(dialogo.querySelector('dl')).toHaveTextContent(/Ausentes marcados\s*2/);
    });

    it('al confirmar cierra la sesión, avisa el resultado y entrega la respuesta', async () => {
        const usuario = userEvent.setup();
        const alCerrar = vi.fn();
        render(<CierreSesionDialog open idSesion={19} totales={TOTALES} onCancel={() => {}} onCerrada={alCerrar} />);
        await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
        await waitFor(() => expect(api.cerrarSesion).toHaveBeenCalledWith({ idSesion: 19 }));
        await waitFor(() => expect(alCerrar).toHaveBeenCalledWith({ ausentes_creados: 3, pendientes: 1 }));
    });

    it('con antesDeCerrar lo ejecuta primero; si falla, no cierra y el diálogo sigue disponible', async () => {
        const usuario = userEvent.setup();
        const orden = [];
        const antes = vi.fn(async () => {
            orden.push('guardar');
        });
        api.cerrarSesion.mockImplementation(async () => {
            orden.push('cerrar');
            return { ausentes_creados: 0, pendientes: 0 };
        });
        const { rerender } = render(<CierreSesionDialog open idSesion={19} antesDeCerrar={antes} onCancel={() => {}} />);
        await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
        await waitFor(() => expect(orden).toEqual(['guardar', 'cerrar']));

        api.cerrarSesion.mockClear();
        const fallo = vi.fn().mockRejectedValue(new Error('Sin conexión'));
        rerender(<CierreSesionDialog open idSesion={19} antesDeCerrar={fallo} onCancel={() => {}} />);
        await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
        await waitFor(() => expect(fallo).toHaveBeenCalled());
        expect(api.cerrarSesion).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('Cancelar no cierra nada', async () => {
        const usuario = userEvent.setup();
        const alCancelar = vi.fn();
        render(<CierreSesionDialog open idSesion={19} totales={TOTALES} onCancel={alCancelar} />);
        await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(alCancelar).toHaveBeenCalled();
        expect(api.cerrarSesion).not.toHaveBeenCalled();
    });
});
