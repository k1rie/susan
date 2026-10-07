// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
    inscritos: vi.fn(),
    bajaInscripcion: vi.fn(),
    alumnosListar: vi.fn(),
    inscribir: vi.fn(),
    importarInscripciones: vi.fn(),
}));
vi.mock('@/lib/api/admin.js', () => api);
import InscripcionesTabla from './InscripcionesTabla.jsx';

const fila = (n, estatus = 'activa') => ({ id_inscripcion: n, id_alumno: n, matricula: `E26000${n}`, nombre_completo: `Alumno ${n}`, estatus, fecha_alta: '2026-09-14', consentimiento_vigente: n % 2 === 0 });

beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.inscritos.mockResolvedValue({ total: 2, items: [fila(1), fila(2)] });
    api.bajaInscripcion.mockResolvedValue({ cambio: true });
    api.alumnosListar.mockResolvedValue({ total: 0, items: [] });
});

describe('InscripcionesTabla', () => {
    it('lista las inscripciones y ofrece inscribir (con los lugares libres) e importar un CSV', async () => {
        render(<InscripcionesTabla idGrupo={3} capacidadAula={5} />);
        expect(await screen.findByText('E260001')).toBeTruthy();
        expect(screen.getByText('Quedan 3 lugares libres en el aula (2 de 5).')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Importar desde CSV' })).toBeTruthy();
        expect(screen.getByRole('combobox', { name: /Buscar alumno/ })).toBeTruthy();
    });

    it('si el grupo supera la capacidad del aula lo avisa', async () => {
        render(<InscripcionesTabla idGrupo={3} capacidadAula={1} />);
        expect(await screen.findByText(/El grupo supera la capacidad del aula \(1\)/)).toBeTruthy();
    });

    it('no enseña cifras de capacidad hasta tener la lista (no mide con cero inscritos)', async () => {
        let resolver;
        api.inscritos.mockReturnValue(new Promise((r) => { resolver = r; }));
        render(<InscripcionesTabla idGrupo={3} capacidadAula={5} />);
        expect(screen.queryByText(/lugares libres/)).toBeNull();
        resolver({ total: 2, items: [fila(1), fila(2)] });
        expect(await screen.findByText('Quedan 3 lugares libres en el aula (2 de 5).')).toBeTruthy();
    });

    it('dar de baja pide confirmar diciendo qué pasa y luego recarga', async () => {
        const onChanged = vi.fn();
        const user = userEvent.setup();
        render(<InscripcionesTabla idGrupo={3} capacidadAula={5} onChanged={onChanged} />);
        await user.click(await screen.findByRole('button', { name: 'Dar de baja a Alumno 1' }));
        const dialogo = await screen.findByRole('dialog', { name: 'Dar de baja la inscripción' });
        expect(within(dialogo).getByText(/ya no contará en el cupo del aula ni aparecerá en el pase de lista/)).toBeTruthy();
        expect(within(dialogo).getByText(/Si vuelve, se puede reinscribir/)).toBeTruthy();
        await user.click(within(dialogo).getByRole('button', { name: 'Dar de baja' }));
        await waitFor(() => expect(api.bajaInscripcion).toHaveBeenCalledWith({ idInscripcion: 1 }));
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it('sin inscripciones muestra el estado vacío con el siguiente paso', async () => {
        api.inscritos.mockResolvedValue({ total: 0, items: [] });
        render(<InscripcionesTabla idGrupo={3} capacidadAula={5} />);
        expect(await screen.findByText('Sin inscripciones')).toBeTruthy();
        expect(screen.getByText(/Busca a un alumno arriba para inscribirlo o importa un CSV/)).toBeTruthy();
    });
});
