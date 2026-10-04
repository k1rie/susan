// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TablaPeriodo from './TablaPeriodo.jsx';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }) => <a href={href} {...r}>{children}</a> }));

const grupo = (o) => ({ id_grupo: 1, clave_grupo: '3A', materia_nombre: 'Finanzas', docente_nombre: 'Doc Uno', inscritos: 30, sesiones_programadas: 45, sesiones_cerradas: 17,
    asistencia_promedio: 90, alumnos_en_limite: 2, alumnos_sin_derecho: 1, ...o });
const sinAlertas = grupo({ id_grupo: 2, clave_grupo: '5C', materia_nombre: 'Costos', docente_nombre: 'Doc Dos', inscritos: 20, sesiones_cerradas: 20, asistencia_promedio: 70.55, alumnos_en_limite: 0, alumnos_sin_derecho: 0 });
const sinDato = grupo({ id_grupo: 3, clave_grupo: '7B', materia_nombre: 'Matemáticas', inscritos: 25, sesiones_cerradas: 0, asistencia_promedio: null, alumnos_en_limite: 0, alumnos_sin_derecho: 4 });

const tabla = () => screen.getByRole('table', { name: 'Resumen por grupo del periodo' });

describe('TablaPeriodo', () => {
    it('una fila por grupo con su asistencia, sesiones cerradas e inscritos; sin dato, guion y no 0 %', () => {
        render(<TablaPeriodo items={[grupo(), sinAlertas, sinDato]} onAbrirGrupo={() => {}} />);
        const t = within(tabla());
        expect(t.getAllByRole('row')).toHaveLength(4);
        expect(t.getByText('90.00 %')).toBeInTheDocument();
        expect(t.getByText('70.55 %')).toBeInTheDocument();
        expect(within(t.getByText('Matemáticas', { selector: 'td' }).closest('tr')).getByText('—')).toBeInTheDocument();
        expect(t.getByText('17 / 45')).toBeInTheDocument();
        expect(t.getByText('20 / 45')).toBeInTheDocument();
        expect(t.getByText('0 / 45')).toBeInTheDocument();
    });

    it('el docente nunca desaparece: bajo la materia entre sm y xl y en su columna desde xl, sin duplicarse a la vista', () => {
        render(<TablaPeriodo items={[sinAlertas]} onAbrirGrupo={() => {}} />);
        const t = within(tabla());
        // Dos apariciones en el DOM; el CSS deja visible solo una según el ancho.
        const apariciones = t.getAllByText('Doc Dos');
        expect(apariciones).toHaveLength(2);
        const [bajoMateria, enColumna] = apariciones;
        expect(bajoMateria.tagName).toBe('SPAN');
        expect(bajoMateria).toHaveClass('xl:hidden');
        expect(bajoMateria.closest('td')).toHaveClass('hidden', 'sm:table-cell');
        expect(bajoMateria.closest('td')).toHaveTextContent('Costos');
        expect(enColumna.tagName).toBe('TD');
        expect(enColumna).toHaveClass('hidden', 'xl:table-cell');
    });

    it('la situación de riesgo va en texto + color y sale en su columna y bajo la clave del grupo (pantallas angostas)', () => {
        render(<TablaPeriodo items={[grupo(), sinAlertas, sinDato]} onAbrirGrupo={() => {}} />);
        const t = within(tabla());
        expect(t.getAllByText('1 sin derecho')).toHaveLength(2);
        expect(t.getAllByText('2 en el límite')).toHaveLength(2);
        expect(t.getAllByText('4 sin derecho')).toHaveLength(2);
        expect(t.getAllByText('Sin alertas')).toHaveLength(2);
        // La materia también va bajo la clave solo en pantallas angostas (desde sm tiene su columna).
        expect(t.getAllByText('Finanzas')).toHaveLength(2);
    });

    it('el nombre del grupo abre su reporte y el icono lleva a su analítica', async () => {
        const onAbrirGrupo = vi.fn();
        render(<TablaPeriodo items={[grupo(), sinAlertas]} onAbrirGrupo={onAbrirGrupo} />);
        await userEvent.click(screen.getByRole('button', { name: '5C' }));
        expect(onAbrirGrupo).toHaveBeenCalledWith(2);
        expect(screen.getByRole('link', { name: 'Ver analítica del grupo 3A' })).toHaveAttribute('href', '/analitica?grupo=1');
    });

    it('no fuerza una anchura mínima: a 360 px ocupa el ancho disponible sin desplazarse en horizontal', () => {
        render(<TablaPeriodo items={[grupo()]} onAbrirGrupo={() => {}} />);
        expect(tabla()).toHaveClass('w-full');
        expect(tabla().className).not.toMatch(/min-w-/);
        // Docente, inscritos y sesiones son columnas de pantallas amplias.
        for (const c of ['Docente', 'Inscritos', 'Sesiones cerradas']) {
            expect(within(tabla()).getByRole('columnheader', { name: c })).toHaveClass('hidden');
        }
    });

    it('sin grupos muestra el mensaje de vacío', () => {
        render(<TablaPeriodo items={[]} onAbrirGrupo={() => {}} />);
        expect(within(tabla()).getByText('Sin resultados')).toBeInTheDocument();
    });
});
