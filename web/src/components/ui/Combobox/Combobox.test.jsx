// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Field from '../Field/Field.jsx';
import Combobox from './Combobox.jsx';

const MATERIAS = [
    { value: 1, label: 'Álgebra Lineal', description: 'ALG101' },
    { value: 2, label: 'Cálculo Diferencial', description: 'CAL101' },
    { value: 3, label: 'Administración I', description: 'ADM101', disabled: true },
    { value: 4, label: 'Contabilidad Básica', description: 'CON101' },
];

function Controlado({ inicial = '', alCambiar, ...props }) {
    const [valor, setValor] = useState(inicial);
    return (
        <Combobox
            aria-label="Materia"
            options={MATERIAS}
            value={valor}
            onChange={(v, o) => {
                setValor(v);
                alCambiar?.(v, o);
            }}
            {...props}
        />
    );
}

const campo = () => screen.getByRole('combobox', { name: 'Materia' });

describe('Combobox (local)', () => {
    it('cerrado: es un combobox sin lista, con los atributos ARIA del patrón', () => {
        render(<Controlado placeholder="Elige una materia" />);
        expect(campo()).toHaveAttribute('aria-expanded', 'false');
        expect(campo()).toHaveAttribute('aria-autocomplete', 'list');
        expect(campo()).toHaveAttribute('aria-haspopup', 'listbox');
        expect(campo()).not.toHaveAttribute('aria-controls');
        expect(campo()).toHaveAttribute('placeholder', 'Elige una materia');
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('al hacer clic abre la lista con todas las opciones, vinculada con aria-controls', async () => {
        const user = userEvent.setup();
        render(<Controlado />);
        await user.click(campo());
        const lista = screen.getByRole('listbox');
        expect(campo()).toHaveAttribute('aria-expanded', 'true');
        expect(campo()).toHaveAttribute('aria-controls', lista.id);
        expect(within(lista).getAllByRole('option')).toHaveLength(4);
        expect(screen.getByRole('status')).toHaveTextContent('4 opciones disponibles.');
    });

    it('la lista se dibuja en un portal con posición fija y encima de los diálogos', async () => {
        const user = userEvent.setup();
        const { container } = render(<Controlado />);
        await user.click(campo());
        const lista = screen.getByRole('listbox');
        expect(container.contains(lista)).toBe(false);
        const popup = lista.parentElement;
        expect(popup).toHaveStyle({ position: 'fixed' });
        expect(popup).toHaveClass('z-[70]');
    });

    it('cada opción mide al menos 44 px (min-h-11) y muestra título y descripción', async () => {
        const user = userEvent.setup();
        render(<Controlado />);
        await user.click(campo());
        const opcion = screen.getByRole('option', { name: /Álgebra Lineal/ });
        expect(opcion).toHaveClass('min-h-11');
        expect(opcion).toHaveTextContent('Álgebra Lineal');
        expect(opcion).toHaveTextContent('ALG101');
    });

    it('filtra mientras se escribe, sin acentos ni mayúsculas', async () => {
        const user = userEvent.setup();
        render(<Controlado />);
        await user.type(campo(), 'ALGEBRA');
        const opciones = screen.getAllByRole('option');
        expect(opciones).toHaveLength(1);
        expect(opciones[0]).toHaveTextContent('Álgebra Lineal');
        await user.clear(campo());
        await user.type(campo(), 'calculo diferencial');
        expect(screen.getAllByRole('option')).toHaveLength(1);
    });

    it('sin coincidencias dice emptyText (propio o el de siempre) y lo anuncia', async () => {
        const user = userEvent.setup();
        const { rerender } = render(<Controlado />);
        await user.type(campo(), 'zzz');
        expect(screen.queryAllByRole('option')).toHaveLength(0);
        expect(screen.getAllByText('Sin resultados').length).toBeGreaterThan(0);
        rerender(<Controlado emptyText="No hay materias" />);
        expect(screen.getAllByText('No hay materias').length).toBeGreaterThan(0);
    });

    it('flechas + Enter: abre, mueve la opción activa, elige y entrega (valor, opción)', async () => {
        const user = userEvent.setup();
        const alCambiar = vi.fn();
        render(<Controlado alCambiar={alCambiar} />);
        campo().focus();
        await user.keyboard('{ArrowDown}');
        expect(campo()).toHaveAttribute('aria-expanded', 'true');
        const primera = screen.getByRole('option', { name: /Álgebra Lineal/ });
        expect(campo()).toHaveAttribute('aria-activedescendant', primera.id);
        await user.keyboard('{ArrowDown}');
        // la 3.ª está deshabilitada: se salta a la 4.ª tras la 2.ª
        expect(campo()).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Cálculo Diferencial/ }).id);
        await user.keyboard('{ArrowDown}');
        expect(campo()).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Contabilidad/ }).id);
        await user.keyboard('{ArrowDown}');
        expect(campo()).toHaveAttribute('aria-activedescendant', primera.id); // da la vuelta
        await user.keyboard('{ArrowUp}');
        await user.keyboard('{Enter}');
        expect(alCambiar).toHaveBeenCalledTimes(1);
        expect(alCambiar.mock.calls[0][0]).toBe(4);
        expect(alCambiar.mock.calls[0][1]).toMatchObject({ value: 4, label: 'Contabilidad Básica' });
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(campo()).toHaveValue('Contabilidad Básica');
        expect(campo()).toHaveFocus();
    });

    it('escribir y Enter elige la primera coincidencia', async () => {
        const user = userEvent.setup();
        const alCambiar = vi.fn();
        render(<Controlado alCambiar={alCambiar} />);
        await user.type(campo(), 'conta{Enter}');
        expect(alCambiar).toHaveBeenCalledWith(4, expect.objectContaining({ label: 'Contabilidad Básica' }));
    });

    it('Enter con la lista abierta no envía el formulario', async () => {
        const user = userEvent.setup();
        const alEnviar = vi.fn((e) => e.preventDefault());
        render(
            <form onSubmit={alEnviar}>
                <Controlado />
                <button type="submit">Enviar</button>
            </form>,
        );
        await user.type(campo(), 'alg{Enter}');
        expect(alEnviar).not.toHaveBeenCalled();
    });

    it('el clic elige una opción y no se puede elegir una deshabilitada', async () => {
        const user = userEvent.setup();
        const alCambiar = vi.fn();
        render(<Controlado alCambiar={alCambiar} />);
        await user.click(campo());
        await user.click(screen.getByRole('option', { name: /Administración I/ }));
        expect(alCambiar).not.toHaveBeenCalled();
        expect(screen.getByRole('option', { name: /Administración I/ })).toHaveAttribute('aria-disabled', 'true');
        await user.click(screen.getByRole('option', { name: /Cálculo/ }));
        expect(alCambiar).toHaveBeenCalledWith(2, expect.any(Object));
        expect(campo()).toHaveValue('Cálculo Diferencial');
    });

    it('el ratón mueve la opción activa', async () => {
        const user = userEvent.setup();
        render(<Controlado />);
        await user.click(campo());
        const cuarta = screen.getByRole('option', { name: /Contabilidad/ });
        await user.hover(cuarta);
        expect(campo()).toHaveAttribute('aria-activedescendant', cuarta.id);
    });

    it('Esc cierra la lista SIN llegar al documento (no cierra el diálogo que contiene el campo)', async () => {
        const user = userEvent.setup();
        const alDocumento = vi.fn();
        document.addEventListener('keydown', alDocumento);
        try {
            render(<Controlado />);
            await user.click(campo());
            await user.keyboard('{Escape}');
            expect(screen.queryByRole('listbox')).toBeNull();
            expect(alDocumento).not.toHaveBeenCalled();
            // con la lista cerrada el Esc sigue su camino (el diálogo sí puede cerrarse)
            await user.keyboard('{Escape}');
            expect(alDocumento).toHaveBeenCalledTimes(1);
        } finally {
            document.removeEventListener('keydown', alDocumento);
        }
    });

    it('al salir del campo se cierra y el texto vuelve a la etiqueta elegida', async () => {
        const user = userEvent.setup();
        render(
            <>
                <Controlado inicial={2} />
                <button type="button">Otro</button>
            </>,
        );
        expect(campo()).toHaveValue('Cálculo Diferencial');
        await user.click(campo());
        await user.keyboard('xyz');
        expect(campo()).toHaveValue('xyz');
        await user.click(screen.getByRole('button', { name: 'Otro' }));
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(campo()).toHaveValue('Cálculo Diferencial');
    });

    it('al abrir con algo elegido esa opción queda resaltada y marcada como seleccionada', async () => {
        const user = userEvent.setup();
        render(<Controlado inicial={4} />);
        await user.click(campo());
        const elegida = screen.getByRole('option', { name: /Contabilidad/ });
        expect(elegida).toHaveAttribute('aria-selected', 'true');
        expect(campo()).toHaveAttribute('aria-activedescendant', elegida.id);
        expect(screen.getByRole('option', { name: /Cálculo/ })).toHaveAttribute('aria-selected', 'false');
    });

    it('compara por texto: value numérico 3 y opción "3" son la misma', () => {
        render(<Combobox aria-label="Materia" options={[{ value: '3', label: 'Tres' }]} value={3} onChange={() => {}} />);
        expect(campo()).toHaveValue('Tres');
    });

    it('funciona sin value (no controlado)', async () => {
        const user = userEvent.setup();
        render(<Combobox aria-label="Materia" options={MATERIAS} />);
        await user.click(campo());
        await user.click(screen.getByRole('option', { name: /Álgebra/ }));
        expect(campo()).toHaveValue('Álgebra Lineal');
    });

    it('clearable: aparece solo con valor, limpia con onChange("", null) y devuelve el foco', async () => {
        const user = userEvent.setup();
        const alCambiar = vi.fn();
        const { rerender } = render(<Controlado clearable inicial="" alCambiar={alCambiar} />);
        expect(screen.queryByRole('button', { name: 'Quitar selección' })).toBeNull();
        rerender(<Controlado key="otro" clearable inicial={2} alCambiar={alCambiar} />);
        await user.click(screen.getByRole('button', { name: 'Quitar selección' }));
        expect(alCambiar).toHaveBeenCalledWith('', null);
        expect(campo()).toHaveValue('');
        expect(campo()).toHaveFocus();
        expect(screen.queryByRole('button', { name: 'Quitar selección' })).toBeNull();
    });

    it('sin clearable no hay botón de quitar', () => {
        render(<Controlado inicial={2} />);
        expect(screen.queryByRole('button', { name: 'Quitar selección' })).toBeNull();
    });

    it('el botón del chevron abre y cierra con el ratón sin ser parada de tabulador', async () => {
        const user = userEvent.setup();
        render(<Controlado />);
        const boton = screen.getByRole('button', { name: 'Mostrar opciones' });
        expect(boton).toHaveAttribute('tabindex', '-1');
        await user.click(boton);
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Ocultar opciones' }));
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('agrupa con group: encabezados como grupos con nombre y flechas en orden visual', async () => {
        const user = userEvent.setup();
        const opciones = [
            { value: 'a1', label: 'Ana', group: 'Docentes' },
            { value: 'l1', label: 'Luis', group: 'Alumnos' },
            { value: 'a2', label: 'Ada', group: 'Docentes' },
        ];
        render(<Combobox aria-label="Persona" options={opciones} />);
        await user.click(screen.getByRole('combobox', { name: 'Persona' }));
        const docentes = screen.getByRole('group', { name: 'Docentes' });
        expect(within(docentes).getAllByRole('option').map((o) => o.textContent)).toEqual(['Ana', 'Ada']);
        expect(within(screen.getByRole('group', { name: 'Alumnos' })).getAllByRole('option')).toHaveLength(1);
        // La lista abre con Ana activa; el orden visual es Ana, Ada, Luis (no el de los datos: Ana, Luis, Ada).
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant', within(docentes).getByRole('option', { name: 'Ada' }).id);
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Luis' }).id);
    });

    it('opción de dos líneas con avatar y renderOption propio', async () => {
        const user = userEvent.setup();
        const opciones = [{ value: 1, label: 'Ana López', description: 'A001234 · 3A', avatar: 'Ana López' }];
        const { rerender } = render(<Combobox aria-label="Alumno" options={opciones} />);
        await user.click(screen.getByRole('combobox'));
        expect(screen.getByText('AL')).toBeInTheDocument(); // iniciales del Avatar
        expect(screen.getByText('A001234 · 3A')).toBeInTheDocument();
        rerender(
            <Combobox
                aria-label="Alumno"
                options={opciones}
                renderOption={(o, { activa }) => (
                    <span data-testid="propia">
                        {o.label.toUpperCase()} {activa ? 'activa' : 'inactiva'}
                    </span>
                )}
            />,
        );
        expect(screen.getByTestId('propia')).toHaveTextContent('ANA LÓPEZ activa');
    });

    it('name escribe un campo oculto con el valor', async () => {
        const user = userEvent.setup();
        const { container } = render(<Controlado name="id_materia" inicial={2} />);
        expect(container.querySelector('input[type="hidden"][name="id_materia"]')).toHaveValue('2');
        await user.click(campo());
        await user.click(screen.getByRole('option', { name: /Álgebra/ }));
        expect(container.querySelector('input[type="hidden"][name="id_materia"]')).toHaveValue('1');
    });

    it('deshabilitado: no abre ni responde', async () => {
        const user = userEvent.setup();
        render(<Controlado disabled />);
        expect(campo()).toBeDisabled();
        await user.click(campo());
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(screen.getByRole('button', { name: 'Mostrar opciones' })).toBeDisabled();
    });

    it('con Field: etiqueta, required, aria-invalid y descripción', () => {
        render(
            <Field label="Materia" required error="Elige una materia" hint="Del catálogo">
                <Combobox options={MATERIAS} value="" onChange={() => {}} />
            </Field>,
        );
        const c = screen.getByLabelText(/Materia/);
        expect(c).toHaveAttribute('role', 'combobox');
        expect(c).toBeRequired();
        expect(c).toHaveAttribute('aria-invalid', 'true');
        expect(c).toHaveClass('border-destructive');
        expect(c).toHaveAccessibleDescription(/Del catálogo/);
        expect(c).toHaveAccessibleDescription(/Elige una materia/);
    });

    it('onBlur se llama al salir del conjunto, no al pasar del campo a «Quitar selección» ni al elegir una opción', async () => {
        const user = userEvent.setup();
        const onBlur = vi.fn();
        render(
            <>
                <Controlado inicial={2} clearable onBlur={onBlur} />
                <button>Después</button>
            </>,
        );
        await user.click(campo());
        // Elegir con el ratón no quita el foco del campo.
        await user.click(screen.getByRole('option', { name: /Álgebra/ }));
        expect(onBlur).not.toHaveBeenCalled();
        // Campo -> botón «Quitar selección» (mismo conjunto): tampoco.
        await user.tab();
        expect(screen.getByRole('button', { name: 'Quitar selección' })).toHaveFocus();
        expect(onBlur).not.toHaveBeenCalled();
        // Salir del conjunto: una vez.
        await user.tab();
        expect(screen.getByRole('button', { name: 'Después' })).toHaveFocus();
        expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('onBlur también avisa al salir del campo directamente (Tab y Mayús+Tab)', async () => {
        const user = userEvent.setup();
        const onBlur = vi.fn();
        render(
            <>
                <button>Antes</button>
                <Controlado onBlur={onBlur} />
            </>,
        );
        await user.tab();
        await user.tab();
        expect(campo()).toHaveFocus();
        await user.tab({ shift: true });
        expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('ref apunta al <input> de texto y autoFocus lo enfoca al montar', () => {
        const ref = createRef();
        render(<Controlado ref={ref} autoFocus />);
        expect(ref.current).toBe(campo());
        expect(campo()).toHaveFocus();
    });

    it('acepta un ref de función', () => {
        let nodo = null;
        render(<Controlado ref={(el) => { nodo = el; }} />);
        expect(nodo).toBe(campo());
    });

    it('con name marca el contenedor con data-campo-nombre (y sin name no)', () => {
        const { container, rerender } = render(<Controlado name="id_materia" />);
        expect(container.querySelector('[data-campo-nombre="id_materia"]')).not.toBeNull();
        rerender(<Controlado />);
        expect(container.querySelector('[data-campo-nombre]')).toBeNull();
    });

    it('al teclear sin tener la lista abierta la abre', async () => {
        const user = userEvent.setup();
        render(<Controlado />);
        campo().focus();
        await user.keyboard('a');
        expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
});

describe('Combobox (remoto)', () => {
    const ALUMNOS = [
        { value: 10, label: 'Ana López', description: 'A001' },
        { value: 11, label: 'Luis Pérez', description: 'A002' },
    ];

    it('no pide nada con menos de minChars y dice cuántos caracteres hacen falta', async () => {
        const user = userEvent.setup();
        const loadOptions = vi.fn().mockResolvedValue(ALUMNOS);
        render(<Combobox aria-label="Alumno" loadOptions={loadOptions} debounceMs={0} />);
        await user.type(screen.getByRole('combobox'), 'a');
        expect(screen.getAllByText('Escribe al menos 2 caracteres para buscar.').length).toBeGreaterThan(0);
        await new Promise((r) => setTimeout(r, 30));
        expect(loadOptions).not.toHaveBeenCalled();
    });

    it('minChars y hintText son configurables', async () => {
        const user = userEvent.setup();
        render(<Combobox aria-label="Alumno" loadOptions={vi.fn()} minChars={3} hintText="Escribe matrícula o nombre" debounceMs={0} />);
        await user.type(screen.getByRole('combobox'), 'an');
        expect(screen.getAllByText('Escribe matrícula o nombre').length).toBeGreaterThan(0);
    });

    it('con minChars caracteres busca con debounce, entrega (q, { signal }) y muestra los resultados', async () => {
        const user = userEvent.setup();
        const loadOptions = vi.fn().mockResolvedValue(ALUMNOS);
        render(<Combobox aria-label="Alumno" loadOptions={loadOptions} debounceMs={20} />);
        await user.type(screen.getByRole('combobox'), 'ana');
        await screen.findByRole('option', { name: /Ana López/ });
        expect(loadOptions).toHaveBeenCalledTimes(1); // las tres teclas se juntaron en una sola petición
        expect(loadOptions).toHaveBeenCalledWith('ana', expect.objectContaining({ signal: expect.any(AbortSignal) }));
        expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    it('mientras carga muestra «Buscando…» (loadingText propio) y se anuncia', async () => {
        const user = userEvent.setup();
        let resolver;
        const loadOptions = vi.fn(() => new Promise((r) => { resolver = r; }));
        render(<Combobox aria-label="Alumno" loadOptions={loadOptions} debounceMs={0} loadingText="Cargando alumnos…" />);
        await user.type(screen.getByRole('combobox'), 'an');
        expect((await screen.findAllByText('Cargando alumnos…')).length).toBeGreaterThan(0);
        expect(screen.getByRole('combobox')).toHaveAttribute('aria-busy', 'true');
        await act(async () => resolver(ALUMNOS));
        await screen.findByRole('option', { name: /Ana/ });
        expect(screen.queryByText('Cargando alumnos…')).toBeNull();
    });

    it('cancela la petición anterior y la respuesta vieja no pisa a la nueva', async () => {
        const user = userEvent.setup();
        const resolvers = {};
        const señales = {};
        const loadOptions = vi.fn((q, { signal }) => {
            señales[q] = signal;
            return new Promise((r) => { resolvers[q] = r; });
        });
        render(<Combobox aria-label="Alumno" loadOptions={loadOptions} debounceMs={0} />);
        await user.type(screen.getByRole('combobox'), 'an');
        await waitFor(() => expect(loadOptions).toHaveBeenCalledWith('an', expect.any(Object)));
        await user.type(screen.getByRole('combobox'), 'a');
        await waitFor(() => expect(loadOptions).toHaveBeenCalledWith('ana', expect.any(Object)));
        expect(señales.an.aborted).toBe(true);
        await act(async () => resolvers.ana([{ value: 10, label: 'Ana López' }]));
        await act(async () => resolvers.an([{ value: 99, label: 'Resultado viejo' }]));
        expect(await screen.findByRole('option', { name: /Ana López/ })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /Resultado viejo/ })).toBeNull();
    });

    it('si la carga falla lo dice y «Reintentar» vuelve a pedir', async () => {
        const user = userEvent.setup();
        const loadOptions = vi.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValueOnce(ALUMNOS);
        render(<Combobox aria-label="Alumno" loadOptions={loadOptions} debounceMs={0} errorText="No se pudo buscar." />);
        await user.type(screen.getByRole('combobox'), 'an');
        expect((await screen.findAllByText('No se pudo buscar.')).length).toBeGreaterThan(0);
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(await screen.findByRole('option', { name: /Ana López/ })).toBeInTheDocument();
        expect(loadOptions).toHaveBeenCalledTimes(2);
    });

    it('sin resultados del servidor dice emptyText', async () => {
        const user = userEvent.setup();
        render(<Combobox aria-label="Alumno" loadOptions={vi.fn().mockResolvedValue([])} debounceMs={0} emptyText="Nadie con ese dato" />);
        await user.type(screen.getByRole('combobox'), 'zz');
        expect((await screen.findAllByText('Nadie con ese dato')).length).toBeGreaterThan(0);
    });

    it('muestra `selected` mientras no hay opciones y recuerda lo que se elige', async () => {
        const user = userEvent.setup();
        const loadOptions = vi.fn().mockResolvedValue(ALUMNOS);
        const alCambiar = vi.fn();
        render(<Combobox aria-label="Alumno" loadOptions={loadOptions} debounceMs={0} value={7} selected={{ value: 7, label: 'Marta Ruiz' }} onChange={alCambiar} />);
        expect(screen.getByRole('combobox')).toHaveValue('Marta Ruiz');

        const { unmount } = render(<Combobox aria-label="Otro alumno" loadOptions={loadOptions} debounceMs={0} />);
        await user.type(screen.getByRole('combobox', { name: 'Otro alumno' }), 'lu');
        await user.click(await screen.findByRole('option', { name: /Luis Pérez/ }));
        expect(screen.getByRole('combobox', { name: 'Otro alumno' })).toHaveValue('Luis Pérez');
        unmount();
    });

    it('una función loadOptions nueva en cada render no reinicia ni repite la búsqueda', async () => {
        const user = userEvent.setup();
        const llamadas = vi.fn().mockResolvedValue(ALUMNOS);
        function Inestable() {
            const [n, setN] = useState(0);
            return (
                <>
                    <button type="button" onClick={() => setN(n + 1)}>
                        Rerender
                    </button>
                    <Combobox aria-label="Alumno" loadOptions={(q, o) => llamadas(q, o)} debounceMs={0} />
                </>
            );
        }
        render(<Inestable />);
        await user.type(screen.getByRole('combobox'), 'an');
        await screen.findByRole('option', { name: /Ana López/ });
        fireEvent.click(screen.getByRole('button', { name: 'Rerender' }));
        await new Promise((r) => setTimeout(r, 30));
        expect(llamadas).toHaveBeenCalledTimes(1);
    });

    it('loadKey distinto invalida lo cargado y vuelve a pedir con la lista abierta', async () => {
        const user = userEvent.setup();
        const loadOptions = vi.fn().mockResolvedValue(ALUMNOS);
        const { rerender } = render(<Combobox aria-label="Alumno" loadOptions={loadOptions} debounceMs={0} loadKey="2026-1" />);
        await user.type(screen.getByRole('combobox'), 'an');
        await screen.findByRole('option', { name: /Ana/ });
        expect(loadOptions).toHaveBeenCalledTimes(1);
        rerender(<Combobox aria-label="Alumno" loadOptions={loadOptions} debounceMs={0} loadKey="2026-2" />);
        await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(2));
    });

    it('minChars={0} carga al abrir con la consulta vacía', async () => {
        const user = userEvent.setup();
        const loadOptions = vi.fn().mockResolvedValue(ALUMNOS);
        render(<Combobox aria-label="Alumno" loadOptions={loadOptions} debounceMs={0} minChars={0} />);
        await user.click(screen.getByRole('combobox'));
        await screen.findByRole('option', { name: /Ana/ });
        expect(loadOptions).toHaveBeenCalledWith('', expect.any(Object));
    });
});
