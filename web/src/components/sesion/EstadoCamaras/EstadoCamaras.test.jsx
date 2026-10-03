// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EstadoCamaras from './EstadoCamaras.jsx';

describe('EstadoCamaras', () => {
    it('sin cámaras lo dice en una línea', () => {
        render(<EstadoCamaras camaras={[]} />);
        expect(screen.getByText('Sin cámaras registradas en el aula.')).toBeInTheDocument();
    });

    it('una tarjeta por cámara con estatus en texto y última captura', () => {
        render(
            <EstadoCamaras
                camaras={[
                    { id_camara: 1, tipo: 'ip', posicion: 'frente', estatus: 'activa', capturas: 12, ultima_captura: '2026-09-14T13:03:21Z' },
                    { id_camara: 2, tipo: 'navegador', posicion: 'fondo', estatus: 'inactiva', capturas: 0, ultima_captura: null },
                ]}
            />,
        );
        expect(screen.getByText('Cámara frente (IP)')).toBeInTheDocument();
        expect(screen.getByText('Activa')).toBeInTheDocument();
        expect(screen.getByText('Inactiva')).toBeInTheDocument();
        expect(screen.getByText('Sin capturas · 0 en total')).toBeInTheDocument();
        expect(screen.getByText(/· 12 en total/)).toBeInTheDocument();
    });
});
