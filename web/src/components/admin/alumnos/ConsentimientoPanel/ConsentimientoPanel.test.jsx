// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/errors.js';
import ConsentimientoPanel from './ConsentimientoPanel.jsx';
import { resumenConsentimiento, validarConsentimiento } from './consentimiento.utils.js';

const mocks = vi.hoisted(() => ({ consentimientosAlumno: vi.fn(), revocarConsentimiento: vi.fn() }));
vi.mock('@/lib/api/biometria.js', () => ({ consentimientosAlumno: mocks.consentimientosAlumno }));
vi.mock('@/lib/http/biometria.js', () => ({
    registrarConsentimiento: vi.fn(),
    revocarConsentimiento: mocks.revocarConsentimiento,
    solicitarUrlDocumento: vi.fn(),
}));

const item = (extra) => ({ id_consent: 1, fecha_firma: '2026-08-01', vigencia_hasta: '2027-08-01', estatus: 'vigente', estatus_efectivo: 'vigente', vigente: true, dias_restantes: 100, plantillas_activas: 1, tiene_documento: true, ...extra });

describe('resumenConsentimiento', () => {
    it('vigente con días restantes', () => {
        const r = resumenConsentimiento({ vigente: true, consentimiento_vigente: { id_consent: 1, vigencia_hasta: '2027-08-01', dias_restantes: 100 }, items: [item()] });
        expect(r).toMatchObject({ estado: 'vigente', tone: 'success', idConsent: 1 });
        expect(r.texto).toBe('Vigente hasta 2027-08-01 (100 días)');
    });
    it('vencido, revocado y sin consentimiento', () => {
        expect(resumenConsentimiento({ vigente: false, items: [item({ estatus_efectivo: 'vencido', vigente: false })] }).estado).toBe('vencido');
        expect(resumenConsentimiento({ vigente: false, items: [item({ estatus: 'revocado', estatus_efectivo: 'revocado', vigente: false })] }).texto).toBe('Revocado');
        expect(resumenConsentimiento({ vigente: false, items: [] }).estado).toBe('sin');
    });
});

describe('validarConsentimiento', () => {
    it('exige fechas coherentes y documento', () => {
        expect(Object.keys(validarConsentimiento({ fechaFirma: '', vigenciaHasta: '', documento: null }))).toHaveLength(3);
        const e = validarConsentimiento({ fechaFirma: '2026-09-01', vigenciaHasta: '2026-08-01', documento: {} }, '2026-09-14');
        expect(e.vigenciaHasta).toMatch(/posterior/);
        expect(validarConsentimiento({ fechaFirma: '2026-09-20', vigenciaHasta: '2027-09-20', documento: {} }, '2026-09-14').fechaFirma).toMatch(/futura/);
    });
});

describe('ConsentimientoPanel', () => {

    it('vigente: muestra estado, revocar y oculta el formulario', async () => {
        mocks.consentimientosAlumno.mockResolvedValue({ vigente: true, consentimiento_vigente: { id_consent: 1, vigencia_hasta: '2027-08-01', dias_restantes: 100 }, total: 1, items: [item()] });
        render(<ConsentimientoPanel idAlumno={1} />);
        expect(await screen.findByText(/Vigente hasta 2027-08-01/)).toBeInTheDocument();
        expect(screen.getByText('Revocar')).toBeInTheDocument();
        expect(screen.queryByLabelText('Registrar consentimiento')).not.toBeInTheDocument();
        expect(screen.getByText('Ver documento firmado')).toBeInTheDocument();
    });

    it('sin consentimiento: aviso de pase manual y formulario abierto', async () => {
        mocks.consentimientosAlumno.mockResolvedValue({ vigente: false, consentimiento_vigente: null, total: 0, items: [] });
        render(<ConsentimientoPanel idAlumno={1} />);
        expect(await screen.findByText(/pase de lista manual/)).toBeInTheDocument();
        expect(screen.getByText('Sin consentimiento')).toBeInTheDocument();
        expect(screen.getByRole('form', { name: 'Registrar consentimiento' })).toBeInTheDocument();
        expect(screen.getByText(/aún no tiene consentimientos/)).toBeInTheDocument();
    });

    it('vencido: muestra Vencido y formulario', async () => {
        mocks.consentimientosAlumno.mockResolvedValue({ vigente: false, consentimiento_vigente: null, total: 1, items: [item({ estatus_efectivo: 'vencido', vigente: false })] });
        render(<ConsentimientoPanel idAlumno={1} />);
        expect(await screen.findByText('Vencido', { selector: 'span' })).toBeInTheDocument();
        expect(screen.queryByText('Revocar')).not.toBeInTheDocument();
    });

    it('error de carga ofrece reintento', async () => {
        mocks.consentimientosAlumno.mockImplementation(async () => {
            throw new ApiError({ code: 'ERROR_INTERNO', message: 'caído' });
        });
        render(<ConsentimientoPanel idAlumno={1} />);
        expect(await screen.findByText('Reintentar')).toBeInTheDocument();
    });

    describe('revocar', () => {
        const revocar = async (respuesta) => {
            mocks.consentimientosAlumno.mockResolvedValue({ vigente: true, consentimiento_vigente: { id_consent: 1, vigencia_hasta: '2027-08-01', dias_restantes: 100 }, total: 1, items: [item()] });
            mocks.revocarConsentimiento.mockResolvedValue(respuesta);
            render(
                <ToastProvider>
                    <ConsentimientoPanel idAlumno={1} />
                </ToastProvider>,
            );
            fireEvent.click(await screen.findByRole('button', { name: 'Revocar' }));
            const dialogo = await screen.findByRole('dialog');
            fireEvent.click(within(dialogo).getByRole('button', { name: 'Revocar' }));
        };

        it('con el índice reconstruido avisa que la plantilla se archivó', async () => {
            await revocar({ requiere_reconstruccion: true, indice: { estado: 'activada', version: 'v005' } });
            expect(await screen.findByText('La plantilla ligada se archivó.')).toBeInTheDocument();
            expect(screen.queryByText(/conserva el vector/)).not.toBeInTheDocument();
        });

        it('con el índice pendiente avisa que el vector sigue en el índice hasta reconstruirlo', async () => {
            await revocar({ requiere_reconstruccion: true, indice: { estado: 'pendiente', version: null, error: { code: 'INDICE_CONSTRUCCION_FALLIDA' } } });
            expect(await screen.findByText('El índice facial conserva el vector hasta que se reconstruya; pide a un técnico que lo reconstruya.')).toBeInTheDocument();
            expect(screen.queryByText('La plantilla ligada se archivó.')).not.toBeInTheDocument();
        });
    });
});
