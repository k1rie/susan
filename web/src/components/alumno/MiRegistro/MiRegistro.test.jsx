// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    miRegistro: vi.fn(),
    aceptarAviso: vi.fn(),
    revocarMiConsentimiento: vi.fn(),
    verificarMisFotos: vi.fn(),
    registrarMiPlantilla: vi.fn(),
    asistente: vi.fn(),
}));
// Parcial: el hook compartido de captura importa también las llamadas del administrador (API_ADMIN) y deben existir.
vi.mock('@/lib/api/biometria.js', async (importarOriginal) => ({ ...(await importarOriginal()), miRegistro: mocks.miRegistro }));
vi.mock('@/lib/http/autoservicio.js', () => ({
    aceptarAviso: mocks.aceptarAviso,
    revocarMiConsentimiento: mocks.revocarMiConsentimiento,
    verificarMisFotos: mocks.verificarMisFotos,
    registrarMiPlantilla: mocks.registrarMiPlantilla,
}));
// El asistente real necesita cámara: aquí solo importa con qué props se abre.
vi.mock('@/components/admin/alumnos/RegistroFacialGuiado', () => ({
    default: (props) => {
        mocks.asistente(props);
        return (
            <div role="dialog" aria-label="Asistente de captura">
                <button type="button" onClick={props.onClose}>Cerrar asistente</button>
            </div>
        );
    },
}));

import { VERSION_AVISO } from '@/lib/avisoBiometrico.js';
import MiRegistro from './MiRegistro.jsx';

const BASE = {
    id_alumno: 44, matricula: 'E20230045', nombre: 'Ana Pérez López', estatus: 'activo', hoy: '2026-10-07', ahora: '2026-10-07T09:12:41-06:00',
    puede_registrar: true, consentimiento: null, plantilla: null, completo: false, paso: 'consentimiento',
    vigencia_meses: 12, vigencia_prevista: '2027-10-07', registros_24h: 0, limite_registros_24h: 5,
};
const CONSENTIMIENTO = { id_consent: 9, fecha_firma: '2026-10-07', vigencia_hasta: '2027-10-07', dias_restantes: 365, origen: 'alumno', version_aviso: VERSION_AVISO };
const PLANTILLA = { id_plantilla: 41, id_consent: 9, fecha_registro: '2026-10-07T09:20:00-06:00', indexada: true, en_uso: true, n_fotos: 5, origen: 'alumno', consentimiento_vigente: true };
const EN_ROSTRO = { ...BASE, consentimiento: CONSENTIMIENTO, paso: 'rostro' };
const LISTO = { ...EN_ROSTRO, plantilla: PLANTILLA, completo: true, paso: 'listo' };

beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.miRegistro.mockResolvedValue(BASE);
    mocks.aceptarAviso.mockResolvedValue({ id_consent: 9, vigente: true });
    mocks.revocarMiConsentimiento.mockResolvedValue({ consentimientos_revocados: 1, plantillas_archivadas: 1 });
});

