// Generador de reportes UNACH (formato "Primer avance SICAL") sobre docx-js.
//
// Todas las medidas salen de la medición del PDF del SICAL (ver lib/README.md, sección
// "Constantes medidas"). Unidades: dxa/twips (1 pt = 20), medios puntos para fuentes,
// octavos de punto para bordes, EMU para imágenes.
//
// Contrato: los ayudantes (portada, titulo1, parrafo, tabla, ...) devuelven BLOQUES; el reporte
// es un arreglo (anidable) de bloques que se entrega a crearDocumento(). Un bloque se convierte en
// elementos docx recién al construir el documento, porque la numeración (secciones, figuras,
// listas) y el índice dependen del orden final.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsearMarcado, textoPlano } from './marcado.mjs';

const require = createRequire(import.meta.url);
const docx = require('docx');
const {
    AlignmentType, BorderStyle, BookmarkEnd, BookmarkStart, Document, Footer, Header, HorizontalPositionAlign,
    HorizontalPositionRelativeFrom, ImageRun, InternalHyperlink, LeaderType, LevelFormat,
    LineRuleType, Packer, PageNumber, Paragraph, SectionType, ShadingType, Tab, TabStopType,
    Table, TableCell, TableLayoutType, TableRow, TextRun, TextWrappingType, VerticalAlign,
    VerticalPositionRelativeFrom, WidthType,
} = docx;

export { Packer, docx, parsearMarcado, textoPlano };

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RUTA_ASSETS = path.resolve(AQUI, '..', 'assets');

// ---------------------------------------------------------------------------------------------
// Constantes medidas (E). Cambiar aquí cambia todo el reporte.
// ---------------------------------------------------------------------------------------------
export const E = {
    pagina: { ancho: 12240, alto: 15840 }, // Carta
    margen: { arriba: 1800, abajo: 1512, izq: 1656, der: 1656, encabezado: 432, pie: 946 },
    anchoTexto: 8928, // 12240 - 2 * 1656 = 446,4 pt = 6,2 in
    fuente: 'Arial', // LibreOffice la reemplaza por Liberation Sans (métricas idénticas)
    mono: 'Courier New', // LibreOffice -> Liberation Mono
    color: {
        marino: '1F3864', // encabezado de tablas, etiqueta de código, barra del código
        cebra: 'DAE3F3', // filas pares de tablas
        bordeTabla: '8EA9DB',
        codigoFondo: 'F2F2F2',
        codigoBorde: 'D0D0D0',
        figuraBorde: 'D9D9D9',
        negro: '000000',
        blanco: 'FFFFFF',
    },
    // Tamaños en medios puntos.
    tam: {
        cuerpo: 22, // 11 pt
        h1: 23, // 11,5 pt
        h2: 22,
        tituloPagina: 26, // 13 pt
        subtituloPagina: 21, // 10,5 pt
        indiceTitulo: 30, // 15 pt
        indice1: 20, // 10 pt
        indice2: 19, // 9,5 pt
        celda: 19, // 9,5 pt
        celdaCodigo: 17, // 8,5 pt (código en línea dentro de tablas)
        cuerpoCodigo: 19, // 9,5 pt (código en línea dentro de párrafos)
        codigoBloque: 17, // 8,5 pt con escala 98 % = 8,3 pt efectivos (medido)
        nota: 20, // 10 pt
        encabezado: 18, // 9 pt
        pie: 17, // 8,5 pt
        portada: 22,
    },
    codigoEscala: 98,
    // Espaciados en twips. linea 288 = 1,2 (proporcional); 'exacta' = alto fijo.
    esp: {
        cuerpo: { before: 0, after: 180, line: 288 },
        h1: { before: 331, after: 180, line: 240 },
        h2: { before: 252, after: 140, line: 240 },
        trasTabla: { cuerpo: 270, titulo: 280 }, // hueco tras una tabla (medido)
        trasCodigo: { cuerpo: 270, titulo: 280 },
        antesTabla: 22,
        h2TrasH1: { before: 274 }, // dos títulos seguidos (medido en el SICAL: un poco más de aire)
        subtitulo: { before: 240, after: 140, line: 240 },
        lista: { after: 80, ultimo: 180, line: 288 },
        celda: { exacta: 247 },
        celdaEncabezado: { exacta: 213 },
        codigo: { exacta: 276 },
        codigoEtiqueta: { before: 224, after: 100, line: 240 },
        figEtiqueta: { before: 0, after: 80, line: 288 },
        figTitulo: { before: 0, after: 92, line: 288 },
        figImagen: { before: 0, afterConNota: 176, afterSinNota: 240, line: 240 },
        nota: { before: 0, after: 240, line: 288 },
        referencia: { before: 0, after: 200, line: 288 },
        indiceTitulo: { before: 0, after: 250, line: 240 },
        indice1: { before: 170, after: 78, line: 240 },
        indice2: { before: 0, after: 78, line: 240 },
        tituloPagina: { before: 0, after: 112, line: 240 },
        subtituloPagina: { before: 0, after: 392, line: 240 },
        encabezado: { before: 360 },
        pie: { after: 160 },
        portada: { exacta: 415, entreGrupos: 240, primero: 1034 },
    },
    sangria: {
        lista: { left: 440, hanging: 140 }, // viñeta a 15 pt, texto a 22 pt
        numerada: { left: 440, hanging: 240 }, // número a 10 pt, texto a 22 pt
        referencia: { left: 720, hanging: 720 }, // APA 7: sangría francesa de 0,5 in
        indice2: 320,
        codigo: { left: 275, right: 215 }, // 3,75 de barra + 10 de espacio; 0,75 + 10
        pie: 1026,
    },
    celda: { izq: 144, der: 156, arriba: 100, abajo: 100, arribaEnc: 120, abajoEnc: 120 },
    codigoBorde: { barra: 30, lado: 6, espacioIzq: 10, espacioSup: 8, espacioDer: 10, espacioInf: 8 },
    figura: { anchoMaxCm: 15.75, altoMaxCm: 17 },
    portada: {
        margen: { arriba: 1440, abajo: 720, izq: 1720, der: 210 }, // centro del texto = 343,75 pt
        primeraLineaY: 130.3,
    },
    encabezadoImg: { altoPt: 68.4, anchoJaguarPt: 67.7, topPt: 21.6 },
    tabPie: 4274,
};

const PX = 96 / 72; // px por pt (docx-js mide imágenes en px a 96 dpi)
const CM_A_PX = 96 / 2.54;

// ---------------------------------------------------------------------------------------------
// Bloques
// ---------------------------------------------------------------------------------------------
class Bloque {
    constructor(tipo, datos = {}) {
        this.tipo = tipo;
        Object.assign(this, datos);
    }
    preparar() {}
    construir() {
        return [];
    }
}

