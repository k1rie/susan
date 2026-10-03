// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusChip from './StatusChip.jsx';
import { MAPA_ESTADOS, etiqueta, tokens } from './statusChip.utils.js';

describe('StatusChip', () => {
    it('mapea todos los estados de todos los tipos a etiqueta y tokens', () => {
        for (const [kind, valores] of Object.entries(MAPA_ESTADOS)) {
            for (const [value, [texto, clases]] of Object.entries(valores)) {
                expect(etiqueta(kind, value)).toBe(texto);
                expect(tokens(kind, value)).toBe(clases);
            }
        }
    });

    it('cubre los 9 tipos y valores clave de la especificación', () => {
        expect(Object.keys(MAPA_ESTADOS)).toHaveLength(9);
        expect(etiqueta('asistencia', 'sin_lecturas')).toBe('Sin lecturas');
        expect(etiqueta('justificante', 'aprobado')).toBe('Aprobado');
        expect(tokens('justificante', 'aprobado')).toContain('text-presente');
        expect(etiqueta('origen', 'correccion')).toBe('Corrección');
        expect(etiqueta('persona', 'baja_temporal')).toBe('Baja temporal');
        expect(tokens('sesion', 'abierta')).toBe('text-justificado bg-justificado-bg');
    });

    it('muestra el valor tal cual con tokens neutros si es desconocido', () => {
        render(<StatusChip kind="asistencia" value="raro" />);
        const chip = screen.getByText('raro');
        expect(chip).toHaveClass('text-muted-foreground');
        expect(etiqueta('kind_inexistente', 'x')).toBe('x');
    });

    it('renderiza texto y color', () => {
        render(<StatusChip kind="asistencia" value="retardo" size="sm" />);
        expect(screen.getByText('Retardo')).toHaveClass('text-retardo', 'bg-retardo-bg');
    });
});
