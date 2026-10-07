// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlantillaFacialPanel from './PlantillaFacialPanel.jsx';

const mocks = vi.hoisted(() => ({
    consentimientosAlumno: vi.fn(),
    plantillaAlumno: vi.fn(),
    verificarFoto: vi.fn(),
    verificarFotos: vi.fn(),
    registrarPlantilla: vi.fn(),
    solicitarUrlDocumento: vi.fn(),
    camara: vi.fn(),
}));
vi.mock('@/lib/api/biometria.js', () => ({ consentimientosAlumno: mocks.consentimientosAlumno, plantillaAlumno: mocks.plantillaAlumno }));
vi.mock('@/lib/http/biometria.js', () => ({
    verificarFoto: mocks.verificarFoto,
    verificarFotos: mocks.verificarFotos,
    registrarPlantilla: mocks.registrarPlantilla,
    solicitarUrlDocumento: mocks.solicitarUrlDocumento,
}));
// La cámara real necesita getUserMedia: se sustituye el hook por un objeto con la misma forma.
vi.mock('@/components/ui/CameraCapture', () => ({ default: () => null, useCameraCapture: (opciones) => mocks.camara(opciones) }));

const CON_CONSENT = { vigente: true, consentimiento_vigente: { id_consent: 9, vigencia_hasta: '2027-01-01', dias_restantes: 90 }, items: [] };
const SIN_CONSENT = { vigente: false, consentimiento_vigente: null, items: [] };
const SIN_PLANTILLA = { activa: null, archivadas: { total: 0, items: [] } };
const ACTIVA = { id_plantilla: 5, indexada: true, version_indice: 'v004', fecha_registro: '2026-09-14', n_fotos: 5, coseno_min: 0.512, coseno_medio: 0.744, fotos: [1, 2, 3, 4, 5].map((o) => ({ id_foto: 100 + o, orden: o, principal: o === 1, calidad: null, coseno_resto: 0.7 })) };

beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.consentimientosAlumno.mockResolvedValue(CON_CONSENT);
    mocks.plantillaAlumno.mockResolvedValue(SIN_PLANTILLA);
    mocks.verificarFotos.mockResolvedValue({ total: 0, fotos: [] });
    mocks.camara.mockImplementation(() => ({ videoRef: { current: null }, capture: vi.fn(), restart: vi.fn(), estado: 'ready', error: null, dispositivos: [] }));
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
});

const montar = async (props = {}) => {
    render(<PlantillaFacialPanel idAlumno={1} nombreAlumno="Ana Pérez" {...props} />);
    return screen.findByRole('button', { name: /^Registrar (el )?rostro/ });
};

describe('PlantillaFacialPanel: asistente de registro', () => {
    it('sin consentimiento vigente no ofrece el registro', async () => {
        mocks.consentimientosAlumno.mockResolvedValue(SIN_CONSENT);
        render(<PlantillaFacialPanel idAlumno={1} />);
        expect(await screen.findByText(/Registre un consentimiento vigente/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Registrar (el )?rostro/ })).not.toBeInTheDocument();
        expect(screen.getByText(/Sin plantilla facial/)).toBeInTheDocument();
    });

    it('sin plantilla el botón dice «Registrar rostro» y abre el asistente con el nombre del alumno', async () => {
        const boton = await montar();
        expect(boton).toHaveTextContent('Registrar rostro');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        fireEvent.click(boton);
        const dialogo = await screen.findByRole('dialog', { name: 'Registro facial' });
        expect(within(dialogo).getByText('Ana Pérez')).toBeInTheDocument();
        expect(within(dialogo).getByRole('button', { name: 'Comenzar' })).toBeInTheDocument();
        // La tarjeta ya no lleva la cámara ni los controles de captura: viven dentro del asistente.
        expect(screen.queryByRole('button', { name: /Capturar toma|Usar cámara|Subir fotos$/ })).not.toBeInTheDocument();
    });

    it('con plantilla activa el botón dice que registra de nuevo y avisa que la anterior se archivará', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: ACTIVA, archivadas: { total: 0, items: [] } });
        const boton = await montar();
        expect(boton).toHaveTextContent('Registrar el rostro de nuevo');
        expect(screen.getByText(/La plantilla anterior se archivará al reemplazarla/)).toBeInTheDocument();
    });

    it('cerrar el asistente sin tomas lo quita y deja la tarjeta como estaba', async () => {
        fireEvent.click(await montar());
        await screen.findByRole('dialog');
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar el registro facial' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'Registrar rostro' })).toBeInTheDocument();
    });
});

