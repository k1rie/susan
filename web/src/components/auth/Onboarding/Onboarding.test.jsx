// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leerPerfil } from '@/lib/perfil';
import Onboarding from './Onboarding.jsx';
import { guiaParaRol, pasosDe } from './guia.js';

const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh, push: vi.fn() }) }));
const ME = { id_usuario: 5, nombre: 'Patricia Ortega Salinas', rol: 'docente', home: '/docente' };
vi.mock('@/hooks/data', () => ({ useMe: () => ({ me: ME }) }));
const cambiarContrasena = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/auth.js', () => ({
    cambiarContrasena,
    obtenerSesion: async () => ({ autenticado: true }),
    suscribirCambioAuth: async () => () => {},
}));

beforeEach(() => {
    window.localStorage.clear();
    replace.mockClear();
    cambiarContrasena.mockReset();
});

describe('contenido del asistente', () => {
    it('activar tiene 4 pasos (con contraseña) y bienvenida 3', () => {
        expect(pasosDe('activar').map((p) => p.id)).toEqual(['contrasena', 'estilo', 'guia', 'privacidad']);
        expect(pasosDe('bienvenida').map((p) => p.id)).toEqual(['estilo', 'guia', 'privacidad']);
    });
    it('cada rol tiene su guía de 3 puntos con icono y un rol desconocido usa la general', () => {
        for (const rol of ['docente', 'administrador', 'alumno', 'tecnico', 'otro']) {
            const g = guiaParaRol(rol);
            expect(g).toHaveLength(3);
            for (const it of g) {
                expect(it.icono).toBeTruthy();
                expect(it.titulo.length).toBeGreaterThan(3);
            }
        }
    });
});

describe('Onboarding (bienvenida)', () => {
    it('recorre perfil → guía → privacidad, guarda el color y redirige al inicio del rol', async () => {
        const user = userEvent.setup();
        render(<Onboarding modo="bienvenida" />);
        expect(screen.getByText('Paso 1 de 3 · Perfil')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Elige tu estilo' })).toBeInTheDocument();
        await user.click(screen.getByRole('radio', { name: 'Color 2' }));
        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        expect(screen.getByRole('heading', { name: 'Así funciona SUSAN para ti' })).toBeInTheDocument();
        expect(screen.getByText('Pasa lista con la cámara')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Atrás/ }));
        expect(screen.getByText('Paso 1 de 3 · Perfil')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        expect(screen.getByRole('heading', { name: 'Tu privacidad' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Listo' }));
        expect(replace).toHaveBeenCalledWith('/docente');
        expect(leerPerfil(ME)).toMatchObject({ tinte: '#0b6bcb', avisoLeido: true, bienvenidaVista: true });
    });
});

describe('Onboarding: progreso con Stepper', () => {
    it('el progreso es un <nav aria-label="Progreso"> con una lista, el paso actual marcado y un aviso para lectores de pantalla', async () => {
        const user = userEvent.setup();
        render(<Onboarding modo="bienvenida" />);
        const nav = screen.getByRole('navigation', { name: 'Progreso' });
        const pasos = within(nav).getAllByRole('listitem');
        expect(pasos).toHaveLength(3);
        expect(pasos[0]).toHaveAttribute('aria-current', 'step');
        expect(pasos[1]).not.toHaveAttribute('aria-current');
        expect(screen.getByText('Paso 1 de 3: Elige tu estilo')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        expect(screen.getByText('Paso 2 de 3: Así funciona SUSAN para ti')).toBeInTheDocument();
        expect(within(nav).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
        // El foco va al título del paso nuevo.
        expect(screen.getByRole('heading', { name: 'Así funciona SUSAN para ti' })).toHaveFocus();
    });

    it('con el progreso se puede volver a un paso ya recorrido', async () => {
        const user = userEvent.setup();
        render(<Onboarding modo="bienvenida" />);
        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        expect(screen.getByRole('heading', { name: 'Tu privacidad' })).toBeInTheDocument();
        await user.click(within(screen.getByRole('navigation', { name: 'Progreso' })).getByRole('button', { name: /Perfil/ }));
        expect(screen.getByRole('heading', { name: 'Elige tu estilo' })).toBeInTheDocument();
    });
});

describe('Onboarding (activar)', () => {
    it('empieza por la contraseña con reglas en vivo y sin «Continuar» (avanza al guardar)', async () => {
        render(<Onboarding modo="activar" />);
        expect(await screen.findByRole('heading', { name: 'Crea tu contraseña' })).toBeInTheDocument();
        expect(screen.getByText('Paso 1 de 4 · Contraseña')).toBeInTheDocument();
        expect(await screen.findByRole('list', { name: 'Requisitos de la contraseña' })).toBeInTheDocument();
        expect(screen.getByText('0 de 3 requisitos')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Continuar/ })).toBeNull();
    });

    it('tras crear la contraseña ya no se puede volver a ese paso, y el final dice por qué no avanza hasta marcar el acuse', async () => {
        cambiarContrasena.mockResolvedValue();
        const user = userEvent.setup();
        render(<Onboarding modo="activar" />);
        await user.type(await screen.findByLabelText(/Crea tu contraseña/), 'buenaclave123');
        await user.click(screen.getByRole('button', { name: 'Activar mi cuenta' }));
        expect(await screen.findByRole('heading', { name: 'Elige tu estilo' })).toBeInTheDocument();
        expect(cambiarContrasena).toHaveBeenCalledWith({ contrasena: 'buenaclave123' });
        // Paso 2 de 4: no hay «Atrás» (llevaría a la contraseña ya guardada) y el paso 1 del progreso no es un botón.
        expect(screen.queryByRole('button', { name: /Atrás/ })).toBeNull();
        expect(within(screen.getByRole('navigation', { name: 'Progreso' })).queryByRole('button', { name: /Contraseña/ })).toBeNull();

        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        expect(screen.getByRole('heading', { name: 'Tu privacidad' })).toBeInTheDocument();
        const terminar = screen.getByRole('button', { name: 'Empezar a usar SUSAN' });
        expect(terminar).toBeDisabled();
        expect(screen.getByText('Marca «He leído el aviso de privacidad» para terminar.')).toBeInTheDocument();

        await user.click(screen.getByRole('checkbox', { name: 'He leído el aviso de privacidad' }));
        expect(screen.getByRole('button', { name: 'Empezar a usar SUSAN' })).toBeEnabled();
        expect(screen.queryByText('Marca «He leído el aviso de privacidad» para terminar.')).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Empezar a usar SUSAN' }));
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente'));
        expect(leerPerfil(ME)).toMatchObject({ avisoLeido: true, bienvenidaVista: true });
    });
});

describe('Onboarding (bienvenida)', () => {
    it('no pide el acuse: el último botón está activo y no hay motivo de bloqueo', async () => {
        const user = userEvent.setup();
        render(<Onboarding modo="bienvenida" />);
        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        expect(screen.getByRole('button', { name: 'Listo' })).toBeEnabled();
        expect(screen.queryByText(/Marca «He leído/)).toBeNull();
        expect(screen.queryByRole('checkbox')).toBeNull();
    });
});
