// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Lock, Sparkles } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import TarjetaPortada from './TarjetaPortada.jsx';

describe('TarjetaPortada', () => {
    it('es un enlace con título, meta y pie; el icono es decorativo', () => {
        render(<TarjetaPortada href="/modulos/x" icono={Sparkles} tono="violeta" titulo="Asistente SUSAN" meta="Análisis" pie={<><Lock />Próximamente</>} />);
        const enlace = screen.getByRole('link', { name: /Asistente SUSAN/ });
        expect(enlace).toHaveAttribute('href', '/modulos/x');
        expect(enlace).toHaveTextContent('Análisis');
        expect(enlace).toHaveTextContent('Próximamente');
        expect(enlace.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    });

    it('sin href es un botón que llama a onClick', async () => {
        const onClick = vi.fn();
        render(<TarjetaPortada titulo="Acción" onClick={onClick} />);
        await userEvent.click(screen.getByRole('button', { name: /Acción/ }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('portada plana usa el fondo del tono y degradado usa gradiente propio', () => {
        const { container, rerender } = render(<TarjetaPortada href="/a" titulo="A" tono="verde" icono={Sparkles} />);
        expect(container.querySelector('.bg-tono-verde')).toBeInTheDocument();
        rerender(<TarjetaPortada href="/a" titulo="A" portada="degradado" icono={Sparkles} />);
        expect(container.querySelector('[style*="linear-gradient"]')).toBeInTheDocument();
        expect(container.querySelector('.bg-tono-azul')).toBeNull();
    });
});
