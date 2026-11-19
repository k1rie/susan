// Ensambla el reporte de avances de SUSAN a partir de reporte/contenido/*.md con la librería lib/estilo.mjs.
//   node paginar-indice.mjs build-reporte.mjs ../entrega/Reporte_de_avances_SUSAN.docx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    crearDocumento, portada, indice, saltoDePagina, titulo1, titulo2, subtitulo, parrafo, lista, listaNumerada,
    tabla, nota, codigo, figura, referencia,
} from './lib/estilo.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPORTE = path.resolve(AQUI, '..');
const CONTENIDO = path.join(REPORTE, 'contenido');

const atributos = (s) => Object.fromEntries([...s.matchAll(/(\w+)=(?:"([^"]*)"|(\S+))/g)].map((m) => [m[1], m[2] ?? m[3]]));
const celdas = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

function leerArchivo(ruta) {
    const lineas = fs.readFileSync(ruta, 'utf8').split('\n');
    const bloques = [];
    let esReferencias = false;
    let i = 0;
    let anchos = null;
    const tomar = (re) => { const out = []; while (i < lineas.length && re.test(lineas[i])) { out.push(lineas[i].replace(re, '')); i++; } return out; };
    while (i < lineas.length) {
        const l = lineas[i];
        if (!l.trim()) { i++; continue; }
        let m;
        if ((m = l.match(/^<!--\s*anchos:\s*([\d.,\s]+)-->/))) { anchos = m[1].split(',').map(Number); i++; continue; }
        if ((m = l.match(/^## (.+)$/))) {
            esReferencias = /^REFERENCIAS/i.test(m[1]);
            bloques.push(titulo1(m[1])); i++; continue;
        }
        if ((m = l.match(/^### (.+)$/))) {
            const num = m[1].match(/^\d+\.\s+(.*)$/);
            bloques.push(num ? titulo2(num[1]) : subtitulo(m[1].replace(/\.$/, ''))); i++; continue;
        }
        if (l.startsWith(':::salto')) { bloques.push(saltoDePagina()); i++; continue; }
        if (l.startsWith(':::figura')) {
            const a = atributos(l);
            bloques.push(figura({
                archivo: path.isAbsolute(a.archivo) ? a.archivo : path.join(REPORTE, a.archivo),
                titulo: a.titulo, nota: a.nota ? a.nota.replace(/^Nota\.\s*/, '') : undefined,
                anchoCm: a.ancho ? Number(a.ancho) : undefined, alt: a.titulo,
            }));
            i++; continue;
        }
        if (l.startsWith(':::codigo')) {
            const a = atributos(l);
            if (!fs.existsSync(a.archivo)) throw new Error(`:::codigo: no existe ${a.archivo} (${ruta})`);
            let t = fs.readFileSync(a.archivo, 'utf8').replace(/\n$/, '').split('\n');
            if (a.lineas) { const [x, y] = a.lineas.split('-').map(Number); t = t.slice(x - 1, y); }
            bloques.push(codigo({ etiqueta: a.etiqueta, texto: t.join('\n') })); i++; continue;
        }
        if ((m = l.match(/^```(.*)$/))) {
            const info = atributos(m[1]); i++;
            const t = []; while (i < lineas.length && !lineas[i].startsWith('```')) t.push(lineas[i++]); i++;
            bloques.push(codigo({ etiqueta: info.etiqueta, texto: t.join('\n') })); continue;
        }
        if (l.startsWith('|')) {
            const filas = []; while (i < lineas.length && lineas[i].startsWith('|')) filas.push(celdas(lineas[i++]));
            const [cols, , ...datos] = filas;
            bloques.push(tabla({ columnas: cols, filas: datos, anchos: anchos ?? undefined })); anchos = null; continue;
        }
        if (/^- /.test(l)) { bloques.push(lista(tomar(/^- /))); continue; }
        if (/^\d+\.\s/.test(l)) { bloques.push(listaNumerada(tomar(/^\d+\.\s+/))); continue; }
        if (/^Nota\.\s/.test(l)) { bloques.push(nota(l.replace(/^Nota\.\s*/, ''))); i++; continue; }
        // párrafo: líneas contiguas
        const p = []; while (i < lineas.length && lineas[i].trim() && !/^(#|\||:::|```|- |\d+\.\s|<!--)/.test(lineas[i])) p.push(lineas[i++]);
        const txt = p.join(' ');
        bloques.push(esReferencias ? referencia(txt) : parrafo(txt));
    }
    return bloques;
}

export function contenido() {
    const archivos = fs.readdirSync(CONTENIDO).filter((f) => /^\d\d-.*\.md$/.test(f) && !f.startsWith('00-')).sort();
    const cuerpo = [];
    for (const f of archivos) { cuerpo.push(...leerArchivo(path.join(CONTENIDO, f))); }
    return [
        portada({
            facultad: ['Escuela de Tecnologías Digitales Aplicadas, Campus I', '(Ingeniería en Desarrollo y Tecnologías de Software)'],
            materias: ['Sistemas Digitales', 'Programación Avanzada'],
            actividad: ['Reporte de Avances del Proyecto Integrador', 'Sistema Universitario de Seguimiento y Análisis de Asistencia (SUSAN)'],
            integrantes: ['Casanova Pérez Gabriela', 'Escobar Domínguez Josué Gabriel', 'Gómez Delgado Ades Yasir', 'González Guerrero Diego Enrique', 'Peña Morales José Manuel', 'Pérez Hernández Alan Eduardo'],
            catedraticos: ['Dr. Daniel González Scarpulli', 'Dr. Yair González Baldizón'],
            semestre: '3°', grado: '“N”',
            fecha: 'Octubre 30, 2026. Tuxtla Gutiérrez, Chiapas, México',
        }),
        indice(),
        saltoDePagina(),
        ...cuerpo,
    ];
}

export function construir({ paginas = {} } = {}) {
    return crearDocumento(contenido(), {
        paginas,
        titulo: 'Reporte de avances del proyecto integrador SUSAN',
        autor: 'Equipo SUSAN',
        descripcion: 'Reporte de avances: base de datos, estación Arduino y formularios',
    });
}
