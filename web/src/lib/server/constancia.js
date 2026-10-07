// Constancia PDF del consentimiento aceptado por el alumno en la app. Solo servidor.
// Se guarda en el bucket como `consentimientos/{id_alumno}/{uuid}.pdf` (igual que el PDF firmado a mano que sube el
// administrador): reproduce el aviso palabra por palabra, la huella SHA-256 de ese texto y los datos de la aceptación.
//
// El PDF es de texto simple (Helvetica estándar, sin fuentes incrustadas ni imágenes) y se escribe a mano: así no se agrega una
// dependencia al proyecto por un documento de una página. Codificación WinAnsi: los acentos y la ñ del español caben; cualquier
// otro carácter se sustituye por «?».
import { createHash } from 'node:crypto';
import { DECLARACION, DEPENDENCIA, INSTITUCION, TITULO_AVISO, VERSION_AVISO, seccionesAviso, textoPlanoAviso } from '@/lib/avisoBiometrico';

const ANCHO = 612; // Carta, en puntos
const ALTO = 792;
const MARGEN = 56;
const INTERLINEADO = 14;
const TAMANO = 10;
// Helvetica ocupa en promedio ~0.5 em por carácter: a 10 pt caben ~96 caracteres en los 500 pt útiles. Se deja margen.
const COLUMNAS = 92;
const LINEAS_POR_PAGINA = Math.floor((ALTO - 2 * MARGEN) / INTERLINEADO);

/** Huella SHA-256 (hex) del texto del aviso que se muestra y se acepta. */
export function huellaAviso(meses = 12) {
    return createHash('sha256').update(textoPlanoAviso(meses).join('\n'), 'utf8').digest('hex');
}

/** Parte un texto en líneas de a lo más `max` caracteres, cortando en espacios. */
export function envolver(texto, max = COLUMNAS) {
    const salida = [];
    for (const parrafo of String(texto).split('\n')) {
        if (parrafo.trim() === '') {
            salida.push('');
            continue;
        }
        let linea = '';
        for (const palabra of parrafo.split(/\s+/)) {
            // Una «palabra» más larga que la línea (una URL, un hash) se parte a la fuerza.
            let resto = palabra;
            while (resto.length > max) {
                if (linea) {
                    salida.push(linea);
                    linea = '';
                }
                salida.push(resto.slice(0, max));
                resto = resto.slice(max);
            }
            if (!linea) linea = resto;
            else if (linea.length + 1 + resto.length <= max) linea += ` ${resto}`;
            else {
                salida.push(linea);
                linea = resto;
            }
        }
        if (linea) salida.push(linea);
    }
    return salida;
}

/** Texto -> bytes WinAnsi dentro de una cadena PDF `( ... )`, con los paréntesis y la barra escapados. */
function cadenaPdf(texto) {
    let salida = '';
    for (const c of String(texto)) {
        const codigo = c.codePointAt(0);
        const ch = codigo >= 0x20 && codigo <= 0xff ? c : '?';
        if (ch === '\\' || ch === '(' || ch === ')') salida += `\\${ch}`;
        else salida += ch;
    }
    return `(${salida})`;
}

/**
 * Arma el PDF a partir de líneas ya envueltas. Cada línea es { texto, negrita? }. Devuelve un Buffer.
 * Los desplazamientos del xref se calculan sobre la cadena latin1 (un carácter = un byte).
 */
