// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/errors.js';
import ConsentimientoPanel from './ConsentimientoPanel.jsx';
import { describirVigencia, mapearErrorConsentimiento, resumenConsentimiento, validarConsentimiento, vigenciaSugerida } from './consentimiento.utils.js';

const mocks = vi.hoisted(() => ({
    ahora: vi.fn(),
    consentimientosAlumno: vi.fn(),
    registrarConsentimiento: vi.fn(),
    revocarConsentimiento: vi.fn(),
}));
vi.mock('@/lib/api/biometria.js', () => ({ consentimientosAlumno: mocks.consentimientosAlumno }));
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: mocks.ahora }));
vi.mock('@/lib/http/biometria.js', () => ({
    registrarConsentimiento: mocks.registrarConsentimiento,
    revocarConsentimiento: mocks.revocarConsentimiento,
    solicitarUrlDocumento: vi.fn(),
}));

const item = (extra) => ({ id_consent: 1, fecha_firma: '2026-08-01', vigencia_hasta: '2027-08-01', estatus: 'vigente', estatus_efectivo: 'vigente', vigente: true, dias_restantes: 100, plantillas_activas: 1, tiene_documento: true, ...extra });
const SIN = { vigente: false, consentimiento_vigente: null, total: 0, items: [] };
const VIGENTE = { vigente: true, consentimiento_vigente: { id_consent: 1, vigencia_hasta: '2027-08-01', dias_restantes: 100 }, total: 1, items: [item()] };

beforeEach(() => {
    mocks.ahora.mockReset().mockResolvedValue({ fecha: '2026-09-14' });
    mocks.consentimientosAlumno.mockReset();
    mocks.registrarConsentimiento.mockReset();
    mocks.revocarConsentimiento.mockReset();
});

