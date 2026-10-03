// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MisGrupos from './MisGrupos.jsx';

const grupo = (i) => ({ id_grupo: i, materia: `Materia ${i}`, clave_grupo: `${i}A`, aula: 'A-12', periodo: '2026-2', inscritos: 20 + i });

describe('MisGrupos', () => {
    it('sin grupos muestra el estado vacío', () => {
        render(<MisGrupos grupos={[]} />);
        expect(screen.getByText('Sin grupos')).toBeInTheDocument();
    });

    it('una fila compacta por grupo con los inscritos en una insignia', () => {
        render(<MisGrupos grupos={[grupo(1)]} />);
        expect(screen.getByText('Materia 1 (1A)')).toBeInTheDocument();
        expect(screen.getByText('Aula A-12 · 2026-2')).toBeInTheDocument();
        expect(screen.getByText('21 alumnos')).toBeInTheDocument();
    });

    it('pliega los grupos a partir del séptimo', () => {
        render(<MisGrupos grupos={Array.from({ length: 9 }, (_, i) => grupo(i + 1))} />);
        expect(screen.getByRole('button', { name: /Ver los 3 restantes/ })).toHaveAttribute('aria-expanded', 'false');
    });
});
