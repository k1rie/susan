// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/errors.js';
import DetalleAlumno from './DetalleAlumno.jsx';

const mocks = vi.hoisted(() => ({
    alumnoObtener: vi.fn(),
    alumnoGuardar: vi.fn(),
    alumnoCambiarEstatus: vi.fn(),
    usuariosListar: vi.fn(),
    consentimientosAlumno: vi.fn(),
    ahora: vi.fn(),
}));
vi.mock('@/lib/api/admin.js', () => ({
    alumnoObtener: mocks.alumnoObtener,
    alumnoGuardar: mocks.alumnoGuardar,
    alumnoCambiarEstatus: mocks.alumnoCambiarEstatus,
    usuariosListar: mocks.usuariosListar,
}));
vi.mock('@/lib/api/biometria.js', () => ({ consentimientosAlumno: mocks.consentimientosAlumno }));
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: mocks.ahora }));
vi.mock('@/lib/http/biometria.js', () => ({ registrarConsentimiento: vi.fn(), revocarConsentimiento: vi.fn(), solicitarUrlDocumento: vi.fn() }));
vi.mock('@/lib/http/admin.js', () => ({ crearUsuario: vi.fn() }));
// El panel de la plantilla facial es de otro frente: aquí solo importa que reciba el nombre del alumno.
vi.mock('../PlantillaFacialPanel', () => ({ default: () => <div data-testid="panel-plantilla">Plantilla</div> }));

const FICHA = {
    id_alumno: 5,
    matricula: 'E260005',
    apellido_paterno: 'Soto',
    apellido_materno: 'Mena',
    nombres: 'Carla',
    nombre_completo: 'Soto Mena Carla',
    correo_institucional: 'e260005@dominio.mx',
    estatus: 'activo',
    consentimiento_vigente: true,
    plantilla: null,
    inscripciones: [
        { id_inscripcion: 1, id_grupo: 3, clave_grupo: '3A', periodo: '2026-2', materia_clave: 'ADM101', estatus: 'activa' },
        { id_inscripcion: 2, id_grupo: 4, clave_grupo: '3B', periodo: '2026-1', materia_clave: 'MAT102', estatus: 'baja' },
    ],
};

const montar = () => render(<ToastProvider><DetalleAlumno idAlumno={5} /></ToastProvider>);

beforeEach(() => {
    mocks.alumnoObtener.mockReset().mockResolvedValue(FICHA);
    mocks.alumnoGuardar.mockReset().mockResolvedValue({ id_alumno: 5 });
    mocks.alumnoCambiarEstatus.mockReset().mockResolvedValue({ id_alumno: 5, estatus: 'baja_temporal', cambio: true, inscripciones_dadas_de_baja: 1 });
    mocks.usuariosListar.mockReset().mockResolvedValue({ total: 0, items: [] });
    mocks.consentimientosAlumno.mockReset().mockResolvedValue({ vigente: false, consentimiento_vigente: null, total: 0, items: [] });
    mocks.ahora.mockReset().mockResolvedValue({ fecha: '2026-09-14' });
});

