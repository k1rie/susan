// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResumenGrupo from './ResumenGrupo.jsx';

const reporte = {
    limite_pct: 20,
    kpis: { sesiones_programadas: 45, sesiones_cerradas: 17, asistencia_promedio: 82.35, alumnos_en_limite: 0, alumnos_sin_derecho: 1 },
};
const fila = (o) => ({ id_alumno: 2, matricula: 'E2', nombres: 'Luis', apellido_paterno: 'Gómez', nombre_completo: 'Luis Gómez', presentes: 5, retardos: 0,
    ausencias: 1, justificadas: 0, pendientes: 0, faltas_equivalentes: 1, porcentaje_faltas: 24, ...o });
const impacto = { minutos_recuperados: 85, horas_recuperadas: 1.42, sesiones_automaticas: 17, sesiones_manuales: 0, sesiones_cerradas: 17, minutos_pase_lista_base: 5 };

// Con "reducir movimiento" los gráficos se dibujan al instante: sin observador de entrada ni temporizadores fuera de `act`.
beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => vi.unstubAllGlobals());

const tarjeta = (nombre) => screen.getByRole('group', { name: nombre });

describe('ResumenGrupo: anillo de estados', () => {
    it('grupo completo: el centro lleva la asistencia promedio del grupo', () => {
        render(<ResumenGrupo reporte={reporte} filas={[fila()]} />);
        const anillo = tarjeta('Estados de asistencia');
        expect(within(anillo).getByText('82 %')).toBeInTheDocument();
        expect(within(anillo).getByText('Asistencia')).toBeInTheDocument();
        expect(within(anillo).queryByText('Total')).toBeNull();
    });

    it('con un alumno seleccionado el centro es el total de sus registros, no la cifra del grupo', () => {
        render(<ResumenGrupo reporte={reporte} filas={[fila()]} nombreAlumno="Luis Gómez" />);
        const anillo = tarjeta('Estados de asistencia');
        expect(within(anillo).getByText('Total')).toBeInTheDocument();
        expect(within(anillo).queryByText('82 %')).toBeNull();
        expect(within(anillo).getByText('6')).toBeInTheDocument();
        expect(screen.getByText('Registros de Luis Gómez')).toBeInTheDocument();
    });

    it('sin sesiones programadas no hay centro de asistencia', () => {
        render(<ResumenGrupo reporte={{ ...reporte, kpis: { ...reporte.kpis, sesiones_programadas: 0, asistencia_promedio: null } }} filas={[fila()]} />);
        const anillo = tarjeta('Estados de asistencia');
        expect(within(anillo).getByText('Total')).toBeInTheDocument();
        expect(within(anillo).queryByText('Asistencia')).toBeNull();
    });

    it('la leyenda trae cada estado con su cifra y porcentaje, también los que valen 0', () => {
        render(<ResumenGrupo reporte={reporte} filas={[fila(), fila({ id_alumno: 3, presentes: 3, retardos: 1, ausencias: 0, justificadas: 2 })]} />);
        const anillo = tarjeta('Estados de asistencia');
        const leyenda = within(anillo).getAllByRole('listitem').map((li) => li.textContent);
        expect(leyenda).toEqual(['Presentes867 %', 'Retardos18 %', 'Ausencias18 %', 'Justificadas217 %', 'Pendientes00 %']);
    });

    it('sin registros muestra el aviso en lugar del anillo', () => {
        render(<ResumenGrupo reporte={reporte} filas={[]} />);
        expect(within(tarjeta('Estados de asistencia')).getByText('Aún no hay registros de asistencia')).toBeInTheDocument();
        // Solo el anillo: los iconos de las tarjetas de arriba también llevan círculos.
        expect(tarjeta('Estados de asistencia').querySelector('svg circle')).toBeNull();
    });
});