describe('MiRegistro: paso 1 (aviso y consentimiento)', () => {
    it('muestra el aviso completo, la versión y la declaración, con el primer paso como actual', async () => {
        render(<MiRegistro />);
        expect(await screen.findByRole('heading', { name: 'Aviso de privacidad y consentimiento para el registro facial' })).toBeInTheDocument();
        for (const titulo of ['Quién es responsable', 'Qué datos se tratan', 'Para qué se usan', 'Cómo se protegen', 'Tu consentimiento', 'Tus derechos']) {
            expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument();
        }
        expect(screen.getByText(`Versión del aviso: ${VERSION_AVISO}`)).toBeInTheDocument();
        expect(screen.getByText(/vale por 12 meses/)).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /He leído el aviso de privacidad/ })).not.toBeChecked();
        expect(screen.queryByRole('button', { name: 'Registrar mi rostro' })).not.toBeInTheDocument();
    });

    it('sin marcar la declaración no acepta y dice qué falta', async () => {
        render(<MiRegistro />);
        await userEvent.click(await screen.findByRole('button', { name: 'Aceptar y continuar' }));
        expect(await screen.findByText('Marca la declaración para continuar.')).toBeInTheDocument();
        expect(mocks.aceptarAviso).not.toHaveBeenCalled();
    });

    it('con la casilla marcada acepta la versión que se mostró y pasa al paso del rostro', async () => {
        render(<MiRegistro />);
        await userEvent.click(await screen.findByRole('checkbox', { name: /He leído el aviso/ }));
        mocks.miRegistro.mockResolvedValue(EN_ROSTRO);
        await userEvent.click(screen.getByRole('button', { name: 'Aceptar y continuar' }));
        expect(mocks.aceptarAviso).toHaveBeenCalledWith({ version: VERSION_AVISO });
        expect(await screen.findByRole('heading', { name: 'Registra tu rostro' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: /Aviso de privacidad/ })).not.toBeInTheDocument();
    });

    it('si el servidor rechaza la aceptación muestra su mensaje y sigue en el aviso', async () => {
        mocks.aceptarAviso.mockRejectedValue(Object.assign(new Error('El aviso de privacidad cambió. Recarga la página.'), { code: 'AVISO_DESACTUALIZADO' }));
        render(<MiRegistro />);
        await userEvent.click(await screen.findByRole('checkbox', { name: /He leído el aviso/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Aceptar y continuar' }));
        expect(await screen.findByText('El aviso de privacidad cambió. Recarga la página.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Aceptar y continuar' })).toBeEnabled();
    });
});

describe('MiRegistro: paso 2 (rostro)', () => {
    beforeEach(() => {
        mocks.miRegistro.mockResolvedValue(EN_ROSTRO);
    });

    it('explica que es con la cámara y abre el asistente en modo propio (sin subir archivos)', async () => {
        render(<MiRegistro />);
        expect(await screen.findByText(/No se pueden subir fotos/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Registrar mi rostro' }));
        const dialogo = await screen.findByRole('dialog', { name: 'Asistente de captura' });
        expect(dialogo).toBeInTheDocument();
        expect(mocks.asistente).toHaveBeenLastCalledWith(expect.objectContaining({ propio: true, nombreAlumno: 'Ana Pérez López' }));
    });

    it('al cerrar el asistente vuelve a leer el estado', async () => {
        render(<MiRegistro />);
        await userEvent.click(await screen.findByRole('button', { name: 'Registrar mi rostro' }));
        const antes = mocks.miRegistro.mock.calls.length;
        await userEvent.click(await screen.findByRole('button', { name: 'Cerrar asistente' }));
        await waitFor(() => expect(mocks.miRegistro.mock.calls.length).toBeGreaterThan(antes));
        expect(screen.queryByRole('dialog', { name: 'Asistente de captura' })).not.toBeInTheDocument();
    });

    it('con el cupo diario agotado lo avisa y no deja registrar', async () => {
        mocks.miRegistro.mockResolvedValue({ ...EN_ROSTRO, registros_24h: 5 });
        render(<MiRegistro />);
        expect(await screen.findByText('Llegaste al límite de hoy')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Registrar mi rostro' })).toBeDisabled();
    });

    it('muestra el consentimiento vigente con su vencimiento y quién lo dio de alta', async () => {
        render(<MiRegistro />);
        expect(await screen.findByText('Vigente hasta el 7 de octubre de 2027')).toBeInTheDocument();
        expect(screen.getByText(/Lo aceptaste en la app · Vence en 365 días/)).toBeInTheDocument();
    });
});

describe('MiRegistro: paso 3 (listo)', () => {
    beforeEach(() => {
        mocks.miRegistro.mockResolvedValue(LISTO);
    });

    it('confirma que el rostro está registrado y resume la plantilla', async () => {
        render(<MiRegistro />);
        expect(await screen.findByRole('heading', { name: 'Tu rostro está registrado' })).toBeInTheDocument();
        expect(screen.getByText('Todo listo')).toBeInTheDocument();
        expect(screen.getByText('Activo')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText(/Hoy te quedan 5 de 5 registros/)).toBeInTheDocument();
    });

    it('con la plantilla aún sin indexar dice que se está procesando y permite actualizar', async () => {
        mocks.miRegistro.mockResolvedValue({ ...LISTO, plantilla: { ...PLANTILLA, indexada: false, en_uso: false } });
        render(<MiRegistro />);
        expect(await screen.findByText('Se está procesando')).toBeInTheDocument();
        const antes = mocks.miRegistro.mock.calls.length;
        await userEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }));
        await waitFor(() => expect(mocks.miRegistro.mock.calls.length).toBeGreaterThan(antes));
    });

    it('permite volver a registrar el rostro (abre el asistente) mientras quede cupo', async () => {
        render(<MiRegistro />);
        await userEvent.click(await screen.findByRole('button', { name: 'Volver a registrar mi rostro' }));
        expect(await screen.findByRole('dialog', { name: 'Asistente de captura' })).toBeInTheDocument();
    });

    it('sin cupo no deja volver a registrar', async () => {
        mocks.miRegistro.mockResolvedValue({ ...LISTO, registros_24h: 5 });
        render(<MiRegistro />);
        expect(await screen.findByRole('button', { name: 'Volver a registrar mi rostro' })).toBeDisabled();
    });
});

