// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ camaraGuardar: vi.fn() }));
const http = vi.hoisted(() => ({ probarCamara: vi.fn() }));
vi.mock('@/lib/api/admin.js', () => api);
vi.mock('@/lib/http/admin.js', () => http);
import { ApiError } from '@/lib/api/errors.js';
import CamaraForm from './CamaraForm.jsx';
import { datosCamara, describirPrueba, estadoProbar, mapearErrorCamara, validarCamara } from './camaraForm.utils.js';

const IP = { id_camara: 3, id_aula: 1, posicion: 'fondo', tipo: 'ip', direccion_ip: '10.20.12.2', estatus: 'activa' };
const NAVEGADOR = { id_camara: 4, id_aula: 1, posicion: 'frente', tipo: 'navegador', direccion_ip: null, estatus: 'activa' };

beforeEach(() => {
    api.camaraGuardar.mockReset();
    http.probarCamara.mockReset();
    api.camaraGuardar.mockResolvedValue({ id_camara: 3 });
});

describe('utilidades de cámara', () => {
    it('la IP es obligatoria solo en cámaras IP y el mensaje trae un ejemplo', () => {
        expect(validarCamara({ tipo: 'ip', direccion_ip: '' }).direccion_ip).toMatch(/por ejemplo 10\.20\.12\.2/);
        expect(validarCamara({ tipo: 'ip', direccion_ip: '10.20.12.300' }).direccion_ip).toMatch(/formato 10\.20\.12\.2/);
        expect(validarCamara({ tipo: 'ip', direccion_ip: '10.20.12.2' })).toEqual({});
        expect(validarCamara({ tipo: 'ip', direccion_ip: 'fe80::1' })).toEqual({});
        expect(validarCamara({ tipo: 'navegador', direccion_ip: '' })).toEqual({});
    });
    it('el payload no lleva IP en las del navegador y lleva id solo al editar', () => {
        expect(datosCamara({ tipo: 'navegador', direccion_ip: '10.0.0.1', estatus: 'activa' }, { idAula: 1, posicion: 'frente' })).toEqual({ id_aula: 1, posicion: 'frente', tipo: 'navegador', estatus: 'activa' });
        expect(datosCamara({ tipo: 'ip', direccion_ip: ' 10.0.0.1 ', estatus: 'inactiva' }, { idAula: 1, posicion: 'fondo', idCamara: 8 })).toEqual({ id_aula: 1, posicion: 'fondo', tipo: 'ip', estatus: 'inactiva', direccion_ip: '10.0.0.1', id_camara: 8 });
    });
    it('la prueba solo se habilita con la cámara IP guardada y sin cambios; si no, dice por qué', () => {
        expect(estadoProbar({ camara: undefined, tipoActual: 'ip', sucio: false })).toMatchObject({ puede: false, motivo: 'Guarda la cámara para poder probarla.' });
        expect(estadoProbar({ camara: NAVEGADOR, tipoActual: 'navegador', sucio: false }).motivo).toMatch(/webcam del navegador/);
        expect(estadoProbar({ camara: IP, tipoActual: 'navegador', sucio: true }).puede).toBe(false);
        expect(estadoProbar({ camara: IP, tipoActual: 'ip', sucio: true }).motivo).toMatch(/dirección guardada \(10\.20\.12\.2\)/);
        expect(estadoProbar({ camara: IP, tipoActual: 'ip', sucio: false })).toEqual({ puede: true, motivo: null });
    });
    it('describe el resultado de la prueba', () => {
        expect(describirPrueba({ ok: true, ms: 220, rostros: 2 })).toEqual({ ok: true, titulo: 'Conectada', detalle: '220 ms · 2 rostros detectados' });
        expect(describirPrueba({ ok: true, rostros: 1 }).detalle).toBe('1 rostro detectado');
        expect(describirPrueba({ ok: false, mensaje: 'No se pudo conectar.' })).toEqual({ ok: false, titulo: 'No respondió', detalle: 'No se pudo conectar.' });
    });
    it('los errores del servidor van al campo de la IP', () => {
        expect(mapearErrorCamara({ code: 'DUPLICADO', message: 'IP en uso.' })).toEqual({ direccion_ip: 'IP en uso.' });
        expect(mapearErrorCamara({ code: 'CAMARA_POSICION_DUPLICADA' })).toBeNull();
    });
});

