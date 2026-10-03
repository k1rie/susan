// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlantillaFacialPanel from './PlantillaFacialPanel.jsx';
import { esFotoAceptable, mensajeErrorPlantilla } from './plantillaFacial.utils.js';

const mocks = vi.hoisted(() => ({
    consentimientosAlumno: vi.fn(),
    plantillaAlumno: vi.fn(),
    verificarFoto: vi.fn(),
    registrarPlantilla: vi.fn(),
}));
vi.mock('@/lib/api/biometria.js', () => ({ consentimientosAlumno: mocks.consentimientosAlumno, plantillaAlumno: mocks.plantillaAlumno }));
vi.mock('@/lib/http/biometria.js', () => ({
    verificarFoto: mocks.verificarFoto,
    registrarPlantilla: mocks.registrarPlantilla,
    solicitarUrlDocumento: vi.fn(),
}));
// La cámara real necesita getUserMedia: se sustituye por un botón que entrega un Blob JPEG.
vi.mock('@/components/ui/CameraCapture', () => ({
    default: ({ onCapture }) => <button onClick={() => onCapture(new Blob(['x'], { type: 'image/jpeg' }))}>Tomar foto simulada</button>,
}));

const CON_CONSENT = { vigente: true, consentimiento_vigente: { id_consent: 9, vigencia_hasta: '2027-01-01', dias_restantes: 90 }, items: [] };
const SIN_CONSENT = { vigente: false, consentimiento_vigente: null, items: [] };
const SIN_PLANTILLA = { activa: null, archivadas: { total: 0, items: [] } };
const BUENA = { rostros: 1, un_solo_rostro: true, calidad: { brillo: 120, nitidez: 80, tamano_rostro: 200, frontal: true }, motivo_rechazo: null };

beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
});

describe('utils', () => {
    it('esFotoAceptable exige un rostro y sin motivo', () => {
        expect(esFotoAceptable(BUENA)).toBe(true);
        expect(esFotoAceptable({ ...BUENA, motivo_rechazo: 'BORROSA' })).toBe(false);
        expect(esFotoAceptable({ ...BUENA, un_solo_rostro: false })).toBe(false);
        expect(esFotoAceptable(null)).toBe(false);
    });
    it('mensajes de error', () => {
        expect(mensajeErrorPlantilla({ code: 'FOTO_RECHAZADA', details: { motivo_rechazo: 'NO_FRONTAL' }, message: 'x' })).toBe('Mire de frente a la cámara.');
        expect(mensajeErrorPlantilla({ status: 503, message: 'x' })).toMatch(/reintente/);
    });
});

describe('PlantillaFacialPanel', () => {
    it('sin consentimiento vigente deshabilita la captura', async () => {
        mocks.consentimientosAlumno.mockResolvedValue(SIN_CONSENT);
        mocks.plantillaAlumno.mockResolvedValue(SIN_PLANTILLA);
        render(<PlantillaFacialPanel idAlumno={1} />);
        expect(await screen.findByText(/Registre un consentimiento vigente/)).toBeInTheDocument();
        expect(screen.queryByText('Tomar foto simulada')).not.toBeInTheDocument();
        expect(screen.getByText(/Sin plantilla facial/)).toBeInTheDocument();
    });

    it('rechazo de calidad muestra el motivo y bloquea el registro', async () => {
        mocks.consentimientosAlumno.mockResolvedValue(CON_CONSENT);
        mocks.plantillaAlumno.mockResolvedValue(SIN_PLANTILLA);
        mocks.verificarFoto.mockResolvedValue({ ...BUENA, calidad: { ...BUENA.calidad, nitidez: 3 }, motivo_rechazo: 'BORROSA' });
        render(<PlantillaFacialPanel idAlumno={1} />);
        fireEvent.click(await screen.findByText('Tomar foto simulada'));
        expect(await screen.findByText(/La imagen está borrosa/)).toBeInTheDocument();
        expect(screen.getByText('Registrar plantilla').closest('button')).toBeDisabled();
        expect(mocks.registrarPlantilla).not.toHaveBeenCalled();
    });

    it('éxito: registra con el consentimiento vigente y muestra el índice listo', async () => {
        mocks.consentimientosAlumno.mockResolvedValue(CON_CONSENT);
        mocks.plantillaAlumno
            .mockResolvedValueOnce(SIN_PLANTILLA)
            .mockResolvedValue({ activa: { id_plantilla: 5, indexada: true, version_indice: 'v004', fecha_registro: '2026-09-14' }, archivadas: { total: 0, items: [] } });
        mocks.verificarFoto.mockResolvedValue(BUENA);
        mocks.registrarPlantilla.mockResolvedValue({ id_plantilla: 5, indice: { estado: 'activada', version: 'v004' } });
        const onCambio = vi.fn();
        render(<PlantillaFacialPanel idAlumno={1} onCambio={onCambio} />);
        fireEvent.click(await screen.findByText('Tomar foto simulada'));
        const boton = await screen.findByText('Registrar plantilla');
        await waitFor(() => expect(boton.closest('button')).toBeEnabled());
        fireEvent.click(boton);
        expect(await screen.findByText(/Índice listo, versión v004/)).toBeInTheDocument();
        expect(mocks.registrarPlantilla).toHaveBeenCalledWith(expect.objectContaining({ idAlumno: 1, idConsent: 9 }));
        expect(onCambio).toHaveBeenCalled();
    });

    it('error 503 al registrar ofrece reintento', async () => {
        mocks.consentimientosAlumno.mockResolvedValue(CON_CONSENT);
        mocks.plantillaAlumno.mockResolvedValue(SIN_PLANTILLA);
        mocks.verificarFoto.mockResolvedValue(BUENA);
        mocks.registrarPlantilla.mockRejectedValue(Object.assign(new Error('caído'), { status: 503, code: 'RECONOCIMIENTO_NO_DISPONIBLE' }));
        render(<PlantillaFacialPanel idAlumno={1} />);
        fireEvent.click(await screen.findByText('Tomar foto simulada'));
        const boton = await screen.findByText('Registrar plantilla');
        await waitFor(() => expect(boton.closest('button')).toBeEnabled());
        fireEvent.click(boton);
        expect(await screen.findByText(/no responde; reintente/)).toBeInTheDocument();
        expect(screen.getByText('Reintentar')).toBeInTheDocument();
    });
});
