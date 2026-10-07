// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BarraFiltros from './BarraFiltros.jsx';
import { chipsActivos, esVacio, valorSinElegir } from './barraFiltros.utils.js';

const ESTATUS = [
    { value: 'activo', label: 'Activo' },
    { value: 'baja', label: 'Baja' },
];

function Caso({ onQ = () => {}, extra = {}, inicial = {} }) {
    const [q, setQ] = useState(inicial.q ?? '');
    const [estatus, setEstatus] = useState(inicial.estatus ?? '');
    return (
        <BarraFiltros
            q={q}
            onQ={(v) => {
                onQ(v);
                setQ(v);
            }}
            placeholder="Matrícula o nombre"
            filtros={[{ name: 'estatus', label: 'Estatus', options: ESTATUS, value: estatus, onChange: setEstatus }]}
            {...extra}
        />
    );
}

describe('barraFiltros.utils', () => {
    it('esVacio, chipsActivos y valorSinElegir', () => {
        expect(esVacio('')).toBe(true);
        expect(esVacio([])).toBe(true);
        expect(esVacio(null)).toBe(true);
        expect(esVacio('x')).toBe(false);
        expect(esVacio(0)).toBe(false);
        const filtros = [
            { name: 'a', label: 'A', options: ESTATUS, value: 'baja' },
            { name: 'b', label: 'B', options: ESTATUS, value: ['activo', 'baja'], multiple: true },
            { name: 'c', label: 'C', options: ESTATUS, value: '' },
        ];
        expect(chipsActivos(filtros).map((c) => c.texto)).toEqual(['Baja', 'Activo', 'Baja']);
        expect(valorSinElegir(filtros[1], 'activo')).toEqual(['baja']);
        expect(valorSinElegir(filtros[0], 'baja')).toBe('');
    });
});

