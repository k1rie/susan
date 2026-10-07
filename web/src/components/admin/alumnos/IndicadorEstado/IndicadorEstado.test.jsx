// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EstatusAlumno from './EstatusAlumno.jsx';
import IndicadorEstado from './IndicadorEstado.jsx';

describe('IndicadorEstado', () => {
    it('dice el estado con texto (nunca solo color) y con icono distinto', () => {
        const { container, rerender } = render(<IndicadorEstado ok textoOk="Vigente" textoNo="Sin consentimiento" />);
        expect(screen.getByText('Vigente')).toBeInTheDocument();
        expect(container.querySelector('svg.lucide-circle-check')).toBeInTheDocument();
        rerender(<IndicadorEstado ok={false} textoOk="Vigente" textoNo="Sin consentimiento" toneNo="warning" />);
        expect(screen.getByText('Sin consentimiento')).toHaveClass('bg-retardo-bg');
        expect(container.querySelector('svg.lucide-circle-dashed')).toBeInTheDocument();
        expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    });
});

describe('EstatusAlumno', () => {
    it('escribe el estatus y lo refuerza con un tono', () => {
        const { rerender } = render(<EstatusAlumno estatus="activo" />);
        expect(screen.getByText('Activo')).toHaveClass('bg-presente-bg');
        rerender(<EstatusAlumno estatus="baja_definitiva" />);
        expect(screen.getByText('Baja definitiva')).toHaveClass('bg-ausente-bg');
        rerender(<EstatusAlumno estatus="egresado" />);
        expect(screen.getByText('Egresado')).toBeInTheDocument();
    });
});
