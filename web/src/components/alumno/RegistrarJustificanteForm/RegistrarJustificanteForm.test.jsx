// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegistrarJustificanteForm, { FormularioJustificante } from './RegistrarJustificanteForm.jsx';
import {
    MAX_BYTES,
    MOTIVO_MAX,
    datosFalta,
    pendientesDeCaptura,
    primerCampoConError,
    sesionInicial,
    textoPendientes,
    validarFormulario,
} from './registrarJustificante.utils.js';

const subir = vi.hoisted(() => vi.fn());
const registrar = vi.hoisted(() => vi.fn());
const justificables = vi.hoisted(() => vi.fn());
vi.mock('@/lib/http', () => ({ subirDocumentoJustificante: subir }));
vi.mock('@/lib/api/revision.js', () => ({ registrarJustificante: registrar, misJustificables: (...a) => justificables(...a) }));

const archivo = (nombre, tipo, bytes = 10) => {
    const f = new File(['x'], nombre, { type: tipo });
    Object.defineProperty(f, 'size', { value: bytes });
    return f;
};

beforeEach(() => {
    subir.mockReset();
    registrar.mockReset();
    justificables.mockReset();
});

describe('validarFormulario', () => {
    const ok = { idSesion: 3, motivo: 'Cita médica', archivo: archivo('a.pdf', 'application/pdf') };
    it('acepta datos válidos', () => expect(validarFormulario(ok)).toEqual({}));
    it('exige sesión, motivo y documento', () => {
        const e = validarFormulario({ idSesion: null, motivo: '   ', archivo: null });
        expect(Object.keys(e).sort()).toEqual(['archivo', 'idSesion', 'motivo']);
    });
    it('motivo de 201 caracteres es inválido y 200 es válido', () => {
        expect(validarFormulario({ ...ok, motivo: 'a'.repeat(MOTIVO_MAX) })).toEqual({});
        expect(validarFormulario({ ...ok, motivo: 'a'.repeat(MOTIVO_MAX + 1) }).motivo).toMatch(/200/);
    });
    it('rechaza tipo y tamaño', () => {
        expect(validarFormulario({ ...ok, archivo: archivo('a.gif', 'image/gif') }).archivo).toMatch(/Tipo/);
        expect(validarFormulario({ ...ok, archivo: archivo('a.png', 'image/png', MAX_BYTES + 1) }).archivo).toMatch(/supera/);
        expect(validarFormulario({ ...ok, archivo: archivo('a.png', 'image/png', MAX_BYTES) })).toEqual({});
    });
});

describe('utilidades de la guía', () => {
    it('datosFalta: título, fecha corta, estado y si hubo un rechazo', () => {
        expect(datosFalta({ id_sesion: 7, estado: 'ausente', fecha: '2026-09-10', materia: { nombre: 'Cálculo' }, grupo: { clave_grupo: '3A' }, tiene_rechazado: true })).toEqual({
            value: '7',
            titulo: 'Cálculo · 3A',
            fecha: '10 sep 2026',
            estado: 'ausente',
            rechazado: true,
        });
    });
    it('sesionInicial: la del enlace, o la única falta; si hay varias y ninguna del enlace, ninguna', () => {
        const dos = [{ id_sesion: 1 }, { id_sesion: 2 }];
        expect(sesionInicial(dos, 2)).toBe('2');
        expect(sesionInicial(dos, 9)).toBe('');
        expect(sesionInicial(dos, null)).toBe('');
        expect(sesionInicial([{ id_sesion: 5 }], null)).toBe('5');
    });
    it('dice qué falta, en orden de pantalla y con concordancia', () => {
        expect(pendientesDeCaptura({ idSesion: '', motivo: '', archivo: null })).toEqual(['la falta o el retardo', 'el motivo', 'el documento']);
        expect(textoPendientes(['el motivo'])).toBe('Falta el motivo.');
        expect(textoPendientes(['el motivo', 'el documento'])).toBe('Faltan el motivo y el documento.');
        expect(textoPendientes(['la falta o el retardo', 'el motivo', 'el documento'])).toBe('Faltan la falta o el retardo, el motivo y el documento.');
        expect(textoPendientes([])).toBe('Todo listo para enviar.');
    });
    it('primerCampoConError sigue el orden de la pantalla', () => {
        expect(primerCampoConError({ archivo: 'x', motivo: 'y' })).toBe('motivo');
        expect(primerCampoConError({})).toBeNull();
    });
});