describe('DetalleAlumno: estructura de la ficha', () => {
    it('muestra qué falta de un vistazo y cada elemento enlaza a su tarjeta', async () => {
        montar();
        const resumen = await screen.findByRole('navigation', { name: 'Estado de la ficha' });
        // plantilla y cuenta faltan; el consentimiento de la ficha está vigente
        await waitFor(() => expect(within(resumen).getAllByText('Pendiente')).toHaveLength(2));
        const enlaces = within(resumen).getAllByRole('link').map((a) => a.getAttribute('href'));
        expect(enlaces).toEqual(['#consentimiento', '#plantilla', '#cuenta', '#inscripciones']);
        for (const id of ['datos', 'consentimiento', 'plantilla', 'cuenta', 'inscripciones']) {
            expect(document.getElementById(id)).toBeInTheDocument();
        }
        expect(within(resumen).getByText('1 activa')).toBeInTheDocument();
    });

    it('si la URL trae un ancla (los enlaces del alta), salta a esa tarjeta en cuanto la ficha carga', async () => {
        const saltar = vi.fn();
        const original = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function scrollIntoView() {
            saltar(this.id);
        };
        window.location.hash = '#consentimiento';
        try {
            montar();
            await screen.findByRole('navigation', { name: 'Estado de la ficha' });
            await waitFor(() => expect(saltar).toHaveBeenCalledWith('consentimiento'));
        } finally {
            Element.prototype.scrollIntoView = original;
            window.location.hash = '';
        }
    });

    it('lista las inscripciones con enlace al grupo y su estatus en texto', async () => {
        montar();
        const tarjeta = (await screen.findByRole('heading', { name: 'Inscripciones' })).closest('section');
        expect(within(tarjeta).getByRole('link', { name: 'ADM101 · grupo 3A · 2026-2' })).toHaveAttribute('href', '/admin/grupos/3');
        expect(within(tarjeta).getByText('Activa')).toBeInTheDocument();
        expect(within(tarjeta).getByText('Baja')).toBeInTheDocument();
    });

    it('un alumno sin inscripciones dice cómo inscribirlo', async () => {
        mocks.alumnoObtener.mockResolvedValue({ ...FICHA, inscripciones: [] });
        montar();
        expect(await screen.findByText(/Aún no está inscrito en ningún grupo/)).toBeInTheDocument();
    });

    it('muestra y ofrece la cuenta de acceso desde la ficha', async () => {
        montar();
        expect(await screen.findByRole('button', { name: 'Crear cuenta de acceso' })).toBeEnabled();
        expect(screen.getByText('Sin cuenta')).toBeInTheDocument();
    });
});

describe('DetalleAlumno: guardar', () => {
    it('si solo cambian los datos, llama solo a api_alumno_guardar', async () => {
        const user = userEvent.setup();
        montar();
        await user.type(await screen.findByLabelText(/Nombres/), 'ita');
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        await waitFor(() => expect(mocks.alumnoGuardar).toHaveBeenCalledTimes(1));
        expect(mocks.alumnoGuardar).toHaveBeenCalledWith({
            datos: { id_alumno: 5, matricula: 'E260005', apellido_paterno: 'Soto', apellido_materno: 'Mena', nombres: 'Carlaita', correo_institucional: 'e260005@dominio.mx' },
        });
        expect(mocks.alumnoCambiarEstatus).not.toHaveBeenCalled();
        expect(await screen.findByText('Datos guardados')).toBeInTheDocument();
    });

    it('un DUPLICADO se pega a la matrícula, sin toast de error genérico', async () => {
        mocks.alumnoGuardar.mockRejectedValue(new ApiError({ code: 'DUPLICADO', message: 'Ya existe un alumno con la matrícula E260001.', status: 409 }));
        const user = userEvent.setup();
        montar();
        const matricula = await screen.findByLabelText(/Matrícula/);
        await user.clear(matricula);
        await user.type(matricula, 'E260001');
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(await screen.findByText('Esta matrícula ya está registrada.')).toBeInTheDocument();
        expect(screen.getByLabelText(/Matrícula/)).toHaveFocus();
        expect(screen.queryByText('No se pudo guardar')).not.toBeInTheDocument();
    });
});

