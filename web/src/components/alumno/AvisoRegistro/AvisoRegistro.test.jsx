// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const registro = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/biometria.js', () => ({ miRegistro: (...a) => registro(...a) }));

import AvisoRegistro from './AvisoRegistro.jsx';

const BASE = { puede_registrar: true, completo: false, paso: 'consentimiento' };

beforeEach(() => {
    registro.mockReset();
});

// Espera a que la consulta SE RESUELVA (no solo a que se haya llamado): sin esto, «no muestra nada» pasaría también con los datos
// todavía en camino, que es justo lo que no debe pasar vacío.
const asentar = async () => {
    await vi.waitFor(() => expect(registro).toHaveBeenCalled());
    await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
    });
};

describe('AvisoRegistro', () => {
    it('sin consentimiento invita a aceptar el aviso y registrar el rostro, con enlace a Mi registro facial', async () => {
        registro.mockResolvedValue(BASE);
        render(<AvisoRegistro />);
        const enlace = await screen.findByRole('link', { name: /Completa tu registro facial/ });
        expect(enlace).toHaveAttribute('href', '/alumno/registro');
        expect(enlace).toHaveTextContent('Acepta el aviso de privacidad y registra tu rostro');
    });

    it('con el aviso aceptado solo pide el rostro', async () => {
        registro.mockResolvedValue({ ...BASE, paso: 'rostro' });
        render(<AvisoRegistro />);
        expect(await screen.findByRole('link', { name: /Completa tu registro facial/ })).toHaveTextContent('Solo falta registrar tu rostro');
    });

    it('con el registro completo no muestra nada', async () => {
        registro.mockResolvedValue({ ...BASE, completo: true, paso: 'listo' });
        const { container } = render(<AvisoRegistro />);
        await asentar();
        expect(container).toBeEmptyDOMElement();
    });

    it('si la cuenta no puede registrarse no insiste', async () => {
        registro.mockResolvedValue({ ...BASE, puede_registrar: false });
        const { container } = render(<AvisoRegistro />);
        await asentar();
        expect(container).toBeEmptyDOMElement();
    });

    it('si la consulta falla no rompe la pantalla ni muestra un error: es solo un recordatorio', async () => {
        registro.mockImplementation(async () => {
            throw new Error('sin red');
        });
        const { container } = render(<AvisoRegistro />);
        await asentar();
        expect(container).toBeEmptyDOMElement();
    });
});
