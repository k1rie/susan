// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CalendarioAsistencia from './CalendarioAsistencia.jsx';

afterEach(() => vi.unstubAllGlobals());
const sinMovimiento = () => vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));

const SESIONES = [
    { fecha: '2026-09-14', estado: 'presente' },
    { fecha: '2026-09-16', estado: 'retardo' },
    { fecha: '2026-09-18', estado: 'ausente' },
    { fecha: '2026-09-21', estado: 'justificado' },
    { fecha: '2026-09-23', estado: 'pendiente' },
    { fecha: '2026-09-25', estado: null },
];

describe('CalendarioAsistencia', () => {
    it('dibuja una casilla por sesión con su fecha y estado, y las demás casillas sin estado', () => {
        sinMovimiento();
        const { container } = render(<CalendarioAsistencia sesiones={SESIONES} />);
        const con = container.querySelectorAll('[data-fecha]');
        expect(con).toHaveLength(6);
        expect(container.querySelector('[data-fecha="2026-09-14"]')).toHaveAttribute('data-estado', 'presente');
        expect(container.querySelector('[data-fecha="2026-09-25"]')).toHaveAttribute('data-estado', 'sin_registro');
        // 2 semanas x 5 días = 10 casillas; 6 con sesión
        expect(container.querySelectorAll('[class*="aspect-square"]')).toHaveLength(10);
    });

    it('cada casilla lleva title con el día y el estado en texto', () => {
        sinMovimiento();
        const { container } = render(<CalendarioAsistencia sesiones={SESIONES} />);
        expect(container.querySelector('[data-fecha="2026-09-18"]').getAttribute('title')).toMatch(/18/);
        expect(container.querySelector('[data-fecha="2026-09-18"]').getAttribute('title')).toContain('Ausencias');
    });

    it('los colores salen de tokens de gráfica (nunca hex)', () => {
        sinMovimiento();
        const { container } = render(<CalendarioAsistencia sesiones={SESIONES} />);
        expect(container.querySelector('[data-fecha="2026-09-14"]').style.backgroundColor).toBe('var(--g-presente)');
        expect(container.querySelector('[data-fecha="2026-09-18"]').style.backgroundColor).toBe('var(--g-ausente)');
        expect(container.querySelector('[data-fecha="2026-09-16"]').style.backgroundColor).toBe('var(--g-retardo)');
    });

    it('la cuadrícula es decorativa y el resumen llega como texto para lectores de pantalla', () => {
        sinMovimiento();
        const { container } = render(<CalendarioAsistencia sesiones={SESIONES} />);
        expect(container.querySelector('[aria-hidden="true"]')).toContainElement(container.querySelector('[data-fecha]'));
        const resumen = container.querySelector('.sr-only');
        expect(resumen).toHaveTextContent('Calendario de asistencia: 6 sesiones');
        expect(resumen).toHaveTextContent('Presentes 1');
        expect(resumen).toHaveTextContent('Sin registro 1');
    });

    it('etiqueta reemplaza el texto alternativo', () => {
        sinMovimiento();
        const { container } = render(<CalendarioAsistencia sesiones={SESIONES} etiqueta="Tu calendario" />);
        expect(container.querySelector('.sr-only')).toHaveTextContent('Tu calendario');
    });

    it('la leyenda cuenta solo los estados que aparecen', () => {
        sinMovimiento();
        render(<CalendarioAsistencia sesiones={[{ fecha: '2026-09-14', estado: 'presente' }, { fecha: '2026-09-15', estado: 'presente' }, { fecha: '2026-09-16', estado: 'ausente' }]} />);
        const items = screen.getAllByRole('listitem').map((li) => li.textContent);
        expect(items).toEqual(['Presentes2', 'Ausencias1']);
    });

    it('leyenda={false} la oculta', () => {
        sinMovimiento();
        render(<CalendarioAsistencia sesiones={SESIONES} leyenda={false} />);
        expect(screen.queryByRole('list')).toBeNull();
    });

    it('rotula los meses y los días alternos', () => {
        sinMovimiento();
        render(<CalendarioAsistencia sesiones={[{ fecha: '2026-09-14', estado: 'presente' }, { fecha: '2026-11-20', estado: 'presente' }]} />);
        expect(screen.getByText('sep')).toBeInTheDocument();
        expect(screen.getByText('nov')).toBeInTheDocument();
        expect(screen.getByText('Lun')).toBeInTheDocument();
        expect(screen.getByText('Mié')).toBeInTheDocument();
        expect(screen.queryByText('Mar')).toBeNull();
    });

    it('sin sesiones muestra el aviso (o el texto recibido), no un hueco', () => {
        sinMovimiento();
        const { rerender } = render(<CalendarioAsistencia sesiones={[]} />);
        expect(screen.getByText('Aún no hay sesiones registradas')).toBeInTheDocument();
        rerender(<CalendarioAsistencia sesiones={undefined} vacio="Nada por ahora" />);
        expect(screen.getByText('Nada por ahora')).toBeInTheDocument();
    });

    it('con reducir movimiento las casillas son visibles de inmediato y sin transición', () => {
        sinMovimiento();
        const { container } = render(<CalendarioAsistencia sesiones={SESIONES} />);
        const casilla = container.querySelector('[data-fecha="2026-09-14"]');
        expect(casilla.style.opacity).toBe('1');
        expect(casilla.style.transition).toBe('');
    });

    it('una sesión suspendida se dibuja gris y se cuenta aparte', () => {
        sinMovimiento();
        const { container } = render(<CalendarioAsistencia sesiones={[{ fecha: '2026-09-14', estado: null, estatus_sesion: 'suspendida' }, { fecha: '2026-09-15', estado: 'presente' }]} />);
        expect(container.querySelector('[data-fecha="2026-09-14"]')).toHaveAttribute('data-estado', 'suspendida');
        expect(screen.getByText('Suspendida')).toBeInTheDocument();
    });
});
