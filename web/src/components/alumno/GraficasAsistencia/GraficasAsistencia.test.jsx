// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MedidorLiquido from '@/components/ui/MedidorLiquido';
import GraficasAsistencia from './GraficasAsistencia.jsx';

// El medidor real, pero espiado: así se comprueba qué tono, límite y etiqueta recibe sin depender del dibujo del tanque.
vi.mock('@/components/ui/MedidorLiquido', async () => {
    const real = await vi.importActual('@/components/ui/MedidorLiquido');
    return { default: vi.fn((props) => real.default(props)) };
});

const mat = (id, nombre, extra = {}) => ({
    id_grupo: id, clave_grupo: `G${id}`, materia: { nombre }, presentes: 5, retardos: 1, ausencias: 2, justificadas: 1, pendientes: 0,
    sesiones_programadas: 40, faltas_equivalentes: 4, porcentaje_faltas: 10, limite_pct: 20, ...extra,
});

const tarjetaAsistencia = () => screen.getByRole('group', { name: 'Asistencia del periodo' });
const tarjetaFaltas = () => screen.getByRole('group', { name: 'Faltas frente al límite' });
const filasDe = (nodo) => [...nodo.querySelectorAll('[data-fila]')];
const cifrasDe = (nodo) => [...nodo.querySelectorAll('[data-cifra]')].map((n) => n.textContent);