describe('BarraFiltros · búsqueda con retraso', () => {
    // Con temporizadores falsos se usa fireEvent (user-event espera temporizadores reales de Testing Library).
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());
    const escribir = (texto) => fireEvent.change(screen.getByRole('searchbox'), { target: { value: texto } });

    it('es una región de búsqueda y el campo se llama como su placeholder', () => {
        render(<Caso />);
        expect(screen.getByRole('search')).toBeInTheDocument();
        expect(screen.getByRole('searchbox', { name: 'Matrícula o nombre' })).toBeInTheDocument();
    });

    it('emite 300 ms después de la última tecla, una sola vez y sin espacios sobrantes', () => {
        const onQ = vi.fn();
        render(<Caso onQ={onQ} />);
        escribir('ana ');
        expect(onQ).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(299));
        expect(onQ).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(onQ).toHaveBeenCalledTimes(1);
        expect(onQ).toHaveBeenCalledWith('ana');
        act(() => vi.advanceTimersByTime(1000));
        expect(onQ).toHaveBeenCalledTimes(1);
    });

    it('seguir escribiendo reinicia la espera', () => {
        const onQ = vi.fn();
        render(<Caso onQ={onQ} />);
        escribir('a');
        act(() => vi.advanceTimersByTime(250));
        escribir('ab');
        act(() => vi.advanceTimersByTime(250));
        expect(onQ).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(50));
        expect(onQ).toHaveBeenCalledWith('ab');
    });

    it('si el texto queda en 0 caracteres limpia al instante, sin esperar el retraso', () => {
        const onQ = vi.fn();
        render(<Caso onQ={onQ} inicial={{ q: 'ana' }} />);
        escribir('');
        expect(onQ).toHaveBeenCalledTimes(1);
        expect(onQ).toHaveBeenCalledWith('');
    });

    it('borrar con la espera pendiente cancela el envío del texto viejo', () => {
        const onQ = vi.fn();
        render(<Caso onQ={onQ} />);
        escribir('ana');
        act(() => vi.advanceTimersByTime(100));
        escribir('');
        act(() => vi.advanceTimersByTime(1000));
        expect(onQ).not.toHaveBeenCalled();
    });

    it('Enter busca al instante', () => {
        const onQ = vi.fn();
        render(<Caso onQ={onQ} />);
        escribir('luis');
        fireEvent.submit(screen.getByRole('search').querySelector('form'));
        expect(onQ).toHaveBeenCalledWith('luis');
        act(() => vi.advanceTimersByTime(500));
        expect(onQ).toHaveBeenCalledTimes(1);
    });

    it('Esc borra el texto y la X de la caja también, devolviendo el foco al campo', () => {
        const onQ = vi.fn();
        render(<Caso onQ={onQ} inicial={{ q: 'ana' }} />);
        fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
        expect(screen.getByRole('searchbox')).toHaveValue('');
        expect(onQ).toHaveBeenLastCalledWith('');
        escribir('x');
        fireEvent.click(screen.getByRole('button', { name: 'Borrar búsqueda' }));
        expect(screen.getByRole('searchbox')).toHaveValue('');
        expect(screen.getByRole('searchbox')).toHaveFocus();
    });

    it('un cambio externo de q se refleja en el campo', () => {
        const { rerender } = render(<BarraFiltros q="ana" onQ={() => {}} placeholder="Buscar alumno" />);
        expect(screen.getByRole('searchbox')).toHaveValue('ana');
        rerender(<BarraFiltros q="" onQ={() => {}} placeholder="Buscar alumno" />);
        expect(screen.getByRole('searchbox')).toHaveValue('');
        rerender(<BarraFiltros q="luis" onQ={() => {}} placeholder="Buscar alumno" />);
        expect(screen.getByRole('searchbox')).toHaveValue('luis');
    });

    it('el eco tardío de lo que emitió no pisa lo que la persona siguió escribiendo', () => {
        const onQ = vi.fn();
        const { rerender } = render(<BarraFiltros q="" onQ={onQ} placeholder="Buscar" />);
        escribir('ana');
        act(() => vi.advanceTimersByTime(300));
        expect(onQ).toHaveBeenCalledWith('ana');
        // La pantalla (p. ej. estado en la URL) tarda: la persona ya escribió otra letra cuando llega el eco.
        escribir('anax');
        rerender(<BarraFiltros q="ana" onQ={onQ} placeholder="Buscar" />);
        expect(screen.getByRole('searchbox')).toHaveValue('anax');
    });
});