function aplanar(items, salida = []) {
    for (const it of items) {
        if (it === null || it === undefined || it === false) continue;
        if (Array.isArray(it)) aplanar(it, salida);
        else if (it instanceof Bloque) salida.push(it);
        else throw new Error(`Elemento no válido en el contenido (use los ayudantes de estilo.mjs): ${String(it).slice(0, 60)}`);
    }
    return salida;
}

// ---------------------------------------------------------------------------------------------
// Runs a partir de texto con mini-marcado
// ---------------------------------------------------------------------------------------------
/**
 * Convierte texto con mini-marcado (o un arreglo de cadenas/objetos {texto, negrita, cursiva, codigo})
 * en TextRun de docx.
 * @param {string|Array} contenido
 * @param {{size?: number, bold?: boolean, italics?: boolean, color?: string, tamCodigo?: number, underline?: boolean}} base
 */
export function runs(contenido, base = {}) {
    const partes = Array.isArray(contenido) ? contenido : [contenido];
    const salida = [];
    for (const p of partes) {
        const segmentos =
            typeof p === 'string'
                ? parsearMarcado(p)
                : [{ texto: p.texto ?? '', negrita: !!p.negrita, cursiva: !!p.cursiva, codigo: !!p.codigo }];
        for (const s of segmentos) {
            if (s.salto) {
                salida.push(new TextRun({ break: 1 }));
                continue;
            }
            const opts = {
                text: s.codigo ? s.texto.replace(/\n/g, ' ') : s.texto,
                size: base.size ?? E.tam.cuerpo,
                bold: base.bold || s.negrita || undefined,
                italics: base.italics || s.cursiva || undefined,
                color: base.color,
                underline: base.underline ? {} : undefined,
            };
            if (s.codigo) {
                opts.font = E.mono;
                opts.size = base.tamCodigo ?? E.tam.cuerpoCodigo;
            }
            salida.push(new TextRun(opts));
        }
    }
    return salida;
}

const ALINEACION = {
    izq: AlignmentType.LEFT,
    izquierda: AlignmentType.LEFT,
    left: AlignmentType.LEFT,
    centro: AlignmentType.CENTER,
    center: AlignmentType.CENTER,
    der: AlignmentType.RIGHT,
    derecha: AlignmentType.RIGHT,
    right: AlignmentType.RIGHT,
    justificado: AlignmentType.JUSTIFIED,
    justify: AlignmentType.JUSTIFIED,
};

function espaciado({ before = 0, after = 0, line, exacta }) {
    if (exacta !== undefined) {
        return { before, after, line: exacta, lineRule: LineRuleType.EXACT };
    }
    return { before, after, line, lineRule: LineRuleType.AUTO };
}

// Espaciado superior y salto de página del primer párrafo de un bloque. Un salto de página fuerza
// before = 0 (Word lo respetaría tras un salto manual y LibreOffice no; así ambos coinciden). Tras una
// tabla o un bloque de código, el SICAL deja un hueco fijo antes del siguiente texto.
// Si lo que sigue es una tabla, el párrafo previo cede 1,1 pt de su espaciado inferior (medido: la
// tabla del SICAL queda más pegada al texto que un párrafo).
function pos(ctx, propio = 0, clase = 'cuerpo', explicito, despues) {
    const salto = ctx.saltoAntes(explicito);
    let before = propio;
    if (salto) before = 0;
    else if (ctx.previo === 'tabla') before = Math.max(propio, E.esp.trasTabla[clase]);
    else if (ctx.previo === 'codigo') before = Math.max(propio, E.esp.trasCodigo[clase]);
    const spacing = { before };
    if (despues !== undefined && ctx.siguiente === 'tabla') spacing.after = despues - E.esp.antesTabla;
    return { spacing, pageBreakBefore: salto };
}
function finLista(ctx) {
    return ctx.siguiente === 'tabla' ? E.esp.lista.ultimo - E.esp.antesTabla : E.esp.lista.ultimo;
}

// ---------------------------------------------------------------------------------------------
// Tamaño de imagen (PNG / JPEG) sin dependencias
// ---------------------------------------------------------------------------------------------
export function tamanoImagen(buf) {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
        return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20), tipo: 'png' };
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
        let i = 2;
        while (i < buf.length) {
            if (buf[i] !== 0xff) {
                i += 1;
                continue;
            }
            const marca = buf[i + 1];
            if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) {
                return { alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7), tipo: 'jpg' };
            }
            i += 2 + buf.readUInt16BE(i + 2);
        }
    }
    throw new Error('Formato de imagen no reconocido (use PNG o JPEG).');
}

function leerAsset(nombre) {
    return fs.readFileSync(path.join(RUTA_ASSETS, nombre));
}

// ---------------------------------------------------------------------------------------------
// Encabezado y pie
// ---------------------------------------------------------------------------------------------
// docx-js numera todos los dibujos con id = 1 (wp:docPr); Word prefiere ids únicos en el documento.
let contadorDibujos = 0;
function imagen(opciones) {
    const run = new ImageRun(opciones);
    const dibujo = run.root.find((c) => c.rootKey === 'w:drawing');
    const contenedor = dibujo.root[0];
    const docPr = contenedor.root.find((c) => c.rootKey === 'wp:docPr');
    contadorDibujos += 1;
    docPr.root[0].root.id.value = contadorDibujos;
    return run;
}

const pt2emu = (pt) => Math.round(pt * 12700);

/** Encabezado de todas las páginas salvo la portada: escudo, "PÁGINA X DE N", jaguar. */
export function encabezado() {
    const { altoPt, anchoJaguarPt, topPt } = E.encabezadoImg;
    const vertical = { relative: VerticalPositionRelativeFrom.PAGE, offset: pt2emu(topPt) };
    const flotante = (horizontal) => ({
        horizontalPosition: horizontal,
        verticalPosition: vertical,
        allowOverlap: true,
        lockAnchor: true,
        behindDocument: false,
        wrap: { type: TextWrappingType.NONE },
    });
    const escudo = imagen({
        type: 'png',
        data: leerAsset('logo-unach.png'),
        transformation: { width: altoPt * PX, height: altoPt * PX },
        floating: flotante({ relative: HorizontalPositionRelativeFrom.MARGIN, align: HorizontalPositionAlign.LEFT }),
        altText: { name: 'Escudo UNACH', title: 'Escudo UNACH', description: 'Escudo de la Universidad Autónoma de Chiapas' },
    });
    const jaguar = imagen({
        type: 'png',
        data: leerAsset('logo-jaguar.png'),
        transformation: { width: anchoJaguarPt * PX, height: altoPt * PX },
        floating: flotante({ relative: HorizontalPositionRelativeFrom.MARGIN, align: HorizontalPositionAlign.RIGHT }),
        altText: { name: 'Jaguar UNACH', title: 'Jaguar UNACH', description: 'Mascota de la Universidad Autónoma de Chiapas' },
    });
    return new Header({
        children: [
            new Paragraph({
                style: 'EncabezadoPagina',
                alignment: AlignmentType.CENTER,
                children: [
                    escudo,
                    jaguar,
                    new TextRun({
                        children: ['PÁGINA ', PageNumber.CURRENT, ' DE ', PageNumber.TOTAL_PAGES],
                        bold: true,
                        size: E.tam.encabezado,
                    }),
                ],
            }),
        ],
    });
}

