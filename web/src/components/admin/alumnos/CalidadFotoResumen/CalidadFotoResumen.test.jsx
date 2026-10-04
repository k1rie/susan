// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CalidadFotoResumen from './CalidadFotoResumen.jsx';

const BUENA = { rostros: 1, un_solo_rostro: true, calidad: { brillo: 120.4, nitidez: 80.2, tamano_rostro_px: 200, frontal: true }, motivo_rechazo: null, motivo_codigo: null };
const fila = (texto) => screen.getByText((_, el) => el.tagName === 'LI' && el.textContent.startsWith(texto));

describe('CalidadFotoResumen', () => {
    it('sin resultado no pinta nada', () => {
        const { container } = render(<CalidadFotoResumen resultado={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('foto correcta: todos los renglones Correcto y el coseno con las demás', () => {
        render(<CalidadFotoResumen resultado={{ ...BUENA, coseno_resto: 0.812 }} titulo="Toma 1" />);
        expect(screen.getByText('Toma 1')).toBeInTheDocument();
        expect(screen.getAllByText('Correcto')).toHaveLength(6);
        expect(screen.queryByText('Revisar')).not.toBeInTheDocument();
        expect(fila('Parecido con las demás fotos')).toHaveTextContent('0.81');
    });

    it('decide cada renglón por motivo_codigo, aunque el motivo_rechazo sea una frase', () => {
        render(<CalidadFotoResumen resultado={{ ...BUENA, motivo_codigo: 'BORROSA', motivo_rechazo: 'La foto esta desenfocada.' }} />);
        expect(within(fila('Nitidez')).getByText('Revisar')).toBeInTheDocument();
        expect(within(fila('Brillo')).getByText('Correcto')).toBeInTheDocument();
        expect(screen.getByText(/La imagen está borrosa; mantenga quieta la cámara\./)).toBeInTheDocument();
    });

    it('resultado heredado con el código en motivo_rechazo sigue funcionando', () => {
        render(<CalidadFotoResumen resultado={{ ...BUENA, calidad: { ...BUENA.calidad, brillo: 20 }, motivo_rechazo: 'POCA_LUZ' }} />);
        expect(within(fila('Brillo')).getByText('Revisar')).toBeInTheDocument();
        expect(screen.getByText(/Falta iluminación\./)).toBeInTheDocument();
    });

    it('mapa de códigos a renglones: tamaño, rostros, de frente y parecido', () => {
        const { rerender } = render(<CalidadFotoResumen resultado={{ ...BUENA, motivo_codigo: 'ROSTRO_PEQUENO' }} />);
        expect(within(fila('Tamaño del rostro')).getByText('Revisar')).toBeInTheDocument();
        rerender(<CalidadFotoResumen resultado={{ ...BUENA, rostros: 2, un_solo_rostro: false, motivo_codigo: 'MULTIPLES_ROSTROS' }} />);
        expect(within(fila('Rostros detectados')).getByText('Revisar')).toBeInTheDocument();
        rerender(<CalidadFotoResumen resultado={{ ...BUENA, calidad: { ...BUENA.calidad, frontal: false }, motivo_codigo: 'NO_FRONTAL' }} />);
        expect(within(fila('De frente')).getByText('Revisar')).toBeInTheDocument();
        rerender(<CalidadFotoResumen resultado={{ ...BUENA, coseno_resto: 0.1, motivo_codigo: 'NO_COINCIDE' }} />);
        expect(within(fila('Parecido con las demás fotos')).getByText('Revisar')).toBeInTheDocument();
        expect(screen.getByText(/No parece la misma persona\./)).toBeInTheDocument();
    });

    it('una foto ilegible solo muestra el motivo', () => {
        render(<CalidadFotoResumen resultado={{ estado: 'ilegible', calidad: null, rostros: null, motivo_codigo: 'IMAGEN_INVALIDA' }} />);
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
        expect(screen.getByText(/Foto ilegible: No se pudo leer la imagen\./)).toBeInTheDocument();
    });
});
