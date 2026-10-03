// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ResumenMaterias from './ResumenMaterias.jsx';

const item = {
    id_grupo: 1, clave_grupo: '3A', docente_nombre: 'Ana Pérez', materia: { nombre: 'Cálculo' },
    sesiones_programadas: 40, faltas_equivalentes: 12, faltas_maximas_permitidas: 9, faltas_restantes_antes_limite: 0,
    porcentaje_faltas: 30, limite_pct: 20, supera_limite: true, en_limite: false, derecho_examen: false,
    presentes: 5, retardos: 0, ausencias: 12, justificadas: 2, pendientes: 1,
};

describe('ResumenMaterias', () => {
    it('la tarjeta muestra la cifra principal, la barra y solo tres cifras; el resto va plegado', () => {
        render(<ResumenMaterias items={[item]} idGrupoSeleccionado={1} onSeleccionar={() => {}} />);
        const tarjeta = screen.getByRole('heading', { name: 'Cálculo' }).closest('li');
        expect(within(tarjeta).getByText('12', { selector: 'strong' })).toBeInTheDocument();
        expect(within(tarjeta).getByText(/de 9 faltas permitidas/)).toBeInTheDocument();
        expect(within(tarjeta).getByRole('progressbar')).toBeInTheDocument();
        expect(within(tarjeta).getByText('Presentes')).toBeInTheDocument();
        expect(within(tarjeta).getByText('Retardos')).toBeInTheDocument();
        expect(within(tarjeta).getByText('Ausencias')).toBeInTheDocument();
        expect(within(tarjeta).queryByText('Justificadas')).not.toBeInTheDocument();
        expect(within(tarjeta).getByText(/sin derecho a examen/)).toBeInTheDocument();
    });
    it('el desglose completo sigue en el DOM, plegado por defecto, con todos los estados', async () => {
        render(<ResumenMaterias items={[item]} idGrupoSeleccionado={1} onSeleccionar={() => {}} />);
        const boton = screen.getByRole('button', { name: /Desglose por materia/ });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        const tabla = screen.getByRole('table', { hidden: true });
        for (const c of ['Presentes', 'Retardos', 'Ausencias', 'Justificadas', 'Pendientes', 'Faltas eq.', 'Te quedan']) {
            expect(within(tabla).getByText(c)).toBeInTheDocument();
        }
        await userEvent.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'true');
        expect(within(screen.getByRole('table')).getByText('12 / 9')).toBeInTheDocument();
    });
    it('sin sesiones programadas no hay barra ni cifra de faltas', () => {
        render(<ResumenMaterias items={[{ ...item, sesiones_programadas: 0, supera_limite: false, derecho_examen: true }]} idGrupoSeleccionado={null} onSeleccionar={() => {}} />);
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(screen.getByText('Aún no hay sesiones programadas.')).toBeInTheDocument();
    });
    it('Ver historial notifica el grupo y marca la materia vista', async () => {
        const alElegir = vi.fn();
        const { rerender } = render(<ResumenMaterias items={[item]} idGrupoSeleccionado={null} onSeleccionar={alElegir} />);
        await userEvent.click(screen.getByRole('button', { name: 'Ver historial' }));
        expect(alElegir).toHaveBeenCalledWith(1);
        rerender(<ResumenMaterias items={[item]} idGrupoSeleccionado={1} onSeleccionar={alElegir} />);
        expect(screen.getByRole('button', { name: 'Viendo historial' })).toHaveAttribute('aria-pressed', 'true');
    });
});
