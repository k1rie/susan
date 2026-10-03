// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AlertasAsistencia from './AlertasAsistencia.jsx';

const alerta = (i, extra = {}) => ({
    tipo: 'en_limite',
    id_grupo: 1,
    id_alumno: i,
    matricula: `E${i}`,
    nombre: `Alumno ${i}`,
    materia: 'Finanzas',
    clave_grupo: '3A',
    porcentaje_faltas: 15,
    limite_pct: 20,
    mensaje: 'Superó el límite de faltas equivalentes y perdió el derecho a examen',
    ...extra,
});

describe('AlertasAsistencia', () => {
    it('sin alertas muestra el estado vacío', () => {
        render(<AlertasAsistencia alertas={[]} />);
        expect(screen.getByText('Sin alertas')).toBeInTheDocument();
    });

    it('una fila compacta por alumno: insignia, % contra el límite y sin el mensaje largo repetido', () => {
        render(<AlertasAsistencia alertas={[alerta(1, { tipo: 'sin_derecho', porcentaje_faltas: 25 }), alerta(2)]} />);
        expect(screen.queryByText(/Superó el límite/)).toBeNull();
        expect(screen.getByText('Sin derecho a examen')).toBeInTheDocument();
        expect(screen.getByText('A una falta del límite')).toBeInTheDocument();
        expect(screen.getByText('1 sin derecho · 1 al límite')).toBeInTheDocument();
        const barra = screen.getByRole('progressbar', { name: 'Faltas de Alumno 1' });
        expect(barra).toHaveAttribute('aria-valuenow', '100');
        expect(barra).toHaveAttribute('aria-valuetext', '25 % de 20 %');
        expect(screen.getByRole('progressbar', { name: 'Faltas de Alumno 2' })).toHaveAttribute('aria-valuenow', '75');
    });

    it('la matrícula distingue a dos alumnos homónimos del mismo grupo', () => {
        render(<AlertasAsistencia alertas={[alerta(1, { nombre: 'Ana Pérez', matricula: 'E101' }), alerta(2, { nombre: 'Ana Pérez', matricula: 'E202' })]} />);
        expect(screen.getByText('Finanzas (3A) · E101')).toBeInTheDocument();
        expect(screen.getByText('Finanzas (3A) · E202')).toBeInTheDocument();
    });

    it('sin porcentaje no dibuja una barra en cero', () => {
        render(<AlertasAsistencia alertas={[alerta(1, { porcentaje_faltas: null })]} />);
        expect(screen.getByText('Alumno 1')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('muestra 5 y pliega el resto en Detalles (siguen en el DOM)', async () => {
        const muchas = Array.from({ length: 8 }, (_, i) => alerta(i + 1));
        render(<AlertasAsistencia alertas={muchas} />);
        const boton = screen.getByRole('button', { name: /Ver las 3 restantes/ });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getAllByRole('progressbar', { hidden: true })).toHaveLength(8);
        const lista = screen.getAllByRole('list')[0];
        expect(within(lista).getAllByRole('listitem')).toHaveLength(5);
        await userEvent.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getAllByRole('progressbar')).toHaveLength(8);
    });
});
