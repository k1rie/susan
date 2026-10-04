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
    it('la tarjeta muestra la cifra principal, la barra y el aviso; las cifras por estado ya no van en cajas propias', () => {
        const { container } = render(<ResumenMaterias items={[item]} idGrupoSeleccionado={1} onSeleccionar={() => {}} />);
        const tarjeta = screen.getByRole('heading', { name: 'Cálculo' }).closest('li');
        expect(within(tarjeta).getByText('12', { selector: 'strong' })).toBeInTheDocument();
        expect(within(tarjeta).getByText(/de 9 faltas permitidas/)).toBeInTheDocument();
        expect(within(tarjeta).getByRole('progressbar')).toBeInTheDocument();
        expect(within(tarjeta).getByText(/sin derecho a examen/)).toBeInTheDocument();
        // Presentes, retardos y ausencias viven en las casillas (StatCard) de la materia elegida, no en cajas dentro de cada tarjeta.
        expect(within(tarjeta).queryByText('Presentes')).not.toBeInTheDocument();
        expect(within(tarjeta).queryByText('Retardos')).not.toBeInTheDocument();
        expect(tarjeta.querySelector('dl')).toBeNull();
        expect(container.querySelector('.bg-muted\\/60')).toBeNull();
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
    it('el desglose resume la mezcla de registros de cada materia en una barra segmentada, sin quitar las cifras', () => {
        render(<ResumenMaterias items={[item]} idGrupoSeleccionado={1} onSeleccionar={() => {}} />);
        const tabla = screen.getByRole('table', { hidden: true });
        expect(within(tabla).getByText('Distribución')).toBeInTheDocument();
        // Presentes, retardos, ausencias y justificadas resueltos (los pendientes aún no cuentan); la barra es una imagen con su texto.
        const barra = within(tabla).getByRole('img', { hidden: true });
        expect(barra).toHaveAccessibleName(/Presentes 5 \(26 %\).*Ausencias 12 \(63 %\).*Justificadas 2 \(11 %\)/);
        expect(within(tabla).getByText('12 / 9')).toBeInTheDocument();
    });
    it('sin registros resueltos la barra del desglose dice «Sin registros»', () => {
        render(<ResumenMaterias items={[{ ...item, presentes: 0, retardos: 0, ausencias: 0, justificadas: 0 }]} idGrupoSeleccionado={1} onSeleccionar={() => {}} />);
        expect(within(screen.getByRole('table', { hidden: true })).getByRole('img', { hidden: true })).toHaveAccessibleName('Sin registros');
    });
    it('sin sesiones programadas no hay barra ni cifra de faltas', () => {
        render(<ResumenMaterias items={[{ ...item, sesiones_programadas: 0, supera_limite: false, derecho_examen: true }]} idGrupoSeleccionado={null} onSeleccionar={() => {}} />);
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(screen.getByText('Aún no hay sesiones programadas.')).toBeInTheDocument();
    });
    it('una sola materia ocupa toda la columna; con varias, dos columnas en pantallas anchas', () => {
        const { container, rerender } = render(<ResumenMaterias items={[item]} idGrupoSeleccionado={1} onSeleccionar={() => {}} />);
        expect(container.querySelector('ul')).not.toHaveClass('lg:grid-cols-2');
        rerender(<ResumenMaterias items={[item, { ...item, id_grupo: 2, materia: { nombre: 'Álgebra' } }]} idGrupoSeleccionado={1} onSeleccionar={() => {}} />);
        expect(container.querySelector('ul')).toHaveClass('lg:grid-cols-2');
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
