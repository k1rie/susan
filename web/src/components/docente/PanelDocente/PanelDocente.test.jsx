// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PanelDocente from './PanelDocente.jsx';
import { docentePanel } from '@/lib/api/sesiones.js';
import { ahora } from '@/lib/api/plataforma.js';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/docente' }));
vi.mock('@/lib/api/sesiones.js', () => ({ docentePanel: vi.fn(), abrirSesion: vi.fn() }));
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: vi.fn() }));

const base = { fecha: '2026-09-14', sesiones_hoy: [], pendientes: 2, justificantes_por_resolver: 1, alertas: [], grupos: [] };

describe('PanelDocente', () => {
    it('sin alertas no hay gráfica de faltas', async () => {
        ahora.mockResolvedValue({ reloj_simulado: false });
        docentePanel.mockResolvedValue(base);
        render(<PanelDocente encabezado={false} />);
        await waitFor(() => expect(screen.getByText('Sin alertas')).toBeInTheDocument());
        expect(screen.queryByRole('group', { name: 'Faltas vs límite' })).toBeNull();
    });

    it('con alertas muestra la lista compacta y la gráfica Faltas vs límite', async () => {
        ahora.mockResolvedValue({ reloj_simulado: false });
        docentePanel.mockResolvedValue({
            ...base,
            alertas: [{ tipo: 'sin_derecho', id_grupo: 1, id_alumno: 1, matricula: 'E1', nombre: 'Ana Perez', materia: 'Finanzas', clave_grupo: '3A', porcentaje_faltas: 25, limite_pct: 20, mensaje: 'texto largo repetido' }],
        });
        render(<PanelDocente encabezado={false} />);
        await waitFor(() => expect(screen.getByRole('group', { name: 'Faltas vs límite' })).toBeInTheDocument());
        expect(screen.getAllByText('Ana Perez').length).toBeGreaterThan(0);
        expect(screen.getByText('Sin derecho a examen')).toBeInTheDocument();
        expect(screen.queryByText('texto largo repetido')).toBeNull();
    });
});
