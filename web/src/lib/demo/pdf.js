// PDF mínimo de una página para los documentos de la demostración (consentimientos y justificantes).
//
// La semilla de la base de datos solo trae RUTAS ficticias al bucket: el objeto no existe y "Ver documento" fallaría.
// El script de la demostración escribe con esto un PDF real y diminuto en cada ruta, sin dependencias. Sin importaciones
// a propósito (lo carga el script de Node como módulo suelto).

const ANCHO_PAGINA = 595; // A4 en puntos
const ALTO_PAGINA = 842;

/** Cadena apta para un literal de PDF: escapa ( ) \ y pasa lo que no es ASCII a octal (WinAnsi = Latin-1 en 0xA0..0xFF). */
export function literalPdf(texto) {
    let salida = '';
    for (const caracter of String(texto ?? '')) {
        const c = caracter.codePointAt(0);
        if (caracter === '(' || caracter === ')' || caracter === '\\') salida += `\\${caracter}`;
        else if (c >= 0x20 && c <= 0x7e) salida += caracter;
        else if (c >= 0xa0 && c <= 0xff) salida += `\\${c.toString(8).padStart(3, '0')}`;
        else salida += '?'; // fuera de Latin-1 (emojis, etc.): no se intenta dibujar
    }
    return salida;
}

/**
 * Genera un PDF de una página con un título y renglones de texto (Helvetica).
 * @param {{ titulo: string, lineas?: string[] }} contenido
 * @returns {Uint8Array} bytes del PDF; empieza con '%PDF-' (la firma que valida el servidor al subir)
 */
export function pdfMinimo({ titulo, lineas = [] }) {
    const renglones = [`0 -26 Td /F1 12 Tf`];
    for (const linea of lineas) renglones.push(`(${literalPdf(linea)}) Tj 0 -18 Td`);
    const flujo = [
        'BT',
        '/F1 18 Tf',
        `56 ${ALTO_PAGINA - 80} Td`,
        `(${literalPdf(titulo)}) Tj`,
        ...renglones,
        'ET',
    ].join('\n');

    const objetos = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO_PAGINA} ${ALTO_PAGINA}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
        `<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    ];

    let documento = '%PDF-1.4\n';
    const posiciones = [];
    objetos.forEach((cuerpo, i) => {
        posiciones.push(documento.length); // todo es ASCII: longitud de la cadena = desplazamiento en bytes
        documento += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
    });
    const inicioXref = documento.length;
    documento += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    for (const p of posiciones) documento += `${String(p).padStart(10, '0')} 00000 n \n`;
    documento += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

    return Uint8Array.from(documento, (c) => c.charCodeAt(0));
}