/** Pie de todas las páginas salvo la portada, en dos líneas. */
export function pie() {
    return new Footer({
        children: [
            new Paragraph({
                style: 'PiePagina',
                tabStops: [{ type: TabStopType.LEFT, position: E.tabPie }],
                children: [
                    new TextRun({ text: 'Universidad Autónoma de Chiapas', bold: true, size: E.tam.pie }),
                    new TextRun({
                        children: [new Tab(), 'Por La Conciencia De la Necesidad De Servir'],
                        bold: true,
                        italics: true,
                        size: E.tam.pie,
                    }),
                ],
            }),
            new Paragraph({
                style: 'PiePagina',
                spacing: { after: 0 },
                children: [new TextRun({ text: 'Ingeniería en Desarrollo y Tecnologías de Software', bold: true, size: E.tam.pie })],
            }),
        ],
    });
}

// ---------------------------------------------------------------------------------------------
// Portada
// ---------------------------------------------------------------------------------------------
/**
 * Portada: fondo flotante (plantilla del SICAL) + campos como texto real centrado.
 * @param {object} datos
 * @param {string[]} datos.facultad          líneas de "FACULTAD y LICENCIATURA"
 * @param {string[]} datos.materias          nombres de las materias (1 -> "NOMBRE DE LA MATERIA")
 * @param {string[]} datos.actividad         líneas de "NOMBRE DE LA ACTIVIDAD"
 * @param {string[]} datos.integrantes
 * @param {string[]} datos.catedraticos      (1 -> "NOMBRE DEL CATEDRÁTICO")
 * @param {string} datos.semestre            p. ej. '3°'
 * @param {string} datos.grado               p. ej. '“N”'
 * @param {string} datos.fecha               p. ej. 'Octubre 22, 2026. Tuxtla Gutiérrez, Chiapas, México'
 * @param {{unidad?: string[]}} [datos.extra] campos adicionales: [{etiqueta, lineas}] antes de "NOMBRE DE LA MATERIA"
 */
export function portada(datos) {
    return new Bloque('portada', { datos });
}

function construirPortada(datos) {
    const arr = (v) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
    const grupos = [];
    grupos.push({ etiqueta: 'FACULTAD y LICENCIATURA:', lineas: arr(datos.facultad) });
    for (const ex of datos.extra || []) grupos.push({ etiqueta: ex.etiqueta, lineas: arr(ex.lineas) });
    const materias = arr(datos.materias);
    if (materias.length) {
        grupos.push({
            etiqueta: materias.length === 1 ? 'NOMBRE DE LA MATERIA:' : 'NOMBRE DE LAS MATERIAS:',
            lineas: materias,
        });
    }
    grupos.push({ etiqueta: 'NOMBRE DE LA ACTIVIDAD:', lineas: arr(datos.actividad) });
    grupos.push({ etiqueta: 'INTEGRANTES DEL EQUIPO:', lineas: arr(datos.integrantes) });
    const catedraticos = arr(datos.catedraticos);
    if (catedraticos.length) {
        grupos.push({
            etiqueta: catedraticos.length === 1 ? 'NOMBRE DEL CATEDRÁTICO:' : 'NOMBRE DE LOS CATEDRÁTICOS:',
            lineas: catedraticos,
        });
    }
    // "SEMESTRE: 3° | GRADO: “N”" es una sola línea con etiquetas en negrita.
    grupos.push({
        mixta: [
            { texto: 'SEMESTRE:', negrita: true },
            { texto: ` ${datos.semestre ?? ''} ` },
            { texto: '|', negrita: true },
            { texto: ' ' },
            { texto: 'GRADO:', negrita: true },
            { texto: ` ${datos.grado ?? ''}` },
        ],
    });
    grupos.push({ etiqueta: 'FECHA Y LUGAR DE ENTREGA:', lineas: arr(datos.fecha) });

    // Fondo: imagen flotante detrás del texto, anclada a la esquina de la página.
    const fondo = imagen({
        type: 'png',
        data: leerAsset('portada-fondo.png'),
        transformation: { width: (E.pagina.ancho / 20) * PX, height: (E.pagina.alto / 20) * PX },
        floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
            verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
            behindDocument: true,
            allowOverlap: true,
            lockAnchor: true,
            wrap: { type: TextWrappingType.NONE },
        },
        altText: { name: 'Fondo de portada', title: 'Fondo de portada', description: 'Plantilla de portada UNACH' },
    });

    const parrafos = [];
    let primero = true;
    for (const g of grupos) {
        const lineas = g.mixta ? [g.mixta] : [g.etiqueta, ...g.lineas];
        lineas.forEach((l, i) => {
            const esEtiqueta = !g.mixta && i === 0;
            const hijos = [];
            if (primero) hijos.push(fondo);
            if (g.mixta) {
                for (const m of g.mixta) {
                    hijos.push(new TextRun({ text: m.texto, bold: !!m.negrita, size: E.tam.portada }));
                }
            } else {
                hijos.push(...runs(l, { size: E.tam.portada, bold: esEtiqueta }));
            }
            const antesGrupo = i === 0 && !primero ? E.esp.portada.entreGrupos : 0;
            parrafos.push(
                new Paragraph({
                    style: 'Portada',
                    alignment: AlignmentType.CENTER,
                    spacing: espaciado({ before: primero ? E.esp.portada.primero ?? 0 : antesGrupo, after: 0, exacta: E.esp.portada.exacta }),
                    children: hijos,
                }),
            );
            primero = false;
        });
    }
    return parrafos;
}

// ---------------------------------------------------------------------------------------------
// Títulos
// ---------------------------------------------------------------------------------------------
// docx-js (Bookmark) reutiliza el id numérico 1 en todos los marcadores: se arma el par inicio/fin a mano.
let contadorMarcadores = 0;
function marcar(nombre, ...runsMarcados) {
    contadorMarcadores += 1;
    return [new BookmarkStart(nombre, contadorMarcadores), ...runsMarcados, new BookmarkEnd(contadorMarcadores)];
}

