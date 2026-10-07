// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Field from '../Field/Field.jsx';
import Textarea from './Textarea.jsx';

function Controlada(props) {
    const [valor, setValor] = useState('');
    return <Textarea aria-label="motivo" value={valor} onChange={(e) => setValor(e.target.value)} {...props} />;
}

describe('Textarea', () => {
    it('renderiza filas y maxLength nativos', () => {
        render(<Textarea aria-label="m" rows={5} maxLength={200} />);
        const area = screen.getByLabelText('m');
        expect(area).toHaveAttribute('rows', '5');
        expect(area).toHaveAttribute('maxlength', '200');
    });

    it('showCount + maxLength muestra n/max en una región polite', async () => {
        const user = userEvent.setup();
        render(<Controlada maxLength={200} showCount />);
        expect(screen.getByText('0/200')).toHaveAttribute('aria-live', 'polite');
        await user.type(screen.getByLabelText('motivo'), 'hola');
        expect(screen.getByText('4/200')).toBeInTheDocument();
    });

    it('sin showCount o sin maxLength no hay contador', () => {
        const { rerender } = render(<Textarea aria-label="m" maxLength={10} value="" onChange={() => {}} />);
        expect(screen.queryByText('0/10')).toBeNull();
        rerender(<Textarea aria-label="m" showCount value="" onChange={() => {}} />);
        expect(screen.queryByText(/\//)).toBeNull();
    });

    it('invalid marca el borde y funciona con Field', () => {
        render(
            <Field label="Motivo" error="Obligatorio">
                <Textarea />
            </Field>,
        );
        const area = screen.getByLabelText('Motivo');
        expect(area).toHaveAttribute('aria-invalid', 'true');
        expect(area).toHaveClass('border-destructive');
    });

    it('autoGrow quita el tirador de tamaño y ajusta el alto al contenido hasta maxRows', () => {
        const alto = vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(120);
        const { rerender } = render(<Textarea aria-label="m" autoGrow value="uno" onChange={() => {}} />);
        const area = screen.getByLabelText('m');
        expect(area).toHaveClass('resize-none');
        expect(area.style.height).toBe('120px');
        expect(area.style.overflowY).toBe('hidden');

        // Con maxRows el alto se acota (jsdom no calcula estilos: línea de 20 px por omisión) y aparece el scroll.
        alto.mockReturnValue(400);
        rerender(<Textarea aria-label="m" autoGrow maxRows={4} value="uno\ndos" onChange={() => {}} />);
        expect(parseFloat(area.style.height)).toBeLessThan(400);
        expect(area.style.overflowY).toBe('auto');
    });

    it('sin autoGrow no toca el alto', () => {
        vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(120);
        render(<Textarea aria-label="m" value="x" onChange={() => {}} />);
        expect(screen.getByLabelText('m').style.height).toBe('');
    });

    it('reenvía el ref del consumidor (objeto y función)', () => {
        const objeto = { current: null };
        render(<Textarea ref={objeto} aria-label="a" />);
        expect(objeto.current).toBe(screen.getByLabelText('a'));
        const funcion = vi.fn();
        render(<Textarea ref={funcion} aria-label="b" />);
        expect(funcion).toHaveBeenCalledWith(screen.getByLabelText('b'));
    });
});
