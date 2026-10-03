// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import HistorialMateria from './HistorialMateria.jsx';

const sesion = (id, extra = {}) => ({ id_sesion: id, fecha: '2026-09-10', hora_inicio: '08:00:00', estado: 'ausente', origen: 'automatico', ...extra });

describe('HistorialMateria', () => {
    it('sin sesiones muestra el aviso', () => {
        render(<HistorialMateria items={[]} />);
        expect(screen.getByText('Aún no hay sesiones registradas en esta materia.')).toBeInTheDocument();
    });
    it('muestra fecha, estado y origen en texto corto; Justificar solo si se puede', async () => {
        const alJustificar = vi.fn();
        render(<HistorialMateria items={[sesion(1, { puede_justificar: true }), sesion(2, { estado: 'presente' })]} total={2} onJustificar={alJustificar} />);
        expect(screen.getAllByText('10/09/2026 · 08:00')).toHaveLength(2);
        expect(screen.getAllByText('Automático')).toHaveLength(2);
        expect(screen.getByText('Ausente')).toBeInTheDocument();
        const botones = screen.getAllByRole('button', { name: 'Justificar' });
        expect(botones).toHaveLength(1);
        await userEvent.click(botones[0]);
        expect(alJustificar).toHaveBeenCalledWith(expect.objectContaining({ id_sesion: 1 }));
    });
    it('conserva el estado del justificante y el registro; suspendida y sin registro', () => {
        render(<HistorialMateria items={[
            sesion(1, { justificante: { estatus: 'pendiente' }, hora_registro: '2026-09-10T08:03:00' }),
            sesion(2, { estado: null, origen: null }),
            sesion(3, { estatus_sesion: 'suspendida', estado: null }),
        ]} total={3} />);
        expect(screen.getByText(/Justificante:/)).toHaveTextContent('Pendiente');
        expect(screen.getByText('Automático · 08:03')).toBeInTheDocument();
        expect(screen.getByText('Sin registro')).toBeInTheDocument();
        expect(screen.getByText('Suspendida')).toBeInTheDocument();
    });
    it('pagina por desplazamiento con el tamaño recibido', async () => {
        const alPaginar = vi.fn();
        render(<HistorialMateria items={[sesion(1)]} total={20} limit={8} offset={0} onPagina={alPaginar} />);
        await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        expect(alPaginar).toHaveBeenCalledWith(8);
    });
});