// docx-js escribe w:pBdr en el orden top, bottom, left, right; el esquema OOXML exige top, left,
// bottom, right (Word puede rechazar el archivo si no). Se reordena el árbol interno antes de empaquetar.
const ORDEN_PBDR = ['w:top', 'w:left', 'w:bottom', 'w:right', 'w:between', 'w:bar'];
function ordenarBordes(parrafoDocx) {
    const bordes = parrafoDocx.properties.root.find((c) => c.rootKey === 'w:pBdr');
    if (bordes) {
        bordes.root.sort((a, b) => ORDEN_PBDR.indexOf(a.rootKey) - ORDEN_PBDR.indexOf(b.rootKey));
    }
    return parrafoDocx;
}

function conPunto(texto) {
    const t = texto.trim();
    return /[.!?:…]$/.test(t) ? t : `${t}.`;
}

/**
 * Título de nivel 1: MAYÚSCULAS, negrita, termina en punto. Entra al índice.
 * @param {string} texto
 * @param {{saltoAntes?: boolean}} [opc]
 */
export function titulo1(texto, opc = {}) {
    return new Bloque('titulo1', {
        texto: conPunto(textoPlano(texto)).toLocaleUpperCase('es-MX'),
        opc,
        preparar(ctx) {
            ctx.n1 += 1;
            ctx.n2 = 0;
            this.id = ctx.registrarEncabezado({ nivel: 1, texto: this.texto });
        },
        construir(ctx) {
            return [
                new Paragraph({
                    style: 'Heading1',
                    ...pos(ctx, E.esp.h1.before, 'titulo', this.opc.saltoAntes, E.esp.h1.after),
                    children: marcar(this.id, new TextRun({ text: this.texto })),
                }),
            ];
        },
    });
}

/**
 * Título de nivel 2: "N. Título." en negrita; N se reinicia en cada título de nivel 1.
 * @param {string} texto
 * @param {{sinNumero?: boolean, numero?: number, saltoAntes?: boolean}} [opc]  `numero` fuerza el número (útil en excerpts)
 */
export function titulo2(texto, opc = {}) {
    return new Bloque('titulo2', {
        base: conPunto(textoPlano(texto)),
        opc,
        preparar(ctx) {
            if (this.opc.numero) ctx.n2 = this.opc.numero;
            else if (!this.opc.sinNumero) ctx.n2 += 1;
            this.texto = this.opc.sinNumero ? this.base : `${ctx.n2}. ${this.base}`;
            this.id = ctx.registrarEncabezado({ nivel: 2, texto: this.texto });
        },
        construir(ctx) {
            return [
                new Paragraph({
                    style: 'Heading2',
                    ...pos(ctx, ctx.previo === 'titulo1' ? E.esp.h2TrasH1.before : E.esp.h2.before, 'titulo', this.opc.saltoAntes, E.esp.h2.after),
                    children: marcar(this.id, new TextRun({ text: this.texto })),
                }),
            ];
        },
    });
}

/** Etiqueta en negrita sin numerar ni entrar al índice (p. ej. "Supuestos."). */
export function subtitulo(texto) {
    return new Bloque('subtitulo', {
        texto,
        construir(ctx) {
            return [
                new Paragraph({
                    style: 'Subtitulo',
                    ...pos(ctx, E.esp.subtitulo.before, 'titulo', undefined, E.esp.subtitulo.after),
                    children: runs(conPunto(this.texto), { bold: true }),
                }),
            ];
        },
    });
}

/**
 * Título de página sin numerar: 13 pt negrita centrado + subtítulo de 10,5 pt subrayado.
 * (En el SICAL: "PRIMER AVANCE | PROPUESTA DEL SISTEMA." y "Proyecto: ...".)
 */
export function tituloPagina(titulo, subtitulo) {
    return new Bloque('tituloPagina', {
        construir(ctx) {
            const salida = [
                new Paragraph({
                    style: 'TituloPagina',
                    ...pos(ctx, 0, 'titulo'),
                    children: [new TextRun({ text: titulo, bold: true, size: E.tam.tituloPagina })],
                }),
            ];
            if (subtitulo) {
                salida.push(
                    new Paragraph({
                        style: 'SubtituloPagina',
                        children: runs(subtitulo, { size: E.tam.subtituloPagina, underline: true }),
                    }),
                );
            }
            return salida;
        },
    });
}

// ---------------------------------------------------------------------------------------------
// Párrafos, listas, notas, referencias
// ---------------------------------------------------------------------------------------------
/**
 * Párrafo de cuerpo (justificado, 11 pt, interlineado 1,2, 9 pt después).
 * @param {string|Array} contenido  texto con mini-marcado o arreglo de cadenas/objetos
 * @param {{alinear?: string, sangria?: number, antes?: number, despues?: number, mantener?: boolean}} [opc]
 */
export function parrafo(contenido, opc = {}) {
    return new Bloque('parrafo', {
        contenido,
        opc,
        construir(ctx) {
            const p = pos(ctx, opc.antes ?? 0, 'cuerpo', undefined, opc.despues ?? E.esp.cuerpo.after);
            if (opc.despues !== undefined && p.spacing.after === undefined) p.spacing.after = opc.despues;
            return [
                new Paragraph({
                    style: 'Cuerpo',
                    alignment: opc.alinear ? ALINEACION[opc.alinear] : undefined,
                    indent: opc.sangria ? { left: opc.sangria } : undefined,
                    keepNext: opc.mantener || undefined,
                    ...p,
                    children: runs(this.contenido),
                }),
            ];
        },
    });
}

function normalizarItems(items) {
    return items.map((it) => (typeof it === 'string' || Array.isArray(it) ? { texto: it } : it));
}

/**
 * Lista con viñetas. Cada elemento es texto (con marcado) o {texto, sub: [...]} (un nivel anidado).
 */
export function lista(items) {
    return new Bloque('lista', {
        items: normalizarItems(items),
        construir(ctx) {
            const salida = [];
            const total = this.items.length;
            this.items.forEach((it, i) => {
                const ultimoNivel0 = i === total - 1 && !(it.sub && it.sub.length);
                const p = i === 0 ? pos(ctx, 0, 'cuerpo') : { spacing: {} };
                if (ultimoNivel0) p.spacing.after = finLista(ctx);
                salida.push(
                    new Paragraph({
                        style: 'Lista',
                        numbering: { reference: 'vinetas', level: 0 },
                        ...p,
                        children: runs(it.texto),
                    }),
                );
                (it.sub || []).forEach((s, j) => {
                    const ultimo = i === total - 1 && j === it.sub.length - 1;
                    salida.push(
                        new Paragraph({
                            style: 'Lista',
                            numbering: { reference: 'vinetas', level: 1 },
                            spacing: ultimo ? { after: finLista(ctx) } : undefined,
                            children: runs(s),
                        }),
                    );
                });
            });
            return salida;
        },
    });
}

