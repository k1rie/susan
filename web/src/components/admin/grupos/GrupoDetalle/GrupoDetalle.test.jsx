// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const obtener = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => ({ grupoObtener: (...a) => obtener(...a) }));
// Las pestañas pesadas no son lo que se prueba aquí: solo las cifras de la cabecera.
vi.mock('../AulaCamaras', () => ({ default: () => null }));
vi.mock('../GenerarSesiones', () => ({ default: () => null }));
vi.mock('../GrupoForm', () => ({ default: () => null }));
vi.mock('../HorarioEditor', () => ({ default: () => null }));
vi.mock('../InscripcionesTabla', () => ({ default: () => null }));

import GrupoDetalle from './GrupoDetalle.jsx';

const grupo = {
    id_grupo: 7, clave_grupo: '3A', materia_clave: 'ADM101', materia_nombre: 'Administración', periodo: '2026-2', docente_nombre: 'Ana López', aula_clave: 'A-12',
    horario: [], aula: { id_aula: 1 }, inscritos: { activos: 24, baja: 2, capacidad_aula: 45 },
    sesiones: { total: 40, programadas: 28, abiertas: 0, cerradas: 12, suspendidas: 0 },
};

// Tarjeta (StatCard) que lleva esa etiqueta: el borde redondeado es su raíz.
const tarjetaDe = (nombre) => screen.getByText(nombre).closest('.rounded-xl');
const cifra = (nombre) => tarjetaDe(nombre).querySelector('p.tabular-nums');
const pastilla = (nombre) => tarjetaDe(nombre).querySelector('svg').parentElement;

beforeEach(() => obtener.mockReset());

describe('GrupoDetalle: cifras de la cabecera', () => {
    it('lee los inscritos frente a la capacidad del aula y las cerradas frente al total', async () => {
        obtener.mockResolvedValue(grupo);
        render(<GrupoDetalle idGrupo={7} />);
        await screen.findByText('Inscritos activos');
        expect(cifra('Inscritos activos')).toHaveTextContent(/^24\s*\/ 45$/);
        expect(within(tarjetaDe('Inscritos activos')).getByText('Capacidad del aula')).toBeInTheDocument();
        expect(cifra('Bajas')).toHaveTextContent(/^2$/);
        expect(within(tarjetaDe('Bajas')).getByText('Fuera del cupo')).toBeInTheDocument();
        expect(cifra('Sesiones')).toHaveTextContent(/^40$/);
        expect(within(tarjetaDe('Sesiones')).getByText('28 programadas')).toBeInTheDocument();
        expect(cifra('Cerradas')).toHaveTextContent(/^12\s*\/ 40$/);
        expect(within(tarjetaDe('Cerradas')).getByText('30 % del total')).toBeInTheDocument();
    });

    it('cada tarjeta lleva su icono decorativo; en neutro la pastilla es gris', async () => {
        obtener.mockResolvedValue(grupo);
        render(<GrupoDetalle idGrupo={7} />);
        await screen.findByText('Inscritos activos');
        for (const nombre of ['Inscritos activos', 'Bajas', 'Sesiones', 'Cerradas']) {
            const svg = tarjetaDe(nombre).querySelector('svg');
            expect(svg).toHaveAttribute('aria-hidden', 'true');
            expect(svg.parentElement).toHaveClass('bg-muted', 'text-muted-foreground');
        }
    });

    it('con el aula llena la tarjeta de inscritos pasa a ámbar y lo dice con texto', async () => {
        obtener.mockResolvedValue({ ...grupo, inscritos: { activos: 45, baja: 0, capacidad_aula: 45 } });
        render(<GrupoDetalle idGrupo={7} />);
        await screen.findByText('Inscritos activos');
        expect(pastilla('Inscritos activos')).toHaveClass('bg-retardo-bg', 'text-retardo');
        expect(screen.getByText('Aula llena')).toHaveClass('text-retardo');
    });

    it('sin sesiones ni datos de inscritos muestra ceros sin unidades inventadas', async () => {
        obtener.mockResolvedValue({ ...grupo, inscritos: undefined, sesiones: undefined });
        render(<GrupoDetalle idGrupo={7} />);
        await screen.findByText('Inscritos activos');
        expect(cifra('Inscritos activos')).toHaveTextContent(/^0$/);
        expect(cifra('Cerradas')).toHaveTextContent(/^0$/);
        expect(cifra('Sesiones')).toHaveTextContent(/^0$/);
        expect(screen.getByText('0 programadas')).toBeInTheDocument();
        expect(screen.getByText('Sin capacidad registrada')).toBeInTheDocument();
        expect(screen.getByText('Sin sesiones aún')).toBeInTheDocument();
    });
    it('las cuatro tarjetas llevan apoyo para que sus cifras queden a la misma altura', async () => {
        obtener.mockResolvedValue(grupo);
        render(<GrupoDetalle idGrupo={7} />);
        await screen.findByText('Inscritos activos');
        for (const nombre of ['Inscritos activos', 'Bajas', 'Sesiones', 'Cerradas']) {
            expect(tarjetaDe(nombre).querySelector('p.tabular-nums').nextElementSibling).not.toBeNull();
        }
    });

    it('en teléfono son dos columnas (2 x 2) y desde sm cuatro', async () => {
        obtener.mockResolvedValue(grupo);
        render(<GrupoDetalle idGrupo={7} />);
        await screen.findByText('Inscritos activos');
        expect(tarjetaDe('Inscritos activos').parentElement).toHaveClass('grid-cols-2', 'sm:grid-cols-4');
    });
});
