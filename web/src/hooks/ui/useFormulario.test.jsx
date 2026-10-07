// @vitest-environment jsdom
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Combobox from '@/components/ui/Combobox';
import Input from '@/components/ui/Input';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { useFormulario } from './useFormulario.js';

const validar = (v) => ({
    matricula: v.matricula.trim() ? undefined : 'Escribe la matrícula',
    correo: /^\S+@\S+\.\S+$/.test(v.correo) ? undefined : 'Escribe un correo válido',
});
const INICIAL = { matricula: '', correo: '' };

function Formulario({ onSubmit = async () => {}, opciones, alCambiar }) {
    const f = useFormulario({ inicial: INICIAL, validar, onSubmit, ...opciones });
    alCambiar?.(f);
    const m = f.campo('matricula');
    const c = f.campo('correo');
    return (
        <form onSubmit={f.enviar} noValidate>
            <label>
                Matrícula
                <Input {...m.props} />
            </label>
            {m.error && <p role="alert">{m.error}</p>}
            <label>
                Correo
                <Input {...c.props} />
            </label>
            {c.error && <p role="alert">{c.error}</p>}
            <p data-testid="estado">{`sucio:${f.sucio} cambios:${f.cambios} valido:${f.valido} enviando:${f.enviando}`}</p>
            {f.errorEnvio && <p role="alert">{`Fallo: ${f.errorEnvio.message}`}</p>}
            <button type="submit">Guardar</button>
        </form>
    );
}

describe('useFormulario · validación en el momento justo', () => {
    it('no muestra errores mientras se escribe por primera vez ni antes de salir del campo', async () => {
        const user = userEvent.setup();
        render(<Formulario />);
        expect(screen.queryByRole('alert')).toBeNull();
        await user.click(screen.getByLabelText('Correo'));
        await user.keyboard('a');
        expect(screen.queryByText('Escribe un correo válido')).toBeNull();
    });

    it('muestra el error al salir del campo y lo revalida en cada tecla hasta que se corrige', async () => {
        const user = userEvent.setup();
        render(<Formulario />);
        await user.click(screen.getByLabelText('Matrícula'));
        await user.tab();
        expect(screen.getByText('Escribe la matrícula')).toBeInTheDocument();
        expect(screen.getByLabelText('Matrícula')).toHaveAttribute('aria-invalid', 'true');
        await user.click(screen.getByLabelText('Matrícula'));
        await user.keyboard('E');
        expect(screen.queryByText('Escribe la matrícula')).toBeNull();
    });

    it('con validarAlSalir=false solo muestra errores tras intentar enviar', async () => {
        const user = userEvent.setup();
        render(<Formulario opciones={{ validarAlSalir: false }} />);
        await user.click(screen.getByLabelText('Matrícula'));
        await user.tab();
        expect(screen.queryByText('Escribe la matrícula')).toBeNull();
        await user.click(screen.getByText('Guardar'));
        expect(screen.getByText('Escribe la matrícula')).toBeInTheDocument();
    });
});

