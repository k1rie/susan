// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
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

describe('CorreccionesRecientes', () => {
    it('muestra la dona del estado final con texto alternativo y una fila por cambio', () => {
        render(<CorreccionesRecientes items={[C(1, 'ausente', { automatica: true }), C(2, 'presente', { comentario: 'Llegó tarde' })]} total={2} />);
        const grupo = screen.getByRole('group', { name: 'Estado final' });
        expect(grupo).toHaveAccessibleDescription('Presentes: 1 (50 %); Ausencias: 1 (50 %)');
        expect(screen.getByText('1 automática por plazo vencido')).toBeInTheDocument();
        expect(screen.getAllByText('cambió a')).toHaveLength(2);
        expect(screen.getByText('“Llegó tarde”')).toBeInTheDocument();
        expect(screen.getByText(/Automática/)).toBeInTheDocument();
    });

    it('avisa cuando solo se cargó una parte de las correcciones', () => {
        render(<CorreccionesRecientes items={[C(1, 'ausente')]} total={40} />);
        expect(screen.getByText(/se muestran 1 de 40/)).toBeInTheDocument();
    });
});