describe('GraficasAsistencia', () => {
    // Con llaves: una arrow que devuelve el mock haría que vitest lo ejecute como limpieza.
    beforeEach(() => {
        MedidorLiquido.mockClear();
        // «Reducir movimiento»: el medidor salta a su nivel sin física ni cuadros pendientes.
        vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('medidor «Tu asistencia»', () => {
        it('es la pieza principal: 100 % menos las faltas equivalentes, con la marca del mínimo y su descripción', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra')]} />);
            const medidor = within(tarjetaAsistencia()).getByRole('meter', { name: 'Tu asistencia: 90 %' });
            expect(medidor).toHaveAttribute('aria-valuenow', '90');
            expect(medidor).toHaveAccessibleDescription('Mínimo 80 % 4 faltas equivalentes de 40 sesiones');
            expect(MedidorLiquido).toHaveBeenCalled();
            expect(MedidorLiquido.mock.calls[0][0]).toMatchObject({ valor: 90, tono: 'presente', etiqueta: 'Tu asistencia', limite: { valor: 80, etiqueta: 'Mínimo 80 %' } });
        });

        it('el tono sigue a la base: una materia en el límite pone el medidor en ámbar y una sobre el límite en rojo', () => {
            const { rerender } = render(<GraficasAsistencia items={[mat(1, 'Álgebra', { en_limite: true })]} />);
            expect(MedidorLiquido.mock.calls.at(-1)[0].tono).toBe('retardo');
            rerender(<GraficasAsistencia items={[mat(1, 'Álgebra', { faltas_equivalentes: 10, porcentaje_faltas: 25, supera_limite: true })]} />);
            expect(MedidorLiquido.mock.calls.at(-1)[0]).toMatchObject({ tono: 'ausente', valor: 75 });
            expect(screen.getByRole('meter', { name: 'Tu asistencia: 75 %' })).toBeInTheDocument();
        });

        it('sin el dato del límite en las props no dibuja marca ni inventa el mínimo', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra', { limite_pct: undefined })]} />);
            expect(MedidorLiquido.mock.calls[0][0].limite).toBeNull();
            expect(screen.getByRole('meter')).toHaveAccessibleDescription('4 faltas equivalentes de 40 sesiones');
            expect(tarjetaAsistencia().querySelector('[data-limite]')).toBeNull();
        });

        it('suma todas las materias', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra'), mat(2, 'Cálculo', { faltas_equivalentes: 8, porcentaje_faltas: 20 })]} />);
            expect(screen.getByRole('meter', { name: 'Tu asistencia: 85 %' })).toHaveAccessibleDescription('Mínimo 80 % 12 faltas equivalentes de 80 sesiones');
        });

        it('sin sesiones programadas no hay medidor (no se inventa un nivel) pero el anillo sí se muestra', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra', { sesiones_programadas: 0, faltas_equivalentes: 0 })]} />);
            expect(screen.queryByRole('meter')).toBeNull();
            expect(MedidorLiquido).not.toHaveBeenCalled();
            expect(tarjetaAsistencia()).toHaveAccessibleDescription(/Presentes: 5/);
        });
    });

    // jsdom no mide el layout, así que se fija el contrato de clases que evita el aplastamiento: en fila el anillo tiene ancho fijo y el
    // medidor (cuya descripción sí se parte) es quien cede espacio. Con el medidor en shrink-0 y el anillo en flex-1, una descripción
    // larga dejaba el anillo en 0 px y la leyenda sin etiquetas.
    describe('disposición medidor + anillo (tarjeta ancha)', () => {
        const anillo = () => tarjetaAsistencia().querySelector('[class~="@min-[34rem]:w-72"]');

        it('el medidor cede espacio (min-w-0 + flex-1) y no se fija con shrink-0', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra'), mat(2, 'Cálculo', { faltas_equivalentes: 12, supera_limite: true })]} />);
            const clases = MedidorLiquido.mock.calls[0][0].className.split(' ');
            expect(clases).toEqual(expect.arrayContaining(['@min-[34rem]:min-w-0', '@min-[34rem]:flex-1']));
            expect(clases).not.toContain('@min-[34rem]:shrink-0');
        });

        it('el anillo conserva un ancho fijo en fila (w-72, sin crecer ni encogerse) y ocupa todo el ancho al apilar', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra')]} />);
            expect(anillo()).not.toBeNull();
            const clases = anillo().className.split(' ');
            expect(clases).toEqual(expect.arrayContaining(['w-full', '@min-[34rem]:w-72', '@min-[34rem]:flex-none']));
            expect(clases).not.toContain('@min-[34rem]:flex-1');
        });
    });

    describe('anillo de registros', () => {
        it('con una materia solo se pintan el medidor y el anillo, con texto alternativo', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra')]} />);
            expect(tarjetaAsistencia()).toHaveAccessibleDescription(/Presentes: 5 \(56 %\); Retardos: 1 \(11 %\); Ausencias: 2 \(22 %\); Justificadas: 1 \(11 %\)/);
            expect(screen.queryByRole('group', { name: 'Faltas frente al límite' })).not.toBeInTheDocument();
        });

        it('la leyenda trae cada estado con su cifra y porcentaje, y el centro el total de registros (no un segundo % de asistencia)', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra')]} />);
            const tarjeta = tarjetaAsistencia();
            expect(within(tarjeta).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
                'Presentes556 %', 'Retardos111 %', 'Ausencias222 %', 'Justificadas111 %',
            ]);
            expect(within(tarjeta).getByText('Registros')).toBeInTheDocument();
            expect(within(tarjeta).getByText('9', { selector: 'span.tabular-nums.font-semibold' })).toBeInTheDocument();
            expect(within(tarjeta).queryByText('Asistieron')).toBeNull();
        });

        it('el texto alternativo dice cuánto «asististe» sin confundirlo con el medidor', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra')]} />);
            expect(tarjetaAsistencia()).toHaveAccessibleDescription(/Asististe \(presente o retardo\) en el 67 % de los registros ya resueltos\./);
        });

        it('sin registros de asistencia muestra el aviso en lugar de un hueco', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra', { presentes: 0, retardos: 0, ausencias: 0, justificadas: 0 })]} />);
            expect(screen.getByText('Aún no hay registros de asistencia')).toBeInTheDocument();
            expect(tarjetaAsistencia()).toHaveAccessibleDescription('Aún no hay registros de asistencia.');
        });

        it('avisa de los pendientes que aún no cuentan', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra', { pendientes: 2 })]} />);
            expect(screen.getByText('2 registros pendientes de revisión aún no cuentan.')).toBeInTheDocument();
        });
    });

    describe('«Cómo se calcula» (plegado)', () => {
        it('las explicaciones están plegadas y se abren con el botón', async () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra')]} />);
            const boton = screen.getByRole('button', { name: 'Cómo se calcula' });
            expect(boton).toHaveAttribute('aria-expanded', 'false');
            await userEvent.click(boton);
            expect(boton).toHaveAttribute('aria-expanded', 'true');
            // El contenido sigue en el DOM aunque esté plegado (Detalles lo oculta con una clase, que jsdom no aplica).
            expect(screen.getByText(/Tu asistencia es 100 % menos tus faltas equivalentes/)).toBeInTheDocument();
            expect(screen.getByText(/asististe \(presente o retardo\) en el 67 % de los registros ya resueltos/)).toBeInTheDocument();
            expect(screen.getByText(/no se mide así, sino en faltas equivalentes/)).toBeInTheDocument();
        });

        it('sin nada que explicar (sin medidor ni registros ni pendientes) no hay pie', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra', { sesiones_programadas: 0, faltas_equivalentes: 0, presentes: 0, retardos: 0, ausencias: 0, justificadas: 0 })]} />);
            expect(screen.queryByRole('button', { name: 'Cómo se calcula' })).toBeNull();
        });
    });

    describe('faltas frente al límite', () => {
        const dos = () => [mat(1, 'Álgebra'), mat(2, 'Cálculo', { porcentaje_faltas: 30, faltas_equivalentes: 12, supera_limite: true })];

        it('con varias materias añade la gráfica: una fila por materia con su cifra y la leyenda de estados', () => {
            render(<GraficasAsistencia items={dos()} />);
            const tarjeta = tarjetaFaltas();
            expect(tarjeta).toHaveAccessibleDescription(/Cálculo: 30 % de faltas \(sobre el límite\).*Límite: 20 %/);
            expect(filasDe(tarjeta).map((f) => f.getAttribute('data-fila'))).toEqual(['Álgebra', 'Cálculo']);
            expect(cifrasDe(tarjeta)).toEqual(['10 %', '30 %']);
            const leyenda = within(tarjeta).getAllByRole('listitem').map((li) => li.textContent);
            expect(leyenda).toEqual(expect.arrayContaining(['Dentro del límite', 'Sobre el límite']));
            expect(leyenda).not.toContain('En el límite');
        });

        it('conserva el límite: línea discontinua con su etiqueta «Límite 20 %»', () => {
            render(<GraficasAsistencia items={dos()} />);
            const tarjeta = tarjetaFaltas();
            expect(tarjeta.querySelector('[data-limite]')).not.toBeNull();
            // La etiqueta se dibuja sobre la línea y además va en el texto para lectores de pantalla.
            expect(within(tarjeta).getAllByText('Límite 20 %').length).toBeGreaterThanOrEqual(1);
        });

        it('un límite con decimales se escribe con el formato numérico de la interfaz (es-MX)', () => {
            render(<GraficasAsistencia items={[mat(1, 'A', { limite_pct: 22.5 }), mat(2, 'B', { limite_pct: 22.5 })]} />);
            expect(within(tarjetaFaltas()).getAllByText('Límite 22.5 %').length).toBeGreaterThanOrEqual(1);
        });

        it('la materia que está en el límite lo dice su texto alternativo y su serie', () => {
            render(<GraficasAsistencia items={[mat(1, 'Álgebra'), mat(2, 'Cálculo', { porcentaje_faltas: 20, en_limite: true })]} />);
            expect(tarjetaFaltas()).toHaveAccessibleDescription(/Cálculo: 20 % de faltas \(en el límite\)/);
            const fila = filasDe(tarjetaFaltas()).find((f) => f.getAttribute('data-fila') === 'Cálculo');
            expect(fila).toHaveAttribute('title', expect.stringContaining('En el límite 20 %'));
        });

        it('el nombre largo de una materia va completo (no se recorta a 18 letras)', () => {
            render(<GraficasAsistencia items={[mat(1, 'Métodos numéricos aplicados a ingeniería'), mat(2, 'Cálculo')]} />);
            expect(tarjetaFaltas()).toHaveAccessibleDescription(/Métodos numéricos aplicados a ingeniería: 10 % de faltas/);
            expect(within(tarjetaFaltas()).getByTitle('Métodos numéricos aplicados a ingeniería')).toBeInTheDocument();
        });
    });
});