describe('useFormulario · envío', () => {
    it('un envío inválido no llama a onSubmit, muestra todos los errores y enfoca el primer campo inválido', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(<Formulario onSubmit={onSubmit} />);
        await user.click(screen.getByText('Guardar'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText('Escribe la matrícula')).toBeInTheDocument();
        expect(screen.getByText('Escribe un correo válido')).toBeInTheDocument();
        expect(screen.getByLabelText('Matrícula')).toHaveFocus();
    });

    it('enfoca el segundo campo cuando solo ese es inválido', async () => {
        const user = userEvent.setup();
        render(<Formulario />);
        await user.type(screen.getByLabelText('Matrícula'), 'E260099');
        await user.click(screen.getByText('Guardar'));
        expect(screen.getByLabelText('Correo')).toHaveFocus();
    });

    it('un envío válido llama a onSubmit con los valores y deja de estar sucio', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(<Formulario onSubmit={onSubmit} />);
        await user.type(screen.getByLabelText('Matrícula'), 'E260099');
        await user.type(screen.getByLabelText('Correo'), 'e260099@unach.mx');
        expect(screen.getByTestId('estado')).toHaveTextContent('sucio:true cambios:2 valido:true');
        await user.click(screen.getByText('Guardar'));
        expect(onSubmit).toHaveBeenCalledWith({ matricula: 'E260099', correo: 'e260099@unach.mx' });
        expect(screen.getByTestId('estado')).toHaveTextContent('sucio:false cambios:0 valido:true enviando:false');
    });

    it('evita el doble envío mientras hay uno en curso', async () => {
        let resolver;
        const onSubmit = vi.fn(() => new Promise((r) => { resolver = r; }));
        const { result } = renderHook(() => useFormulario({ inicial: { a: 'x' }, onSubmit }));
        let primero;
        let segundo;
        await act(async () => {
            primero = result.current.enviar();
            segundo = result.current.enviar();
        });
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(result.current.enviando).toBe(true);
        await expect(segundo).resolves.toBe(false);
        await act(async () => {
            resolver();
            await primero;
        });
        expect(result.current.enviando).toBe(false);
        await expect(primero).resolves.toBe(true);
    });

    it('si onSubmit lanza conserva lo capturado y guarda el error en errorEnvio', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockRejectedValue(new Error('Servidor caído'));
        render(<Formulario onSubmit={onSubmit} />);
        await user.type(screen.getByLabelText('Matrícula'), 'E1');
        await user.type(screen.getByLabelText('Correo'), 'a@b.co');
        await user.click(screen.getByText('Guardar'));
        expect(screen.getByText('Fallo: Servidor caído')).toBeInTheDocument();
        expect(screen.getByLabelText('Matrícula')).toHaveValue('E1');
        expect(screen.getByTestId('estado')).toHaveTextContent('sucio:true');
        expect(screen.getByTestId('estado')).toHaveTextContent('enviando:false');
    });

    it('mapearError pega el error del servidor al campo, le da el foco y se quita al editarlo', async () => {
        const user = userEvent.setup();
        const duplicado = Object.assign(new Error('dup'), { code: 'DUPLICADO' });
        const onSubmit = vi.fn().mockRejectedValue(duplicado);
        const mapearError = (e) => (e.code === 'DUPLICADO' ? { matricula: 'Esta matrícula ya está registrada' } : null);
        render(<Formulario onSubmit={onSubmit} opciones={{ mapearError }} />);
        await user.type(screen.getByLabelText('Matrícula'), 'E1');
        await user.type(screen.getByLabelText('Correo'), 'a@b.co');
        await user.click(screen.getByText('Guardar'));
        expect(screen.getByText('Esta matrícula ya está registrada')).toBeInTheDocument();
        expect(screen.getByLabelText('Matrícula')).toHaveFocus();
        expect(screen.queryByText(/Fallo:/)).toBeNull();
        await user.type(screen.getByLabelText('Matrícula'), '2');
        expect(screen.queryByText('Esta matrícula ya está registrada')).toBeNull();
    });

    it('un campo deshabilitado mientras envía recibe el foco del error del servidor cuando termina el envío', async () => {
        const user = userEvent.setup();
        const duplicado = Object.assign(new Error('dup'), { code: 'DUPLICADO' });
        let rechazar;
        const onSubmit = vi.fn(() => new Promise((_, no) => { rechazar = no; }));
        const mapearError = (e) => (e.code === 'DUPLICADO' ? { matricula: 'Esta matrícula ya está registrada' } : null);
        function ConDeshabilitado() {
            const f = useFormulario({ inicial: { matricula: 'E1', correo: 'a@b.co' }, validar, onSubmit, mapearError });
            const m = f.campo('matricula');
            return (
                <form onSubmit={f.enviar} noValidate>
                    <label>
                        Matrícula
                        <Input {...m.props} disabled={f.enviando} />
                    </label>
                    {m.error && <p role="alert">{m.error}</p>}
                    <button type="submit">Guardar</button>
                </form>
            );
        }
        render(<ConDeshabilitado />);
        await user.click(screen.getByText('Guardar'));
        expect(screen.getByLabelText('Matrícula')).toBeDisabled();
        await act(async () => {
            rechazar(duplicado);
        });
        expect(screen.getByText('Esta matrícula ya está registrada')).toBeInTheDocument();
        expect(screen.getByLabelText('Matrícula')).toBeEnabled();
        expect(screen.getByLabelText('Matrícula')).toHaveFocus();
    });

    it('con readOnly mientras envía el campo con el error del servidor recibe el foco de inmediato', async () => {
        const user = userEvent.setup();
        const duplicado = Object.assign(new Error('dup'), { code: 'DUPLICADO' });
        const onSubmit = vi.fn().mockRejectedValue(duplicado);
        const mapearError = () => ({ matricula: 'Repetida' });
        function ConReadOnly() {
            const f = useFormulario({ inicial: { matricula: 'E1', correo: 'a@b.co' }, validar, onSubmit, mapearError });
            const m = f.campo('matricula');
            return (
                <form onSubmit={f.enviar} noValidate>
                    <label>
                        Matrícula
                        <Input {...m.props} readOnly={f.enviando} />
                    </label>
                    <button type="submit">Guardar</button>
                </form>
            );
        }
        render(<ConReadOnly />);
        await user.click(screen.getByText('Guardar'));
        expect(screen.getByLabelText('Matrícula')).toHaveFocus();
    });

    it('lleva el foco a un Combobox y a un SegmentedControl con error (por data-campo-nombre), en orden de pantalla', async () => {
        const user = userEvent.setup();
        const validarCatalogo = (v) => ({ materia: v.materia ? undefined : 'Elige una materia', estatus: v.estatus ? undefined : 'Elige el estatus' });
        function ConControles() {
            const f = useFormulario({ inicial: { materia: '', estatus: '' }, validar: validarCatalogo, onSubmit: async () => {} });
            const materia = f.campo('materia');
            const estatus = f.campo('estatus');
            return (
                <form onSubmit={f.enviar} noValidate>
                    <Combobox {...materia.props} aria-label="Materia" options={[{ value: 1, label: 'Álgebra' }]} />
                    <SegmentedControl {...estatus.props} label="Estatus" items={[{ value: 'a', label: 'Activo' }, { value: 'i', label: 'Inactivo' }]} />
                    <button type="submit">Guardar</button>
                </form>
            );
        }
        render(<ConControles />);
        await user.click(screen.getByText('Guardar'));
        expect(screen.getByRole('combobox', { name: 'Materia' })).toHaveFocus();
    });

    it('con un SegmentedControl como único error, enfoca su primer radio', async () => {
        const user = userEvent.setup();
        function SoloSegmentado() {
            const f = useFormulario({ inicial: { estatus: '' }, validar: (v) => ({ estatus: v.estatus ? undefined : 'Elige el estatus' }), onSubmit: async () => {} });
            const estatus = f.campo('estatus');
            return (
                <form onSubmit={f.enviar} noValidate>
                    <SegmentedControl {...estatus.props} label="Estatus" items={[{ value: 'a', label: 'Activo' }, { value: 'i', label: 'Inactivo' }]} />
                    <button type="submit">Guardar</button>
                </form>
            );
        }
        render(<SoloSegmentado />);
        await user.click(screen.getByText('Guardar'));
        expect(screen.getByRole('radio', { name: 'Activo' })).toHaveFocus();
    });

    it('usa el enviar más reciente aunque el valor cambie en el mismo instante', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useFormulario({ inicial: { a: '' }, onSubmit }));
        await act(async () => {
            result.current.setCampo('a', 'nuevo');
            await result.current.enviar();
        });
        expect(onSubmit).toHaveBeenCalledWith({ a: 'nuevo' });
    });
});

