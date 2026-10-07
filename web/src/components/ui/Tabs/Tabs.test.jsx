// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Tabs from './Tabs.jsx';

const TABS = [
    { id: 'datos', label: 'Datos' },
    { id: 'horario', label: 'Horario' },
    { id: 'aula', label: 'Aula', disabled: true },
    { id: 'inscritos', label: 'Inscripciones', count: 3 },
];

function Caso({ confirmLeave, onChange = () => {} }) {
    const [valor, setValor] = useState('datos');
    return (
        <Tabs
            tabs={TABS}
            value={valor}
            confirmLeave={confirmLeave}
            onChange={(id) => {
                onChange(id);
                setValor(id);
            }}
        />
    );
}

describe('Tabs', () => {
    it('roles, selección y contador', () => {
        render(<Caso />);
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Datos' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: /Inscripciones/ })).toHaveTextContent('(3)');
    });

    it('cambia con clic y con flechas saltando las deshabilitadas', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Caso onChange={onChange} />);
        await user.click(screen.getByRole('tab', { name: 'Horario' }));
        expect(onChange).toHaveBeenLastCalledWith('horario');
        await user.keyboard('{ArrowRight}');
        expect(onChange).toHaveBeenLastCalledWith('inscritos');
        expect(screen.getByRole('tab', { name: /Inscripciones/ })).toHaveFocus();
        await user.keyboard('{Home}');
        expect(onChange).toHaveBeenLastCalledWith('datos');
        await user.keyboard('{End}');
        expect(onChange).toHaveBeenLastCalledWith('inscritos');
    });
});

describe('Tabs · confirmLeave', () => {
    it('si devuelve false cancela el cambio por clic y por teclado y deja el foco', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const confirmLeave = vi.fn(() => false);
        render(<Caso confirmLeave={confirmLeave} onChange={onChange} />);
        await user.click(screen.getByRole('tab', { name: 'Horario' }));
        expect(confirmLeave).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByRole('tab', { name: 'Datos' })).toHaveAttribute('aria-selected', 'true');
        screen.getByRole('tab', { name: 'Datos' }).focus();
        await user.keyboard('{ArrowRight}');
        await user.keyboard('{End}');
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByRole('tab', { name: 'Datos' })).toHaveFocus();
    });

    it('si devuelve true deja cambiar', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Caso confirmLeave={() => true} onChange={onChange} />);
        await user.click(screen.getByRole('tab', { name: 'Horario' }));
        expect(onChange).toHaveBeenCalledWith('horario');
    });

    it('volver a la misma pestaña no pregunta', async () => {
        const user = userEvent.setup();
        const confirmLeave = vi.fn(() => false);
        render(<Caso confirmLeave={confirmLeave} />);
        await user.click(screen.getByRole('tab', { name: 'Datos' }));
        expect(confirmLeave).not.toHaveBeenCalled();
    });
});
