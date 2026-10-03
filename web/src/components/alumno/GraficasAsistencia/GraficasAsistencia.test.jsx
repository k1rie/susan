// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GraficasAsistencia from './GraficasAsistencia.jsx';

const mat = (id, nombre, extra = {}) => ({
    id_grupo: id, clave_grupo: `G${id}`, materia: { nombre }, presentes: 5, retardos: 1, ausencias: 2, justificadas: 1, pendientes: 0,
    porcentaje_faltas: 10, limite_pct: 20, ...extra,
});

describe('GraficasAsistencia', () => {
    it('con una materia solo pinta la dona, con texto alternativo', () => {
        const { container } = render(<GraficasAsistencia items={[mat(1, 'Álgebra')]} />);
        expect(screen.getByRole('group', { name: 'Mi asistencia' })).toHaveAccessibleDescription(/Presentes: 5/);
        expect(screen.queryByRole('group', { name: 'Faltas frente al límite' })).not.toBeInTheDocument();
        expect(container.querySelectorAll('[data-slot="chart"]')).toHaveLength(1);
    });
    it('con varias materias añade la gráfica de faltas frente al límite', () => {
        const { container } = render(<GraficasAsistencia items={[mat(1, 'Álgebra'), mat(2, 'Cálculo', { porcentaje_faltas: 30, supera_limite: true })]} />);
        expect(screen.getByRole('group', { name: 'Faltas frente al límite' })).toHaveAccessibleDescription(/Cálculo: 30 % de faltas.*Límite: 20 %/);
        expect(container.querySelectorAll('[data-slot="chart"]')).toHaveLength(2);
    });
    it('el centro de la dona dice "Asistieron" y el pie aclara la fórmula', () => {
        render(<GraficasAsistencia items={[mat(1, 'Álgebra')]} />);
        expect(screen.getByRole('group', { name: 'Mi asistencia' })).toHaveAccessibleDescription(/Asistieron: 67 %/);
        expect(screen.getByText(/Asistieron: presentes y retardos/)).toBeInTheDocument();
    });
    it('la gráfica de faltas marca en su texto alternativo la materia que está en el límite', () => {
        render(<GraficasAsistencia items={[mat(1, 'Álgebra'), mat(2, 'Cálculo', { porcentaje_faltas: 20, en_limite: true })]} />);
        expect(screen.getByRole('group', { name: 'Faltas frente al límite' })).toHaveAccessibleDescription(/Cálculo: 20 % de faltas \(en el límite\)/);
    });
    it('sin registros de asistencia muestra el aviso en lugar de un hueco', () => {
        render(<GraficasAsistencia items={[mat(1, 'Álgebra', { presentes: 0, retardos: 0, ausencias: 0, justificadas: 0 })]} />);
        expect(screen.getByText('Aún no hay registros de asistencia')).toBeInTheDocument();
    });
    it('avisa de los pendientes que aún no cuentan', () => {
        render(<GraficasAsistencia items={[mat(1, 'Álgebra', { pendientes: 2 })]} />);
        expect(screen.getByText('2 registros pendientes de revisión aún no cuentan.')).toBeInTheDocument();
    });
});
