// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TablaReporte from './TablaReporte.jsx';

const fila = (o) => ({ id_alumno: 1, matricula: 'E1', nombre_completo: 'Ana Pérez', presentes: 5, retardos: 0, ausencias: 1, justificadas: 0, pendientes: 0,
    faltas_equivalentes: 1, porcentaje_faltas: 2.22, faltas_restantes_antes_limite: 8, derecho_examen: true, en_limite: false, supera_limite: false, ...o });
const sinDerecho = fila({ id_alumno: 2, matricula: 'E2', nombre_completo: 'Luis Gómez', presentes: 3, ausencias: 9, faltas_equivalentes: 9, porcentaje_faltas: 24,
    derecho_examen: false, supera_limite: true, faltas_restantes_antes_limite: 0 });
const completo = fila({ id_alumno: 3, matricula: 'E3', nombre_completo: 'Eva Ríos', presentes: 11, retardos: 3, ausencias: 6, justificadas: 2, pendientes: 1,
    faltas_equivalentes: 7, porcentaje_faltas: 17.8, en_limite: true });
const sinRegistros = fila({ id_alumno: 4, matricula: 'E4', nombre_completo: 'Sin Registros', presentes: 0, ausencias: 0, faltas_equivalentes: 0, porcentaje_faltas: 0 });

// Con "reducir movimiento" las barras se dibujan al instante: sin observadores ni temporizadores fuera de `act`.
beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => vi.unstubAllGlobals());

const tabla = () => screen.getByRole('table', { name: 'Asistencia acumulada por alumno' });
const barrasDe = (nombre) => within(screen.getByText(nombre).closest('tr')).getAllByRole('img');

