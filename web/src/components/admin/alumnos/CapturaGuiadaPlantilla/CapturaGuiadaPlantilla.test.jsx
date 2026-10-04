// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CapturaGuiadaPlantilla from './CapturaGuiadaPlantilla.jsx';
import { numerarTomas, ordenarTomas, PASOS_TOMA, primerPasoLibre, ranurasGuiadas, textoCaptura } from './capturaGuiada.utils.js';

const mocks = vi.hoisted(() => ({ capture: vi.fn() }));
// La cámara real necesita getUserMedia: se sustituye por un objeto con la misma API de ref (capture).
vi.mock('@/components/ui/CameraCapture', async () => {
    const { useImperativeHandle } = await import('react');
    return {
        default: function CamaraSimulada({ ref, showShutter }) {
            useImperativeHandle(ref, () => ({ capture: mocks.capture }));
            return <div data-testid="camara" data-obturador={String(showShutter)} />;
        },
    };
});

const toma = (id, paso, extra = {}) => ({ id, origen: paso == null ? 'archivo' : 'camara', paso, blob: new Blob([String(id)], { type: 'image/jpeg' }), nombre: null, estado: 'aceptada', ...extra });

// Pantalla mínima con estado: la captura guiada es controlada por props.
function Arnes({ inicial = [], onCapturar, maximo }) {
    const [tomas, setTomas] = useState(inicial);
    const [id, setId] = useState(100);
    return (
        <CapturaGuiadaPlantilla
            tomas={tomas}
            maximo={maximo}
            onCapturar={(blob, paso) => {
                onCapturar?.(blob, paso);
                setTomas((t) => [...t, toma(id, paso, { blob })]);
                setId((n) => n + 1);
            }}
            onRepetir={(i) => setTomas((t) => t.filter((x) => x.id !== i))}
            onQuitar={(i) => setTomas((t) => t.filter((x) => x.id !== i))}
        />
    );
}

beforeEach(() => {
    mocks.capture.mockReset();
    mocks.capture.mockImplementation(async () => new Blob(['x'], { type: 'image/jpeg' }));
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
});

const capturar = async () => {
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^Capturar toma|tomas están capturadas/ }));
    });
};

describe('utils de la captura guiada', () => {
    it('los 5 pasos llevan sus textos exactos y las tomas 4 y 5 son opcionales', () => {
        expect(PASOS_TOMA.map((p) => p.titulo)).toEqual(['De frente', 'Gira a la izquierda', 'Gira a la derecha', 'Inclina hacia arriba', 'Otra expresión o luz']);
        expect(PASOS_TOMA[0].indicacion).toBe('Mira de frente a la cámara, con el rostro dentro del óvalo.');
        expect(PASOS_TOMA[1].indicacion).toBe('Gira la cabeza un poco hacia tu izquierda (unos 15 grados) sin dejar de ver la cámara.');
        expect(PASOS_TOMA[2].indicacion).toBe('Ahora gira un poco hacia tu derecha (unos 15 grados).');
        expect(PASOS_TOMA[3].indicacion).toBe('Levanta ligeramente la barbilla, sin cerrar los ojos.');
        expect(PASOS_TOMA[4].indicacion).toBe('Sonríe o cambia un poco la luz o el lugar. Mantén el rostro completo visible.');
        expect(PASOS_TOMA.map((p) => p.opcional)).toEqual([false, false, false, true, true]);
    });

    it('ordenarTomas: por paso, las subidas al final y por llegada dentro de cada grupo', () => {
        const t = [toma(5, null), toma(4, 2), toma(3, 0), toma(2, null), toma(1, 1)];
        expect(ordenarTomas(t).map((x) => x.id)).toEqual([3, 1, 4, 2, 5]);
        expect(t.map((x) => x.id)).toEqual([5, 4, 3, 2, 1]); // no muta
    });

    it('primerPasoLibre respeta el paso preferido solo si está libre', () => {
        const t = [toma(1, 0), toma(2, 2)];
        expect(primerPasoLibre(t)).toBe(1);
        expect(primerPasoLibre(t, 3)).toBe(3);
        expect(primerPasoLibre(t, 2)).toBe(1);
        expect(primerPasoLibre([0, 1, 2, 3, 4].map((p) => toma(p + 1, p)))).toBeNull();
    });

    it('numerarTomas: por paso en cámara (subidas desde el 6) y por posición en archivo', () => {
        const t = [toma(1, 0), toma(2, 2), toma(3, null), toma(4, null)];
        expect([...numerarTomas(t, 'camara')]).toEqual([[1, 1], [2, 3], [3, 6], [4, 7]]);
        expect([...numerarTomas(t, 'archivo')]).toEqual([[1, 1], [2, 2], [3, 3], [4, 4]]);
    });

    it('textoCaptura y ranurasGuiadas', () => {
        expect(textoCaptura(0)).toBe('Capturar toma 1 de 5');
        expect(textoCaptura(3)).toBe('Capturar toma 4 de 5 (opcional)');
        const r = ranurasGuiadas([toma(1, 0), toma(2, null, { nombre: 'a.jpg' })], 1);
        expect(r).toHaveLength(6);
        expect(r[0].toma.id).toBe(1);
        expect(r[1]).toMatchObject({ toma: null, destacada: true, numero: 2 });
        expect(r[5]).toMatchObject({ numero: 6, titulo: 'a.jpg', accion: 'quitar' });
    });
});