/** Lista numerada (1., 2., ...) que reinicia en cada llamada. */
export function listaNumerada(items) {
    return new Bloque('listaNumerada', {
        items: normalizarItems(items),
        preparar(ctx) {
            ctx.instanciaLista += 1;
            this.instancia = ctx.instanciaLista;
        },
        construir(ctx) {
            const salida = [];
            const total = this.items.length;
            this.items.forEach((it, i) => {
                const ultimoNivel0 = i === total - 1 && !(it.sub && it.sub.length);
                const p = i === 0 ? pos(ctx, 0, 'cuerpo') : { spacing: {} };
                if (ultimoNivel0) p.spacing.after = finLista(ctx);
                salida.push(
                    new Paragraph({
                        style: 'Lista',
                        numbering: { reference: 'numerada', level: 0, instance: this.instancia },
                        ...p,
                        children: runs(it.texto),
                    }),
                );
                (it.sub || []).forEach((s, j) => {
                    const ultimo = i === total - 1 && j === it.sub.length - 1;
                    salida.push(
                        new Paragraph({
                            style: 'Lista',
                            numbering: { reference: 'numerada', level: 1, instance: this.instancia },
                            spacing: ultimo ? { after: finLista(ctx) } : undefined,
                            children: runs(s),
                        }),
                    );
                });
            });
            return salida;
        },
    });
}

function parrafoNota(texto, ctx, extra = {}) {
    return new Paragraph({
        style: 'Nota',
        ...(extra.pos ?? {}),
        keepLines: true,
        children: [
            new TextRun({ text: 'Nota.', bold: true, italics: true, size: E.tam.nota }),
            new TextRun({ text: ' ', size: E.tam.nota }),
            ...runs(texto, { size: E.tam.nota, tamCodigo: E.tam.celdaCodigo }),
        ],
    });
}

/** Nota al pie de una tabla o figura: "Nota." en negrita cursiva + texto, 10 pt. */
export function nota(texto) {
    return new Bloque('nota', {
        texto,
        construir(ctx) {
            return [parrafoNota(this.texto, ctx, { pos: pos(ctx, E.esp.nota.before, 'cuerpo', undefined, E.esp.nota.after) })];
        },
    });
}

/**
 * Entrada de referencias bibliográficas (APA 7): sangría francesa de 0,5 in, alineada a la izquierda.
 * Use *cursiva* para el título de la obra.
 */
export function referencia(texto) {
    return new Bloque('referencia', {
        texto,
        construir(ctx) {
            return [
                new Paragraph({
                    style: 'Referencia',
                    ...pos(ctx, 0, 'cuerpo'),
                    children: runs(this.texto),
                }),
            ];
        },
    });
}

/** Salto de página: el siguiente bloque inicia en página nueva (sin párrafo vacío). */
export function saltoDePagina() {
    return new Bloque('salto', {
        preparar() {},
        construir(ctx) {
            ctx.saltoPendiente = true;
            return [];
        },
    });
}

// ---------------------------------------------------------------------------------------------
// Tablas
// ---------------------------------------------------------------------------------------------
function normalizarAnchos(anchos, n, total) {
    let pesos = anchos && anchos.length === n ? anchos.map(Number) : Array(n).fill(1);
    const suma = pesos.reduce((a, b) => a + b, 0);
    const dxa = pesos.map((p) => Math.floor((p / suma) * total));
    dxa[dxa.length - 1] += total - dxa.reduce((a, b) => a + b, 0);
    return dxa;
}

function parrafosDeCelda(contenido, { encabezado, alinear, mantener }) {
    const texto = Array.isArray(contenido) ? contenido : String(contenido ?? '').split('\n');
    return texto.map(
        (linea) =>
            new Paragraph({
                style: encabezado ? 'CeldaEncabezado' : 'Celda',
                alignment: encabezado ? AlignmentType.CENTER : ALINEACION[alinear] ?? AlignmentType.LEFT,
                keepNext: mantener || undefined,
                children: runs(linea, {
                    size: E.tam.celda,
                    bold: encabezado,
                    color: encabezado ? E.color.blanco : undefined,
                    tamCodigo: E.tam.celdaCodigo,
                }),
            }),
    );
}

const borde = (color) => ({ style: BorderStyle.SINGLE, size: 6, color });

/**
 * Tabla con encabezado marino, filas alternadas en azul claro, bordes finos, encabezado repetido en
 * cada página y filas que no se parten.
 * @param {object} o
 * @param {string[]} o.columnas   títulos de columna (marcado permitido); omitir para tabla sin encabezado
 * @param {Array<Array<string|string[]>>} o.filas   cada celda: texto con marcado ('\n' = otro párrafo)
 * @param {number[]} [o.anchos]   pesos relativos de columna (se normalizan a 8928 dxa)
 * @param {string[]} [o.alinear]  'izq' | 'centro' | 'der' por columna (encabezados siempre centrados)
 * @param {boolean} [o.cebra=true]
 */
