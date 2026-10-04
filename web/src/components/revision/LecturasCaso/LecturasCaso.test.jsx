// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LecturasCaso from './LecturasCaso.jsx';
import { obtenerDeteccionesCaso } from '@/lib/http/revision.js';

vi.mock('@/lib/http/revision.js', () => ({ obtenerDeteccionesCaso: vi.fn() }));

const L = (id, min, score, es_valida) => ({ id_deteccion: id, marca_tiempo: `2026-09-14T13:${String(min).padStart(2, '0')}:00Z`, minuto_sesion: min, camara_posicion: 'frente', score_similitud: score, es_valida, recorte_disponible: false });

// Las tarjetas de la lista de lecturas (no la leyenda ni el texto oculto de la gráfica, que también son <li>).
const tarjetas = () => screen.getAllByRole('listitem').filter((li) => /Lectura \d+ ·/.test(li.textContent));
const columnas = (c) => [...c.querySelectorAll('[data-fila]')];
const cifras = (columna) => [...columna.querySelectorAll('[data-cifra]')].map((n) => n.textContent);
// Segmentos dibujados (opacidad 1) de una columna: el score va en la serie `valida` o en `no_valida`, nunca en las dos.
const segmentosDibujados = (columna) => [...columna.querySelectorAll('[data-segmento]')].filter((s) => s.style.opacity === '1');
const seriesDibujadas = (columna) => segmentosDibujados(columna).map((s) => s.dataset.segmento);
// «calc(81% - 2px)» -> 81
const altoDe = (columna) => Number(/([\d.]+)%/.exec(segmentosDibujados(columna)[0].style.height)[1]);