describe('CapturaGuiadaPlantilla', () => {
    it('muestra el primer paso sobre la cámara y usa obturador propio', () => {
        render(<Arnes />);
        expect(screen.getByText('De frente.')).toBeInTheDocument();
        expect(screen.getByText(/Mira de frente a la cámara, con el rostro dentro del óvalo/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Capturar toma 1 de 5' })).toBeEnabled();
        expect(screen.getByTestId('camara')).toHaveAttribute('data-obturador', 'false');
    });

    it('entrega el blob con el paso y avanza al primer paso libre hasta completar las 5', async () => {
        const onCapturar = vi.fn();
        render(<Arnes onCapturar={onCapturar} />);
        await capturar();
        expect(onCapturar).toHaveBeenLastCalledWith(expect.any(Blob), 0);
        expect(screen.getByText('Gira a la izquierda.')).toBeInTheDocument();
        await capturar();
        await capturar();
        expect(screen.getByRole('button', { name: 'Capturar toma 4 de 5 (opcional)' })).toBeEnabled();
        expect(screen.getByText(/Levanta ligeramente la barbilla/)).toBeInTheDocument();
        await capturar();
        await capturar();
        expect(onCapturar.mock.calls.map((c) => c[1])).toEqual([0, 1, 2, 3, 4]);
        expect(screen.getByRole('button', { name: 'Las 5 tomas están capturadas' })).toBeDisabled();
    });

    it('si la cámara no está lista avisa y no entrega la toma', async () => {
        mocks.capture.mockRejectedValue(new Error('no listo'));
        const onCapturar = vi.fn();
        render(<Arnes onCapturar={onCapturar} />);
        await capturar();
        expect(screen.getByRole('alert')).toHaveTextContent('La cámara aún no está lista; espera un momento e inténtalo de nuevo.');
        expect(onCapturar).not.toHaveBeenCalled();
    });

    it('repetir una toma conserva las demás y deja su paso como siguiente', async () => {
        render(<Arnes inicial={[toma(1, 0), toma(2, 1), toma(3, 2)]} />);
        // Se libera la toma 1 (paso 0) y también la 3: la repetida (paso 2) debe quedar como siguiente.
        fireEvent.click(screen.getByRole('button', { name: 'Repetir toma 1' }));
        fireEvent.click(screen.getByRole('button', { name: 'Repetir toma 3' }));
        expect(screen.getByRole('button', { name: 'Capturar toma 3 de 5' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Repetir toma 2' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Repetir toma 1' })).not.toBeInTheDocument();
        const siguiente = screen.getByRole('listitem', { current: 'step' });
        expect(siguiente).toHaveAttribute('aria-label', 'Toma 3 de 5, Gira a la derecha, pendiente');
    });

    it('rejilla de 2 columnas bajo 480 px y ranuras vacías con número y título', () => {
        render(<Arnes inicial={[toma(1, 0)]} />);
        const lista = screen.getByRole('list');
        expect(lista.className).toMatch(/grid-cols-2/);
        expect(lista.className).toMatch(/min-\[480px\]:grid-cols-3/);
        expect(lista.className).toMatch(/sm:grid-cols-5/);
        expect(within(lista).getAllByRole('listitem')).toHaveLength(5);
        expect(screen.getByText('4. Inclina hacia arriba')).toBeInTheDocument();
    });

    it('con el máximo de fotos deshabilita la captura', () => {
        render(<Arnes inicial={[toma(1, 0), toma(2, 1)]} maximo={2} />);
        expect(screen.getByRole('button', { name: 'Máximo de 2 fotos' })).toBeDisabled();
    });

    it('las subidas como archivo se muestran después de los 5 pasos y se quitan', () => {
        render(<Arnes inicial={[toma(1, 0), toma(2, null, { nombre: 'extra.jpg' })]} />);
        expect(screen.getAllByRole('listitem')).toHaveLength(6);
        expect(screen.getByRole('button', { name: 'Quitar toma 6' })).toBeInTheDocument();
    });
});
