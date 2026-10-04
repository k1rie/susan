// Genera assets/avatars/*.svg con DiceBear "lorelei" (CC0 1.0). Determinista: mismas opciones -> mismos SVG.
// Uso:  cd <dir temporal> && npm i @dicebear/core @dicebear/collection   (NO se instala en el proyecto)
//       node gen-avatars.mjs <dir-temporal-con-node_modules> <dir-salida>
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const tmp = path.resolve(process.argv[2] || '.');
const out = path.resolve(process.argv[3] || './avatars');
const req = createRequire(tmp + '/');
const { createAvatar } = await import(req.resolve('@dicebear/core'));
const { lorelei } = await import(req.resolve('@dicebear/collection'));

// Fondos = los pasteles que ya usan los cuadros (05-camara, 08-reportes) para mantener la paleta.
const BG = { azul: 'cfe0ff', rosa: 'ffd9e8', lila: 'e4d8ff', verde: 'd3efdc', durazno: 'ffe0c4', amarillo: 'f6e7b8', cielo: 'cde8f5', malva: 'f0d9f0' };
// Tonos de piel y cabello pensados para una facultad de Chiapas (predominan los tonos medios), sin colores fantasia.
const SKIN = { a: 'f1c7a0', b: 'e0a97c', c: 'c98b5e', d: 'a86a40', e: 'f6d5b5', f: 'd9a070', g: '8d5a3a', h: 'e8b48a' };
const HAIR = { n: '1d1512', m: '2c1b18', c: '3a2418', k: '4a312c', t: '5a3825', r: '7a4a2a' };
const EYES = ['variant03', 'variant04', 'variant06', 'variant10', 'variant11', 'variant13', 'variant14', 'variant17', 'variant18', 'variant20', 'variant23'];
// Solo sonrisas calmas: se descartan happy07-09/11/12/16-18 (lengua, dientes, mueca) que se leen raras a 64 px.
const MOUTHS = ['happy01', 'happy02', 'happy03', 'happy04', 'happy05', 'happy06', 'happy10', 'happy13', 'happy14', 'happy15'];
const v = (n) => 'variant' + String(n).padStart(2, '0');

// id, iniciales, nombre, bg, piel, cabello, pelo(variant), extras. Las 15 primeras coinciden con los alumnos del video.
const P = [
    ['01', 'XR', 'Ximena Rios', 'azul', 'b', 'm', 31, {}],
    ['02', 'MG', 'Mateo Garcia', 'rosa', 'c', 'n', 3, {}],
    ['03', 'VS', 'Valeria Soto', 'lila', 'a', 'k', 15, {}],
    ['04', 'DH', 'Diego Herrera', 'verde', 'f', 'm', 12, { glasses: 1 }],
    ['05', 'CV', 'Camila Vega', 'durazno', 'e', 'c', 41, {}],
    ['06', 'ET', 'Emiliano Torres', 'amarillo', 'b', 'n', 8, {}],
    ['07', 'RM', 'Regina Mora', 'cielo', 'd', 'n', 26, {}],
    ['08', 'SC', 'Sebastian Cruz', 'malva', 'h', 'k', 1, {}],
    ['09', 'AG', 'Ana Garcia', 'azul', 'c', 'm', 19, {}],
    ['10', 'HM', 'Hector Mendoza', 'rosa', 'b', 't', 22, { beard: 1 }],
    ['11', 'XT', 'Ximena Torres', 'lila', 'f', 'c', 38, {}],
    ['12', 'MH', 'Mateo Hernandez', 'verde', 'g', 'n', 39, {}],
    ['13', 'VN', 'Valeria Nunez', 'durazno', 'a', 'r', 13, {}],
    ['14', 'DR', 'Diego Ramirez', 'amarillo', 'c', 'm', 6, {}],
    ['15', 'CR', 'Camila Reyes', 'cielo', 'h', 'k', 45, { glasses: 3 }],
    ['16', 'PO', 'Patricia Ortega', 'malva', 'e', 't', 23, {}],
    ['17', 'LB', 'Luis Barrios', 'azul', 'd', 'n', 4, {}],
    ['18', 'SG', 'Sofia Gomez', 'rosa', 'f', 'm', 29, {}],
    ['19', 'AL', 'Andres Lopez', 'lila', 'b', 'c', 2, { glasses: 5 }],
    ['20', 'DM', 'Daniela Molina', 'verde', 'h', 'n', 35, {}],
    ['21', 'JP', 'Jorge Pineda', 'durazno', 'g', 'n', 28, {}],
    ['22', 'FA', 'Fernanda Aguilar', 'amarillo', 'c', 'k', 14, {}],
    ['23', 'IC', 'Itzel Castro', 'cielo', 'e', 'm', 24, {}],
    ['24', 'BS', 'Bruno Salas', 'malva', 'f', 't', 20, { glasses: 4 }],
];

fs.mkdirSync(out, { recursive: true });
const manifest = [];
P.forEach(([id, ini, nombre, bg, sk, hc, hair, ex], i) => {
    const o = {
        seed: `susan-${id}`,
        size: 256,
        backgroundColor: [BG[bg]],
        skinColor: [SKIN[sk]],
        hairColor: [HAIR[hc]],
        hair: [v(hair)],
        eyes: [EYES[(i * 5 + 3) % EYES.length]],
        mouth: [MOUTHS[(i * 7 + 1) % MOUTHS.length]],
        eyebrowsColor: ['1d1512'],
        glassesProbability: ex.glasses ? 100 : 0,
        glasses: ex.glasses ? [v(ex.glasses)] : ['variant01'],
        beardProbability: ex.beard ? 100 : 0,
        frecklesProbability: i % 6 === 2 ? 100 : 0,
        earringsProbability: 0,
        hairAccessoriesProbability: 0,
    };
    const svg = createAvatar(lorelei, o).toString();
    const file = `avatar-${id}-${ini.toLowerCase()}.svg`;
    fs.writeFileSync(path.join(out, file), svg);
    manifest.push({ id, iniciales: ini, nombre, archivo: file, fondo: '#' + BG[bg] });
});
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ estilo: 'lorelei', licencia: 'CC0 1.0', paquete: '@dicebear/collection', avatares: manifest }, null, 2) + '\n');
console.log('OK', manifest.length, 'avatares ->', out);
