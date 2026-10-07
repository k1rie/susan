// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Field from '../Field/Field.jsx';
import Select from './Select.jsx';
import { repartirClases } from './select.utils.js';

const OPCIONES = [
    { value: 'a', label: 'Alfa' },
    { value: 'b', label: 'Beta', disabled: true },
    { value: 'c', label: 'Gamma' },
];

describe('Select', () => {
    it('conserva el <select> nativo con sus opciones (API de options)', () => {
        render(<Select aria-label="Letra" options={OPCIONES} />);
        const selector = screen.getByRole('combobox', { name: 'Letra' });
        expect(selector.tagName).toBe('SELECT');
        expect(within(selector).getAllByRole('option').map((o) => o.textContent)).toEqual(['Alfa', 'Beta', 'Gamma']);
        expect(screen.getByRole('option', { name: 'Beta' })).toBeDisabled();
    });

    it('placeholder agrega una primera opción vacía deshabilitada y seleccionada', () => {
        render(<Select aria-label="Letra" placeholder="Elige una" options={OPCIONES} />);
        const [primera] = screen.getAllByRole('option');
        expect(primera).toHaveTextContent('Elige una');
        expect(primera).toBeDisabled();
        expect(screen.getByRole('combobox')).toHaveValue('');
    });

    it('acepta hijos <option> cuando no hay options', () => {
        render(
            <Select aria-label="Hijos">
                <option value="1">Uno</option>
            </Select>,
        );
        expect(screen.getByRole('option', { name: 'Uno' })).toBeInTheDocument();
    });

    it('groups genera <optgroup> después de las opciones sueltas', () => {
        render(
            <Select
                aria-label="Con grupos"
                options={[{ value: 'todos', label: 'Todos' }]}
                groups={[
                    { label: 'Docentes', options: [{ value: 'd1', label: 'Ana' }] },
                    { label: 'Alumnos', options: [{ value: 'a1', label: 'Luis' }] },
                ]}
            />,
        );
        expect(screen.getByRole('group', { name: 'Docentes' })).toContainElement(screen.getByRole('option', { name: 'Ana' }));
        expect(screen.getByRole('group', { name: 'Alumnos' })).toContainElement(screen.getByRole('option', { name: 'Luis' }));
    });

    it('dibuja el chevron de Lucide (decorativo) y quita la flecha nativa', () => {
        const { container } = render(<Select aria-label="x" options={OPCIONES} />);
        expect(screen.getByRole('combobox')).toHaveClass('appearance-none');
        const icono = container.querySelector('svg');
        expect(icono).toHaveAttribute('aria-hidden', 'true');
    });

    it('un select múltiple es una lista: sin chevron ni appearance-none', () => {
        const { container } = render(<Select aria-label="x" multiple options={OPCIONES} />);
        expect(container.querySelector('svg')).toBeNull();
        expect(screen.getByRole('listbox')).not.toHaveClass('appearance-none');
    });

    it('reparte className: diseño al contenedor, el resto al <select>', () => {
        const { container } = render(<Select aria-label="x" className="!w-auto max-w-xs mb-2 text-[13px] min-h-8" options={OPCIONES} />);
        expect(container.firstChild).toHaveClass('!w-auto', 'max-w-xs', 'mb-2');
        expect(screen.getByRole('combobox')).toHaveClass('text-[13px]', 'min-h-8');
        expect(screen.getByRole('combobox')).not.toHaveClass('max-w-xs');
    });

    it('funciona controlado y con Field (etiqueta, id y aria-invalid)', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn((e) => e.target.value);
        render(
            <Field label="Letra" error="Elige una">
                <Select value="a" onChange={onChange} options={OPCIONES} />
            </Field>,
        );
        const selector = screen.getByLabelText('Letra');
        expect(selector).toHaveAttribute('aria-invalid', 'true');
        expect(selector).toHaveClass('border-destructive');
        await user.selectOptions(selector, 'c');
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.results[0].value).toBe('c');
    });

    it('reenvía ref y atributos al <select>', () => {
        const ref = { current: null };
        render(<Select ref={ref} aria-label="x" disabled options={OPCIONES} data-testid="sel" />);
        expect(ref.current).toBe(screen.getByTestId('sel'));
        expect(ref.current).toBeDisabled();
    });
});

describe('repartirClases', () => {
    it('manda ancho, márgenes y posición al contenedor, incluso con variantes e importancia', () => {
        const { envoltura, control } = repartirClases('w-36 !w-auto sm:max-w-xs -mt-2 col-span-2 grow z-10 min-w-36 mb-2 w-full!');
        expect(envoltura.split(' ')).toEqual(['w-36', '!w-auto', 'sm:max-w-xs', '-mt-2', 'col-span-2', 'grow', 'z-10', 'min-w-36', 'mb-2', 'w-full!']);
        expect(control).toBe('');
    });

    it('deja el estilo del texto y la altura en el control', () => {
        const { envoltura, control } = repartirClases('text-xs min-h-8 py-1 font-medium hover:bg-accent');
        expect(envoltura).toBe('');
        expect(control).toBe('text-xs min-h-8 py-1 font-medium hover:bg-accent');
    });

    it('tolera valores vacíos', () => {
        expect(repartirClases(undefined)).toEqual({ envoltura: '', control: '' });
        expect(repartirClases('   ')).toEqual({ envoltura: '', control: '' });
    });
});
