// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { sumarAnios } from '@/lib/formularios/fechas.js';
import Field from '../Field/Field.jsx';
import CampoFecha from './CampoFecha.jsx';

function Controlado({ inicial = '', ...props }) {
    const [valor, setValor] = useState(inicial);
    return <CampoFecha aria-label="Fecha" value={valor} onChange={(e) => setValor(e.target.value)} {...props} />;
}

describe('CampoFecha', () => {
    it('es un <input type="date"> con min y max y escribe la fecha en palabras', () => {
        render(<CampoFecha aria-label="Fecha" value="2026-10-05" onChange={() => {}} min="2026-01-01" max="2026-12-31" />);
        const campo = screen.getByLabelText('Fecha');
        expect(campo).toHaveAttribute('type', 'date');
        expect(campo).toHaveAttribute('min', '2026-01-01');
        expect(campo).toHaveAttribute('max', '2026-12-31');
        expect(screen.getByText('lunes, 5 de octubre de 2026')).toBeInTheDocument();
    });

    it('mostrarTexto={false} quita la fecha en palabras', () => {
        render(<CampoFecha aria-label="Fecha" value="2026-10-05" onChange={() => {}} mostrarTexto={false} />);
        expect(screen.queryByText(/octubre/)).toBeNull();
    });

    it('por omisión ofrece «Hoy» y lo aplica como un evento de cambio normal', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn((e) => e.target.value);
        render(<CampoFecha aria-label="Fecha" value="" onChange={onChange} hoy="2026-10-05" />);
        await user.click(screen.getByRole('button', { name: 'Hoy' }));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.results[0].value).toBe('2026-10-05');
    });

    it('al aplicar un atajo el campo muestra la fecha y la dice en palabras', async () => {
        const user = userEvent.setup();
        render(<Controlado hoy="2026-10-05" />);
        await user.click(screen.getByRole('button', { name: 'Hoy' }));
        expect(screen.getByLabelText('Fecha')).toHaveValue('2026-10-05');
        expect(screen.getByText('lunes, 5 de octubre de 2026')).toBeInTheDocument();
        expect(screen.getByLabelText('Fecha')).toHaveFocus();
    });

    it('atajos propios: «+1 año» respecto a otra fecha', async () => {
        const user = userEvent.setup();
        const firma = '2026-08-01';
        render(<Controlado atajos={[{ label: '+1 año', valor: () => sumarAnios(firma, 1) }, { label: '+2 años', valor: () => sumarAnios(firma, 2) }]} />);
        await user.click(screen.getByRole('button', { name: '+1 año' }));
        expect(screen.getByLabelText('Fecha')).toHaveValue('2027-08-01');
        await user.click(screen.getByRole('button', { name: '+2 años' }));
        expect(screen.getByLabelText('Fecha')).toHaveValue('2028-08-01');
    });

    it('oculta los atajos que caen fuera de min/max', () => {
        render(<CampoFecha aria-label="Fecha" value="" onChange={() => {}} hoy="2026-10-05" max="2026-10-01" />);
        expect(screen.queryByRole('button', { name: 'Hoy' })).toBeNull();
        expect(screen.queryByRole('group', { name: 'Atajos de fecha' })).toBeNull();
    });

    it('atajos={[]} no dibuja atajos', () => {
        render(<CampoFecha aria-label="Fecha" value="" onChange={() => {}} atajos={[]} />);
        expect(screen.queryByRole('group', { name: 'Atajos de fecha' })).toBeNull();
    });

    it('teclear una fecha dispara onChange con el valor', () => {
        const onChange = vi.fn((e) => e.target.value);
        render(<CampoFecha aria-label="Fecha" value="" onChange={onChange} atajos={[]} />);
        fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-03-02' } });
        expect(onChange.mock.results[0].value).toBe('2026-03-02');
    });

    it('deshabilitado bloquea el campo y los atajos', () => {
        render(<CampoFecha aria-label="Fecha" value="" onChange={() => {}} hoy="2026-10-05" disabled />);
        expect(screen.getByLabelText('Fecha')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Hoy' })).toBeDisabled();
    });

    it('funciona con Field: etiqueta, error y aria-invalid', () => {
        render(
            <Field label="Fecha de firma" required error="Elige una fecha.">
                <CampoFecha value="" onChange={() => {}} />
            </Field>,
        );
        const campo = screen.getByLabelText(/Fecha de firma/);
        expect(campo).toHaveAttribute('type', 'date');
        expect(campo).toHaveAttribute('aria-invalid', 'true');
        expect(campo).toBeRequired();
    });
});

describe('CampoFecha: «Hoy» y la hidratación', () => {
    it('sin `hoy` usa la fecha del navegador (la de hoy, en local)', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 9, 5, 23, 30)); // 23:30 locales: en UTC ya sería el 6
        try {
            const onChange = vi.fn((e) => e.target.value);
            render(<CampoFecha aria-label="Fecha" value="" onChange={onChange} />);
            fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
            expect(onChange.mock.results[0].value).toBe('2026-10-05');
        } finally {
            vi.useRealTimers();
        }
    });

    it('el render del servidor no conoce «Hoy»: no dibuja el atajo hasta hidratar', async () => {
        const { renderToString } = await import('react-dom/server');
        const html = renderToString(<CampoFecha aria-label="Fecha" value="" onChange={() => {}} />);
        expect(html).not.toContain('Hoy');
        const conHoy = renderToString(<CampoFecha aria-label="Fecha" value="" onChange={() => {}} hoy="2026-10-05" />);
        expect(conHoy).toContain('Hoy'); // con `hoy` explícito sale igual en servidor y cliente
    });
});
