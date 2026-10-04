// Contraste de los colores de GRÁFICA (--g-*) de globals.css contra la tarjeta que los contiene.
// WCAG 1.4.11 pide >= 3:1 para elementos gráficos: una línea de 1,75 px (p. ej. la media móvil EMA de Analítica, que usa --g-dorado)
// que no lo cumple se confunde con la cuadrícula. El comentario de globals.css lo promete; esta prueba impide que deje de ser cierto
// cuando alguien afine la paleta.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

// Cuerpo de un bloque de variables (`:root { ... }` o `.dark { ... }`); no tienen llaves anidadas.
function bloque(selector) {
    const inicio = css.indexOf(`\n${selector} {`);
    expect(inicio, `bloque ${selector} en globals.css`).toBeGreaterThanOrEqual(0);
    return css.slice(inicio, css.indexOf('}', inicio));
}

function variables(cuerpo) {
    const mapa = {};
    for (const [, nombre, valor] of cuerpo.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) mapa[nombre] = valor.toLowerCase();
    return mapa;
}

function luminancia(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
    const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
    return (claro + 0.05) / (oscuro + 0.05);
}

describe.each([['tema claro', ':root'], ['tema oscuro', '.dark']])('colores de gráfica (%s)', (_, selector) => {
    const vars = variables(bloque(selector));
    const tarjeta = vars['--card'];
    const colores = Object.entries(vars).filter(([nombre]) => nombre.startsWith('--g-'));

    it('define los ocho colores de gráfica y la tarjeta contra la que se miden', () => {
        expect(tarjeta).toMatch(/^#[0-9a-f]{6}$/);
        expect(colores.map(([nombre]) => nombre).sort()).toEqual([
            '--g-ausente', '--g-azul', '--g-dorado', '--g-justificado', '--g-pendiente', '--g-presente', '--g-retardo', '--g-violeta',
        ]);
    });

    it.each(colores)('%s cumple 3:1 contra la tarjeta', (_nombre, hex) => {
        expect(contraste(hex, tarjeta)).toBeGreaterThanOrEqual(3);
    });
});
