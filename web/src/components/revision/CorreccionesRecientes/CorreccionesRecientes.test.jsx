// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CorreccionesRecientes from './CorreccionesRecientes.jsx';

const C = (id, nuevo, extra = {}) => ({
    id_bitacora: id,
    alumno: { nombre_completo: `Ana ${id}` },
    materia: { nombre: 'Finanzas' },
    grupo: { clave_grupo: '3A' },
    sesion: { fecha: '2026-09-14' },
    estado_anterior: 'pendiente',
    estado_nuevo: nuevo,
    automatica: false,
    usuario: { rol: 'docente' },
    fecha_hora: '2026-09-15T15:00:00Z',
    ...extra,
});

// La fila de la leyenda del anillo (la que lleva el nombre del estado, no el chip de cada cambio).
const filaDeLeyenda = (nombre) => screen.getByText(nombre).closest('li');

describe('CorreccionesRecientes', () => {
    it('muestra el anillo del estado final con texto alternativo y una fila por cambio', () => {
        render(<CorreccionesRecientes items={[C(1, 'ausente', { automatica: true }), C(2, 'presente', { comentario: 'Llegó tarde' })]} total={2} />);
        const grupo = screen.getByRole('group', { name: 'Estado final' });
        expect(grupo).toHaveAccessibleDescription('Presentes: 1 (50 %); Ausencias: 1 (50 %)');
        expect(screen.getByText('1 automática por plazo vencido')).toBeInTheDocument();
        expect(screen.getAllByText('cambió a')).toHaveLength(2);
        expect(screen.getByText('“Llegó tarde”')).toBeInTheDocument();
        expect(screen.getByText(/Automática/)).toBeInTheDocument();
    });

    it('la leyenda del anillo da la cifra y el porcentaje de cada estado, y el centro el total de cambios', () => {
        const { container } = render(
            <CorreccionesRecientes items={[C(1, 'ausente'), C(2, 'presente'), C(3, 'presente'), C(4, 'presente')]} total={4} />,
        );
        expect(filaDeLeyenda('Presentes')).toHaveTextContent(/Presentes.*3.*75 %/);
        expect(filaDeLeyenda('Ausencias')).toHaveTextContent(/Ausencias.*1.*25 %/);
        // Un estado sin cambios no aparece en la leyenda.
        expect(screen.queryByText('Retardos')).toBeNull();
        expect(screen.queryByText('Justificadas')).toBeNull();
        // Centro: total de cambios y su etiqueta (no el total del anillo con la etiqueta por defecto).
        const anillo = container.querySelector('.\\@container');
        expect(within(anillo).getByText('4')).toBeInTheDocument();
        expect(within(anillo).getByText('cambios')).toBeInTheDocument();
        expect(within(anillo).queryByText('Total')).toBeNull();
        // Es un anillo hecho a mano: no monta el contenedor `data-slot="chart"` de la librería anterior.
        expect(container.querySelector('[data-slot="chart"]')).toBeNull();
    });

    it('un estado muy raro se escribe «<1 %» y no «0 %», que contradiría su cifra', () => {
        const muchas = [...Array.from({ length: 300 }, (_, i) => C(i + 1, 'presente')), C(999, 'ausente')];
        render(<CorreccionesRecientes items={muchas} total={301} />);
        expect(filaDeLeyenda('Ausencias')).toHaveTextContent('<1 %');
        expect(filaDeLeyenda('Presentes')).toHaveTextContent('100 %');
    });

    it('si ninguna corrección terminó en un estado conocido, el anillo avisa que no hay qué graficar', () => {
        render(<CorreccionesRecientes items={[C(1, 'raro')]} total={1} />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
        // La lista de cambios sigue completa.
        expect(screen.getAllByText('cambió a')).toHaveLength(1);
    });

    it('avisa cuando solo se cargó una parte de las correcciones', () => {
        render(<CorreccionesRecientes items={[C(1, 'ausente')]} total={40} />);
        expect(screen.getByText(/se muestran 1 de 40/)).toBeInTheDocument();
    });

    it('no avisa «se muestran» cuando están todas', () => {
        render(<CorreccionesRecientes items={[C(1, 'ausente')]} total={1} />);
        expect(screen.queryByText(/se muestran/)).toBeNull();
    });
});
