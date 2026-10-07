// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Pills from './Pills.jsx';

const ITEMS = [{ id: 'todos', label: 'Todos', count: 9 }, { id: 'asistencia', label: 'Asistencia', count: 3 }, { id: 'pronto', label: 'Próximamente' }];

describe('Pills', () => {
    it('grupo de botones con aria-pressed y contadores', () => {
        render(<Pills items={ITEMS} value="todos" onChange={() => {}} label="Filtrar módulos" />);
        expect(screen.getByRole('group', { name: 'Filtrar módulos' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Todos/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /Asistencia/ })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: /Asistencia/ })).toHaveTextContent('3');
        expect(screen.getByRole('button', { name: 'Próximamente' })).toBeInTheDocument();
    });
    it('al elegir llama a onChange con el id', async () => {
        const onChange = vi.fn();
        render(<Pills items={ITEMS} value="todos" onChange={onChange} />);
        await userEvent.click(screen.getByRole('button', { name: /Asistencia/ }));
        expect(onChange).toHaveBeenCalledWith('asistencia');
    });
});

describe('Pills · multiple', () => {
    it('enciende y apaga píldoras y entrega siempre el arreglo nuevo', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Pills multiple items={ITEMS} value={['asistencia']} onChange={onChange} />);
        expect(screen.getByRole('button', { name: /Asistencia/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /Todos/ })).toHaveAttribute('aria-pressed', 'false');
        await user.click(screen.getByRole('button', { name: /Todos/ }));
        expect(onChange).toHaveBeenLastCalledWith(['asistencia', 'todos']);
        await user.click(screen.getByRole('button', { name: /Asistencia/ }));
        expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it('tolera un valor que no es arreglo y no muta el original', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const valor = ['pronto'];
        const { rerender } = render(<Pills multiple items={ITEMS} value={undefined} onChange={onChange} />);
        await user.click(screen.getByRole('button', { name: /Todos/ }));
        expect(onChange).toHaveBeenLastCalledWith(['todos']);
        rerender(<Pills multiple items={ITEMS} value={valor} onChange={onChange} />);
        await user.click(screen.getByRole('button', { name: /Asistencia/ }));
        expect(valor).toEqual(['pronto']);
    });
});
