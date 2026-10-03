// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RecorteFirmado from './RecorteFirmado.jsx';
import { recortePurgado } from '../LecturasCaso/lecturasCaso.utils.js';

describe('RecorteFirmado', () => {
    it('purgado: silueta con la leyenda de retención', () => {
        render(<RecorteFirmado url={null} purgado alt="r" />);
        expect(screen.getByText('Recorte eliminado por retención')).toBeInTheDocument();
        expect(screen.queryByRole('img')).toBeNull();
    });
    it('con URL muestra la imagen y, si falla, ofrece volver a cargar', async () => {
        const onExpirada = vi.fn();
        render(<RecorteFirmado url="/x.jpg" alt="recorte" onExpirada={onExpirada} />);
        fireEvent.error(screen.getByAltText('recorte'));
        expect(screen.getByText('Enlace vencido')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
        expect(onExpirada).toHaveBeenCalledOnce();
    });
    it('recortePurgado detecta lecturas sin recorte', () => {
        expect(recortePurgado({ recorte_disponible: false, recorte: null })).toBe(true);
        expect(recortePurgado({ recorte_disponible: true, recorte: { url: 'u' } })).toBe(false);
    });
});
