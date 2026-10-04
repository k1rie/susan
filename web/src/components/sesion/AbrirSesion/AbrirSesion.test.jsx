// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import AbrirSesion, { textoUso } from './AbrirSesion.jsx';

const sesion = { id_sesion: 19, materia: 'Administracion Financiera', clave_grupo: '3A', hora_inicio: '07:00:00', hora_fin: '08:00:00', aula: 'A-12', estatus: 'programada' };
const camaraActiva = { id_camara: 2, tipo: 'navegador', estatus: 'activa', posicion: 'frente' };

describe('textoUso', () => {
    it('con cámaras activas dice que se usará la cámara del aula; sin ellas, manual', () => {
        expect(textoUso([camaraActiva]).texto).toContain('la cámara del aula (1 activa)');
        expect(textoUso([camaraActiva, { ...camaraActiva, id_camara: 3 }]).texto).toContain('(2 activas)');
        expect(textoUso([{ ...camaraActiva, estatus: 'inactiva' }])).toMatchObject({ conCamara: false });
        expect(textoUso([]).texto).toContain('a mano');
        expect(textoUso(undefined).conCamara).toBe(false);
    });
});

describe('AbrirSesion', () => {
    it('una tarjeta con una sola acción primaria «Abrir sesión y pasar lista»', async () => {
        const usuario = userEvent.setup();
        const onAbrir = vi.fn();
        render(<AbrirSesion sesion={sesion} camaras={[camaraActiva]} hora="07:05:00" onAbrir={onAbrir} />);
        expect(screen.getByRole('heading', { name: 'Esta clase aún no está abierta' })).toBeInTheDocument();
        expect(screen.getAllByRole('button')).toHaveLength(1);
        await usuario.click(screen.getByRole('button', { name: 'Abrir sesión y pasar lista' }));
        expect(onAbrir).toHaveBeenCalledTimes(1);
    });

    it('explica qué se usará: cámara del aula o manual', () => {
        const { rerender } = render(<AbrirSesion sesion={sesion} camaras={[camaraActiva]} onAbrir={() => {}} />);
        expect(screen.getByText(/Se usará la cámara del aula/)).toBeInTheDocument();
        rerender(<AbrirSesion sesion={sesion} camaras={[]} onAbrir={() => {}} />);
        expect(screen.getByText(/pasarás lista a mano/)).toBeInTheDocument();
    });

    it('recuerda la regla del horario', () => {
        render(<AbrirSesion sesion={sesion} camaras={[]} hora="07:05:00" onAbrir={() => {}} />);
        expect(screen.getByText('La sesión solo puede abrirse dentro de su horario, de 07:00 a 08:00.')).toBeInTheDocument();
        // Dentro del horario no hay aviso de «aún no»: se puede abrir ya.
        expect(screen.queryByText(/Disponible a las|Terminó a las/)).toBeNull();
    });

    it('antes de la hora, o ya vencida, lo dice con una etiqueta de texto', () => {
        const { rerender } = render(<AbrirSesion sesion={sesion} camaras={[]} hora="06:30:00" onAbrir={() => {}} />);
        expect(screen.getByText('Disponible a las 07:00')).toBeInTheDocument();
        rerender(<AbrirSesion sesion={sesion} camaras={[]} hora="08:10:00" onAbrir={() => {}} />);
        expect(screen.getByText('Terminó a las 08:00')).toBeInTheDocument();
    });

    it('sin la hora del plantel no inventa etiquetas', () => {
        render(<AbrirSesion sesion={sesion} camaras={[]} hora={null} onAbrir={() => {}} />);
        expect(screen.queryByText(/Disponible a las|Terminó a las/)).toBeNull();
    });

    it('mientras abre, el botón queda ocupado', () => {
        render(<AbrirSesion sesion={sesion} camaras={[]} abriendo onAbrir={() => {}} />);
        expect(screen.getByRole('button', { name: /Abrir sesión y pasar lista/ })).toBeDisabled();
    });

    it('FUERA_DE_HORARIO: mensaje comprensible y reintento', async () => {
        const usuario = userEvent.setup();
        const onAbrir = vi.fn();
        const error = new ApiError({ code: 'FUERA_DE_HORARIO', message: 'La sesión solo se puede abrir entre las 07:00 y las 08:00.', status: 409 });
        render(<AbrirSesion sesion={sesion} camaras={[]} onAbrir={onAbrir} error={error} />);
        const alerta = screen.getByRole('alert');
        expect(alerta).toHaveTextContent('La sesión está fuera de su horario');
        expect(alerta).toHaveTextContent('La sesión solo se puede abrir entre las 07:00 y las 08:00.');
        await usuario.click(screen.getByRole('button', { name: 'Reintentar abrir la sesión' }));
        expect(onAbrir).toHaveBeenCalledTimes(1);
    });

    it('un error sin salida (sesión cerrada) no ofrece reintentar', () => {
        const error = new ApiError({ code: 'SESION_CERRADA', message: 'cerrada', status: 409 });
        render(<AbrirSesion sesion={sesion} camaras={[]} onAbrir={() => {}} error={error} />);
        expect(screen.getByRole('alert')).toHaveTextContent('La sesión ya está cerrada');
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('un error cualquiera se muestra y se puede reintentar', () => {
        render(<AbrirSesion sesion={sesion} camaras={[]} onAbrir={() => {}} error={new Error('boom')} />);
        expect(screen.getByRole('alert')).toHaveTextContent('No se pudo abrir la sesión');
        expect(screen.getByRole('button', { name: 'Reintentar abrir la sesión' })).toBeInTheDocument();
    });
});
