// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { reglasContrasena, validarContrasena } from '../CambiarContrasenaForm/contrasena.utils.js';
import ReglasContrasena from './ReglasContrasena.jsx';

describe('reglasContrasena', () => {
    it('evalúa largo, letra y número; la coincidencia solo aparece con confirmación escrita', () => {
        expect(reglasContrasena('').map((r) => r.cumple)).toEqual([false, false, false]);
        expect(reglasContrasena('abcdefghij1').map((r) => r.cumple)).toEqual([true, true, true]);
        expect(reglasContrasena('corta1').find((r) => r.id === 'largo').cumple).toBe(false);
        const r = reglasContrasena('abcdefghij1', 'otra');
        expect(r.find((x) => x.id === 'coincide').cumple).toBe(false);
        expect(reglasContrasena('abcdefghij1', 'abcdefghij1').find((x) => x.id === 'coincide').cumple).toBe(true);
    });
    it('es coherente con la validación del envío', () => {
        for (const [n, c] of [['abcdefghij1', 'abcdefghij1'], ['abc', 'abc'], ['abcdefghijk', 'abcdefghijk'], ['1234567890', '1234567890']]) {
            const todas = reglasContrasena(n, c).every((r) => r.cumple);
            expect(Object.keys(validarContrasena(n, c)).length === 0).toBe(todas);
        }
    });
});

describe('ReglasContrasena', () => {
    it('comunica cumple/falta con texto además del icono', () => {
        render(<ReglasContrasena nueva="abc" confirmacion="" />);
        const lista = screen.getByRole('list', { name: 'Requisitos de la contraseña' });
        expect(lista).toHaveTextContent('Al menos 10 caracteres (falta)');
        expect(lista).toHaveTextContent('Contiene una letra (cumple)');
        expect(lista).toHaveTextContent('Contiene un número (falta)');
    });
});