describe('MiRegistro: revocar el consentimiento', () => {
    beforeEach(() => {
        mocks.miRegistro.mockResolvedValue(LISTO);
    });

    it('pide confirmación, explica las consecuencias y revoca', async () => {
        render(<MiRegistro />);
        await userEvent.click(await screen.findByRole('button', { name: 'Revocar consentimiento' }));
        const dialogo = await screen.findByRole('dialog');
        expect(within(dialogo).getByText(/tu docente tomará tu asistencia a mano/)).toBeInTheDocument();
        expect(mocks.revocarMiConsentimiento).not.toHaveBeenCalled();
        mocks.miRegistro.mockResolvedValue(BASE);
        await userEvent.click(within(dialogo).getByRole('button', { name: 'Revocar consentimiento' }));
        await waitFor(() => expect(mocks.revocarMiConsentimiento).toHaveBeenCalledTimes(1));
        expect(await screen.findByRole('heading', { name: /Aviso de privacidad/ })).toBeInTheDocument();
    });

    it('Cancelar no revoca nada', async () => {
        render(<MiRegistro />);
        await userEvent.click(await screen.findByRole('button', { name: 'Revocar consentimiento' }));
        await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
        expect(mocks.revocarMiConsentimiento).not.toHaveBeenCalled();
    });
});

describe('MiRegistro: casos límite', () => {
    it('un alumno que no está activo no puede registrarse y se le indica a dónde acudir', async () => {
        mocks.miRegistro.mockResolvedValue({ ...BASE, puede_registrar: false, estatus: 'baja_temporal' });
        render(<MiRegistro />);
        expect(await screen.findByText('Tu cuenta de alumno no está activa')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Aceptar y continuar' })).not.toBeInTheDocument();
    });

    it('si no carga el estado muestra el error con reintento', async () => {
        mocks.miRegistro.mockRejectedValue(Object.assign(new Error('No se pudo conectar.'), { code: 'ERROR_RED' }));
        render(<MiRegistro />);
        expect(await screen.findByText(/No se pudo conectar/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
    });

    it('el paso actual del progreso es el que indica el servidor', async () => {
        mocks.miRegistro.mockResolvedValue(EN_ROSTRO);
        render(<MiRegistro />);
        const progreso = await screen.findByRole('navigation', { name: 'Pasos del registro facial' });
        await act(async () => {});
        expect(within(progreso).getAllByRole('listitem').find((li) => li.getAttribute('aria-current') === 'step')).toHaveTextContent('Tu rostro');
    });
});
