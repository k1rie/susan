import { describe, expect, it, vi } from 'vitest';
import { elegirSesionAutomatica, pedirPantallaCompleta, salirPantallaCompleta, siguienteSesion } from './modoAutomatico.utils.js';

const s = (id, inicio, fin, extra = {}) => ({ id_sesion: id, hora_inicio: `${inicio}:00`, hora_fin: `${fin}:00`, estatus: 'programada', abrible: false, modo_previsto: 'automatico', ...extra });

describe('elegirSesionAutomatica', () => {
    it('con clases encimadas elige la que empezó más recientemente', () => {
        const sesiones = [
            s(1, '09:40', '10:40', { estatus: 'abierta' }),
            s(2, '10:00', '11:00', { abrible: true }),
            s(3, '10:20', '11:20', { abrible: true }),
            s(4, '10:40', '11:40'),
        ];
        expect(elegirSesionAutomatica(sesiones, '10:25:00')?.id_sesion).toBe(3);
    });

    it('una abierta cuenta aunque el servidor ya no la marque abrible', () => {
        expect(elegirSesionAutomatica([s(7, '08:00', '09:00', { estatus: 'abierta' })], '08:05:00')?.id_sesion).toBe(7);
    });

    it('ignora las de pase manual, las cerradas, las suspendidas y las que aún no empiezan', () => {
        const sesiones = [
            s(1, '08:00', '09:00', { abrible: true, modo_previsto: 'manual' }),
            s(2, '08:00', '09:00', { estatus: 'cerrada' }),
            s(3, '08:00', '09:00', { estatus: 'suspendida' }),
            s(4, '09:00', '10:00'),
        ];
        expect(elegirSesionAutomatica(sesiones, '08:30:00')).toBeNull();
    });

    it('sin sesiones o sin datos: null', () => {
        expect(elegirSesionAutomatica(undefined, '08:00:00')).toBeNull();
        expect(elegirSesionAutomatica([], null)).toBeNull();
    });
});

describe('siguienteSesion', () => {
    it('la próxima programada automática que aún no empieza', () => {
        const sesiones = [s(1, '08:00', '09:00', { estatus: 'cerrada' }), s(2, '11:00', '12:00', { modo_previsto: 'manual' }), s(3, '12:00', '13:00'), s(4, '13:00', '14:00')];
        expect(siguienteSesion(sesiones, '10:00:00')?.id_sesion).toBe(3);
    });

    it('sin hora o sin clases pendientes: null', () => {
        expect(siguienteSesion([s(1, '12:00', '13:00')], null)).toBeNull();
        expect(siguienteSesion([s(1, '08:00', '09:00')], '10:00:00')).toBeNull();
    });
});

describe('pantalla completa', () => {
    it('la pide sobre el documento y no falla si el navegador la niega', async () => {
        const requestFullscreen = vi.fn().mockRejectedValue(new Error('sin gesto'));
        expect(await pedirPantallaCompleta({ documentElement: { requestFullscreen }, fullscreenElement: null })).toBe(false);
        requestFullscreen.mockResolvedValue();
        expect(await pedirPantallaCompleta({ documentElement: { requestFullscreen }, fullscreenElement: null })).toBe(true);
    });

    it('no la pide si ya está en pantalla completa o si el navegador no la soporta', async () => {
        const requestFullscreen = vi.fn();
        expect(await pedirPantallaCompleta({ documentElement: { requestFullscreen }, fullscreenElement: {} })).toBe(false);
        expect(await pedirPantallaCompleta({ documentElement: {} })).toBe(false);
        expect(requestFullscreen).not.toHaveBeenCalled();
    });

    it('sale solo si está en pantalla completa', async () => {
        const exitFullscreen = vi.fn().mockResolvedValue();
        await salirPantallaCompleta({ fullscreenElement: null, exitFullscreen });
        expect(exitFullscreen).not.toHaveBeenCalled();
        await salirPantallaCompleta({ fullscreenElement: {}, exitFullscreen });
        expect(exitFullscreen).toHaveBeenCalledTimes(1);
    });
});