export function tabla({ columnas, filas, anchos, alinear = [], cebra = true }) {
    return new Bloque('tabla', {
        construir(ctx) {
            const n = columnas ? columnas.length : filas[0].length;
            const dxa = normalizarAnchos(anchos, n, E.anchoTexto);
            const todas = [];
            if (columnas) {
                todas.push(
                    new TableRow({
                        tableHeader: true,
                        cantSplit: true,
                        children: columnas.map(
                            (c, i) =>
                                new TableCell({
                                    width: { size: dxa[i], type: WidthType.DXA },
                                    verticalAlign: VerticalAlign.CENTER,
                                    shading: { type: ShadingType.CLEAR, fill: E.color.marino, color: 'auto' },
                                    margins: { top: E.celda.arribaEnc, bottom: E.celda.abajoEnc, left: E.celda.izq, right: E.celda.der },
                                    borders: {
                                        top: borde(E.color.marino),
                                        bottom: borde(E.color.marino),
                                        left: borde(E.color.marino),
                                        right: borde(E.color.marino),
                                    },
                                    children: parrafosDeCelda(c, { encabezado: true, mantener: true }),
                                }),
                        ),
                    }),
                );
            }
            filas.forEach((fila, r) => {
                if (fila.length !== n) throw new Error(`Fila ${r + 1} con ${fila.length} celdas; se esperaban ${n}.`);
                const sombreada = cebra && r % 2 === 1;
                todas.push(
                    new TableRow({
                        cantSplit: true,
                        children: fila.map(
                            (c, i) =>
                                new TableCell({
                                    width: { size: dxa[i], type: WidthType.DXA },
                                    verticalAlign: VerticalAlign.TOP,
                                    shading: sombreada
                                        ? { type: ShadingType.CLEAR, fill: E.color.cebra, color: 'auto' }
                                        : undefined,
                                    margins: { top: E.celda.arriba, bottom: E.celda.abajo, left: E.celda.izq, right: E.celda.der },
                                    borders: {
                                        top: borde(E.color.bordeTabla),
                                        bottom: borde(E.color.bordeTabla),
                                        left: borde(E.color.bordeTabla),
                                        right: borde(E.color.bordeTabla),
                                    },
                                    children: parrafosDeCelda(c, { alinear: alinear[i], mantener: columnas && r === 0 }),
                                }),
                        ),
                    }),
                );
            });
            const tbl = new Table({
                width: { size: E.anchoTexto, type: WidthType.DXA },
                columnWidths: dxa,
                layout: TableLayoutType.FIXED,
                indent: { size: 0, type: WidthType.DXA },
                borders: {
                    top: borde(E.color.bordeTabla),
                    bottom: borde(E.color.bordeTabla),
                    left: borde(E.color.bordeTabla),
                    right: borde(E.color.bordeTabla),
                    insideHorizontal: borde(E.color.bordeTabla),
                    insideVertical: borde(E.color.bordeTabla),
                },
                rows: todas,
            });
            if (ctx.saltoPendiente) {
                // Una tabla no admite pageBreakBefore: se usa un párrafo mínimo (1 pt) con el salto.
                ctx.saltoPendiente = false;
                return [
                    new Paragraph({
                        pageBreakBefore: true,
                        spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
                        children: [],
                    }),
                    tbl,
                ];
            }
            return [tbl];
        },
    });
}

// ---------------------------------------------------------------------------------------------
// Código
// ---------------------------------------------------------------------------------------------
/**
 * Bloque de código: etiqueta azul marino en negrita ("Código SQL.") y caja gris con barra marina.
 * Una línea = un párrafo (la caja se parte entre páginas sin problema).
 * @param {{etiqueta?: string, texto: string, tabulador?: number}} o
 */
export function codigo({ etiqueta, texto, tabulador = 4 }) {
    return new Bloque('codigo', {
        construir(ctx) {
            const salida = [];
            if (etiqueta) {
                salida.push(
                    new Paragraph({
                        style: 'CodigoEtiqueta',
                        keepNext: true,
                        ...pos(ctx, E.esp.codigoEtiqueta.before, 'cuerpo'),
                        children: [new TextRun({ text: etiqueta, bold: true, color: E.color.marino, size: E.tam.cuerpo })],
                    }),
                );
            }
            const lineas = String(texto).replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
            const n = lineas.length;
            const cb = E.codigoBorde;
            // La caja se arma con bordes distintos por posición (primera línea: arriba; última: abajo;
            // todas: barra izquierda y lado derecho). Así la caja queda ABIERTA al partirse entre
            // páginas, igual que en el SICAL, en Word y en LibreOffice (con bordes idénticos en todas las
            // líneas, LibreOffice 24 cierra la caja en cada salto de página y gasta 2 x 8,75 pt).
            const lado = (extra) => ({
                left: { style: BorderStyle.SINGLE, size: cb.barra, color: E.color.marino, space: cb.espacioIzq },
                right: { style: BorderStyle.SINGLE, size: cb.lado, color: E.color.codigoBorde, space: cb.espacioDer },
                ...extra,
            });
            const arriba = { style: BorderStyle.SINGLE, size: cb.lado, color: E.color.codigoBorde, space: cb.espacioSup };
            const abajo = { style: BorderStyle.SINGLE, size: cb.lado, color: E.color.codigoBorde, space: cb.espacioInf };
            const bordesDe = (i) => lado({ ...(i === 0 ? { top: arriba } : {}), ...(i === n - 1 ? { bottom: abajo } : {}) });
            lineas.forEach((linea, i) => {
                // Para que la caja se parta con elegancia: bloques cortos juntos; largos, mínimo 3 líneas por lado.
                const mantener = n <= 6 ? i < n - 1 : i < 2 || (i >= n - 3 && i < n - 1);
                salida.push(
                    ordenarBordes(new Paragraph({
                        style: 'Codigo',
                        border: bordesDe(i),
                        keepNext: mantener || undefined,
                        ...(!etiqueta && i === 0 ? pos(ctx, 0, 'cuerpo') : {}),
                        children: [
                            new TextRun({
                                text: linea.replace(/\t/g, ' '.repeat(tabulador)),
                                font: E.mono,
                                size: E.tam.codigoBloque,
                                scale: E.codigoEscala,
                            }),
                        ],
                    })),
                );
            });
            return salida;
        },
    });
}

// ---------------------------------------------------------------------------------------------
// Figuras (APA 7)
// ---------------------------------------------------------------------------------------------
/**
 * Figura en estilo APA 7 tal como el SICAL: "Figura N." (negrita), título en cursiva en la línea
 * siguiente, imagen centrada con marco gris y "Nota." (negrita cursiva) + texto.
 * @param {{archivo: string, numero?: number, titulo: string, nota?: string, anchoCm?: number, alt?: string}} o
 */
export function figura({ archivo, numero, titulo, nota: notaTexto, anchoCm, alt }) {
    return new Bloque('figura', {
        preparar(ctx) {
            ctx.fig = numero ?? ctx.fig + 1;
            this.numero = ctx.fig;
        },
        construir(ctx) {
            const data = fs.readFileSync(archivo);
            const { ancho, alto, tipo } = tamanoImagen(data);
            let wCm = anchoCm ?? E.figura.anchoMaxCm;
            let hCm = (wCm * alto) / ancho;
            if (hCm > E.figura.altoMaxCm) {
                hCm = E.figura.altoMaxCm;
                wCm = (hCm * ancho) / alto;
            }
            // El marco (borde de párrafo de 0,75 pt) queda dentro del margen: se descuenta de la imagen
            // máxima para que no sobresalga del texto.
            const wPx = Math.min(wCm * CM_A_PX, ((E.anchoTexto - 30) / 20) * PX);
            const hPx = (wPx * alto) / ancho;
            const bordeFig = { style: BorderStyle.SINGLE, size: 6, color: E.color.figuraBorde, space: 0 };
            const conNota = !!notaTexto;
            const salida = [
                new Paragraph({
                    style: 'FiguraEtiqueta',
                    keepNext: true,
                    ...pos(ctx, 0, 'cuerpo'),
                    children: [new TextRun({ text: `Figura ${this.numero}.`, bold: true, size: E.tam.cuerpo })],
                }),
                new Paragraph({
                    style: 'FiguraTitulo',
                    keepNext: true,
                    children: runs(titulo, { italics: true }),
                }),
                ordenarBordes(new Paragraph({
                    style: 'FiguraImagen',
                    alignment: AlignmentType.CENTER,
                    keepNext: conNota || undefined,
                    spacing: { after: conNota ? E.esp.figImagen.afterConNota : E.esp.figImagen.afterSinNota },
                    indent: { left: 15, right: 15 },
                    border: { top: bordeFig, bottom: bordeFig, left: bordeFig, right: bordeFig },
                    children: [
                        imagen({
                            type: tipo,
                            data,
                            transformation: { width: wPx, height: hPx },
                            altText: {
                                name: `Figura ${this.numero}`,
                                title: textoPlano(titulo),
                                description: alt ?? textoPlano(titulo),
                            },
                        }),
                    ],
                })),
            ];
            if (conNota) salida.push(parrafoNota(notaTexto, ctx));
            return salida;
        },
    });
}