const falta = (id, estado = 'ausente', extra = {}) => ({ id_sesion: id, estado, fecha: `2026-09-${String(id).padStart(2, '0')}`, materia: { nombre: id === 7 ? 'Cálculo' : `Materia ${id}` }, grupo: { clave_grupo: '3A' }, ...extra });
const registros = [falta(7)];
const varias = [falta(7), falta(8, 'retardo', { tiene_rechazado: true }), falta(9)];

describe('FormularioJustificante', () => {
    it('preselecciona la sesión, limita a 200 y muestra contador', () => {
        render(<FormularioJustificante registros={varias} idSesionInicial={7} />);
        expect(screen.getByRole('radio', { name: /Cálculo/ })).toBeChecked();
        const motivo = screen.getByLabelText(/Motivo/);
        expect(motivo).toHaveAttribute('maxlength', '200');
        fireEvent.change(motivo, { target: { value: 'hola' } });
        expect(screen.getByText('4/200')).toBeInTheDocument();
    });

    it('con varias faltas muestra todas como tarjetas con su estado (texto y color) y avisa del justificante rechazado', async () => {
        const usuario = userEvent.setup();
        render(<FormularioJustificante registros={varias} />);
        const grupo = screen.getByRole('group', { name: /Falta o retardo a justificar/ });
        expect(within(grupo).getAllByRole('radio')).toHaveLength(3);
        for (const r of within(grupo).getAllByRole('radio')) expect(r).not.toBeChecked();
        expect(within(grupo).getAllByText('Ausente')).toHaveLength(2);
        expect(within(grupo).getByText('Retardo')).toBeInTheDocument();
        // La segunda falta ya tuvo un justificante rechazado: se dice en la propia tarjeta.
        expect(within(grupo).getByText('Rechazado')).toBeInTheDocument();
        expect(screen.queryByText(/Tu justificante anterior para esta falta fue rechazado/)).toBeNull();
        await usuario.click(within(grupo).getByRole('radio', { name: /Materia 8/ }));
        expect(screen.getByText(/Tu justificante anterior para esta falta fue rechazado/)).toBeInTheDocument();
        await usuario.click(within(grupo).getByRole('radio', { name: /Cálculo/ }));
        expect(screen.queryByText(/Tu justificante anterior para esta falta fue rechazado/)).toBeNull();
    });

    it('con una sola falta ya viene elegida (no hay nada que decidir)', () => {
        render(<FormularioJustificante registros={registros} />);
        expect(screen.getByRole('radio', { name: /Cálculo/ })).toBeChecked();
        expect(screen.getByText('Faltan el motivo y el documento.')).toBeInTheDocument();
    });

    it('con más de cuatro faltas se elige con búsqueda por materia o fecha', async () => {
        const usuario = userEvent.setup();
        const muchas = [falta(1), falta(2), falta(3), falta(4), falta(5, 'retardo', { tiene_rechazado: true })];
        render(<FormularioJustificante registros={muchas} />);
        expect(screen.queryByRole('radio')).toBeNull();
        const campo = screen.getByRole('combobox', { name: /Falta o retardo a justificar/ });
        await usuario.click(campo);
        expect(screen.getAllByRole('option')).toHaveLength(5);
        await usuario.type(campo, 'materia 5');
        const opcion = screen.getByRole('option');
        expect(opcion).toHaveTextContent('Materia 5 · 3A');
        // El estado va con texto y color (chip) y el rechazo previo se dice en la propia opción.
        expect(within(opcion).getByText('Retardo')).toBeInTheDocument();
        expect(within(opcion).getByText('Rechazado')).toBeInTheDocument();
        await usuario.click(opcion);
        // Una vez elegida, el campo conserva la fecha: varias faltas de la misma materia se distinguen por el día.
        expect(campo).toHaveValue('5 sep 2026 · Materia 5 · 3A');
        expect(screen.getByText(/Tu justificante anterior para esta falta fue rechazado/)).toBeInTheDocument();
    });

    it('el rótulo del documento está asociado a la zona y las reglas se ven antes de elegir', () => {
        const { container } = render(<FormularioJustificante registros={registros} />);
        const entrada = screen.getByLabelText(/Documento/);
        expect(entrada).toBe(container.querySelector('input[type="file"]'));
        expect(entrada).toHaveAttribute('aria-required', 'true');
        expect(screen.getByText('PDF, JPG o PNG. Máximo 5 MB.')).toBeInTheDocument();
        expect(entrada).toHaveAccessibleDescription(/PDF, JPG o PNG\. Máximo 5 MB\./);
    });

    it('ofrece tomar la foto con la cámara (solo se ve en pantallas táctiles) con capture', () => {
        const { container } = render(<FormularioJustificante registros={registros} />);
        const entradas = container.querySelectorAll('input[type="file"]');
        expect(entradas).toHaveLength(2);
        expect(entradas[1]).toHaveAttribute('capture', 'environment');
        expect(entradas[1]).toHaveAttribute('accept', '.jpg,.jpeg,.png');
        expect(screen.getByRole('button', { name: 'Tomar foto' })).toBeInTheDocument();
        // La zona principal no lleva capture: dejaría sin poder elegir un PDF en algunos teléfonos.
        expect(entradas[0]).not.toHaveAttribute('capture');
    });

    it('una foto elegida muestra su nombre y tamaño y se puede quitar', async () => {
        const usuario = userEvent.setup();
        const { container } = render(<FormularioJustificante registros={registros} />);
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [archivo('receta.png', 'image/png', 2048)] } });
        expect(await screen.findByText('receta.png')).toBeInTheDocument();
        expect(screen.getByText('2 KB')).toBeInTheDocument();
        expect(screen.getByText('Falta el motivo.')).toBeInTheDocument();
        await usuario.click(screen.getByRole('button', { name: 'Quitar' }));
        expect(screen.queryByText('receta.png')).toBeNull();
    });

    it('los motivos de ejemplo empiezan el texto y desaparecen cuando ya hay algo escrito', async () => {
        const usuario = userEvent.setup();
        render(<FormularioJustificante registros={registros} />);
        const ideas = screen.getByRole('group', { name: 'Ideas para empezar el motivo' });
        await usuario.click(within(ideas).getByRole('button', { name: 'Cita médica' }));
        const motivo = screen.getByLabelText(/Motivo/);
        expect(motivo).toHaveValue('Cita médica: ');
        expect(motivo).toHaveFocus();
        expect(screen.queryByRole('group', { name: 'Ideas para empezar el motivo' })).toBeNull();
    });

    it('no envía si faltan campos: marca los errores, lleva el foco al primero y los quita al corregirlos', async () => {
        const usuario = userEvent.setup();
        render(<FormularioJustificante registros={varias} />);
        expect(screen.queryByText('Escribe el motivo.')).toBeNull();
        await usuario.click(screen.getByRole('button', { name: 'Enviar justificante' }));
        expect(await screen.findByText('Escribe el motivo.')).toBeInTheDocument();
        expect(screen.getByText('Elige la falta o el retardo que quieres justificar.')).toBeInTheDocument();
        expect(screen.getByText('Adjunta el documento (PDF, JPG o PNG).')).toBeInTheDocument();
        expect(subir).not.toHaveBeenCalled();
        // El foco va al primer campo con error (la falta); el botón no se apagó.
        expect(screen.getAllByRole('radio')[0]).toHaveFocus();
        await usuario.click(screen.getAllByRole('radio')[0]);
        expect(screen.queryByText('Elige la falta o el retardo que quieres justificar.')).toBeNull();
        await usuario.type(screen.getByLabelText(/Motivo/), 'Cita');
        expect(screen.queryByText('Escribe el motivo.')).toBeNull();
        expect(screen.getByText('Adjunta el documento (PDF, JPG o PNG).')).toBeInTheDocument();
    });

    it('sube el documento y registra; conserva el objeto subido si el registro falla', async () => {
        subir.mockResolvedValue({ objeto_documento: 'justificantes/1/u.pdf' });
        registrar.mockRejectedValueOnce({ code: 'JUSTIFICANTE_DUPLICADO', message: 'x' }).mockResolvedValueOnce({ id_justificante: 1 });
        const alRegistrar = vi.fn();
        const { container } = render(<FormularioJustificante registros={registros} idSesionInicial={7} onRegistrado={alRegistrar} />);
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Cita médica' } });
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [archivo('a.pdf', 'application/pdf')] } });
        expect(screen.getByText('Todo listo para enviar.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Enviar justificante' }));
        expect(await screen.findByText('Ya tienes un justificante pendiente para esta sesión.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Enviar justificante' }));
        await waitFor(() => expect(alRegistrar).toHaveBeenCalled());
        expect(subir).toHaveBeenCalledTimes(1);
        expect(registrar).toHaveBeenLastCalledWith({ idSesion: 7, motivo: 'Cita médica', objetoDocumento: 'justificantes/1/u.pdf' });
        expect(alRegistrar).toHaveBeenCalledWith({ id_justificante: 1 }, { idSesion: 7 });
    });

    it('mientras sube dice en qué fase va', async () => {
        let terminarSubida;
        subir.mockReturnValue(new Promise((resolver) => { terminarSubida = resolver; }));
        registrar.mockResolvedValue({ id_justificante: 1 });
        const { container } = render(<FormularioJustificante registros={registros} />);
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Cita médica' } });
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [archivo('a.pdf', 'application/pdf')] } });
        fireEvent.click(screen.getByRole('button', { name: 'Enviar justificante' }));
        expect(await screen.findByText('Subiendo documento…')).toBeInTheDocument();
        terminarSubida({ objeto_documento: 'justificantes/1/u.pdf' });
        await waitFor(() => expect(registrar).toHaveBeenCalled());
    });
});