describe('LecturasCaso', () => {
    it('con lecturas muestra el avance de válidas, la gráfica de scores con texto alternativo y una tarjeta por lectura', async () => {
        obtenerDeteccionesCaso.mockResolvedValue({ foto_registro: null, lecturas: [L(1, 1, 0.81, true), L(2, 2, 0.4, false)] });
        const { container } = render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(screen.getByText('Lecturas válidas: 1/3')).toBeInTheDocument());
        expect(screen.getByRole('progressbar', { name: 'Lecturas válidas frente al mínimo' })).toHaveAttribute('aria-valuetext', '1 de 3');
        expect(screen.getByRole('group', { name: 'Score por lectura' })).toHaveAccessibleDescription(/lectura 1: 81 % \(válida\); lectura 2: 40 % \(no válida\)/);
        // La leyenda de la gráfica y la tarjeta de cada lectura dicen el estado con texto, no solo con color.
        expect(screen.getAllByText('Válida').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('No válida').length).toBeGreaterThanOrEqual(2);
        expect(tarjetas()).toHaveLength(2);
        expect(screen.getByText('Sin foto de registro activa')).toBeInTheDocument();
        // Es una gráfica hecha a mano: una columna por lectura con su score y sin el contenedor `data-slot="chart"` de la librería anterior.
        expect(columnas(container).map((c) => c.dataset.fila)).toEqual(['1', '2']);
        expect(container.querySelector('[data-slot="chart"]')).toBeNull();
    });

    it('cada columna lleva su score y lo dibuja en la serie que corresponde, sobre una escala fija de 0 a 100', async () => {
        obtenerDeteccionesCaso.mockResolvedValue({ foto_registro: null, lecturas: [L(1, 1, 0.81, true), L(2, 2, 0.4, false), L(3, 3, 1, true)] });
        const { container } = render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(columnas(container)).toHaveLength(3));
        const [uno, dos, tres] = columnas(container);
        expect(cifras(uno)).toEqual(['81 %']);
        expect(cifras(dos)).toEqual(['40 %']);
        expect(seriesDibujadas(uno)).toEqual(['valida']);
        expect(seriesDibujadas(dos)).toEqual(['no_valida']);
        // La altura es el score tal cual (dominio [0, 100]): un 100 llena la columna y un 40 no llega a la mitad.
        expect(altoDe(uno)).toBe(81);
        expect(altoDe(dos)).toBe(40);
        expect(altoDe(tres)).toBe(100);
    });

    it('la lista sigue el orden cronológico y numera cada tarjeta como la gráfica, aunque el servidor entregue las válidas primero', async () => {
        // Orden del servidor: válidas primero (la lectura de las 13:03 llega antes que la de las 13:02).
        obtenerDeteccionesCaso.mockResolvedValue({ foto_registro: null, lecturas: [L(1, 1, 0.81, true), L(3, 3, 0.7, true), L(2, 2, 0.4, false)] });
        const { container } = render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(screen.getByText('Lecturas válidas: 2/3')).toBeInTheDocument());
        const lista = tarjetas();
        expect(lista.map((t) => t.textContent.match(/Lectura (\d+) ·/)[1])).toEqual(['1', '2', '3']);
        // La lectura 2 (13:02) es la no válida, y es la segunda tarjeta y la segunda columna.
        expect(lista[1]).toHaveTextContent('No válida');
        expect(columnas(container).map((c) => c.dataset.fila)).toEqual(['1', '2', '3']);
        expect(seriesDibujadas(columnas(container)[1])).toEqual(['no_valida']);
        expect(screen.getByRole('group', { name: 'Score por lectura' })).toHaveAccessibleDescription(/lectura 2: 40 % \(no válida\)/);
    });

    it('con más lecturas que columnas muestra las más recientes con su número real y lo avisa; la lista las trae todas', async () => {
        // 20 lecturas: a 360 px caben 12 columnas con el número completo (con más, «10»… se cortaba en «1.»).
        const veinte = Array.from({ length: 20 }, (_, i) => L(i + 1, i, 0.5 + (i % 5) / 10, i % 2 === 0));
        obtenerDeteccionesCaso.mockResolvedValue({ foto_registro: null, lecturas: veinte });
        const { container } = render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(columnas(container)).toHaveLength(12));
        expect(columnas(container).map((c) => c.dataset.fila)).toEqual(['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20']);
        expect(screen.getByText('Se muestran las 12 más recientes de 20.')).toBeInTheDocument();
        expect(tarjetas()).toHaveLength(20);
    });

    it('con 12 lecturas o menos no hay aviso de recorte', async () => {
        const doce = Array.from({ length: 12 }, (_, i) => L(i + 1, i, 0.7, true));
        obtenerDeteccionesCaso.mockResolvedValue({ foto_registro: null, lecturas: doce });
        const { container } = render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(columnas(container)).toHaveLength(12));
        expect(screen.queryByText(/Se muestran las/)).toBeNull();
    });

    it('una lectura sin score no se grafica como 0 %, pero su tarjeta sí está y el aviso no la cuenta', async () => {
        obtenerDeteccionesCaso.mockResolvedValue({ foto_registro: null, lecturas: [L(1, 1, 0.8, true), L(2, 2, null, false), L(3, 3, 0.6, false)] });
        const { container } = render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(columnas(container)).toHaveLength(2));
        // La lectura 3 conserva su número aunque la 2 no tenga score.
        expect(columnas(container).map((c) => c.dataset.fila)).toEqual(['1', '3']);
        expect(tarjetas()).toHaveLength(3);
        expect(screen.queryByText(/Se muestran las/)).toBeNull();
    });

    it('con una sola lectura no dibuja gráfica', async () => {
        obtenerDeteccionesCaso.mockResolvedValue({ foto_registro: null, lecturas: [L(1, 1, 0.81, true)] });
        render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(screen.getByText('Lecturas válidas: 1/3')).toBeInTheDocument());
        expect(screen.queryByRole('group', { name: 'Score por lectura' })).toBeNull();
    });

    it('sin lecturas lo dice', async () => {
        obtenerDeteccionesCaso.mockResolvedValue({ foto_registro: null, lecturas: [] });
        render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(screen.getByText(/Sin lecturas del reconocimiento facial/)).toBeInTheDocument());
    });

    it('si falla la carga ofrece reintentar', async () => {
        obtenerDeteccionesCaso.mockRejectedValue(new Error('boom'));
        render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument());
    });
});
