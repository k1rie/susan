// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SinAccesoCamara from './SinAccesoCamara.jsx';

describe('SinAccesoCamara', () => {
    it('es un aviso (role=alert) con el mensaje de la cámara y las salidas que existen', () => {
        render(<SinAccesoCamara mensaje="Permiso denegado: permite el acceso a la cámara en el navegador." onReintentar={() => {}} onManual={() => {}} />);
        const aviso = screen.getByRole('alert');
        expect(aviso).toHaveTextContent('No se pudo usar la cámara de este dispositivo');
        expect(aviso).toHaveTextContent('Permiso denegado');
        expect(screen.getByRole('button', { name: 'Reintentar con la cámara' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Registrar manualmente' })).toBeInTheDocument();
    });

    it('solo ofrece lo que se puede: sin IP ni simulador no hay esos botones', () => {
        render(<SinAccesoCamara mensaje="x" onManual={() => {}} />);
        expect(screen.queryByRole('button', { name: /cámara IP|cámaras IP/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Usar la cámara simulada' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Reintentar con la cámara' })).toBeNull();
    });

    it('con cámaras IP ofrece seguir con ellas, en singular o plural', () => {
        const { rerender } = render(<SinAccesoCamara mensaje="x" camarasIp={1} onSoloIp={() => {}} />);
        expect(screen.getByRole('button', { name: 'Seguir con la cámara IP del aula' })).toBeInTheDocument();
        rerender(<SinAccesoCamara mensaje="x" camarasIp={3} onSoloIp={() => {}} />);
        expect(screen.getByRole('button', { name: 'Seguir con las 3 cámaras IP del aula' })).toBeInTheDocument();
    });

    it('con el reloj simulado ofrece la cámara simulada', async () => {
        const usuario = userEvent.setup();
        const simulada = vi.fn();
        render(<SinAccesoCamara mensaje="x" onSimulada={simulada} />);
        await usuario.click(screen.getByRole('button', { name: 'Usar la cámara simulada' }));
        expect(simulada).toHaveBeenCalledTimes(1);
    });

    it('cada botón llama a su acción', async () => {
        const usuario = userEvent.setup();
        const f = { reintentar: vi.fn(), ip: vi.fn(), manual: vi.fn() };
        render(<SinAccesoCamara mensaje="x" camarasIp={2} onReintentar={f.reintentar} onSoloIp={f.ip} onManual={f.manual} />);
        await usuario.click(screen.getByRole('button', { name: 'Reintentar con la cámara' }));
        await usuario.click(screen.getByRole('button', { name: /cámaras IP/ }));
        await usuario.click(screen.getByRole('button', { name: 'Registrar manualmente' }));
        expect(f.reintentar).toHaveBeenCalledTimes(1);
        expect(f.ip).toHaveBeenCalledTimes(1);
        expect(f.manual).toHaveBeenCalledTimes(1);
    });

    it('sin mensaje usa uno genérico', () => {
        render(<SinAccesoCamara />);
        expect(screen.getByRole('alert')).toHaveTextContent('La cámara no está disponible.');
    });
});