describe('RegistrarJustificanteForm (tarjeta)', () => {
    it('con registros ya cargados: una sola tarjeta con título y el formulario dentro', () => {
        render(<RegistrarJustificanteForm registros={registros} idSesion={7} />);
        const tarjeta = screen.getByRole('region', { name: 'Registrar justificante' });
        const formulario = screen.getByRole('form', { name: 'Registrar justificante' });
        expect(tarjeta).toContainElement(formulario);
        // El formulario no trae borde propio: nada de tarjeta dentro de tarjeta.
        expect(tarjeta).toHaveClass('border');
        expect(formulario).not.toHaveClass('border', 'rounded-xl');
    });

    it('al enviar, el éxito aparece dentro de la tarjeta con los siguientes pasos y «Justificar otra falta» vuelve al formulario', async () => {
        const usuario = userEvent.setup();
        subir.mockResolvedValue({ objeto_documento: 'justificantes/1/u.pdf' });
        registrar.mockResolvedValue({ id_justificante: 1, id_sesion: 7 });
        const alRegistrar = vi.fn();
        const { container } = render(<RegistrarJustificanteForm registros={varias} idSesion={7} onRegistrado={alRegistrar} />);
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Cita médica' } });
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [archivo('a.pdf', 'application/pdf')] } });
        await usuario.click(screen.getByRole('button', { name: 'Enviar justificante' }));

        const tarjeta = screen.getByRole('region', { name: 'Registrar justificante' });
        expect(await within(tarjeta).findByRole('heading', { name: 'Justificante enviado' })).toBeInTheDocument();
        expect(within(tarjeta).getByText(/aparece como Pendiente en «Mis justificantes»/)).toBeInTheDocument();
        expect(within(tarjeta).queryByRole('form')).toBeNull();
        expect(alRegistrar).toHaveBeenCalledTimes(1);
        // Quedan 2 faltas por justificar: la siguiente acción natural es otra, y la otra es ver el estado.
        expect(within(tarjeta).getByRole('button', { name: /Justificar otra falta/ })).toHaveTextContent('2 pendientes');
        expect(within(tarjeta).getByRole('button', { name: /Ver mis justificantes/ })).toBeInTheDocument();

        await usuario.click(within(tarjeta).getByRole('button', { name: /Justificar otra falta/ }));
        expect(screen.getByRole('form', { name: 'Registrar justificante' })).toBeInTheDocument();
        // La sesión del enlace ya se usó: el formulario vuelve vacío, sin preselección.
        for (const r of screen.getAllByRole('radio')) expect(r).not.toBeChecked();
        expect(screen.getByLabelText(/Motivo/)).toHaveValue('');
    });

    it('«Ver mis justificantes» lleva a la tarjeta vecina centrada en pantalla (la barra superior fija taparía el título)', async () => {
        const usuario = userEvent.setup();
        const mover = vi.fn();
        // jsdom no implementa scrollIntoView.
        Element.prototype.scrollIntoView = mover;
        subir.mockResolvedValue({ objeto_documento: 'justificantes/1/u.pdf' });
        registrar.mockResolvedValue({ id_justificante: 1, id_sesion: 7 });
        const { container } = render(
            <>
                <RegistrarJustificanteForm registros={registros} />
                <section aria-labelledby="t-mis-just">
                    <h3 id="t-mis-just">Mis justificantes</h3>
                </section>
            </>,
        );
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Cita médica' } });
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [archivo('a.pdf', 'application/pdf')] } });
        await usuario.click(screen.getByRole('button', { name: 'Enviar justificante' }));
        await usuario.click(await screen.findByRole('button', { name: /Ver mis justificantes/ }));
        try {
            expect(mover).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }));
            expect(mover.mock.contexts[0]).toBe(screen.getByRole('heading', { name: 'Mis justificantes' }).closest('section'));
        } finally {
            delete Element.prototype.scrollIntoView;
        }
    });

    it('modo alumno: el éxito sigue a la vista aunque la lista recargada quede vacía (no hay más faltas)', async () => {
        const usuario = userEvent.setup();
        justificables.mockResolvedValueOnce({ total: 1, items: [falta(7)] }).mockResolvedValue({ total: 0, items: [] });
        subir.mockResolvedValue({ objeto_documento: 'justificantes/1/u.pdf' });
        registrar.mockResolvedValue({ id_justificante: 1, id_sesion: 7 });
        const { container } = render(<RegistrarJustificanteForm />);
        expect(await screen.findByRole('radio', { name: /Cálculo/ })).toBeChecked();
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Cita médica' } });
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [archivo('a.pdf', 'application/pdf')] } });
        await usuario.click(screen.getByRole('button', { name: 'Enviar justificante' }));
        expect(await screen.findByRole('heading', { name: 'Justificante enviado' })).toBeInTheDocument();
        await waitFor(() => expect(justificables).toHaveBeenCalledTimes(2));
        // Sin más faltas: solo «Ver mis justificantes» y una salida corta.
        expect(screen.queryByRole('button', { name: /Justificar otra falta/ })).toBeNull();
        await usuario.click(screen.getByRole('button', { name: 'Listo' }));
        expect(screen.getByText('No tienes faltas ni retardos por justificar.')).toBeInTheDocument();
    });

    it('modo alumno sin faltas por justificar lo dice', async () => {
        justificables.mockResolvedValue({ total: 0, items: [] });
        render(<RegistrarJustificanteForm />);
        expect(await screen.findByText('No tienes faltas ni retardos por justificar.')).toBeInTheDocument();
    });
});
