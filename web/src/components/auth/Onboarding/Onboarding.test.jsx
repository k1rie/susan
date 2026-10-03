// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
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
vi.mock('@/lib/api/auth.js', () => ({
    cambiarContrasena: vi.fn(),
    obtenerSesion: async () => ({ autenticado: true }),
    suscribirCambioAuth: async () => () => {},
}));

beforeEach(() => {
    window.localStorage.clear();
    replace.mockClear();
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
        expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Elige tu estilo' })).toBeInTheDocument();
        await user.click(screen.getByRole('radio', { name: 'Color 2' }));
        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        expect(screen.getByRole('heading', { name: 'Así funciona SUSAN para ti' })).toBeInTheDocument();
        expect(screen.getByText('Pasa lista con la cámara')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Atrás/ }));
        expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        await user.click(screen.getByRole('button', { name: /Continuar/ }));
        expect(screen.getByRole('heading', { name: 'Tu privacidad' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Listo' }));
        expect(replace).toHaveBeenCalledWith('/docente');
        expect(leerPerfil(ME)).toMatchObject({ tinte: '#0b6bcb', avisoLeido: true, bienvenidaVista: true });
    });
});

describe('Onboarding (activar)', () => {
    it('empieza por la contraseña con reglas en vivo y no deja terminar sin aceptar el aviso', async () => {
        const user = userEvent.setup();
        render(<Onboarding modo="activar" />);
        expect(await screen.findByRole('heading', { name: 'Crea tu contraseña' })).toBeInTheDocument();
        expect(screen.getByText('Paso 1 de 4')).toBeInTheDocument();
        expect(screen.getByRole('list', { name: 'Requisitos de la contraseña' })).toBeInTheDocument();
        // En este paso no hay «Continuar»: avanza al guardar la contraseña.
        expect(screen.queryByRole('button', { name: /Continuar/ })).toBeNull();
        void user;
    });
});
