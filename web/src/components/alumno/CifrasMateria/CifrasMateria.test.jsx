// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CifrasMateria from './CifrasMateria.jsx';

const item = {
    id_grupo: 1, clave_grupo: '3A', materia: { nombre: 'Álgebra' }, sesiones_programadas: 40,
    presentes: 30, retardos: 1, ausencias: 2, justificadas: 1, pendientes: 0,
    faltas_equivalentes: 2, faltas_maximas_permitidas: 8, faltas_restantes_antes_limite: 6, limite_pct: 20,
    supera_limite: false, en_limite: false, derecho_examen: true,
};

// La casilla es la tarjeta (borde redondeado) que contiene la etiqueta.
const casilla = (etiqueta) => screen.getByText(etiqueta).closest('[class*="rounded-xl"]');

beforeEach(() => {
    // «Reducir movimiento»: las cifras muestran su valor final sin contar desde 0.
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => vi.unstubAllGlobals());

describe('CifrasMateria', () => {
    it('es un grupo con el nombre de la materia y seis casillas con su cifra', () => {
        render(<CifrasMateria item={item} />);
        const grupo = screen.getByRole('group', { name: 'Cifras de Álgebra' });
        for (const [etiqueta, cifra] of [['Presentes', '30'], ['Retardos', '1'], ['Ausencias', '2'], ['Justificadas', '1'], ['Pendientes', '0'], ['Faltas restantes', '6']]) {
            expect(within(grupo).getByText(etiqueta)).toBeInTheDocument();
            // CountUp deja la cifra final en un texto oculto para lectores de pantalla.
            expect(within(casilla(etiqueta)).getAllByText(cifra, { exact: true }).length).toBeGreaterThan(0);
        }
        expect(grupo.children).toHaveLength(6);
    });

    it('cada casilla lleva su icono de Lucide, decorativo', () => {
        render(<CifrasMateria item={item} />);
        for (const etiqueta of ['Presentes', 'Retardos', 'Ausencias', 'Justificadas', 'Pendientes', 'Faltas restantes']) {
            const icono = casilla(etiqueta).querySelector('svg');
            expect(icono).not.toBeNull();
            expect(icono).toHaveAttribute('aria-hidden', 'true');
            expect(icono.getAttribute('class')).toContain('lucide');
        }
    });

    it('la pastilla del icono toma el color del estado de la cifra', () => {
        render(<CifrasMateria item={item} />);
        expect(casilla('Presentes').querySelector('.bg-presente-bg')).not.toBeNull();
        expect(casilla('Retardos').querySelector('.bg-retardo-bg')).not.toBeNull();
        expect(casilla('Ausencias').querySelector('.bg-ausente-bg')).not.toBeNull();
        // Justificadas y pendientes son neutras: pastilla gris.
        expect(casilla('Justificadas').querySelector('.bg-muted')).not.toBeNull();
        expect(casilla('Pendientes').querySelector('.bg-muted')).not.toBeNull();
    });

    describe('«Faltas restantes» sigue los avisos de la materia', () => {
        it('dentro del límite: verde y «Dentro del límite»', () => {
            render(<CifrasMateria item={item} />);
            expect(within(casilla('Faltas restantes')).getByText('Dentro del límite')).toHaveClass('text-presente');
        });

        it('con pocas faltas restantes: apoyo neutro, sin alarma', () => {
            render(<CifrasMateria item={{ ...item, faltas_restantes_antes_limite: 2 }} />);
            expect(within(casilla('Faltas restantes')).getByText('Cerca del límite')).toHaveClass('text-muted-foreground');
        });

        it('en el límite: ámbar y el aviso de una falta más', () => {
            render(<CifrasMateria item={{ ...item, en_limite: true, faltas_restantes_antes_limite: 0 }} />);
            const c = casilla('Faltas restantes');
            expect(within(c).getByText('Una falta más y pierdes el derecho')).toHaveClass('text-retardo');
            expect(c.querySelector('.bg-retardo-bg')).not.toBeNull();
        });

        it('límite superado: rojo, cero faltas y sin derecho a examen', () => {
            render(<CifrasMateria item={{ ...item, supera_limite: true, derecho_examen: false, faltas_restantes_antes_limite: 0 }} />);
            const c = casilla('Faltas restantes');
            expect(within(c).getByText('Sin derecho a examen')).toHaveClass('text-ausente');
            expect(c.querySelector('.bg-ausente-bg')).not.toBeNull();
            expect(within(c).getAllByText('0').length).toBeGreaterThan(0);
        });

        it('el estado se dice con forma (escudo distinto) y texto, no solo con color', () => {
            const forma = (extra) => {
                const { unmount } = render(<CifrasMateria item={{ ...item, ...extra }} />);
                const clases = casilla('Faltas restantes').querySelector('svg').getAttribute('class');
                unmount();
                return clases;
            };
            const sano = forma({});
            const limite = forma({ en_limite: true, faltas_restantes_antes_limite: 0 });
            const perdido = forma({ supera_limite: true, faltas_restantes_antes_limite: 0 });
            expect(sano).toContain('lucide-shield-check');
            expect(limite).toContain('lucide-shield-alert');
            expect(perdido).toContain('lucide-shield-x');
        });

        it('sin sesiones programadas escribe «-» y lo explica', () => {
            render(<CifrasMateria item={{ ...item, sesiones_programadas: 0 }} />);
            const c = casilla('Faltas restantes');
            expect(within(c).getByText('-')).toBeInTheDocument();
            expect(within(c).getByText('Aún no hay sesiones programadas')).toBeInTheDocument();
        });
    });

    it('los pendientes de revisión avisan que aún no cuentan', () => {
        render(<CifrasMateria item={{ ...item, pendientes: 3 }} />);
        expect(within(casilla('Pendientes')).getByText('Aún no cuentan')).toBeInTheDocument();
    });

    it('360 px: dos columnas; tres y seis solo cuando la SECCIÓN es ancha (container query), sin cajas con ancho fijo', () => {
        const { container } = render(<CifrasMateria item={item} />);
        expect(container.firstChild).toHaveClass('@container');
        const rejilla = screen.getByRole('group', { name: 'Cifras de Álgebra' });
        expect(rejilla).toHaveClass('grid-cols-2');
        expect(rejilla.className).toContain('@min-[32rem]:grid-cols-3');
        expect(rejilla.className).toContain('@min-[60rem]:grid-cols-6');
        expect(container.innerHTML).not.toMatch(/\bw-\[\d+px\]|min-w-\[/);
    });

    it('sin materia no pinta nada', () => {
        const { container } = render(<CifrasMateria item={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('sin el nombre de la materia el grupo tiene un nombre genérico', () => {
        render(<CifrasMateria item={{ ...item, materia: undefined }} />);
        expect(screen.getByRole('group', { name: 'Cifras de la materia' })).toBeInTheDocument();
    });
});
