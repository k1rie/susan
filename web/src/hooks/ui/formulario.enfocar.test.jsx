// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Combobox from '@/components/ui/Combobox';
import Input from '@/components/ui/Input';
import SegmentedControl from '@/components/ui/SegmentedControl';
import TarjetaOpcion from '@/components/ui/TarjetaOpcion';
import { enfocarPrimerError } from './formulario.utils.js';

const OPCIONES = [
    { value: 1, label: 'Álgebra' },
    { value: 2, label: 'Cálculo' },
];
const ESTATUS = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
    { value: 'mantenimiento', label: 'Mantenimiento' },
];

function Formulario({ valorEstatus = '', deshabilitarNombre = false, estatusDeshabilitado = false }) {
    return (
        <form data-testid="form">
            <Input name="nombre" aria-label="Nombre" disabled={deshabilitarNombre} />
            <Combobox name="materia" aria-label="Materia" options={OPCIONES} value="" onChange={() => {}} />
            <SegmentedControl name="estatus" label="Estatus" items={ESTATUS} value={valorEstatus} onChange={() => {}} disabled={estatusDeshabilitado} />
            <Input name="correo" aria-label="Correo" />
        </form>
    );
}

describe('enfocarPrimerError', () => {
    it('lleva el foco a un campo normal por su name (comportamiento de siempre)', () => {
        render(<Formulario />);
        const destino = enfocarPrimerError(screen.getByTestId('form'), { correo: 'Escribe el correo' });
        expect(destino).toBe(screen.getByLabelText('Correo'));
        expect(screen.getByLabelText('Correo')).toHaveFocus();
    });

    it('encuentra el input de un Combobox (que expone data-campo-nombre y no lleva name en el input)', () => {
        render(<Formulario />);
        const destino = enfocarPrimerError(screen.getByTestId('form'), { materia: 'Elige una materia' });
        expect(destino).toBe(screen.getByRole('combobox', { name: 'Materia' }));
        expect(screen.getByRole('combobox', { name: 'Materia' })).toHaveFocus();
    });

    it('encuentra el radio elegido de un SegmentedControl, o el primero si no hay elegido', () => {
        const { rerender } = render(<Formulario valorEstatus="inactivo" />);
        enfocarPrimerError(screen.getByTestId('form'), { estatus: 'Elige el estatus' });
        expect(screen.getByRole('radio', { name: 'Inactivo' })).toHaveFocus();
        rerender(<Formulario valorEstatus="" />);
        enfocarPrimerError(screen.getByTestId('form'), { estatus: 'Elige el estatus' });
        expect(screen.getByRole('radio', { name: 'Activo' })).toHaveFocus();
    });

    it('con varios errores enfoca el PRIMERO en pantalla aunque sea un Combobox (antes saltaba al segundo)', () => {
        render(<Formulario />);
        const destino = enfocarPrimerError(screen.getByTestId('form'), { correo: 'x', estatus: 'y', materia: 'z' });
        expect(destino).toBe(screen.getByRole('combobox', { name: 'Materia' }));
    });

    it('omite los campos deshabilitados y busca el siguiente con error', () => {
        render(<Formulario deshabilitarNombre />);
        const destino = enfocarPrimerError(screen.getByTestId('form'), { nombre: 'a', materia: 'b' });
        expect(destino).toBe(screen.getByRole('combobox', { name: 'Materia' }));
    });

    it('un SegmentedControl deshabilitado entero no recibe el foco; pasa al siguiente', () => {
        render(<Formulario estatusDeshabilitado />);
        const destino = enfocarPrimerError(screen.getByTestId('form'), { estatus: 'a', correo: 'b' });
        expect(destino).toBe(screen.getByLabelText('Correo'));
    });

    it('si el único campo con error está deshabilitado devuelve null y no rompe', () => {
        render(<Formulario deshabilitarNombre />);
        expect(enfocarPrimerError(screen.getByTestId('form'), { nombre: 'a' })).toBeNull();
    });

    it('sin coincidencia por name usa el primer control marcado aria-invalid, también un grupo de radios', () => {
        render(
            <form data-testid="form">
                <Input aria-label="Libre" />
                <SegmentedControl label="Tipo" items={ESTATUS} value="activo" onChange={() => {}} aria-invalid="true" />
            </form>,
        );
        const destino = enfocarPrimerError(screen.getByTestId('form'), { otro: 'x' });
        expect(destino).toBe(screen.getByRole('radio', { name: 'Activo' }));
        expect(screen.getByRole('radio', { name: 'Activo' })).toHaveFocus();
    });

    it('ignora los campos dentro de una sección plegada (hidden) y busca el siguiente', () => {
        render(
            <form data-testid="form">
                <div hidden>
                    <Input name="oculto" aria-label="Oculto" />
                </div>
                <Input name="visible" aria-label="Visible" />
            </form>,
        );
        const destino = enfocarPrimerError(screen.getByTestId('form'), { oculto: 'a', visible: 'b' });
        expect(destino).toBe(screen.getByLabelText('Visible'));
    });

    it('los radios nativos de TarjetaOpcion (que sí llevan name) siguen funcionando', () => {
        render(
            <form data-testid="form">
                <TarjetaOpcion name="tipo" label="Tipo" value="" onChange={() => {}} opciones={[{ value: 'ip', titulo: 'IP' }, { value: 'web', titulo: 'Web' }]} />
            </form>,
        );
        const destino = enfocarPrimerError(screen.getByTestId('form'), { tipo: 'Elige el tipo' });
        expect(destino?.getAttribute('type')).toBe('radio');
        expect(destino).toHaveFocus();
    });

    it('sin errores o sin nodos devuelve null', () => {
        render(<Formulario />);
        expect(enfocarPrimerError(screen.getByTestId('form'), {})).toBeNull();
        expect(enfocarPrimerError(screen.getByTestId('form'), { inexistente: 'x' })).toBeNull();
    });
});
