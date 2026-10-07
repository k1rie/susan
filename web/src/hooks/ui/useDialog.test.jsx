// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDialog } from './useDialog.js';

function Dialogo({ abierto, onClose, onBlurCampo, etiqueta = 'campo', children }) {
    const ref = useRef(null);
    useDialog(ref, onClose, abierto);
    if (!abierto) return null;
    return (
        <div ref={ref} role="dialog" aria-label={`dialogo ${etiqueta}`} tabIndex={-1}>
            <input aria-label={etiqueta} onBlur={onBlurCampo} />
            {children}
            <button>Fin {etiqueta}</button>
        </div>
    );
}

// El diálogo ya montado y con `abierto` alternando (como Modal/PanelLateral con `open`).
function Caso({ onBlurCampo }) {
    const [abierto, setAbierto] = useState(false);
    return (
        <>
            <button onClick={() => setAbierto(true)}>Abrir</button>
            <Dialogo abierto={abierto} onClose={() => setAbierto(false)} onBlurCampo={onBlurCampo} />
        </>
    );
}

// El diálogo SE MONTA al abrir (`{abierto && <Panel open />}`): es el caso en que Strict Mode hace montar-desmontar-montar con el diálogo
// ya abierto, y donde antes la limpieza devolvía el foco al botón y el primer campo recibía un blur.
function CasoMontadoAlAbrir({ onBlurCampo }) {
    const [abierto, setAbierto] = useState(false);
    return (
        <>
            <button onClick={() => setAbierto(true)}>Abrir</button>
            {abierto && <Dialogo abierto onClose={() => setAbierto(false)} onBlurCampo={onBlurCampo} />}
        </>
    );
}

describe('useDialog · foco', () => {
    it('enfoca el primer control al abrir y devuelve el foco a quien lo abrió al cerrar con Esc', async () => {
        const user = userEvent.setup();
        render(<Caso />);
        const abrir = screen.getByText('Abrir');
        await user.click(abrir);
        expect(screen.getByLabelText('campo')).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(abrir).toHaveFocus();
    });

    it('Strict Mode (doble montaje): abrir NO produce un blur del primer campo ni pierde el foco', async () => {
        const user = userEvent.setup();
        const onBlurCampo = vi.fn();
        render(
            <StrictMode>
                <Caso onBlurCampo={onBlurCampo} />
            </StrictMode>,
        );
        await user.click(screen.getByText('Abrir'));
        expect(screen.getByLabelText('campo')).toHaveFocus();
        expect(onBlurCampo).not.toHaveBeenCalled();
    });

    it('Strict Mode con el diálogo MONTADO al abrir: el primer campo no recibe un blur y conserva el foco', async () => {
        const user = userEvent.setup();
        const onBlurCampo = vi.fn();
        render(
            <StrictMode>
                <CasoMontadoAlAbrir onBlurCampo={onBlurCampo} />
            </StrictMode>,
        );
        await user.click(screen.getByText('Abrir'));
        await act(async () => {});
        expect(screen.getByLabelText('campo')).toHaveFocus();
        expect(onBlurCampo).not.toHaveBeenCalled();
    });

    it('Strict Mode con el diálogo MONTADO al abrir: al cerrar devuelve el foco al abridor original', async () => {
        const user = userEvent.setup();
        render(
            <StrictMode>
                <CasoMontadoAlAbrir />
            </StrictMode>,
        );
        const abrir = screen.getByText('Abrir');
        await user.click(abrir);
        await user.keyboard('{Escape}');
        await act(async () => {});
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(abrir).toHaveFocus();
    });

    it('Strict Mode con el diálogo abierto desde el primer render: el campo conserva el foco, sin blur', async () => {
        const onBlurCampo = vi.fn();
        render(
            <StrictMode>
                <Dialogo abierto onClose={() => {}} onBlurCampo={onBlurCampo} />
            </StrictMode>,
        );
        // El microtask de la limpieza simulada ya se resolvió: sigue dentro del diálogo.
        await act(async () => {});
        expect(screen.getByLabelText('campo')).toHaveFocus();
        expect(onBlurCampo).not.toHaveBeenCalled();
    });

    it('Strict Mode: al cerrar de verdad devuelve el foco al abridor ORIGINAL (no al primer campo)', async () => {
        const user = userEvent.setup();
        render(
            <StrictMode>
                <Caso />
            </StrictMode>,
        );
        const abrir = screen.getByText('Abrir');
        await user.click(abrir);
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(abrir).toHaveFocus();
    });

    it('al desmontar el componente con el diálogo abierto también devuelve el foco al abridor (tras un microtask)', async () => {
        const user = userEvent.setup();
        let desmontar;
        function Padre() {
            const [montado, setMontado] = useState(false);
            useEffect(() => {
                desmontar = () => setMontado(false);
            });
            return (
                <>
                    <button onClick={() => setMontado(true)}>Abrir</button>
                    {montado && <Dialogo abierto onClose={() => {}} />}
                </>
            );
        }
        render(<Padre />);
        await user.click(screen.getByText('Abrir'));
        expect(screen.getByLabelText('campo')).toHaveFocus();
        act(() => desmontar());
        await act(async () => {});
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByText('Abrir')).toHaveFocus();
    });

    it('al desmontar con el diálogo abierto en Strict Mode devuelve el foco al abridor original', async () => {
        const user = userEvent.setup();
        let desmontar;
        function Padre() {
            const [montado, setMontado] = useState(false);
            useEffect(() => {
                desmontar = () => setMontado(false);
            });
            return (
                <>
                    <button onClick={() => setMontado(true)}>Abrir</button>
                    {montado && <Dialogo abierto onClose={() => {}} />}
                </>
            );
        }
        render(
            <StrictMode>
                <Padre />
            </StrictMode>,
        );
        await user.click(screen.getByText('Abrir'));
        expect(screen.getByLabelText('campo')).toHaveFocus();
        act(() => desmontar());
        await act(async () => {});
        expect(screen.getByText('Abrir')).toHaveFocus();
    });

    it('con diálogo sobre diálogo solo el de arriba atiende Esc; al cerrarlo el foco vuelve al diálogo de abajo', async () => {
        const user = userEvent.setup();
        const cierres = [];
        function Pila() {
            const [segundo, setSegundo] = useState(false);
            return (
                <>
                    <Dialogo abierto onClose={() => cierres.push('primero')} etiqueta="uno">
                        <button onClick={() => setSegundo(true)}>Abrir segundo</button>
                    </Dialogo>
                    <Dialogo abierto={segundo} onClose={() => { cierres.push('segundo'); setSegundo(false); }} etiqueta="dos" />
                </>
            );
        }
        render(
            <StrictMode>
                <Pila />
            </StrictMode>,
        );
        await user.click(screen.getByText('Abrir segundo'));
        expect(screen.getByLabelText('dos')).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(cierres).toEqual(['segundo']);
        expect(screen.getByText('Abrir segundo')).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(cierres).toEqual(['segundo', 'primero']);
    });

    it('atrapa el foco con Tab también en Strict Mode', async () => {
        const user = userEvent.setup();
        render(
            <StrictMode>
                <Dialogo abierto onClose={() => {}} />
            </StrictMode>,
        );
        await act(async () => {});
        expect(screen.getByLabelText('campo')).toHaveFocus();
        await user.tab();
        expect(screen.getByText('Fin campo')).toHaveFocus();
        await user.tab();
        expect(screen.getByLabelText('campo')).toHaveFocus();
    });
});
