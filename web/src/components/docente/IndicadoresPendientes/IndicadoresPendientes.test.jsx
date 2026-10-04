// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import IndicadoresPendientes from './IndicadoresPendientes.jsx';

// Cada tarjeta es el enlace que contiene su etiqueta; la cifra final la leen los lectores de pantalla en el texto sr-only de CountUp.
const tarjeta = (nombre) => screen.getByRole('link', { name: new RegExp(nombre) });
const cifra = (el) => el.querySelector('p.tabular-nums .sr-only').textContent;
const pastilla = (el) => el.querySelector('svg').parentElement;

describe('IndicadoresPendientes', () => {
    it('muestra las dos cifras como enlaces a su pestaña de revisión', () => {
        render(<IndicadoresPendientes pendientes={4} justificantes={2} />);
        expect(tarjeta('Registros pendientes de revisión')).toHaveAttribute('href', '/docente/revision?pestana=pendientes');
        expect(tarjeta('Justificantes por resolver')).toHaveAttribute('href', '/docente/revision?pestana=justificantes');
        expect(cifra(tarjeta('Registros pendientes de revisión'))).toBe('4');
        expect(cifra(tarjeta('Justificantes por resolver'))).toBe('2');
    });

    it('con pendientes la pastilla y el apoyo van en ámbar y dicen qué se espera del docente', () => {
        render(<IndicadoresPendientes pendientes={4} justificantes={1} />);
        const registros = tarjeta('Registros pendientes de revisión');
        expect(pastilla(registros)).toHaveClass('bg-retardo-bg', 'text-retardo');
        expect(screen.getByText('Esperan tu revisión')).toHaveClass('text-retardo');
        // En singular el verbo concuerda con la cifra.
        expect(pastilla(tarjeta('Justificantes por resolver'))).toHaveClass('bg-retardo-bg');
        expect(screen.getByText('Espera tu resolución')).toBeInTheDocument();
    });

    it('sin pendientes queda en neutro y dice que no hay nada por hacer (sin depender del color)', () => {
        render(<IndicadoresPendientes pendientes={0} justificantes={0} />);
        expect(pastilla(tarjeta('Registros pendientes de revisión'))).toHaveClass('bg-muted');
        expect(screen.getAllByText('Nada pendiente')).toHaveLength(2);
        expect(cifra(tarjeta('Justificantes por resolver'))).toBe('0');
    });

    it('un valor ausente o inválido cuenta como 0 en lugar de dejar la tarjeta vacía', () => {
        render(<IndicadoresPendientes pendientes={null} justificantes={undefined} />);
        expect(cifra(tarjeta('Registros pendientes de revisión'))).toBe('0');
        expect(cifra(tarjeta('Justificantes por resolver'))).toBe('0');
    });

    it('cada tarjeta lleva su icono decorativo y una flecha de enlace', () => {
        render(<IndicadoresPendientes pendientes={1} justificantes={1} />);
        for (const nombre of ['Registros pendientes de revisión', 'Justificantes por resolver']) {
            const svgs = tarjeta(nombre).querySelectorAll('svg');
            expect(svgs).toHaveLength(2);
            svgs.forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'));
        }
    });
});