describe('BarraFiltros · filtros, chips y Limpiar', () => {
    it('el filtro select ofrece «Todos» y avisa del cambio', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<BarraFiltros q="" onQ={() => {}} filtros={[{ name: 'estatus', label: 'Estatus', options: ESTATUS, value: '', onChange }]} />);
        const select = screen.getByLabelText('Estatus');
        expect([...select.options].map((o) => o.text)).toEqual(['Todos', 'Activo', 'Baja']);
        await user.selectOptions(select, 'baja');
        expect(onChange).toHaveBeenCalledWith('baja');
    });

    it('un filtro activo aparece como chip con su botón para quitarlo', async () => {
        const user = userEvent.setup();
        render(<Caso inicial={{ estatus: 'baja' }} />);
        const chips = screen.getByRole('list', { name: 'Filtros activos' });
        expect(chips).toHaveTextContent('Estatus:');
        expect(chips).toHaveTextContent('Baja');
        await user.click(screen.getByRole('button', { name: 'Quitar filtro Estatus: Baja' }));
        expect(screen.queryByRole('list', { name: 'Filtros activos' })).toBeNull();
        expect(screen.getByLabelText('Estatus')).toHaveValue('');
    });

    it('«Limpiar» solo aparece si hay algo activo y limpia texto y filtros', async () => {
        const user = userEvent.setup();
        const { rerender } = render(<Caso />);
        expect(screen.queryByRole('button', { name: 'Limpiar' })).toBeNull();
        rerender(<Caso inicial={{ estatus: 'activo' }} />);
        await user.type(screen.getByRole('searchbox'), 'ana{Enter}');
        const limpiar = screen.getByRole('button', { name: 'Limpiar' });
        await user.click(limpiar);
        expect(screen.getByRole('searchbox')).toHaveValue('');
        expect(screen.getByLabelText('Estatus')).toHaveValue('');
        expect(screen.queryByRole('button', { name: 'Limpiar' })).toBeNull();
    });

    it('onLimpiar sustituye la limpieza por defecto', async () => {
        const user = userEvent.setup();
        const onLimpiar = vi.fn();
        const onChange = vi.fn();
        render(
            <BarraFiltros
                q="ana"
                onQ={() => {}}
                onLimpiar={onLimpiar}
                filtros={[{ name: 'estatus', label: 'Estatus', options: ESTATUS, value: 'baja', onChange }]}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Limpiar' }));
        expect(onLimpiar).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByRole('searchbox')).toHaveValue('');
    });

    it('muestra el texto de resultado en una región aria-live', () => {
        const { rerender } = render(<BarraFiltros q="" onQ={() => {}} resultado="12 alumnos" />);
        expect(screen.getByRole('status')).toHaveTextContent('12 alumnos');
        rerender(<BarraFiltros q="" onQ={() => {}} resultado="1 alumno" />);
        expect(screen.getByRole('status')).toHaveTextContent('1 alumno');
    });

    it('filtros de tipo pills: simple con «Todos» y múltiple con un chip por opción', async () => {
        const user = userEvent.setup();
        const onSimple = vi.fn();
        const onMultiple = vi.fn();
        render(
            <BarraFiltros
                q=""
                onQ={() => {}}
                filtros={[
                    { name: 'e', label: 'Estatus', tipo: 'pills', options: ESTATUS, value: '', onChange: onSimple },
                    { name: 'm', label: 'Días', tipo: 'pills', multiple: true, options: ESTATUS, value: ['activo', 'baja'], onChange: onMultiple },
                ]}
            />,
        );
        expect(screen.getByRole('group', { name: 'Estatus' })).toBeInTheDocument();
        await user.click(within_group('Estatus', 'Baja'));
        expect(onSimple).toHaveBeenCalledWith('baja');
        await user.click(within_group('Días', 'Activo'));
        expect(onMultiple).toHaveBeenCalledWith(['baja']);
        await user.click(screen.getByRole('button', { name: 'Quitar filtro Días: Baja' }));
        expect(onMultiple).toHaveBeenLastCalledWith(['activo']);
    });

    it('sin onLimpiar, Limpiar vacía cada filtro activo (múltiples con arreglo vacío)', async () => {
        const user = userEvent.setup();
        const onE = vi.fn();
        const onM = vi.fn();
        const onQ = vi.fn();
        render(
            <BarraFiltros
                q="ana"
                onQ={onQ}
                filtros={[
                    { name: 'e', label: 'Estatus', options: ESTATUS, value: 'baja', onChange: onE },
                    { name: 'm', label: 'Días', tipo: 'pills', multiple: true, options: ESTATUS, value: ['activo'], onChange: onM },
                ]}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Limpiar' }));
        expect(onQ).toHaveBeenCalledWith('');
        expect(onE).toHaveBeenCalledWith('');
        expect(onM).toHaveBeenCalledWith([]);
    });
});

function within_group(grupo, nombre) {
    const g = screen.getByRole('group', { name: grupo });
    return [...g.querySelectorAll('button')].find((b) => b.textContent.includes(nombre));
}

// jsdom: keydown de Escape sin userEvent también debe funcionar dentro de la caja.
describe('BarraFiltros · teclado', () => {
    it('Escape con la caja vacía no se traga el evento (puede cerrar un diálogo contenedor)', () => {
        const alDocumento = vi.fn();
        document.addEventListener('keydown', alDocumento);
        render(<BarraFiltros q="" onQ={() => {}} />);
        fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
        document.removeEventListener('keydown', alDocumento);
        expect(alDocumento).toHaveBeenCalled();
    });
});