describe('useFormulario · estado', () => {
    it('sucio, cambios y reiniciar', () => {
        const { result } = renderHook(() => useFormulario({ inicial: { a: 'x', b: 'y' } }));
        expect(result.current.sucio).toBe(false);
        act(() => result.current.setCampo('a', 'z'));
        expect(result.current.sucio).toBe(true);
        expect(result.current.cambios).toBe(1);
        act(() => result.current.setCampo('a', 'x'));
        expect(result.current.sucio).toBe(false);
        act(() => result.current.setCampo('b', 'q'));
        act(() => result.current.reiniciar());
        expect(result.current.valores).toEqual({ a: 'x', b: 'y' });
        act(() => result.current.reiniciar({ a: 'nuevo', b: 'otro' }));
        expect(result.current.valores).toEqual({ a: 'nuevo', b: 'otro' });
        expect(result.current.sucio).toBe(false);
    });

    it('detecta cambios en valores anidados (arreglos de bloques)', () => {
        const { result } = renderHook(() => useFormulario({ inicial: { bloques: [{ dia: 1 }] } }));
        act(() => result.current.setCampo('bloques', [{ dia: 1 }]));
        expect(result.current.sucio).toBe(false);
        act(() => result.current.setCampo('bloques', [{ dia: 1 }, { dia: 3 }]));
        expect(result.current.sucio).toBe(true);
    });

    it('setCampo acepta una función sobre el valor anterior', () => {
        const { result } = renderHook(() => useFormulario({ inicial: { n: 1 } }));
        act(() => result.current.setCampo('n', (n) => n + 1));
        expect(result.current.valores.n).toBe(2);
    });

    it('valido y primerError salen de validar aunque no se hayan mostrado', () => {
        const { result } = renderHook(() => useFormulario({ inicial: INICIAL, validar }));
        expect(result.current.valido).toBe(false);
        expect(result.current.primerError).toBe('Escribe la matrícula');
        expect(result.current.errores).toEqual({});
    });

    it('campo() entrega value, onChange (evento o valor), onBlur, invalid y error; y checked con checkbox', () => {
        const { result } = renderHook(() => useFormulario({ inicial: { a: undefined, activo: false }, validar: (v) => ({ a: v.a ? undefined : 'Falta' }) }));
        expect(result.current.campo('a')).toMatchObject({ name: 'a', value: '', invalid: false, error: undefined });
        act(() => result.current.campo('a').onBlur());
        expect(result.current.campo('a')).toMatchObject({ invalid: true, error: 'Falta' });
        act(() => result.current.campo('a').onChange({ target: { value: 'hola', type: 'text' } }));
        expect(result.current.campo('a').value).toBe('hola');
        act(() => result.current.campo('a').onChange('crudo'));
        expect(result.current.campo('a').value).toBe('crudo');
        const casilla = result.current.campo('activo', { checkbox: true });
        expect(casilla.checked).toBe(false);
        expect('value' in casilla).toBe(false);
        act(() => casilla.onChange({ target: { checked: true, type: 'checkbox' } }));
        expect(result.current.campo('activo', { checkbox: true }).checked).toBe(true);
    });

    it('validarCampos marca como tocados solo esos campos y dice si están bien', () => {
        const { result } = renderHook(() => useFormulario({ inicial: INICIAL, validar }));
        let ok;
        act(() => { ok = result.current.validarCampos(['matricula']); });
        expect(ok).toBe(false);
        expect(result.current.errores).toEqual({ matricula: 'Escribe la matrícula' });
        act(() => result.current.setCampo('matricula', 'E1'));
        act(() => { ok = result.current.validarCampos(['matricula']); });
        expect(ok).toBe(true);
        expect(result.current.errores).toEqual({});
    });

    it('erroresDe devuelve los errores actuales de esos campos sin mostrarlos', () => {
        const { result } = renderHook(() => useFormulario({ inicial: INICIAL, validar }));
        expect(result.current.erroresDe(['matricula'])).toEqual({ matricula: 'Escribe la matrícula' });
        expect(result.current.erroresDe(['otro'])).toEqual({});
        act(() => result.current.setCampo('matricula', 'E1'));
        expect(result.current.erroresDe(['matricula', 'correo'])).toEqual({ correo: 'Escribe un correo válido' });
        expect(result.current.errores).toEqual({});
    });

    it('fijarErrores muestra errores del servidor y se limpian al editar el campo', () => {
        const { result } = renderHook(() => useFormulario({ inicial: { a: '' } }));
        act(() => result.current.fijarErrores({ a: 'No disponible' }));
        expect(result.current.errores).toEqual({ a: 'No disponible' });
        act(() => result.current.setCampo('a', 'x'));
        expect(result.current.errores).toEqual({});
    });

    it('no falla si el componente se desmonta durante el envío', async () => {
        let resolver;
        const onSubmit = vi.fn(() => new Promise((r) => { resolver = r; }));
        const { result, unmount } = renderHook(() => useFormulario({ inicial: { a: 'x' }, onSubmit }));
        let promesa;
        act(() => { promesa = result.current.enviar(); });
        unmount();
        resolver();
        await expect(promesa).resolves.toBe(true);
    });
});
