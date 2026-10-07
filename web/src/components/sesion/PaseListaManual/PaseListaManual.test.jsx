// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { hayCambiosSinGuardar } from '@/hooks/ui/useCambiosSinGuardar.js';
import PaseListaManual from './PaseListaManual.jsx';

vi.mock('@/lib/api/sesiones.js', () => ({ cerrarSesion: vi.fn(), paseListaManual: vi.fn() }));
vi.mock('@/hooks/data', () => ({ useApiMutation: (fn) => ({ run: fn, loading: false, error: null }) }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const sesion = { id_sesion: 115, minuto_actual: 5, limite_presente_min: 10, tolerancia_min: 20 };
const alumno = (id, nombre, estado = null) => ({ id_alumno: id, nombre, matricula: `E26000${id}`, inscripcion: 'activa', estado, origen: null });

const montar = (alumnos) => render(<PaseListaManual data={{ sesion, alumnos }} onActualizar={() => {}} />);
const grupoDe = (nombre) => screen.getByRole('group', { name: `Estado de ${nombre}` });

describe('PaseListaManual: aviso de cambios sin guardar', () => {
    it('sin marcas nuevas no hay cambios; marcar a un alumno los activa y desmarcarlo los apaga', async () => {
        const usuario = userEvent.setup();
        montar([alumno(1, 'Ana Pérez'), alumno(2, 'Beto Núñez')]);
        expect(hayCambiosSinGuardar()).toBe(false);

        await usuario.click(within(grupoDe('Ana Pérez')).getByRole('button', { name: 'Presente' }));
        expect(hayCambiosSinGuardar()).toBe(true);

        await usuario.click(within(grupoDe('Ana Pérez')).getByRole('button', { name: 'Presente' }));
        expect(hayCambiosSinGuardar()).toBe(false);
    });

    it('lo que el servidor ya tiene guardado no cuenta como cambio, pero corregirlo sí', async () => {
        const usuario = userEvent.setup();
        montar([alumno(1, 'Ana Pérez', 'presente'), alumno(2, 'Beto Núñez')]);
        expect(hayCambiosSinGuardar()).toBe(false);

        await usuario.click(within(grupoDe('Ana Pérez')).getByRole('button', { name: 'Ausente' }));
        expect(hayCambiosSinGuardar()).toBe(true);
    });

    it('«Marcar restantes según la hora» cuenta como cambio y al salir de la pantalla se retira el aviso', async () => {
        const usuario = userEvent.setup();
        const { unmount } = montar([alumno(1, 'Ana Pérez'), alumno(2, 'Beto Núñez')]);
        await usuario.click(screen.getByRole('button', { name: /Marcar restantes según la hora/ }));
        expect(hayCambiosSinGuardar()).toBe(true);

        unmount();
        expect(hayCambiosSinGuardar()).toBe(false);
    });
});
