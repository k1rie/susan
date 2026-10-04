// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CONFIG_ASISTENCIA, resumenTexto } from '@/lib/graficas.js';
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

    it('sin resumen no declara descripción accesible', () => {
        render(<TarjetaGrafica titulo="Sin resumen"><div>grafica</div></TarjetaGrafica>);
        expect(screen.getByRole('group', { name: 'Sin resumen' })).not.toHaveAttribute('aria-describedby');
    });
});
