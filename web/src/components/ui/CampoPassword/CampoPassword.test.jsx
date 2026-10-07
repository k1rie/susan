// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Field from '../Field/Field.jsx';
import CampoPassword from './CampoPassword.jsx';
import { evaluarReglas, REGLAS_PREDETERMINADAS } from './campoPassword.utils.js';

function Controlado({ inicial = '', alCambiar, ...props }) {
    const [valor, setValor] = useState(inicial);
    return (
        <CampoPassword
            aria-label="Contraseña"
            value={valor}
            onChange={(e) => {
                setValor(e.target.value);
                alCambiar?.(e);
            }}
            {...props}
        />
    );
}

afterEach(() => {
    vi.useRealTimers();
});

describe('CampoPassword', () => {
    it('empieza oculta, con autocomplete new-password y se muestra/oculta con aria-pressed', async () => {
        const user = userEvent.setup();
        render(<Controlado inicial="secreta1234" />);
        const campo = screen.getByLabelText('Contraseña');
        expect(campo).toHaveAttribute('type', 'password');
        expect(campo).toHaveAttribute('autocomplete', 'new-password');
        const boton = screen.getByRole('button', { name: 'Mostrar contraseña' });
        expect(boton).toHaveAttribute('aria-pressed', 'false');
        await user.click(boton);
        expect(campo).toHaveAttribute('type', 'text');
        expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('lista las 3 reglas reales con icono + texto y las marca en vivo mientras se escribe', async () => {
        const user = userEvent.setup();
        render(<Controlado />);
        const lista = screen.getByRole('list', { name: 'Requisitos de la contraseña' });
        expect(lista).toHaveTextContent('Al menos 10 caracteres (falta)');
        expect(screen.getByText('0 de 3 requisitos')).toBeInTheDocument();
        await user.type(screen.getByLabelText('Contraseña'), 'abc');
        expect(lista).toHaveTextContent('Contiene una letra (cumple)');
        expect(lista).toHaveTextContent('Contiene un número (falta)');
        expect(screen.getByText('1 de 3 requisitos')).toBeInTheDocument();
        await user.type(screen.getByLabelText('Contraseña'), 'defghij1');
        expect(screen.getByText('3 de 3 requisitos')).toBeInTheDocument();
        expect(lista).not.toHaveTextContent('(falta)');
    });

    it('la lista de requisitos describe el campo', () => {
        render(<Controlado />);
        expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription(/Al menos 10 caracteres/);
    });

    it('acepta reglas propias y reglas={false} quita la lista', () => {
        const { rerender } = render(<Controlado reglas={[{ id: 'sim', texto: 'Lleva un símbolo', test: (v) => /[!@#]/.test(v) }]} inicial="hola!" />);
        expect(screen.getByRole('list')).toHaveTextContent('Lleva un símbolo (cumple)');
        expect(screen.getByText('1 de 1 requisitos')).toBeInTheDocument();
        rerender(<Controlado reglas={false} />);
        expect(screen.queryByRole('list')).toBeNull();
        expect(screen.getByLabelText('Contraseña')).not.toHaveAttribute('aria-describedby');
    });

    it('onChange recibe eventos reales como un Input', async () => {
        const user = userEvent.setup();
        const valores = [];
        render(<Controlado alCambiar={(e) => valores.push(e.target.value)} />);
        await user.type(screen.getByLabelText('Contraseña'), 'ab');
        expect(valores).toEqual(['a', 'ab']);
    });

    it('Generar escribe una contraseña válida, la muestra y avisa', async () => {
        const user = userEvent.setup();
        const onGenerar = vi.fn();
        const recibidos = [];
        render(<Controlado generar onGenerar={onGenerar} alCambiar={(e) => recibidos.push(e.target.value)} />);
        await user.click(screen.getByRole('button', { name: 'Generar' }));
        const campo = screen.getByLabelText('Contraseña');
        expect(campo).toHaveAttribute('type', 'text');
        expect(campo.value).toHaveLength(16);
        expect(recibidos).toEqual([campo.value]);
        expect(onGenerar).toHaveBeenCalledWith(campo.value);
        expect(evaluarReglas(REGLAS_PREDETERMINADAS, campo.value).every((r) => r.cumple)).toBe(true);
        expect(screen.getByText('3 de 3 requisitos')).toBeInTheDocument();
    });

    it('longitudGenerada se respeta', async () => {
        const user = userEvent.setup();
        render(<Controlado generar longitudGenerada={20} />);
        await user.click(screen.getByRole('button', { name: 'Generar' }));
        expect(screen.getByLabelText('Contraseña').value).toHaveLength(20);
    });

    it('Copiar escribe en el portapapeles, avisa con texto y el aviso vuelve solo', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        // Después de setup(): user-event instala su propio portapapeles y hay que reemplazarlo por el espía.
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        render(<Controlado copiar inicial="secreta1234" />);
        await user.click(screen.getByRole('button', { name: 'Copiar' }));
        expect(writeText).toHaveBeenCalledWith('secreta1234');
        expect(await screen.findByRole('button', { name: 'Copiada' })).toBeInTheDocument();
        expect(screen.getByText('Contraseña copiada.')).toBeInTheDocument();
        act(() => {
            vi.advanceTimersByTime(2100);
        });
        expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    });

    it('si el portapapeles falla lo dice y no finge éxito', async () => {
        const user = userEvent.setup();
        const writeText = vi.fn().mockRejectedValue(new Error('denegado'));
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        render(<Controlado copiar inicial="secreta1234" />);
        await user.click(screen.getByRole('button', { name: 'Copiar' }));
        expect(await screen.findByText(/No se pudo copiar/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Copiada' })).toBeNull();
    });

    it('Copiar está deshabilitado sin contraseña', () => {
        render(<Controlado copiar />);
        expect(screen.getByRole('button', { name: 'Copiar' })).toBeDisabled();
    });

    it('avisa del Bloq Mayús al teclear y lo quita al salir', () => {
        render(<Controlado />);
        const campo = screen.getByLabelText('Contraseña');
        fireEvent.keyDown(campo, { key: 'A', modifierCapsLock: true });
        expect(screen.getByRole('status')).toHaveTextContent('Bloq Mayús está activado.');
        fireEvent.keyUp(campo, { key: 'A', modifierCapsLock: false });
        expect(screen.queryByText('Bloq Mayús está activado.')).toBeNull();
        fireEvent.keyDown(campo, { key: 'A', modifierCapsLock: true });
        fireEvent.blur(campo);
        expect(screen.queryByText('Bloq Mayús está activado.')).toBeNull();
    });

    it('avisoMayusculas={false} no vigila el teclado', () => {
        render(<Controlado avisoMayusculas={false} />);
        fireEvent.keyDown(screen.getByLabelText('Contraseña'), { key: 'A', modifierCapsLock: true });
        expect(screen.queryByText('Bloq Mayús está activado.')).toBeNull();
    });

    it('conserva los manejadores del consumidor (teclado y blur)', () => {
        const onKeyDown = vi.fn();
        const onBlur = vi.fn();
        render(<Controlado onKeyDown={onKeyDown} onBlur={onBlur} />);
        const campo = screen.getByLabelText('Contraseña');
        fireEvent.keyDown(campo, { key: 'a' });
        fireEvent.blur(campo);
        expect(onKeyDown).toHaveBeenCalledTimes(1);
        expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('con Field recibe id, etiqueta, required y error, y suma la lista al aria-describedby', () => {
        render(
            <Field label="Contraseña nueva" required error="La contraseña es muy débil." hint="Elige una que no uses en otro sitio">
                <CampoPassword value="" onChange={() => {}} />
            </Field>,
        );
        const campo = screen.getByLabelText(/Contraseña nueva/);
        expect(campo).toBeRequired();
        expect(campo).toHaveAttribute('aria-invalid', 'true');
        expect(campo).toHaveAccessibleDescription(/Elige una que no uses/);
        expect(campo).toHaveAccessibleDescription(/La contraseña es muy débil/);
        expect(campo).toHaveAccessibleDescription(/Al menos 10 caracteres/);
    });

    it('dentro de Field el error y la ayuda van pegados a la caja, ANTES de la lista de requisitos', () => {
        render(
            <Field label="Contraseña nueva" required error="La contraseña es muy débil." hint="Elige una que no uses en otro sitio">
                <CampoPassword value="" onChange={() => {}} generar />
            </Field>,
        );
        const campo = screen.getByLabelText(/Contraseña nueva/);
        const error = screen.getByRole('alert');
        const ayuda = screen.getByText('Elige una que no uses en otro sitio');
        const lista = screen.getByRole('list', { name: 'Requisitos de la contraseña' });
        const boton = screen.getByRole('button', { name: 'Generar' });
        const antes = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        expect(antes(campo, ayuda)).toBe(true);
        expect(antes(ayuda, error)).toBe(true);
        expect(antes(error, boton)).toBe(true);
        expect(antes(error, lista)).toBe(true);
        // El error no se duplica: Field no lo pinta además de CampoPassword.
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(campo).toHaveAccessibleDescription(/La contraseña es muy débil/);
    });

    it('con Field y valid el «Válido» también va bajo la caja', () => {
        render(
            <Field label="Contraseña" valid>
                <CampoPassword value="abcdefghi1" onChange={() => {}} />
            </Field>,
        );
        const lista = screen.getByRole('list', { name: 'Requisitos de la contraseña' });
        expect(screen.getByText('Válido').compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('sin Field no escribe mensajes y sigue funcionando', () => {
        render(<Controlado />);
        expect(screen.queryByRole('alert')).toBeNull();
        expect(CampoPassword.recibeMensajes).toBe(true);
    });

    it('un ref del consumidor apunta al input y no rompe el ref interno de «Generar»', async () => {
        const user = userEvent.setup();
        const objeto = createRef();
        const recibidos = [];
        render(<Controlado ref={objeto} generar alCambiar={(e) => recibidos.push(e.target.value)} />);
        expect(objeto.current).toBe(screen.getByLabelText('Contraseña'));
        objeto.current.focus();
        expect(screen.getByLabelText('Contraseña')).toHaveFocus();
        await user.click(screen.getByRole('button', { name: 'Generar' }));
        expect(recibidos).toHaveLength(1);
        expect(screen.getByLabelText('Contraseña').value).toHaveLength(16);
    });

    it('acepta un ref de función', () => {
        let nodo = null;
        render(<Controlado ref={(el) => { nodo = el; }} />);
        expect(nodo).toBe(screen.getByLabelText('Contraseña'));
    });

    it('deshabilitado bloquea el campo, el ojo y los botones', () => {
        render(<Controlado disabled generar copiar inicial="abc" />);
        expect(screen.getByLabelText('Contraseña')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Generar' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Copiar' })).toBeDisabled();
    });
});
