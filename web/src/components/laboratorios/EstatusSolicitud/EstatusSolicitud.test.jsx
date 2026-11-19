// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EstatusSolicitud from './EstatusSolicitud.jsx';

describe('EstatusSolicitud', () => {
    it.each([
        ['pendiente', 'Pendiente'],
        ['aprobada', 'Aprobada'],
        ['rechazada', 'Rechazada'],
        ['cancelada', 'Cancelada'],
    ])('%s se escribe con texto', (estatus, texto) => {
        render(<EstatusSolicitud solicitud={{ estatus, vencida: false }} />);
        expect(screen.getByText(texto)).toBeInTheDocument();
    });

    it('una pendiente vencida se ve «Vencida»; una aprobada nunca', () => {
        const { rerender } = render(<EstatusSolicitud solicitud={{ estatus: 'pendiente', vencida: true }} />);
        expect(screen.getByText('Vencida')).toBeInTheDocument();
        rerender(<EstatusSolicitud solicitud={{ estatus: 'aprobada', vencida: true }} />);
        expect(screen.getByText('Aprobada')).toBeInTheDocument();
    });

    it('acepta el estatus suelto', () => {
        render(<EstatusSolicitud estatus="rechazada" />);
        expect(screen.getByText('Rechazada')).toBeInTheDocument();
    });
});