// ---------------------------------------------------------------------------------------------
// Índice
// ---------------------------------------------------------------------------------------------
/**
 * Índice estático: título "ÍNDICE.", entradas con puntos guía y número de página. Si no se pasan
 * `entradas`, se generan con los títulos 1 y 2 del documento, y los números de página salen de
 * `opciones.paginas` de crearDocumento (los calcula paginar-indice.mjs).
 * @param {Array<{nivel: 1|2, texto: string, pagina: number|string}>} [entradas]
 */
export function indice(entradas) {
    return new Bloque('indice', {
        entradas,
        construir(ctx) {
            const lista = this.entradas ?? ctx.encabezados;
            const salida = [
                new Paragraph({
                    style: 'IndiceTitulo',
                    ...pos(ctx, 0, 'titulo'),
                    children: [new TextRun({ text: 'ÍNDICE.', bold: true, size: E.tam.indiceTitulo })],
                }),
            ];
            for (const en of lista) {
                const pagina = en.pagina ?? ctx.paginas[en.id] ?? ctx.marcadorPagina;
                const nivel = en.nivel === 2 ? 2 : 1;
                const tam = nivel === 1 ? E.tam.indice1 : E.tam.indice2;
                const hijos = [];
                const textoEntrada = new TextRun({ text: en.texto, bold: true, size: tam });
                if (en.id) {
                    hijos.push(new InternalHyperlink({ anchor: en.id, children: [textoEntrada] }));
                } else {
                    hijos.push(textoEntrada);
                }
                hijos.push(new TextRun({ children: [new Tab(), String(pagina)], size: tam }));
                salida.push(
                    new Paragraph({
                        style: nivel === 1 ? 'Indice1' : 'Indice2',
                        tabStops: [{ type: TabStopType.RIGHT, position: E.anchoTexto, leader: LeaderType.DOT }],
                        children: hijos,
                    }),
                );
            }
            return salida;
        },
    });
}

// ---------------------------------------------------------------------------------------------
// Estilos y numeración
// ---------------------------------------------------------------------------------------------
function estilos() {
    const base = { font: E.fuente };
    const p = (id, name, opts) => ({ id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true, ...opts });
    return {
        default: {
            document: {
                run: { ...base, size: E.tam.cuerpo, kern: 2, language: { value: 'es-MX' } },
                paragraph: { spacing: espaciado({ before: 0, after: E.esp.cuerpo.after, line: E.esp.cuerpo.line }) },
            },
            // Títulos con los estilos incorporados de Word (panel de navegación y estilos propios del usuario).
            heading1: {
                run: { ...base, size: E.tam.h1, bold: true, color: E.color.negro },
                paragraph: { keepNext: true, keepLines: true, outlineLevel: 0, spacing: espaciado(E.esp.h1) },
            },
            heading2: {
                run: { ...base, size: E.tam.h2, bold: true, color: E.color.negro },
                paragraph: { keepNext: true, keepLines: true, outlineLevel: 1, spacing: espaciado(E.esp.h2) },
            },
        },
        paragraphStyles: [
            p('Cuerpo', 'Cuerpo', { paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: espaciado(E.esp.cuerpo) } }),
            p('Subtitulo', 'Subtítulo', {
                run: { ...base, size: E.tam.cuerpo, bold: true },
                paragraph: { keepNext: true, spacing: espaciado(E.esp.subtitulo) },
            }),
            p('TituloPagina', 'Título de página', {
                paragraph: { alignment: AlignmentType.CENTER, keepNext: true, spacing: espaciado(E.esp.tituloPagina) },
            }),
            p('SubtituloPagina', 'Subtítulo de página', {
                paragraph: { alignment: AlignmentType.CENTER, spacing: espaciado(E.esp.subtituloPagina) },
            }),
            p('Lista', 'Lista', {
                paragraph: {
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: espaciado({ before: 0, after: E.esp.lista.after, line: E.esp.lista.line }),
                },
            }),
            p('Celda', 'Celda de tabla', {
                run: { ...base, size: E.tam.celda },
                paragraph: { spacing: espaciado({ before: 0, after: 0, exacta: E.esp.celda.exacta }) },
            }),
            p('CeldaEncabezado', 'Encabezado de tabla', {
                run: { ...base, size: E.tam.celda, bold: true, color: E.color.blanco },
                paragraph: {
                    alignment: AlignmentType.CENTER,
                    spacing: espaciado({ before: 0, after: 0, exacta: E.esp.celdaEncabezado.exacta }),
                },
            }),
            p('Codigo', 'Código', {
                run: { font: E.mono, size: E.tam.codigoBloque },
                paragraph: {
                    shading: { type: ShadingType.CLEAR, fill: E.color.codigoFondo, color: 'auto' },
                    indent: { left: E.sangria.codigo.left, right: E.sangria.codigo.right },
                    widowControl: false,
                    spacing: espaciado({ before: 0, after: 0, exacta: E.esp.codigo.exacta }),
                },
            }),
            p('CodigoEtiqueta', 'Etiqueta de código', {
                run: { ...base, size: E.tam.cuerpo, bold: true, color: E.color.marino },
                paragraph: { keepNext: true, spacing: espaciado(E.esp.codigoEtiqueta) },
            }),
            p('FiguraEtiqueta', 'Figura (número)', {
                run: { ...base, size: E.tam.cuerpo, bold: true },
                paragraph: { keepNext: true, spacing: espaciado(E.esp.figEtiqueta) },
            }),
            p('FiguraTitulo', 'Figura (título)', {
                run: { ...base, size: E.tam.cuerpo, italics: true },
                paragraph: { keepNext: true, spacing: espaciado(E.esp.figTitulo) },
            }),
            p('FiguraImagen', 'Figura (imagen)', {
                paragraph: { alignment: AlignmentType.CENTER, spacing: espaciado({ before: E.esp.figImagen.before, after: 0, line: E.esp.figImagen.line }) },
            }),
            p('Nota', 'Nota', {
                run: { ...base, size: E.tam.nota },
                paragraph: { alignment: AlignmentType.LEFT, spacing: espaciado(E.esp.nota) },
            }),
            p('Referencia', 'Referencia APA', {
                paragraph: {
                    alignment: AlignmentType.LEFT,
                    indent: E.sangria.referencia,
                    spacing: espaciado(E.esp.referencia),
                },
            }),
            p('IndiceTitulo', 'Título del índice', {
                paragraph: { alignment: AlignmentType.CENTER, spacing: espaciado(E.esp.indiceTitulo) },
            }),
            p('Indice1', 'Índice 1', { paragraph: { spacing: espaciado(E.esp.indice1) } }),
            p('Indice2', 'Índice 2', {
                paragraph: { indent: { left: E.sangria.indice2 }, spacing: espaciado(E.esp.indice2) },
            }),
            p('EncabezadoPagina', 'Encabezado de página', {
                run: { ...base, size: E.tam.encabezado, bold: true },
                paragraph: { alignment: AlignmentType.CENTER, spacing: espaciado({ before: E.esp.encabezado.before, after: 0, line: 240 }) },
            }),
            p('PiePagina', 'Pie de página', {
                run: { ...base, size: E.tam.pie, bold: true },
                paragraph: {
                    indent: { left: E.sangria.pie },
                    spacing: espaciado({ before: 0, after: E.esp.pie.after, line: 240 }),
                },
            }),
            p('Portada', 'Portada', {
                run: { ...base, size: E.tam.portada },
                paragraph: { alignment: AlignmentType.CENTER, spacing: espaciado({ before: 0, after: 0, exacta: E.esp.portada.exacta }) },
            }),
        ],
    };
}

