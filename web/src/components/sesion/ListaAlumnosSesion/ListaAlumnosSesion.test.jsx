// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ListaAlumnosSesion from './ListaAlumnosSesion.jsx';
import { esActivo, metaAlumno, sinRegistro } from './listaAlumnosSesion.utils.js';

const ana = { id_alumno: 1, matricula: 'E1', nombre: 'Ana', inscripcion: 'activa', estado: null, origen: null, lecturas_validas: 0, consentimiento_vigente: true };
// Con una lectura válida ya está en camino: no se le ofrece el registro manual (aún puede confirmarse sola).
const eva = { id_alumno: 5, matricula: 'E5', nombre: 'Eva', inscripcion: 'activa', estado: null, origen: null, lecturas_validas: 1, consentimiento_vigente: true };
const beto = { id_alumno: 2, matricula: 'E2', nombre: 'Beto', inscripcion: 'activa', estado: 'presente', origen: 'automatico', lecturas_validas: 3, hora_registro: '2026-09-14T13:03:00+00:00', consentimiento_vigente: true };
const carla = { id_alumno: 3, matricula: 'E3', nombre: 'Carla', inscripcion: 'activa', estado: null, origen: null, lecturas_validas: 0, consentimiento_vigente: false };
const dani = { id_alumno: 4, matricula: 'E4', nombre: 'Dani', inscripcion: 'baja', estado: null, origen: null, lecturas_validas: 0, consentimiento_vigente: true };

const filas = () => screen.getAllByRole('listitem');

describe('ListaAlumnosSesion', () => {
    it('abre en «Sin registro» con su conteo y deja ver a todos con un toque', () => {
        render(<ListaAlumnosSesion alumnos={[ana, beto, carla]} />);
        expect(screen.getByRole('button', { name: /Sin registro/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /Sin registro/ })).toHaveTextContent('2');
        expect(filas().map((f) => f.textContent)).toEqual([expect.stringContaining('Ana'), expect.stringContaining('Carla')]);
        fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
        expect(filas()).toHaveLength(3);
        expect(screen.getByText('Beto')).toBeInTheDocument();
    });

    it('si ya no falta nadie abre en «Todos»; elegir «Sin registro» avisa que todos tienen registro', () => {
        render(<ListaAlumnosSesion alumnos={[beto]} />);
        expect(screen.getByRole('button', { name: /Todos/ })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: /Sin registro/ }));
        expect(screen.getByText('Todos los alumnos tienen registro.')).toBeInTheDocument();
        expect(screen.queryByRole('list')).toBeNull();
    });

    it('cada fila trae nombre, matrícula con lecturas u hora, y el estado con texto', () => {
        render(<ListaAlumnosSesion alumnos={[ana, beto]} />);
        fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
        const [filaAna, filaBeto] = filas();
        expect(filaAna).toHaveTextContent('Ana');
        expect(filaAna).toHaveTextContent('E1 · 0/3 lecturas');
        expect(filaAna).toHaveTextContent('Sin lecturas');
        expect(filaBeto).toHaveTextContent('E2 · 07:03');
        expect(filaBeto).toHaveTextContent('Presente');
    });

    it('«Registrar» solo a quien lo necesita, y el motivo a la vista solo cuando aporta algo (consentimiento), con nombre accesible', () => {
        const onRegistrar = vi.fn();
        render(<ListaAlumnosSesion alumnos={[ana, beto, carla]} puedeRegistrar onRegistrar={onRegistrar} />);
        fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
        const [filaAna, filaBeto, filaCarla] = filas();
        // Sin lecturas ya lo dicen la etiqueta y «0/3 lecturas»: no se repite una tercera vez en la fila.
        expect(within(filaAna).queryByText('Sin lecturas válidas')).toBeNull();
        expect(within(filaAna).getByRole('button', { name: 'Registrar manualmente a Ana' })).toBeInTheDocument();
        expect(within(filaCarla).getByText('Sin consentimiento vigente')).toBeInTheDocument();
        expect(within(filaBeto).queryByRole('button')).toBeNull();
        fireEvent.click(within(filaCarla).getByRole('button', { name: 'Registrar manualmente a Carla' }));
        expect(onRegistrar).toHaveBeenCalledWith(carla);
    });

    it('con una lectura válida en camino no se ofrece el registro manual, pero se ve cuántas lleva', () => {
        render(<ListaAlumnosSesion alumnos={[eva]} puedeRegistrar onRegistrar={vi.fn()} />);
        expect(screen.getByRole('listitem')).toHaveTextContent('E5 · 1/3 lecturas');
        expect(screen.queryByRole('button', { name: /Registrar/ })).toBeNull();
    });

    it('sin puedeRegistrar no hay botones ni motivos', () => {
        render(<ListaAlumnosSesion alumnos={[ana, carla]} onRegistrar={vi.fn()} />);
        expect(screen.queryByRole('button', { name: /Registrar/ })).toBeNull();
        expect(screen.queryByText('Sin lecturas válidas')).toBeNull();
    });

    it('una baja no aparece en ninguna vista', () => {
        render(<ListaAlumnosSesion alumnos={[ana, dani]} />);
        expect(screen.queryByText('Dani')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
        expect(screen.queryByText('Dani')).toBeNull();
        expect(screen.getByRole('button', { name: /Todos/ })).toHaveTextContent('1');
    });

    it('sin alumnos lo dice', () => {
        render(<ListaAlumnosSesion alumnos={[]} />);
        expect(screen.getByText('El grupo no tiene alumnos inscritos.')).toBeInTheDocument();
    });
});

describe('listaAlumnosSesion.utils', () => {
    it('esActivo: sin dato de inscripción cuenta como activo; una baja no', () => {
        expect(esActivo({})).toBe(true);
        expect(esActivo(ana)).toBe(true);
        expect(esActivo(dani)).toBe(false);
    });

    it('sinRegistro: sin estado y activo; «pendiente» ya tiene registro', () => {
        expect(sinRegistro(ana)).toBe(true);
        expect(sinRegistro(beto)).toBe(false);
        expect(sinRegistro({ ...ana, estado: 'pendiente' })).toBe(false);
        expect(sinRegistro(dani)).toBe(false);
    });

    it('metaAlumno: hora del registro o lecturas válidas', () => {
        expect(metaAlumno(ana)).toBe('E1 · 0/3 lecturas');
        expect(metaAlumno(eva)).toBe('E5 · 1/3 lecturas');
        expect(metaAlumno(beto)).toBe('E2 · 07:03');
        expect(metaAlumno({ matricula: 'E9' })).toBe('E9 · 0/3 lecturas');
    });
});
