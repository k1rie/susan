// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CONFIG_ASISTENCIA, resumenTexto } from '@/lib/graficas.js';
import Detalles from './Detalles';
import GraficaBarras from './GraficaBarras';
import GraficaDona from './GraficaDona';
import TarjetaGrafica from './TarjetaGrafica';

const DATOS = [{ clave: 'presente', valor: 8 }, { clave: 'retardo', valor: 1 }, { clave: 'ausente', valor: 3 }];

describe('TarjetaGrafica', () => {
    it('es un grupo con nombre y descripción accesible para lectores de pantalla', () => {
        render(<TarjetaGrafica titulo="Asistencia" descripcion="Periodo 2026-2" resumen={resumenTexto(DATOS, CONFIG_ASISTENCIA)} pie="Fuente: reporte"><div>grafica</div></TarjetaGrafica>);
        const grupo = screen.getByRole('group', { name: 'Asistencia' });
        expect(grupo).toHaveAccessibleDescription('Presentes: 8 (67 %); Retardos: 1 (8 %); Ausencias: 3 (25 %)');
        expect(screen.getByText('Periodo 2026-2')).toBeInTheDocument();
        expect(screen.getByText('Fuente: reporte')).toBeInTheDocument();
    });
});

describe('GraficaDona', () => {
    it('sin datos o con total 0 muestra un aviso en lugar de un hueco', () => {
        const { rerender } = render(<GraficaDona datos={[]} config={CONFIG_ASISTENCIA} />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
        rerender(<GraficaDona datos={[{ clave: 'presente', valor: 0 }]} config={CONFIG_ASISTENCIA} vacio="Sin sesiones" />);
        expect(screen.getByText('Sin sesiones')).toBeInTheDocument();
    });
    it('con datos monta el contenedor de la gráfica de shadcn', () => {
        const { container } = render(<GraficaDona datos={DATOS} config={CONFIG_ASISTENCIA} centro={{ valor: '67 %', etiqueta: 'Asistencia' }} />);
        expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();
    });
});

describe('GraficaBarras', () => {
    it('sin filas muestra el aviso; con filas monta el contenedor (vertical y horizontal)', () => {
        const { rerender, container } = render(<GraficaBarras datos={[]} ejeX="grupo" series={[{ clave: 'pct' }]} config={{ pct: { label: '%', color: 'var(--chart-1)' } }} />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
        const datos = [{ grupo: '3A', pct: 82 }, { grupo: '5C', pct: 74 }];
        rerender(<GraficaBarras datos={datos} ejeX="grupo" series={[{ clave: 'pct' }]} config={{ pct: { label: '%', color: 'var(--chart-1)' } }} unidad=" %" limite={{ valor: 80, etiqueta: 'Mínimo' }} />);
        expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();
        rerender(<GraficaBarras horizontal apilado datos={datos} ejeX="grupo" series={[{ clave: 'pct' }]} config={{ pct: { label: '%', color: 'var(--chart-1)' } }} />);
        expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();
    });
});

describe('Detalles', () => {
    it('plegado por defecto con aria-expanded; el botón lo abre y cierra y el contenido sigue en el DOM', async () => {
        render(<Detalles titulo="Ver detalle" resumen="24 alumnos"><p>contenido largo</p></Detalles>);
        const boton = screen.getByRole('button', { name: /Ver detalle/ });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByText('contenido largo', { selector: 'p' }).parentElement).toHaveAttribute('hidden');
        await userEvent.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('contenido largo').parentElement).not.toHaveAttribute('hidden');
        await userEvent.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'false');
    });
    it('abierto inicial', () => {
        render(<Detalles titulo="X" abierto><p>hola</p></Detalles>);
        expect(screen.getByRole('button', { name: /X/ })).toHaveAttribute('aria-expanded', 'true');
    });
});
