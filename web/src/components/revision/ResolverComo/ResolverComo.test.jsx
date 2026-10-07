// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ResolverComo from './ResolverComo.jsx';
import { estadosOfrecidos, mensajeResolucion, normalizarComentario, sugerenciaValida } from './resolverComo.utils.js';

describe('resolverComo.utils', () => {
    it('ofrece todos los destinos menos el actual y nunca justificado/pendiente', () => {
        expect(estadosOfrecidos('pendiente')).toEqual(['presente', 'retardo', 'ausente']);
        expect(estadosOfrecidos('retardo')).toEqual(['presente', 'ausente']);
    });
    it('valida la sugerencia', () => {
        expect(sugerenciaValida('retardo')).toBe('retardo');
        expect(sugerenciaValida('justificado')).toBeNull();
        expect(sugerenciaValida(undefined)).toBeNull();
    });
    it('normaliza el comentario', () => {
        expect(normalizarComentario('   ')).toBeNull();
        expect(normalizarComentario(' hola ')).toBe('hola');
        expect(normalizarComentario('x'.repeat(300))).toHaveLength(200);
    });
    it('avisa del derecho a examen', () => {
        const r = (a, n) => ({ inscripcion: { derecho_examen_anterior: a, derecho_examen: n } });
        expect(mensajeResolucion(r(true, false), 'ausente')).toMatch(/queda sin derecho a examen/);
        expect(mensajeResolucion(r(false, true), 'presente')).toMatch(/recupera el derecho/);
        expect(mensajeResolucion(r(true, true), 'retardo')).toBe('Resuelto como Retardo');
    });
});

describe('ResolverComo', () => {
    it('marca el sugerido y resuelve con un solo clic (abrir caso + 1 clic <= 3 interacciones)', async () => {
        const onResolver = vi.fn().mockResolvedValue();
        render(<ResolverComo estadoSugerido="retardo" onResolver={onResolver} />);
        expect(screen.getByText('(Sugerido)')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /Resolver como Retardo/ }));
        expect(onResolver).toHaveBeenCalledTimes(1);
        expect(onResolver).toHaveBeenCalledWith('retardo', null);
    });
    it('envía el comentario y deshabilita con plazo vencido', async () => {
        const onResolver = vi.fn();
        const { rerender } = render(<ResolverComo onResolver={onResolver} />);
        await userEvent.type(screen.getByLabelText(/Comentario/), 'Llegó tarde');
        await userEvent.click(screen.getByRole('button', { name: /Resolver como Ausente/ }));
        expect(onResolver).toHaveBeenCalledWith('ausente', 'Llegó tarde');
        rerender(<ResolverComo deshabilitado motivoDeshabilitado="Plazo vencido" onResolver={onResolver} />);
        expect(screen.getByRole('button', { name: /Resolver como Presente/ })).toBeDisabled();
        expect(screen.getByText('Plazo vencido')).toBeInTheDocument();
    });
    it('el comentario se rotula como opcional con la palabra y dice a dónde va', () => {
        render(<ResolverComo onResolver={vi.fn()} />);
        const campo = screen.getByLabelText(/Comentario/);
        expect(campo).toHaveAccessibleName(/Comentario\s*\(opcional\)/);
        expect(campo).toHaveAccessibleDescription(/Queda en el historial de correcciones del caso\./);
        expect(screen.getByText('0/200')).toBeInTheDocument();
    });
});
