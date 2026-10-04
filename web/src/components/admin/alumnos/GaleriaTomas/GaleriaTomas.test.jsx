// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GaleriaTomas from './GaleriaTomas.jsx';

const toma = (id, estado, extra = {}) => ({ id, origen: 'archivo', paso: null, blob: new Blob(['x'], { type: 'image/jpeg' }), nombre: `f${id}.jpg`, estado, motivoCodigo: null, motivo: null, ...extra });
const ranura = (t, numero, extra = {}) => ({ clave: `t${t.id}`, numero, titulo: `Foto ${numero}`, toma: t, destacada: false, ...extra });

beforeEach(() => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
});

describe('GaleriaTomas', () => {
    it('muestra los 6 estados con texto (nunca solo color) y su ícono', () => {
        const tomas = [
            toma(1, 'verificando'),
            toma(2, 'aceptada'),
            toma(3, 'calidad', { motivoCodigo: 'POCA_LUZ' }),
            toma(4, 'inconsistente', { motivoCodigo: 'NO_COINCIDE' }),
            toma(5, 'ilegible', { motivoCodigo: 'IMAGEN_INVALIDA' }),
            toma(6, 'duplicada', { duplicadaDeId: 2, motivoCodigo: 'DUPLICADA' }),
        ];
        const { container } = render(<GaleriaTomas ranuras={tomas.map((t, i) => ranura(t, i + 1))} />);
        expect(screen.getByText('Verificando…')).toBeInTheDocument();
        expect(screen.getByText('Aceptada')).toBeInTheDocument();
        expect(screen.getByText('Falta iluminación.')).toBeInTheDocument();
        expect(screen.getByText('No parece la misma persona')).toBeInTheDocument();
        expect(screen.getByText('No se pudo leer la imagen')).toBeInTheDocument();
        expect(screen.getByText('Igual a la toma 2')).toBeInTheDocument();
        // Cada estado lleva su ícono Lucide, decorativo.
        const iconos = container.querySelectorAll('svg[aria-hidden="true"]');
        expect(iconos.length).toBeGreaterThanOrEqual(6);
        expect(container.querySelector('svg.lucide-loader-circle')).toBeInTheDocument();
        expect(container.querySelector('svg.lucide-circle-check')).toBeInTheDocument();
        expect(container.querySelector('svg.lucide-copy')).toBeInTheDocument();
        // Sin Badge en píldora: el estado es texto con ícono.
        expect(container.querySelector('.rounded-full')).toBeNull();
    });

    it('un conjunto ambiguo dice que las tomas no coinciden entre sí', () => {
        render(<GaleriaTomas ranuras={[ranura(toma(1, 'inconsistente', { motivoCodigo: 'CONJUNTO_AMBIGUO' }), 1)]} />);
        expect(screen.getByText('Las tomas no coinciden entre sí')).toBeInTheDocument();
    });

    it('el giro excesivo se le dice «tú» a la persona solo en tomas de cámara', () => {
        const t = [toma(1, 'calidad', { motivoCodigo: 'NO_FRONTAL', origen: 'camara', paso: 1 }), toma(2, 'calidad', { motivoCodigo: 'NO_FRONTAL' })];
        render(<GaleriaTomas ranuras={t.map((x, i) => ranura(x, i + 1))} />);
        expect(screen.getByText('Giraste demasiado; vuelve a mirar hacia la cámara.')).toBeInTheDocument();
        expect(screen.getByText('Mire de frente a la cámara.')).toBeInTheDocument();
    });

    it('acción corta con aria-label completo, también en tomas aceptadas', () => {
        const onAccion = vi.fn();
        render(<GaleriaTomas ranuras={[ranura(toma(7, 'aceptada'), 3)]} accion="repetir" onAccion={onAccion} />);
        const boton = screen.getByRole('button', { name: 'Repetir toma 3' });
        expect(boton).toHaveTextContent(/^Repetir$/);
        fireEvent.click(boton);
        expect(onAccion).toHaveBeenCalledWith(7, 'repetir');
    });

    it('«quitar» por defecto y deshabilitado bloquea la acción', () => {
        const onAccion = vi.fn();
        render(<GaleriaTomas ranuras={[ranura(toma(1, 'aceptada'), 1)]} onAccion={onAccion} deshabilitado />);
        const boton = screen.getByRole('button', { name: 'Quitar toma 1' });
        expect(boton).toBeDisabled();
        fireEvent.click(boton);
        expect(onAccion).not.toHaveBeenCalled();
    });

    it('cada elemento anuncia número, título y estado; la ranura siguiente lleva aria-current', () => {
        render(
            <GaleriaTomas
                ranuras={[
                    ranura(toma(1, 'aceptada'), 1, { titulo: 'De frente' }),
                    { clave: 'v', numero: 2, titulo: 'Gira a la izquierda', toma: null, destacada: true },
                    { clave: 'w', numero: 3, titulo: 'Gira a la derecha', toma: null, destacada: false },
                ]}
            />,
        );
        expect(screen.getByRole('listitem', { name: 'Toma 1 de 3, De frente, Aceptada' })).toBeInTheDocument();
        expect(screen.getByRole('listitem', { name: 'Toma 2 de 3, Gira a la izquierda, pendiente' })).toHaveAttribute('aria-current', 'step');
        expect(screen.getByRole('listitem', { name: 'Toma 3 de 3, Gira a la derecha, pendiente' })).not.toHaveAttribute('aria-current');
        expect(screen.getByAltText('Toma 1: De frente')).toBeInTheDocument();
        expect(screen.getByText('2. Gira a la izquierda')).toBeInTheDocument();
    });

    it('libera la URL de objeto al quitar la miniatura', async () => {
        const { rerender } = render(<GaleriaTomas ranuras={[ranura(toma(1, 'aceptada'), 1)]} />);
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
        rerender(<GaleriaTomas ranuras={[]} />);
        await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x'));
    });
});
