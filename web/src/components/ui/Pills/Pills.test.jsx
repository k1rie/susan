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