describe('DetalleAlumno: baja con confirmación única', () => {
    it('desde el formulario: confirma con el número real de inscripciones y recién entonces llama a la RPC', async () => {
        const user = userEvent.setup();
        montar();
        await user.click(await screen.findByRole('radio', { name: 'Baja temporal' }));
        expect(screen.getByText(/Al guardar, se darán de baja sus 1 inscripción activa/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        const dialogo = await screen.findByRole('dialog');
        expect(within(dialogo).getByText('¿Dar de baja temporal a Soto Mena Carla?')).toBeInTheDocument();
        expect(within(dialogo).getByText(/Se darán de baja sus 1 inscripción activa/)).toBeInTheDocument();
        expect(mocks.alumnoCambiarEstatus).not.toHaveBeenCalled();
        await user.click(within(dialogo).getByRole('button', { name: 'Dar de baja temporal' }));
        await waitFor(() => expect(mocks.alumnoCambiarEstatus).toHaveBeenCalledWith({ idAlumno: 5, estatus: 'baja_temporal' }));
        expect(mocks.alumnoGuardar).not.toHaveBeenCalled();
        expect(await screen.findByText('Estatus: Baja temporal')).toBeInTheDocument();
        expect(screen.getByText(/1 inscripción\(es\) dadas de baja/)).toBeInTheDocument();
    });

    it('cancelar la confirmación no cambia nada y el formulario conserva el cambio sin guardar', async () => {
        const user = userEvent.setup();
        montar();
        await user.click(await screen.findByRole('radio', { name: 'Egresado' }));
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        const dialogo = await screen.findByRole('dialog');
        expect(within(dialogo).getByText('¿Marcar a Soto Mena Carla como egresado?')).toBeInTheDocument();
        await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(mocks.alumnoCambiarEstatus).not.toHaveBeenCalled();
        expect(mocks.alumnoGuardar).not.toHaveBeenCalled();
        expect(screen.getByText(/cambio sin guardar/)).toBeInTheDocument();
    });

    it('«Dar de baja» del encabezado usa el mismo diálogo', async () => {
        const user = userEvent.setup();
        montar();
        await user.click(await screen.findByRole('button', { name: 'Dar de baja' }));
        const dialogo = await screen.findByRole('dialog');
        expect(within(dialogo).getByText('¿Dar de baja definitiva a Soto Mena Carla?')).toBeInTheDocument();
        await user.click(within(dialogo).getByRole('button', { name: 'Dar de baja' }));
        await waitFor(() => expect(mocks.alumnoCambiarEstatus).toHaveBeenCalledWith({ idAlumno: 5, estatus: 'baja_definitiva' }));
        expect(await screen.findByText('Alumno dado de baja')).toBeInTheDocument();
    });

    it('si se guardaron los datos pero falla el estatus, lo dice y no habla de «no se pudo guardar»', async () => {
        mocks.alumnoCambiarEstatus.mockRejectedValue(new ApiError({ code: 'ERROR_RED', message: 'No se pudo conectar con el servidor.', status: 503 }));
        const user = userEvent.setup();
        montar();
        await user.type(await screen.findByLabelText(/Nombres/), 'ita');
        await user.click(screen.getByRole('radio', { name: 'Baja temporal' }));
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        await user.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Dar de baja temporal' }));
        expect(await screen.findByText('Se guardaron los datos, pero no el estatus')).toBeInTheDocument();
        expect(screen.getByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
        expect(mocks.alumnoGuardar).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('No se pudo guardar')).not.toBeInTheDocument();
    });

    it('un alumno en baja se reactiva desde el encabezado, sin confirmación, avisando que no se restituyen las inscripciones', async () => {
        mocks.alumnoObtener.mockResolvedValue({ ...FICHA, estatus: 'baja_temporal' });
        mocks.alumnoCambiarEstatus.mockResolvedValue({ id_alumno: 5, estatus: 'activo', cambio: true, inscripciones_dadas_de_baja: 0 });
        const user = userEvent.setup();
        montar();
        await user.click(await screen.findByRole('button', { name: 'Reactivar' }));
        await waitFor(() => expect(mocks.alumnoCambiarEstatus).toHaveBeenCalledWith({ idAlumno: 5, estatus: 'activo' }));
        expect(await screen.findByText('Alumno reactivado')).toBeInTheDocument();
        expect(screen.getByText(/no se restituyen/)).toBeInTheDocument();
    });
});
