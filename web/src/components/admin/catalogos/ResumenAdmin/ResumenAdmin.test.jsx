// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resumen = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => ({ adminResumen: (...a) => resumen(...a) }));

import ResumenAdmin from './ResumenAdmin.jsx';

const base = {
    periodo: '2026-2', fecha: '2026-09-10', alumnos_activos: 120, docentes_activos: 14, grupos_periodo: 9,
    sesiones_hoy: { total: 6, abiertas: 1, programadas: 2, cerradas: 3 }, camaras: { activas: 5, inactivas: 1 },
    consentimientos_por_vencer_30d: 0, plantillas_sin_indexar: 0,
};

beforeEach(() => resumen.mockReset());

describe('ResumenAdmin', () => {
    it('deja tres contadores y dos gráficas con texto alternativo', async () => {
        resumen.mockResolvedValue(base);
        const { container } = render(<ResumenAdmin encabezado={false} />);
        expect(await screen.findByText('Alumnos activos')).toBeInTheDocument();
        expect(screen.getByText('Docentes activos')).toBeInTheDocument();
        expect(screen.getByText('Grupos del periodo')).toBeInTheDocument();
        expect(screen.queryByText('Cámaras activas')).not.toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Sesiones de hoy' })).toHaveAccessibleDescription(/Abiertas: 1.*Programadas: 2.*Cerradas: 3/);
        expect(screen.getByRole('group', { name: 'Cámaras' })).toHaveAccessibleDescription(/Activas: 5.*Inactivas: 1/);
        expect(container.querySelectorAll('[data-slot="chart"]')).toHaveLength(2);
        expect(screen.getByRole('link', { name: /Ver cámaras/ })).toHaveAttribute('href', '/tecnico');
    });
    it('incluye las sesiones suspendidas en la dona y en su texto alternativo', async () => {
        resumen.mockResolvedValue({ ...base, sesiones_hoy: { total: 8, abiertas: 1, programadas: 2, cerradas: 3, suspendidas: 2 } });
        render(<ResumenAdmin encabezado={false} />);
        expect(await screen.findByRole('group', { name: 'Sesiones de hoy' })).toHaveAccessibleDescription(/Suspendidas: 2/);
    });
    it('con solo sesiones suspendidas no dice que hoy no hay sesiones', async () => {
        resumen.mockResolvedValue({ ...base, sesiones_hoy: { total: 2, abiertas: 0, programadas: 0, cerradas: 0, suspendidas: 2 } });
        render(<ResumenAdmin encabezado={false} />);
        expect(await screen.findByRole('group', { name: 'Sesiones de hoy' })).toHaveAccessibleDescription(/Suspendidas: 2/);
        expect(screen.queryByText('Hoy no hay sesiones')).not.toBeInTheDocument();
    });
    it('con ambos avisos en 0 dice "Todo en orden" y no pinta filas de atención', async () => {
        resumen.mockResolvedValue(base);
        render(<ResumenAdmin encabezado={false} />);
        expect(await screen.findByText(/Todo en orden/)).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /por vencer|sin indexar/ })).not.toBeInTheDocument();
    });
    it('muestra solo los avisos con valor, como enlaces a su pantalla', async () => {
        resumen.mockResolvedValue({ ...base, consentimientos_por_vencer_30d: 3 });
        render(<ResumenAdmin encabezado={false} />);
        const fila = await screen.findByRole('link', { name: /3 consentimientos por vencer/ });
        expect(fila).toHaveAttribute('href', '/admin/alumnos');
        expect(screen.queryByText(/sin indexar/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Todo en orden/)).not.toBeInTheDocument();
    });
    it('sin sesiones ni cámaras hoy avisa en lugar de dejar un hueco', async () => {
        resumen.mockResolvedValue({ ...base, sesiones_hoy: { total: 0 }, camaras: {} });
        render(<ResumenAdmin encabezado={false} />);
        expect(await screen.findByText('Hoy no hay sesiones')).toBeInTheDocument();
        expect(screen.getByText('No hay cámaras registradas')).toBeInTheDocument();
    });
    it('con encabezado conserva los accesos rápidos', async () => {
        resumen.mockResolvedValue(base);
        render(<ResumenAdmin />);
        expect(await screen.findByRole('navigation', { name: 'Accesos' })).toBeInTheDocument();
    });
});
