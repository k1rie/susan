// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
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
        render(<ResumenAdmin encabezado={false} />);
        expect(await screen.findByText('Alumnos activos')).toBeInTheDocument();
        expect(screen.getByText('Docentes activos')).toBeInTheDocument();
        expect(screen.getByText('Grupos del periodo')).toBeInTheDocument();
        expect(screen.queryByText('Cámaras activas')).not.toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Sesiones de hoy' })).toHaveAccessibleDescription(/Abiertas: 1.*Programadas: 2.*Cerradas: 3/);
        expect(screen.getByRole('group', { name: 'Cámaras' })).toHaveAccessibleDescription(/Activas: 5.*Inactivas: 1/);
        expect(screen.getByRole('link', { name: /Ver cámaras/ })).toHaveAttribute('href', '/tecnico');
    });
    it('cada contador es un enlace a su listado con su cifra final y un icono decorativo en pastilla neutra', async () => {
        resumen.mockResolvedValue(base);
        render(<ResumenAdmin encabezado={false} />);
        await screen.findByText('Alumnos activos');
        const casos = [['Alumnos activos', '/admin/alumnos', '120'], ['Docentes activos', '/admin/docentes', '14'], ['Grupos del periodo', '/admin/grupos', '9']];
        for (const [nombre, href, cifra] of casos) {
            const tarjeta = screen.getByRole('link', { name: new RegExp(nombre) });
            expect(tarjeta).toHaveAttribute('href', href);
            // La cifra final va en el texto sr-only de CountUp (la visible puede estar a media cuenta).
            expect(tarjeta.querySelector('p.tabular-nums .sr-only')).toHaveTextContent(cifra);
            const [icono, flecha] = tarjeta.querySelectorAll('svg');
            expect(icono).toHaveAttribute('aria-hidden', 'true');
            expect(icono.parentElement).toHaveClass('bg-muted', 'text-muted-foreground');
            expect(flecha).toHaveAttribute('aria-hidden', 'true');
        }
    });
    it('a ancho de teléfono los contadores van en dos columnas y el tercero a todo el ancho', async () => {
        resumen.mockResolvedValue(base);
        render(<ResumenAdmin encabezado={false} />);
        const zona = await screen.findByRole('region', { name: 'Contadores' });
        const rejilla = zona.querySelector('.grid');
        expect(rejilla).toHaveClass('grid-cols-2', 'min-[480px]:grid-cols-3');
        expect(rejilla).not.toHaveClass('grid-cols-1');
        expect(screen.getByRole('link', { name: /Grupos del periodo/ })).toHaveClass('col-span-2', 'min-[480px]:col-span-1');
    });
    it('cada anillo dice sus cifras en la leyenda y el total al centro', async () => {
        resumen.mockResolvedValue(base);
        render(<ResumenAdmin encabezado={false} />);
        // Fila de leyenda = [punto de color, nombre, cifra, porcentaje]: se leen por separado para no depender del texto pegado.
        const leyenda = (grupo) => within(grupo).getAllByRole('listitem').map((li) => [...li.children].slice(1).map((c) => c.textContent));
        const sesiones = await screen.findByRole('group', { name: 'Sesiones de hoy' });
        expect(leyenda(sesiones)).toEqual([['Abiertas', '1', '17 %'], ['Programadas', '2', '33 %'], ['Cerradas', '3', '50 %'], ['Suspendidas', '0', '0 %']]);
        expect(within(sesiones).getByText('6')).toBeInTheDocument();
        expect(within(sesiones).getByText('Sesiones', { selector: 'span.text-xs' })).toBeInTheDocument();
        const camaras = screen.getByRole('group', { name: 'Cámaras' });
        expect(leyenda(camaras)).toEqual([['Activas', '5', '83 %'], ['Inactivas', '1', '17 %']]);
        expect(within(camaras).getByText('6')).toBeInTheDocument();
        expect(within(camaras).getByText('Cámaras', { selector: 'span.text-xs' })).toBeInTheDocument();
    });
    it('incluye las sesiones suspendidas en el anillo y en su texto alternativo', async () => {
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
