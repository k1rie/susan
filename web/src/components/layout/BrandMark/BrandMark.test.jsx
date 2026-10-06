// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BrandMark from './BrandMark.jsx';

describe('BrandMark', () => {
    it('solo muestra el nombre del sistema, sin escudos ni imágenes', () => {
        const { container } = render(<BrandMark variant="compact" />);
        expect(screen.getByText('SUSAN')).toBeInTheDocument();
        expect(container.querySelector('img')).toBeNull();
    });

    it('en "full" añade el subtítulo y sigue sin imágenes', () => {
        const { container } = render(<BrandMark />);
        expect(screen.getByText('Registro de asistencia')).toBeInTheDocument();
        expect(container.querySelector('img')).toBeNull();
    });
});