describe('ResumenGrupo: faltas por alumno', () => {
    it('ordena de mayor a menor, muestra la cifra de cada alumno y marca el límite', () => {
        const filas = [fila({ id_alumno: 1, nombres: 'Ana', apellido_paterno: 'Pérez', porcentaje_faltas: 2.2 }), fila()];
        const { container } = render(<ResumenGrupo reporte={reporte} filas={filas} />);
        const faltas = tarjeta('Faltas por alumno (%)');
        const lista = [...faltas.querySelectorAll('ul.sr-only > li')].map((li) => li.textContent);
        expect(lista).toEqual(['Luis Gómez: 24 %', 'Ana Pérez: 2.2 %', 'Límite 20 %']);
        expect(within(faltas).getByText('De mayor a menor · límite de 20 %')).toBeInTheDocument();
        // Una línea discontinua cruza las filas y su etiqueta va sobre ellas (una sola vez a la vista; la otra es solo para lectores).
        expect(faltas.querySelectorAll('[data-limite]')).toHaveLength(1);
        expect(within(faltas).getAllByText('Límite 20 %')).toHaveLength(2);
        expect(container.querySelectorAll('[data-fila]')).toHaveLength(2);
    });

    it('toma el límite de los datos del reporte', () => {
        render(<ResumenGrupo reporte={{ ...reporte, limite_pct: 30 }} filas={[fila()]} />);
        const faltas = tarjeta('Faltas por alumno (%)');
        expect(within(faltas).getAllByText('Límite 30 %').length).toBeGreaterThan(0);
        expect(within(faltas).queryByText('Límite 20 %')).toBeNull();
        expect(faltas).toHaveAccessibleDescription(/Luis Gómez: 24 %\. Límite: 30 %\./);
    });

    it('con más de 8 alumnos muestra solo los 8 con más faltas y avisa cuántos quedan fuera', () => {
        const filas = Array.from({ length: 10 }, (_, i) => fila({ id_alumno: i + 1, matricula: `E${i + 1}`, nombres: `Alumno${i + 1}`, porcentaje_faltas: 30 - i }));
        const { container } = render(<ResumenGrupo reporte={reporte} filas={filas} />);
        expect(container.querySelectorAll('[data-fila]')).toHaveLength(8);
        expect(screen.getByText('Se muestran los 8 con más faltas; 2 más en la pestaña Alumnos.')).toBeInTheDocument();
    });

    it('un alumno sin porcentaje (grupo sin sesiones) no entra: aparece el aviso de que aún no hay sesiones', () => {
        render(<ResumenGrupo reporte={{ ...reporte, kpis: { ...reporte.kpis, sesiones_programadas: 0, asistencia_promedio: null } }} filas={[fila({ porcentaje_faltas: null })]} />);
        const faltas = tarjeta('Faltas por alumno (%)');
        expect(within(faltas).getByText('Aún no hay sesiones para calcular faltas')).toBeInTheDocument();
        expect(faltas).toHaveAccessibleDescription('Sin datos de faltas.');
    });

    it('sin alumnos con porcentaje, con sesiones, avisa que no hay alumnos que graficar', () => {
        render(<ResumenGrupo reporte={reporte} filas={[]} />);
        expect(within(tarjeta('Faltas por alumno (%)')).getByText('Sin alumnos para graficar')).toBeInTheDocument();
    });

    it('"Ver todos" abre el detalle y con un alumno el botón se llama "Ver sesiones"', async () => {
        const onVerDetalle = vi.fn();
        const { rerender } = render(<ResumenGrupo reporte={reporte} filas={[fila()]} onVerDetalle={onVerDetalle} />);
        await userEvent.click(screen.getByRole('button', { name: /Ver todos/ }));
        expect(onVerDetalle).toHaveBeenCalledTimes(1);
        rerender(<ResumenGrupo reporte={reporte} filas={[fila()]} onVerDetalle={onVerDetalle} nombreAlumno="Luis Gómez" />);
        expect(screen.getByRole('button', { name: /Ver sesiones/ })).toBeInTheDocument();
    });
});

describe('ResumenGrupo: composición', () => {
    it('lleva los cuatro indicadores y las dos gráficas con texto alternativo', () => {
        render(<ResumenGrupo reporte={reporte} filas={[fila()]} />);
        const asistencia = within(screen.getByText('Asistencia promedio').closest('.rounded-xl'));
        expect(asistencia.getByText('82.35')).toBeInTheDocument();
        expect(asistencia.getByText('%')).toBeInTheDocument();
        expect(tarjeta('Estados de asistencia')).toHaveAccessibleDescription(/Presentes: 5 \(83 %\)/);
        expect(tarjeta('Faltas por alumno (%)')).toHaveAccessibleDescription(/Luis Gómez: 24 %/);
    });

    it('muestra el impacto en tiempo solo si llega', () => {
        const { rerender } = render(<ResumenGrupo reporte={reporte} filas={[fila()]} />);
        expect(screen.queryByText(/Estimación, no una medición/)).toBeNull();
        rerender(<ResumenGrupo reporte={reporte} filas={[fila()]} impacto={impacto} />);
        expect(screen.getByText(/Estimación, no una medición/)).toBeInTheDocument();
    });
});