function numeracion() {
    const vineta = (nivel, texto, left, hanging = E.sangria.lista.hanging) => ({
        level: nivel,
        format: LevelFormat.BULLET,
        text: texto,
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left, hanging } } },
    });
    const num = (nivel, formato, texto, left, hanging) => ({
        level: nivel,
        format: formato,
        text: texto,
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left, hanging } } },
    });
    return {
        config: [
            {
                reference: 'vinetas',
                levels: [vineta(0, '•', E.sangria.lista.left), vineta(1, '–', E.sangria.lista.left + 360, 220)],
            },
            {
                reference: 'numerada',
                levels: [
                    num(0, LevelFormat.DECIMAL, '%1.', E.sangria.numerada.left, E.sangria.numerada.hanging),
                    num(1, LevelFormat.LOWER_LETTER, '%2)', E.sangria.numerada.left + 360, E.sangria.numerada.hanging),
                ],
            },
        ],
    };
}

// ---------------------------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------------------------
/**
 * Arma el documento. `contenido` es un arreglo (anidable) de bloques. Si el primero es una
 * portada(), va en su propia sección sin encabezado ni pie; el resto lleva encabezado y pie, y el
 * conteo "PÁGINA X DE N" incluye la portada como página 1.
 *
 * @param {Array} contenido
 * @param {object} [opciones]
 * @param {Object<string, number>} [opciones.paginas] números de página del índice por id de título (h0, h1, ...)
 * @param {string} [opciones.titulo] metadato de título
 * @param {string} [opciones.autor]  metadato de autor
 * @param {string} [opciones.descripcion]
 * @param {string|number} [opciones.marcadorPagina='0'] texto del número mientras no se conoce
 * @returns {Document} con la propiedad `encabezados` (id, nivel, texto) para paginar-indice.mjs
 */
export function crearDocumento(contenido, opciones = {}) {
    const bloques = aplanar(Array.isArray(contenido) ? contenido : [contenido]);
    const encabezados = [];
    const ctx = {
        n1: 0,
        n2: 0,
        fig: 0,
        instanciaLista: 0,
        saltoPendiente: false,
        encabezados,
        paginas: opciones.paginas ?? {},
        marcadorPagina: opciones.marcadorPagina ?? '0',
        registrarEncabezado({ nivel, texto }) {
            const id = `_enc${encabezados.length}`;
            encabezados.push({ id, nivel, texto });
            return id;
        },
        // Devuelve true una sola vez cuando hay un salto pendiente o se pidió explícitamente.
        saltoAntes(explicito) {
            if (explicito || this.saltoPendiente) {
                this.saltoPendiente = false;
                return true;
            }
            return undefined;
        },
    };

    for (const b of bloques) b.preparar(ctx);

    const secciones = [];
    let resto = bloques;
    if (bloques[0] && bloques[0].tipo === 'portada') {
        secciones.push({
            properties: {
                page: {
                    size: { width: E.pagina.ancho, height: E.pagina.alto },
                    margin: {
                        top: E.portada.margen.arriba,
                        bottom: E.portada.margen.abajo,
                        left: E.portada.margen.izq,
                        right: E.portada.margen.der,
                        header: 0,
                        footer: 0,
                    },
                },
            },
            children: construirPortada(bloques[0].datos),
        });
        resto = bloques.slice(1);
    }

    const hijos = [];
    resto.forEach((b, i) => {
        ctx.siguiente = resto[i + 1]?.tipo;
        hijos.push(...b.construir(ctx));
        ctx.previo = b.tipo;
    });
    if (hijos.length === 0) hijos.push(new Paragraph({ children: [] }));

    secciones.push({
        properties: {
            type: SectionType.NEXT_PAGE,
            page: {
                size: { width: E.pagina.ancho, height: E.pagina.alto },
                margin: {
                    top: E.margen.arriba,
                    bottom: E.margen.abajo,
                    left: E.margen.izq,
                    right: E.margen.der,
                    header: E.margen.encabezado,
                    footer: E.margen.pie,
                },
            },
        },
        headers: { default: encabezado() },
        footers: { default: pie() },
        children: hijos,
    });

    const doc = new Document({
        creator: opciones.autor ?? 'Equipo UNACH',
        title: opciones.titulo ?? 'Reporte de avances',
        description: opciones.descripcion ?? '',
        compatibility: { version: opciones.compat ?? 15 },
        styles: estilos(),
        numbering: numeracion(),
        sections: secciones,
    });
    doc.encabezados = encabezados;
    return doc;
}

/** Escribe el documento en disco y devuelve la ruta. */
export async function guardarDocx(doc, ruta) {
    const buf = await Packer.toBuffer(doc);
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, buf);
    return ruta;
}
