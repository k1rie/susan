// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import RegistroManualDialog from './RegistroManualDialog.jsx';

const api = vi.hoisted(() => ({ registrarManual: vi.fn() }));
vi.mock('@/lib/api/sesiones.js', () => api);

// Minuto 15 con límite de presente 10 y tolerancia 20: la sugerencia es «retardo».
const sesion = { id_sesion: 19, minuto_actual: 15, limite_presente_min: 10, tolerancia_min: 20 };
const alumno = (id, nombre, extra = {}) => ({ id_alumno: id, nombre, matricula: `E26000${id}`, inscripcion: 'activa', estado: null, origen: null, lecturas_validas: 0, consentimiento_vigente: true, ...extra });
const ALUMNOS = [
    alumno(1, 'Ana Pérez'),
    alumno(2, 'Beto Núñez', { consentimiento_vigente: false }),
    // ya tiene lecturas válidas con consentimiento vigente: no se ofrece
    alumno(3, 'Carla Ruiz', { lecturas_validas: 3, estado: 'presente', origen: 'automatico' }),
];

const montar = (props = {}) => {
    const alCerrar = vi.fn();
    const alGuardar = vi.fn();
    render(<RegistroManualDialog open sesion={sesion} alumnos={ALUMNOS} onClose={alCerrar} onGuardado={alGuardar} {...props} />);
    return { alCerrar, alGuardar };
};

const elegirAlumno = async (usuario, escrito, nombre) => {
    await usuario.click(screen.getByRole('combobox', { name: /Alumno/ }));
    if (escrito) await usuario.type(screen.getByRole('combobox', { name: /Alumno/ }), escrito);
    await usuario.click(await screen.findByRole('option', { name: new RegExp(nombre) }));
};

beforeEach(() => {
    api.registrarManual.mockReset().mockResolvedValue({ id_asistencia: 1 });
});