describe('TablaReporte', () => {
    it('muestra lo esencial de cada alumno: matrícula, nombre, % de faltas, faltas equivalentes y derecho a examen en texto', () => {
        render(<TablaReporte items={[fila(), sinDerecho, completo]} />);
        const t = within(tabla());
        expect(t.getAllByRole('row')).toHaveLength(4);
        expect(t.getByText('2.22 %')).toBeInTheDocument();
        expect(t.getByText('24.00 %')).toBeInTheDocument();
        expect(t.getByText('Con derecho')).toBeInTheDocument();
        expect(t.getByText('Sin derecho')).toBeInTheDocument();
        expect(t.getByText('En el límite')).toBeInTheDocument();
        // El color de fila refuerza el texto (nunca lo sustituye).
        expect(t.getByText('Luis Gómez').closest('tr')).toHaveClass('bg-ausente-bg');
        expect(t.getByText('Eva Ríos').closest('tr')).toHaveClass('bg-retardo-bg');
    });

    it('sin sesiones programadas no muestra un porcentaje de faltas', () => {
        render(<TablaReporte items={[fila({ porcentaje_faltas: null })]} sinSesiones />);
        expect(within(screen.getByText('Ana Pérez').closest('tr')).getByText('—', { selector: 'td' })).toBeInTheDocument();
        expect(screen.queryByText(/\d %/)).toBeNull();
    });

    it('la composición es UNA columna con barra (sustituye a las cinco de cifras) y ninguna cifra se pierde a la vista', () => {
        render(<TablaReporte items={[fila()]} />);
        const t = within(tabla());
        expect(t.getByRole('columnheader', { name: 'Composición' })).toBeInTheDocument();
        for (const c of ['Presentes', 'Retardos', 'Ausencias', 'Justificadas', 'Pendientes']) {
            expect(t.queryByRole('columnheader', { name: c })).toBeNull();
        }
        // Las cifras siguen en el aria-label de la barra y también escritas: bajo el nombre (hasta lg) y bajo la barra de la
        // columna (xl). El color solo no basta ni el title (sin hover con teclado o con toque); el CSS deja visible solo una copia.
        expect(barrasDe('Ana Pérez')[0]).toHaveAccessibleName('Presentes 5 (83 %); Ausencias 1 (17 %)');
        const textos = t.getAllByText(/5\spres\., 0\sret\., 1\saus\./);
        expect(textos).toHaveLength(2);
        expect(textos[0]).toHaveClass('xl:hidden');
        const celdaComposicion = barrasDe('Ana Pérez')[1].closest('td');
        expect(celdaComposicion).toContainElement(textos[1]);
        expect(celdaComposicion).toHaveClass('hidden', 'xl:table-cell');
    });

    it('el texto de la columna de composición comparte el ancho de la barra: se parte en las comas y no ensancha la columna', () => {
        render(<TablaReporte items={[completo]} />);
        const celda = barrasDe('Eva Ríos')[1].closest('td');
        const texto = within(celda).getByText(/11\spres\., 3\sret\., 6\saus\., 2\sjust\., 1\spend\./);
        expect(texto.parentElement).toHaveClass('w-44');
        expect(texto.parentElement).toContainElement(barrasDe('Eva Ríos')[1]);
    });

    it('cada alumno lleva dos barras iguales: bajo el nombre (hasta lg) y en su columna (xl); el CSS oculta la que no corresponde', () => {
        render(<TablaReporte items={[fila()]} />);
        const barras = barrasDe('Ana Pérez');
        expect(barras).toHaveLength(2);
        expect(barras[0]).toHaveAccessibleName(barras[1].getAttribute('aria-label'));
        expect(barras[0].parentElement).toHaveClass('xl:hidden');
        expect(barras[1].closest('div.w-44')).not.toBeNull();
        expect(barras[1].closest('td')).toHaveClass('hidden', 'xl:table-cell');
    });

    it('la barra nombra todos los estados con cifra: retardos, justificadas y pendientes incluidos', () => {
        render(<TablaReporte items={[completo]} />);
        expect(barrasDe('Eva Ríos')[0]).toHaveAccessibleName('Presentes 11 (48 %); Retardos 3 (13 %); Ausencias 6 (26 %); Justificadas 2 (9 %); Pendientes 1 (4 %)');
    });

    it('un alumno sin registros lleva una pista vacía con su nombre accesible, no una barra falsa', () => {
        render(<TablaReporte items={[sinRegistros]} />);
        const barras = barrasDe('Sin Registros');
        expect(barras).toHaveLength(2);
        expect(barras[0]).toHaveAccessibleName('Sin registros');
        expect(barras[0].querySelector('[data-segmento]')).toBeNull();
    });

    it('la leyenda se escribe una vez, es decorativa y solo trae los estados que aparecen en las filas', () => {
        const { container, rerender } = render(<TablaReporte items={[fila(), sinDerecho]} />);
        const leyenda = container.querySelector('ul[aria-hidden="true"]');
        expect([...leyenda.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Presentes', 'Ausencias']);
        rerender(<TablaReporte items={[completo]} />);
        expect([...container.querySelector('ul[aria-hidden="true"]').querySelectorAll('li')].map((li) => li.textContent))
            .toEqual(['Presentes', 'Retardos', 'Ausencias', 'Justificadas', 'Pendientes']);
        rerender(<TablaReporte items={[sinRegistros]} />);
        expect(container.querySelector('ul[aria-hidden="true"]')).toBeNull();
    });

    it('en pantallas angostas las faltas restantes y las equivalentes van resumidas bajo el nombre y no hay anchura mínima', () => {
        render(<TablaReporte items={[fila()]} />);
        const t = within(tabla());
        expect(t.getByText(/faltas eq\.\s1/)).toBeInTheDocument();
        expect(t.getByText(/8\sfaltas restantes/)).toBeInTheDocument();
        // Sin scroll horizontal a 360 px: la tabla ocupa el ancho disponible y no el de su contenido.
        expect(tabla()).toHaveClass('w-full');
        expect(tabla().className).not.toMatch(/min-w-/);
    });

    it('sin filas no pinta leyenda ni filas', () => {
        const { container } = render(<TablaReporte items={[]} />);
        expect(container.querySelector('ul')).toBeNull();
        expect(within(tabla()).getAllByRole('row')).toHaveLength(1);
    });
});
