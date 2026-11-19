// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/laboratorios.js', () => ({ laboratorioResolver: vi.fn() }));

import { ToastProvider } from '@/components/ui/Toast';
import ColaSolicitudes from './ColaSolicitudes.jsx';

const item = (id, extra = {}) => ({
    id_solicitud: id,
    estatus: 'pendiente',
    vencida: false,
    fecha: '2026-09-16',
    hora_inicio: '10:00',
    hora_fin: '12:00',
    actividad: `Actividad ${id}`,
    aula: { id_aula: 3, clave: `LAB-${id}`, edificio: 'C', capacidad: 30 },
    grupo: { id_grupo: id, clave_grupo: '3A', materia_clave: 'ADM101', materia_nombre: 'Administración I', inscritos: 20 },
    docente: { id_docente: 1, nombre_completo: 'López Ruiz Ana' },
    conflicto: null,
    compite: 0,
    ...extra,
});

const consulta = (data, extra = {}) => ({ data, loading: false, error: null, refetch: vi.fn(), ...extra });

function abrir(props) {
    return render(
        <ToastProvider>
            <ColaSolicitudes hoy="2026-09-14" onCargarMas={vi.fn()} onRecargar={vi.fn()} cargandoMas={false} {...props} />
        </ToastProvider>,
    );
}

describe('ColaSolicitudes', () => {
    it('lista las tarjetas en el orden en que llegan y cuenta cuántas hay', () => {
        const lista = [item(2), item(1)];
        abrir({ consulta: consulta({ items: lista }), lista, total: 2 });
        expect(screen.getByText('2 solicitudes pendientes. Primero las de fecha más próxima.')).toBeInTheDocument();
        const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
        expect(titulos[0]).toMatch(/LAB-2/);
        expect(titulos[1]).toMatch(/LAB-1/);
    });

    it('con una sola dice «solicitud pendiente» en singular', () => {
        abrir({ consulta: consulta({ items: [item(1)] }), lista: [item(1)], total: 1 });
        expect(screen.getByText('1 solicitud pendiente. Primero las de fecha más próxima.')).toBeInTheDocument();
    });

    it('bandeja limpia: un estado vacío sobrio, sin tarjetas', () => {
        abrir({ consulta: consulta({ items: [], total: 0 }), lista: [], total: 0 });
        expect(screen.getByText('Todo al día')).toBeInTheDocument();
        expect(screen.getByText(/No hay solicitudes pendientes\./)).toBeInTheDocument();
        expect(screen.queryByRole('article')).toBeNull();
    });

    it('mientras carga dice que carga; si falla ofrece reintentar', async () => {
        const user = userEvent.setup();
        const { unmount } = abrir({ consulta: consulta(null, { loading: true }), lista: [], total: 0 });
        expect(screen.getByRole('status')).toHaveTextContent('Cargando solicitudes…');
        unmount();
        const refetch = vi.fn();
        abrir({ consulta: consulta(null, { error: { message: 'No se pudo conectar con el servidor.' }, refetch }), lista: [], total: 0 });
        expect(screen.getByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(refetch).toHaveBeenCalled();
    });

    it('«Ver más» aparece solo si faltan por cargar y pide la siguiente página', async () => {
        const user = userEvent.setup();
        const onCargarMas = vi.fn();
        const lista = [item(1)];
        const { unmount } = abrir({ consulta: consulta({ items: lista }), lista, total: 3, onCargarMas });
        await user.click(screen.getByRole('button', { name: 'Ver más (2 restantes)' }));
        expect(onCargarMas).toHaveBeenCalled();
        unmount();
        abrir({ consulta: consulta({ items: lista }), lista, total: 1 });
        expect(screen.queryByRole('button', { name: /Ver más/ })).toBeNull();
    });
});