describe('resumenConsentimiento', () => {
    it('vigente con días restantes y la fecha escrita en corto', () => {
        const r = resumenConsentimiento({ vigente: true, consentimiento_vigente: { id_consent: 1, vigencia_hasta: '2027-08-01', dias_restantes: 100 }, items: [item()] });
        expect(r).toMatchObject({ estado: 'vigente', tone: 'success', idConsent: 1 });
        expect(r.texto).toBe('Vigente hasta 1 ago 2027 (100 días)');
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

    it('rechaza una vigencia que ya terminó (la RPC también la rechaza)', () => {
        const e = validarConsentimiento({ fechaFirma: '2024-01-10', vigenciaHasta: '2025-01-10', documento: {} }, '2026-09-14');
        expect(e.vigenciaHasta).toMatch(/ya terminó/);
        expect(validarConsentimiento({ fechaFirma: '2026-09-14', vigenciaHasta: '2027-09-14', documento: {} }, '2026-09-14')).toEqual({});
    });
});

describe('vigencia calculada', () => {
    it('sugiere un año después de la firma', () => {
        expect(vigenciaSugerida('2026-08-01')).toBe('2027-08-01');
        expect(vigenciaSugerida('2024-02-29')).toBe('2025-02-28');
        expect(vigenciaSugerida('')).toBe('');
    });

    it('dice cuánto dura en años, meses o días', () => {
        expect(describirVigencia('2026-08-01', '2027-08-01')).toBe('1 año');
        expect(describirVigencia('2026-08-01', '2028-08-01')).toBe('2 años');
        expect(describirVigencia('2026-08-01', '2027-02-01')).toBe('6 meses');
        expect(describirVigencia('2026-08-01', '2026-09-01')).toBe('1 mes');
        expect(describirVigencia('2026-08-01', '2026-08-21')).toBe('20 días');
        expect(describirVigencia('2026-08-01', '2026-08-02')).toBe('1 día');
        expect(describirVigencia('2026-08-01', '2026-07-01')).toBe('');
        expect(describirVigencia('', '2026-07-01')).toBe('');
    });
});

describe('mapearErrorConsentimiento', () => {
    it('pega al campo los rechazos de fecha de la RPC y deja lo demás como general', () => {
        expect(mapearErrorConsentimiento({ code: 'VALIDACION', message: 'La fecha de firma no puede ser futura.' })).toEqual({ fechaFirma: 'La fecha de firma no puede ser futura.' });
        expect(Object.keys(mapearErrorConsentimiento({ code: 'VALIDACION', message: 'La vigencia debe ser posterior a la fecha de firma.' }))).toEqual(['vigenciaHasta']);
        expect(Object.keys(mapearErrorConsentimiento({ code: 'VALIDACION', message: 'La vigencia ya terminó.' }))).toEqual(['vigenciaHasta']);
        expect(mapearErrorConsentimiento({ code: 'ALUMNO_INACTIVO', message: 'El alumno no tiene estatus activo.' })).toBeNull();
        expect(mapearErrorConsentimiento(null)).toBeNull();
    });
});

describe('ConsentimientoPanel', () => {
    it('vigente: muestra estado, revocar y oculta el formulario', async () => {
        mocks.consentimientosAlumno.mockResolvedValue(VIGENTE);
        render(<ConsentimientoPanel idAlumno={1} />);
        expect(await screen.findByText(/Vigente hasta 1 ago 2027/)).toBeInTheDocument();
        expect(screen.getByText('Revocar')).toBeInTheDocument();
        expect(screen.queryByLabelText('Registrar consentimiento')).not.toBeInTheDocument();
        expect(screen.getByText('Ver documento firmado')).toBeInTheDocument();
    });

    it('el historial escribe las fechas en corto, no en ISO', async () => {
        mocks.consentimientosAlumno.mockResolvedValue(VIGENTE);
        render(<ConsentimientoPanel idAlumno={1} />);
        expect(await screen.findByText('Firmado 1 ago 2026 · vigente hasta 1 ago 2027')).toBeInTheDocument();
        expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument();
    });

    it('sin consentimiento: aviso de pase manual y formulario abierto', async () => {
        mocks.consentimientosAlumno.mockResolvedValue(SIN);
        render(<ConsentimientoPanel idAlumno={1} />);
        expect(await screen.findByText(/pase de lista manual/)).toBeInTheDocument();
        expect(screen.getByText('Sin consentimiento')).toBeInTheDocument();
        // el formulario espera un instante la fecha del plantel (api_ahora) antes de pintarse
        expect(await screen.findByRole('form', { name: 'Registrar consentimiento' })).toBeInTheDocument();
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

    it('un alumno en baja no puede registrar: se explica en lugar del formulario', async () => {
        mocks.consentimientosAlumno.mockResolvedValue(SIN);
        render(<ConsentimientoPanel idAlumno={1} alumnoActivo={false} />);
        expect(await screen.findByText(/Solo se registra el consentimiento de un alumno activo/)).toBeInTheDocument();
        expect(screen.queryByRole('form', { name: 'Registrar consentimiento' })).not.toBeInTheDocument();
    });

    it('la tarjeta se puede enlazar desde la ficha (#consentimiento)', async () => {
        mocks.consentimientosAlumno.mockResolvedValue(SIN);
        const { container } = render(<ConsentimientoPanel idAlumno={1} />);
        await screen.findByText('Sin consentimiento');
        expect(container.querySelector('#consentimiento')).toBeInTheDocument();
    });

    describe('formulario de registro', () => {
        const pdf = (nombre = 'consentimiento.pdf', bytes = 2048) => new File([new Uint8Array(bytes)], nombre, { type: 'application/pdf' });
        const abrir = async () => {
            mocks.consentimientosAlumno.mockResolvedValue(SIN);
            render(
                <ToastProvider>
                    <ConsentimientoPanel idAlumno={7} />
                </ToastProvider>,
            );
            return screen.findByRole('form', { name: 'Registrar consentimiento' });
        };

        it('etiqueta el documento con su campo, muestra las reglas y ofrece las dos fechas con atajos', async () => {
            const formulario = await abrir();
            const entrada = within(formulario).getByLabelText(/Documento firmado/);
            expect(entrada).toHaveAttribute('type', 'file');
            expect(within(formulario).getByText('PDF. Máximo 10 MB.')).toBeInTheDocument();
            expect(within(formulario).getByLabelText(/Fecha de firma/)).toHaveAttribute('max', '2026-09-14');
            expect(within(formulario).getByRole('button', { name: 'Hoy' })).toBeInTheDocument();
            // sin fecha de firma no hay vigencia que sumar: los atajos «+1 año» se ocultan en vez de quedar sin efecto
            expect(within(formulario).queryByRole('button', { name: '+1 año' })).not.toBeInTheDocument();
        });

        it('«Hoy» fija la firma, sugiere un año de vigencia y lo dice en palabras', async () => {
            const user = userEvent.setup();
            const formulario = await abrir();
            await user.click(within(formulario).getByRole('button', { name: 'Hoy' }));
            expect(within(formulario).getByLabelText(/Fecha de firma/)).toHaveValue('2026-09-14');
            expect(within(formulario).getByLabelText(/Vigente hasta/)).toHaveValue('2027-09-14');
            expect(within(formulario).getByText(/Sugerida: 1 año desde la firma/)).toBeInTheDocument();
            expect(within(formulario).getByText('lunes, 14 de septiembre de 2026')).toBeInTheDocument();
            expect(within(formulario).getByText('martes, 14 de septiembre de 2027')).toBeInTheDocument();
        });

        it('«+2 años» cambia la vigencia y la describe como calculada a mano', async () => {
            const user = userEvent.setup();
            const formulario = await abrir();
            await user.click(within(formulario).getByRole('button', { name: 'Hoy' }));
            await user.click(within(formulario).getByRole('button', { name: '+2 años' }));
            expect(within(formulario).getByLabelText(/Vigente hasta/)).toHaveValue('2028-09-14');
            expect(within(formulario).getByText('Vigencia de 2 años.')).toBeInTheDocument();
            // cambiar la firma después ya no pisa una vigencia elegida a mano
            fireEvent.change(within(formulario).getByLabelText(/Fecha de firma/), { target: { value: '2026-09-01' } });
            expect(within(formulario).getByLabelText(/Vigente hasta/)).toHaveValue('2028-09-14');
        });

        it('sin datos muestra los tres errores y enfoca el primero; no llama a la ruta', async () => {
            const user = userEvent.setup();
            const formulario = await abrir();
            await user.click(within(formulario).getByRole('button', { name: 'Registrar consentimiento' }));
            expect(await screen.findByText('Indica la fecha de firma.')).toBeInTheDocument();
            expect(screen.getByText('Indica hasta cuándo es vigente.')).toBeInTheDocument();
            expect(screen.getByText('Adjunta el PDF firmado.')).toBeInTheDocument();
            expect(within(formulario).getByLabelText(/Fecha de firma/)).toHaveFocus();
            expect(mocks.registrarConsentimiento).not.toHaveBeenCalled();
        });

        it('un archivo que no es PDF se rechaza al elegirlo y no queda seleccionado', async () => {
            const formulario = await abrir();
            const entrada = within(formulario).getByLabelText(/Documento firmado/);
            fireEvent.change(entrada, { target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] } });
            expect(await within(formulario).findByRole('alert')).toHaveTextContent('Tipo de archivo no permitido.');
            expect(within(formulario).getByText('PDF. Máximo 10 MB.')).toBeInTheDocument();
            expect(within(formulario).queryByText('foto.png')).not.toBeInTheDocument();
        });

        it('registra con los campos de la ruta, muestra el estado de carga y el resultado con el siguiente paso', async () => {
            let resolver;
            mocks.registrarConsentimiento.mockImplementation(() => new Promise((r) => { resolver = r; }));
            const user = userEvent.setup();
            const formulario = await abrir();
            await user.click(within(formulario).getByRole('button', { name: 'Hoy' }));
            await user.upload(within(formulario).getByLabelText(/Documento firmado/), pdf());
            expect(within(formulario).getByText('consentimiento.pdf')).toBeInTheDocument();
            await user.click(within(formulario).getByRole('button', { name: 'Registrar consentimiento' }));

            await waitFor(() => expect(mocks.registrarConsentimiento).toHaveBeenCalledTimes(1));
            const datos = mocks.registrarConsentimiento.mock.calls[0][0];
            expect(datos.get('id_alumno')).toBe('7');
            expect(datos.get('fecha_firma')).toBe('2026-09-14');
            expect(datos.get('vigencia_hasta')).toBe('2027-09-14');
            expect(datos.get('documento').name).toBe('consentimiento.pdf');
            // mientras sube: texto de estado y el campo bloqueado
            expect(within(formulario).getByText(/Subiendo el documento/)).toBeInTheDocument();
            expect(within(formulario).getByLabelText(/Documento firmado/)).toBeDisabled();

            mocks.consentimientosAlumno.mockResolvedValue({ ...VIGENTE, consentimiento_vigente: { id_consent: 2, vigencia_hasta: '2027-09-14', dias_restantes: 365 } });
            resolver({ id_consent: 2, vigencia_hasta: '2027-09-14' });
            expect(await screen.findByText('Consentimiento registrado')).toBeInTheDocument();
            expect(screen.getByText(/Vigente hasta 14 sep 2027/, { selector: 'div' })).toBeInTheDocument();
            expect(screen.getByRole('link', { name: 'registrar la plantilla facial' })).toHaveAttribute('href', '#plantilla');
            expect(screen.queryByRole('form', { name: 'Registrar consentimiento' })).not.toBeInTheDocument();
        });

        it('si el servidor rechaza una fecha, el error queda en su campo y lo capturado se conserva', async () => {
            mocks.registrarConsentimiento.mockRejectedValue(new ApiError({ code: 'VALIDACION', message: 'La fecha de firma no puede ser futura.', status: 422 }));
            const user = userEvent.setup();
            const formulario = await abrir();
            await user.click(within(formulario).getByRole('button', { name: 'Hoy' }));
            await user.upload(within(formulario).getByLabelText(/Documento firmado/), pdf());
            await user.click(within(formulario).getByRole('button', { name: 'Registrar consentimiento' }));
            expect(await within(formulario).findByText('La fecha de firma no puede ser futura.')).toBeInTheDocument();
            expect(within(formulario).getByLabelText(/Fecha de firma/)).toHaveAttribute('aria-invalid', 'true');
            expect(within(formulario).getByText('consentimiento.pdf')).toBeInTheDocument();
        });

        it('un error general (alumno inactivo, red…) se muestra junto a los botones', async () => {
            mocks.registrarConsentimiento.mockRejectedValue(new ApiError({ code: 'ALUMNO_INACTIVO', message: 'El alumno no tiene estatus activo.', status: 409 }));
            const user = userEvent.setup();
            const formulario = await abrir();
            await user.click(within(formulario).getByRole('button', { name: 'Hoy' }));
            await user.upload(within(formulario).getByLabelText(/Documento firmado/), pdf());
            await user.click(within(formulario).getByRole('button', { name: 'Registrar consentimiento' }));
            expect(await within(formulario).findByText('No se pudo registrar el consentimiento')).toBeInTheDocument();
            expect(within(formulario).getByText('El alumno no tiene estatus activo.')).toBeInTheDocument();
        });
    });

    describe('revocar', () => {
        const revocar = async (respuesta) => {
            mocks.consentimientosAlumno.mockResolvedValue(VIGENTE);
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