function construirPdf(lineas, titulo) {
    const paginas = [];
    for (let i = 0; i < lineas.length; i += LINEAS_POR_PAGINA) paginas.push(lineas.slice(i, i + LINEAS_POR_PAGINA));
    if (paginas.length === 0) paginas.push([]);

    // Objetos: 1 catálogo, 2 páginas, 3 Helvetica, 4 Helvetica-Bold, 5 info; luego, por página, su objeto y su contenido.
    const objetos = [];
    const ref = (n) => `${n} 0 R`;
    const idPagina = (k) => 6 + 2 * k;
    const idContenido = (k) => 7 + 2 * k;

    objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objetos[2] = `<< /Type /Pages /Kids [${paginas.map((_, k) => ref(idPagina(k))).join(' ')}] /Count ${paginas.length} >>`;
    objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objetos[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objetos[5] = `<< /Title ${cadenaPdf(titulo)} /Producer (SUSAN) >>`;

    paginas.forEach((lineasPagina, k) => {
        const partes = ['BT', `${INTERLINEADO} TL`, `${MARGEN} ${ALTO - MARGEN - TAMANO} Td`];
        let negritaActual = null;
        for (const l of lineasPagina) {
            const negrita = Boolean(l.negrita);
            if (negrita !== negritaActual) {
                partes.push(`/${negrita ? 'F2' : 'F1'} ${TAMANO} Tf`);
                negritaActual = negrita;
            }
            partes.push(`${cadenaPdf(l.texto)} Tj`, 'T*');
        }
        partes.push('ET');
        const contenido = partes.join('\n');
        objetos[idPagina(k)] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] `
            + `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${ref(idContenido(k))} >>`;
        objetos[idContenido(k)] = `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`;
    });

    let pdf = '%PDF-1.4\n';
    const posiciones = [];
    for (let n = 1; n < objetos.length; n += 1) {
        posiciones[n] = pdf.length;
        pdf += `${n} 0 obj\n${objetos[n]}\nendobj\n`;
    }
    const inicioXref = pdf.length;
    pdf += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
    for (let n = 1; n < objetos.length; n += 1) pdf += `${String(posiciones[n]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objetos.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
    return Buffer.from(pdf, 'latin1');
}

const formatoFechaHora = (iso, zona) => {
    try {
        return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short', timeZone: zona }).format(new Date(iso));
    } catch {
        return String(iso);
    }
};

/**
 * Constancia de la aceptación del aviso.
 * @param {{ nombre: string, matricula: string, ahora: string, vigenciaHasta: string, meses?: number, ip?: string | null, zona?: string }} d
 *   `ahora` es el instante de negocio (app.now()); `vigenciaHasta` la fecha YYYY-MM-DD que fijará la base de datos.
 * @returns {Buffer}
 */
export function generarConstancia({ nombre, matricula, ahora, vigenciaHasta, meses = 12, ip = null, zona = 'America/Mexico_City' }) {
    const lineas = [];
    const agregar = (texto, negrita = false) => envolver(texto).forEach((t) => lineas.push({ texto: t, negrita }));

    agregar(INSTITUCION.toUpperCase(), true);
    agregar(DEPENDENCIA, true);
    agregar('Constancia de consentimiento para el registro facial (sistema SUSAN)', true);
    agregar('');
    agregar(`Alumno: ${nombre}`);
    agregar(`Matrícula: ${matricula}`);
    agregar(`Aceptado el: ${formatoFechaHora(ahora, zona)}`);
    agregar(`Vigente hasta: ${vigenciaHasta}`);
    agregar(`Versión del aviso: ${VERSION_AVISO}`);
    agregar(`Huella SHA-256 del aviso: ${huellaAviso(meses)}`);
    agregar('Medio: aceptación electrónica con la sesión autenticada de la cuenta institucional del alumno.');
    if (ip) agregar(`Dirección IP de origen: ${ip}`);
    agregar('');
    agregar('TEXTO ACEPTADO', true);
    agregar('');
    agregar(TITULO_AVISO, true);
    for (const s of seccionesAviso(meses)) {
        agregar('');
        agregar(s.titulo, true);
        for (const p of s.parrafos) agregar(p);
    }
    agregar('');
    agregar('DECLARACIÓN DEL ALUMNO', true);
    agregar(DECLARACION);

    return construirPdf(lineas, 'Constancia de consentimiento biometrico');
}
