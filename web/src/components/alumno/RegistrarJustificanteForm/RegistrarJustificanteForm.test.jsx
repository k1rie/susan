// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormularioJustificante } from './RegistrarJustificanteForm.jsx';
import { MAX_BYTES, MOTIVO_MAX, validarFormulario } from './registrarJustificante.utils.js';

const subir = vi.hoisted(() => vi.fn());
const registrar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/http', () => ({ subirDocumentoJustificante: subir }));
vi.mock('@/lib/api/revision.js', () => ({ registrarJustificante: registrar, misJustificables: vi.fn() }));

const archivo = (nombre, tipo, bytes = 10) => {
    const f = new File(['x'], nombre, { type: tipo });
    Object.defineProperty(f, 'size', { value: bytes });
    return f;
};

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

const registros = [{ id_sesion: 7, estado: 'ausente', fecha: '2026-09-10', materia: { nombre: 'Cálculo' }, grupo: { clave_grupo: '3A' } }];

describe('FormularioJustificante', () => {
    it('preselecciona la sesión, limita a 200 y muestra contador', () => {
        render(<FormularioJustificante registros={registros} idSesionInicial={7} />);
        expect(screen.getByLabelText(/Falta o retardo/)).toHaveValue('7');
        const motivo = screen.getByLabelText(/Motivo/);
        expect(motivo).toHaveAttribute('maxlength', '200');
        fireEvent.change(motivo, { target: { value: 'hola' } });
        expect(screen.getByText('4/200')).toBeInTheDocument();
    });

    it('no envía si faltan campos', async () => {
        render(<FormularioJustificante registros={registros} />);
        fireEvent.click(screen.getByRole('button', { name: 'Enviar justificante' }));
        expect(await screen.findByText('Escribe el motivo.')).toBeInTheDocument();
        expect(subir).not.toHaveBeenCalled();
    });

    it('sube el documento y registra; conserva el objeto subido si el registro falla', async () => {
        subir.mockResolvedValue({ objeto_documento: 'justificantes/1/u.pdf' });
        registrar.mockRejectedValueOnce({ code: 'JUSTIFICANTE_DUPLICADO', message: 'x' }).mockResolvedValueOnce({ id_justificante: 1 });
        const alRegistrar = vi.fn();
        const { container } = render(<FormularioJustificante registros={registros} idSesionInicial={7} onRegistrado={alRegistrar} />);
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Cita médica' } });
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [archivo('a.pdf', 'application/pdf')] } });
        fireEvent.click(screen.getByRole('button', { name: 'Enviar justificante' }));
        expect(await screen.findByText('Ya tienes un justificante pendiente para esta sesión.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Enviar justificante' }));
        await waitFor(() => expect(alRegistrar).toHaveBeenCalled());
        expect(subir).toHaveBeenCalledTimes(1);
        expect(registrar).toHaveBeenLastCalledWith({ idSesion: 7, motivo: 'Cita médica', objetoDocumento: 'justificantes/1/u.pdf' });
    });
});
