// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VentanaTolerancia from './VentanaTolerancia.jsx';

const sesion = { estatus: 'abierta', fase: 'retardo', minuto_actual: 12.34, tolerancia_min: 20, limite_presente_min: 10 };

describe('VentanaTolerancia', () => {
    it('abierta: minuto actual, fase, tramos y barra accesible', () => {
        render(<VentanaTolerancia sesion={sesion} />);
        expect(screen.getByText('Retardo', { selector: 'span.font-medium' })).toBeInTheDocument();
        expect(screen.getByText('12.3')).toBeInTheDocument();
        expect(screen.getByText('Presente hasta min 10')).toBeInTheDocument();
        expect(screen.getByText('Retardo hasta min 20')).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Minuto 12.3 de 20');
    });

    it('no abierta: sin fase ni barra de avance, solo la tolerancia', () => {
        render(<VentanaTolerancia sesion={{ ...sesion, estatus: 'cerrada' }} />);
        expect(screen.queryByRole('progressbar')).toBeNull();
        expect(screen.getByText('Tolerancia de 20 min')).toBeInTheDocument();
    });

    it('sin tolerancia válida no dibuja la barra', () => {
        render(<VentanaTolerancia sesion={{ estatus: 'abierta', minuto_actual: 3 }} />);
        expect(screen.queryByRole('progressbar')).toBeNull();
    });
});
