// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EtiquetaSospechosa from './EtiquetaSospechosa.jsx';

describe('EtiquetaSospechosa', () => {
    it('dice «Sospechosa» con texto y explica cuántas lecturas la causan', () => {
        render(<EtiquetaSospechosa lecturasNoVivas={2} />);
        const etiqueta = screen.getByText('Sospechosa');
        expect(etiqueta).toHaveAttribute('title', '2 lecturas válidas marcadas como no viva');
    });

    it('singular y sin conteo', () => {
        const { rerender } = render(<EtiquetaSospechosa lecturasNoVivas={1} />);
        expect(screen.getByText('Sospechosa')).toHaveAttribute('title', '1 lectura válida marcada como no viva');
        rerender(<EtiquetaSospechosa />);
        expect(screen.getByText('Sospechosa')).toHaveAttribute('title', 'Lectura marcada como no viva');
    });
});