describe('RegistroManualDialog', () => {
    it('elige al alumno con búsqueda (dos líneas: nombre y matrícula con el motivo) y solo ofrece a quien lo necesita', async () => {
        const usuario = userEvent.setup();
        montar();
        await usuario.click(screen.getByRole('combobox', { name: /Alumno/ }));
        const opciones = screen.getAllByRole('option');
        expect(opciones).toHaveLength(2);
        expect(opciones[0]).toHaveTextContent('Ana Pérez');
        expect(opciones[0]).toHaveTextContent('E260001 · Sin lecturas válidas');
        expect(opciones[1]).toHaveTextContent('E260002 · Sin consentimiento vigente');
        expect(screen.getByText(/2 alumnos pueden registrarse a mano/)).toBeInTheDocument();
        await usuario.type(screen.getByRole('combobox', { name: /Alumno/ }), 'nunez');
        expect(screen.getAllByRole('option')).toHaveLength(1);
    });

    it('el estado va en un segmentado con la sugerencia según la hora (con tilde) ya elegida', () => {
        montar();
        const grupo = screen.getByRole('radiogroup');
        expect(within(grupo).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Presente', 'Retardo', 'Ausente']);
        expect(within(grupo).getByRole('radio', { name: 'Retardo' })).toBeChecked();
        expect(screen.getByText('Sugerido según la hora: Retardo.')).toBeInTheDocument();
        expect(screen.queryByText(/segun/)).toBeNull();
    });

    it('«Guardar» registra con el estado elegido, avisa y cierra', async () => {
        const usuario = userEvent.setup();
        const { alCerrar, alGuardar } = montar();
        await elegirAlumno(usuario, '', 'Beto');
        await usuario.click(screen.getByRole('radio', { name: 'Ausente' }));
        await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
        await waitFor(() => expect(api.registrarManual).toHaveBeenCalledWith({ idSesion: 19, idAlumno: 2, estado: 'ausente' }));
        expect(alGuardar).toHaveBeenCalledTimes(1);
        expect(alCerrar).toHaveBeenCalledTimes(1);
    });

    it('sin elegir alumno no llama al servidor y marca el campo con su mensaje', async () => {
        const usuario = userEvent.setup();
        montar();
        await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
        expect(await screen.findByText('Elige al alumno que quieres registrar.')).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /Alumno/ })).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('combobox', { name: /Alumno/ })).toHaveFocus();
        expect(api.registrarManual).not.toHaveBeenCalled();
    });

    it('«Guardar y registrar otro» deja el diálogo abierto, limpia la elección y no vuelve a ofrecer al registrado', async () => {
        const usuario = userEvent.setup();
        const { alCerrar, alGuardar } = montar();
        await elegirAlumno(usuario, '', 'Ana');
        await usuario.click(screen.getByRole('radio', { name: 'Presente' }));
        await usuario.click(screen.getByRole('button', { name: 'Guardar y registrar otro' }));
        await waitFor(() => expect(api.registrarManual).toHaveBeenCalledWith({ idSesion: 19, idAlumno: 1, estado: 'presente' }));
        expect(await screen.findByText(/Registrado:/)).toHaveTextContent('Registrado: Ana Pérez como Presente.');
        expect(alGuardar).toHaveBeenCalledTimes(1);
        expect(alCerrar).not.toHaveBeenCalled();
        expect(screen.getByRole('combobox', { name: /Alumno/ })).toHaveValue('');
        expect(screen.getByRole('combobox', { name: /Alumno/ })).toHaveFocus();
        // El estado vuelve a la sugerencia para el siguiente alumno.
        expect(screen.getByRole('radio', { name: 'Retardo' })).toBeChecked();
        await usuario.click(screen.getByRole('combobox', { name: /Alumno/ }));
        expect(screen.getAllByRole('option')).toHaveLength(1);
        expect(screen.getByRole('option')).toHaveTextContent('Beto Núñez');
    });

    it('al registrar al último deja de ofrecer el formulario y solo queda «Cerrar»', async () => {
        const usuario = userEvent.setup();
        montar({ alumnos: [alumno(1, 'Ana Pérez')] });
        await elegirAlumno(usuario, '', 'Ana');
        await usuario.click(screen.getByRole('button', { name: 'Guardar y registrar otro' }));
        expect(await screen.findByText('Ya no quedan alumnos por registrar a mano.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Guardar y registrar otro' })).toBeNull();
        // «Cerrar» del pie y la X de la esquina.
        expect(screen.getAllByRole('button', { name: 'Cerrar' })).toHaveLength(2);
    });

    it('si el servidor rechaza, el error queda dentro del diálogo y se conserva lo elegido', async () => {
        const usuario = userEvent.setup();
        api.registrarManual.mockRejectedValue(new ApiError({ code: 'SESION_NO_ABIERTA', message: 'La sesión ya no está abierta.', status: 409 }));
        const { alCerrar } = montar();
        await elegirAlumno(usuario, '', 'Ana');
        await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
        expect(await screen.findByText('La sesión ya no está abierta.')).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /Alumno/ })).toHaveValue('Ana Pérez');
        expect(alCerrar).not.toHaveBeenCalled();
    });

    it('con un alumno fijo (desde la fila de la tabla) muestra su ficha y no ofrece «registrar otro»', async () => {
        const usuario = userEvent.setup();
        const { alCerrar } = montar({ alumno: ALUMNOS[0] });
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
        expect(screen.getByText('E260001 · Sin lecturas válidas')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Guardar y registrar otro' })).toBeNull();
        await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
        await waitFor(() => expect(api.registrarManual).toHaveBeenCalledWith({ idSesion: 19, idAlumno: 1, estado: 'retardo' }));
        expect(alCerrar).toHaveBeenCalled();
    });

    it('sin alumnos por registrar lo explica y no pinta el formulario', () => {
        montar({ alumnos: [ALUMNOS[2]] });
        expect(screen.getByText('Todos los alumnos ya tienen lecturas válidas con consentimiento vigente.')).toBeInTheDocument();
        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(screen.getAllByRole('button', { name: 'Cerrar' })).toHaveLength(2);
        expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    });
});