describe('PlantillaFacialPanel: plantilla actual', () => {
    it('muestra el número de fotos y la consistencia medida', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: ACTIVA, archivadas: { total: 1, items: [] } });
        await montar();
        expect(screen.getByText('Fotos: 5')).toBeInTheDocument();
        expect(screen.getByText('Consistencia entre fotos')).toBeInTheDocument();
        expect(screen.getByText(/cada foto se parecía en promedio 0\.74 a las demás \(mínimo 0\.51\)/)).toBeInTheDocument();
        expect(screen.getByText('1 plantilla(s) archivada(s)')).toBeInTheDocument();
        expect(screen.queryByText(/Plantilla de una sola foto/)).not.toBeInTheDocument();
    });

    it('una plantilla de una foto sugiere registrar de 3 a 5 tomas', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: { id_plantilla: 5, indexada: true, version_indice: 'v001', fecha_registro: '2026-09-01', n_fotos: 1, coseno_min: null, coseno_medio: null, fotos: [{ id_foto: 1, orden: 1, principal: true }] }, archivadas: { total: 0, items: [] } });
        await montar();
        expect(screen.getByText('Fotos: 1')).toBeInTheDocument();
        expect(screen.getByText('Plantilla de una sola foto: se recomienda registrar de 3 a 5 tomas.')).toBeInTheDocument();
        expect(screen.queryByText('Consistencia entre fotos')).not.toBeInTheDocument();
        expect(screen.queryByText(/Ver las .* fotos/)).not.toBeInTheDocument();
    });

    it('una plantilla heredada sin los campos nuevos se muestra como de una foto', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: { id_plantilla: 5, indexada: true, version_indice: 'v001', fecha_registro: '2026-09-01' }, archivadas: { total: 0, items: [] } });
        await montar();
        expect(screen.getByText('Fotos: 1')).toBeInTheDocument();
        expect(screen.getByText(/Plantilla de una sola foto/)).toBeInTheDocument();
    });

    it('«Ver foto» pide la principal y «Abrir foto K» pide tipo plantilla_foto con el id de la foto', async () => {
        mocks.plantillaAlumno.mockResolvedValue({ activa: ACTIVA, archivadas: { total: 0, items: [] } });
        mocks.solicitarUrlDocumento.mockImplementation(async ({ tipo, idRegistro }) => ({ url: `https://firmada/${tipo}/${idRegistro}` }));
        await montar();
        fireEvent.click(screen.getByRole('button', { name: 'Ver foto' }));
        expect(await screen.findByText('Abrir foto (el enlace caduca en 5 minutos)')).toHaveAttribute('href', 'https://firmada/plantilla/5');
        expect(screen.getByText('Ver las 5 fotos')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Abrir foto 3' }));
        const enlace = await screen.findByText('Abrir foto 3 (el enlace caduca en 5 minutos)');
        expect(enlace).toHaveAttribute('href', 'https://firmada/plantilla_foto/103');
        expect(mocks.solicitarUrlDocumento).toHaveBeenLastCalledWith({ tipo: 'plantilla_foto', idRegistro: 103 });
    });

    it('con las fotos ya borradas (extensión 18) no ofrece enlaces y dice que solo se guarda el vector', async () => {
        const purgada = { ...ACTIVA, foto_disponible: false, fotos: ACTIVA.fotos.map((f) => ({ ...f, disponible: false })) };
        mocks.plantillaAlumno.mockResolvedValue({ activa: purgada, archivadas: { total: 0, items: [] } });
        await montar();
        expect(screen.getByText('Fotos: 5')).toBeInTheDocument();
        expect(screen.getByText('Las fotos no se conservan: solo se guarda el vector del rostro en el índice.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Ver foto' })).not.toBeInTheDocument();
        expect(screen.queryByText(/Ver las .* fotos/)).not.toBeInTheDocument();
        expect(mocks.solicitarUrlDocumento).not.toHaveBeenCalled();
    });

    it('con las fotos aún sin indexar (disponible: true) sigue ofreciendo «Ver foto» y la lista de fotos', async () => {
        const reciente = { ...ACTIVA, indexada: false, version_indice: null, foto_disponible: true, fotos: ACTIVA.fotos.map((f) => ({ ...f, disponible: true })) };
        mocks.plantillaAlumno.mockResolvedValue({ activa: reciente, archivadas: { total: 0, items: [] } });
        await montar();
        expect(screen.getByRole('button', { name: 'Ver foto' })).toBeInTheDocument();
        expect(screen.getByText('Ver las 5 fotos')).toBeInTheDocument();
        expect(screen.queryByText(/Las fotos no se conservan/)).not.toBeInTheDocument();
    });
});