describe('CamaraForm', () => {
    it('muestra tipo y estatus como segmentados y la IP con su ejemplo', () => {
        render(<CamaraForm idAula={1} posicion="fondo" camara={IP} />);
        expect(screen.getByRole('radio', { name: 'Cámara IP' })).toBeChecked();
        expect(screen.getByRole('radio', { name: 'Activa' })).toBeChecked();
        expect(screen.getByLabelText(/Dirección IP/)).toHaveValue('10.20.12.2');
        expect(screen.getByText(/Ej\. 10\.20\.12\.2/)).toBeTruthy();
        expect(screen.getByText('Sin probar con la dirección actual.')).toBeTruthy();
    });

    it('al elegir la webcam del navegador desaparece la IP', async () => {
        const user = userEvent.setup();
        render(<CamaraForm idAula={1} posicion="fondo" camara={IP} />);
        await user.click(screen.getByRole('radio', { name: 'Webcam del navegador' }));
        expect(screen.queryByLabelText(/Dirección IP/)).toBeNull();
        expect(screen.getByText('1 cambio sin guardar')).toBeTruthy();
    });

    it('«Probar conexión» deja el resultado a la vista con su hora (no solo un aviso que se va)', async () => {
        http.probarCamara.mockResolvedValueOnce({ ok: true, tipo: 'ip', probada: true, rostros: 2, ms: 220 });
        const user = userEvent.setup();
        render(<CamaraForm idAula={1} posicion="fondo" camara={IP} />);
        await user.click(screen.getByRole('button', { name: 'Probar conexión' }));
        expect(await screen.findByText('Conectada')).toBeTruthy();
        expect(http.probarCamara).toHaveBeenCalledWith({ idCamara: 3 });
        expect(screen.getByText(/a las \d{2}:\d{2}:\d{2}/)).toBeTruthy();
        expect(screen.getByText('220 ms · 2 rostros detectados')).toBeTruthy();
    });

    it('si la cámara no responde lo dice con el motivo y una sugerencia', async () => {
        http.probarCamara.mockResolvedValueOnce({ ok: false, tipo: 'ip', probada: true, mensaje: 'No se pudo obtener imagen de la cámara.' });
        const user = userEvent.setup();
        render(<CamaraForm idAula={1} posicion="fondo" camara={IP} />);
        await user.click(screen.getByRole('button', { name: 'Probar conexión' }));
        expect(await screen.findByText('No respondió')).toBeTruthy();
        expect(screen.getByText('No se pudo obtener imagen de la cámara.')).toBeTruthy();
        expect(screen.getByText(/Revisa que la cámara esté encendida/)).toBeTruthy();
    });

    it('con cambios sin guardar apaga la prueba y explica que probaría la dirección guardada', async () => {
        const user = userEvent.setup();
        render(<CamaraForm idAula={1} posicion="fondo" camara={IP} />);
        await user.type(screen.getByLabelText(/Dirección IP/), '9');
        expect(screen.getByRole('button', { name: 'Probar conexión' })).toBeDisabled();
        expect(screen.getByText(/la prueba usa la dirección guardada \(10\.20\.12\.2\), no la que escribiste/)).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Descartar' }));
        expect(screen.getByRole('button', { name: 'Probar conexión' })).toBeEnabled();
    });

    it('si cambia la dirección guardada, el resultado anterior ya no vale y vuelve a «sin probar»', async () => {
        http.probarCamara.mockResolvedValueOnce({ ok: true, tipo: 'ip', probada: true, rostros: 0, ms: 90 });
        const user = userEvent.setup();
        const { rerender } = render(<CamaraForm idAula={1} posicion="fondo" camara={IP} />);
        await user.click(screen.getByRole('button', { name: 'Probar conexión' }));
        await screen.findByText('Conectada');
        rerender(<CamaraForm idAula={1} posicion="fondo" camara={{ ...IP, direccion_ip: '10.20.12.9' }} />);
        expect(screen.queryByText('Conectada')).toBeNull();
        expect(screen.getByText('Sin probar con la dirección actual.')).toBeTruthy();
    });

    it('la webcam del navegador no se prueba aquí y lo dice', () => {
        render(<CamaraForm idAula={1} posicion="frente" camara={NAVEGADOR} />);
        expect(screen.getByRole('button', { name: 'Probar conexión' })).toBeDisabled();
        expect(screen.getByText('La webcam del navegador se prueba al abrir la sesión de captura.')).toBeTruthy();
    });

    it('guarda el payload de siempre y marca lo guardado como sin cambios', async () => {
        const onSaved = vi.fn();
        const user = userEvent.setup();
        render(<CamaraForm idAula={1} posicion="fondo" camara={IP} onSaved={onSaved} />);
        await user.click(screen.getByRole('radio', { name: 'Inactiva' }));
        await user.click(screen.getByRole('button', { name: 'Guardar cámara' }));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(api.camaraGuardar).toHaveBeenCalledWith({ datos: { id_aula: 1, posicion: 'fondo', tipo: 'ip', estatus: 'inactiva', direccion_ip: '10.20.12.2', id_camara: 3 } });
        expect(screen.queryByText(/cambio sin guardar/)).toBeNull();
    });

    it('la IP vacía o con mal formato se marca en el campo y no llega al servidor; una IP en uso se pega al campo', async () => {
        const user = userEvent.setup();
        render(<CamaraForm idAula={1} posicion="fondo" camara={IP} />);
        await user.clear(screen.getByLabelText(/Dirección IP/));
        await user.click(screen.getByRole('button', { name: 'Guardar cámara' }));
        expect(await screen.findByText(/Escribe la dirección IP de la cámara, por ejemplo 10\.20\.12\.2/)).toBeTruthy();
        expect(api.camaraGuardar).not.toHaveBeenCalled();
        api.camaraGuardar.mockRejectedValueOnce(new ApiError({ code: 'DUPLICADO', message: 'Otra cámara ya usa esa IP.', status: 409 }));
        await user.type(screen.getByLabelText(/Dirección IP/), '10.20.12.7');
        await user.click(screen.getByRole('button', { name: 'Guardar cámara' }));
        expect(await screen.findByText('Otra cámara ya usa esa IP.')).toBeTruthy();
        expect(screen.getByLabelText(/Dirección IP/)).toHaveAttribute('aria-invalid', 'true');
    });
});
