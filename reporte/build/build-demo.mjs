// Documento de demostración: usa TODOS los elementos de lib/estilo.mjs con contenido ficticio.
//
//   node build-demo.mjs                    -> salida/demo.docx (índice con números de salida/demo.paginas.json si existe)
//   node paginar-indice.mjs build-demo.mjs -> docx + PDF con el índice calculado y verificado
//
// Todo el texto de este archivo es de relleno para probar el formato; no describe ningún proyecto real.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    crearDocumento, guardarDocx, portada, indice, saltoDePagina, tituloPagina, titulo1, titulo2, subtitulo,
    parrafo, lista, listaNumerada, tabla, nota, codigo, figura, referencia,
} from './lib/estilo.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const asset = (f) => path.join(AQUI, 'demo-assets', f);

// ---- datos de relleno --------------------------------------------------------------------
const filasLargas = Array.from({ length: 34 }, (_, i) => {
    const n = i + 1;
    const estados = ['Pendiente', 'En curso', 'Terminado'];
    const corta = `Elemento de prueba número ${n}`;
    const larga = `${corta}, con una descripción más extensa que obliga a la celda a ocupar dos o tres líneas y así comprobar que las filas no se parten entre páginas.`;
    return [
        `\`ID-${String(n).padStart(3, '0')}\``,
        n % 3 === 0 ? larga : corta,
        estados[i % 3],
        String((i * 7) % 100),
    ];
});

const sqlCorto = `CREATE TABLE ejemplo (
    id_ejemplo  INT          NOT NULL PRIMARY KEY,
    nombre      VARCHAR(60)  NOT NULL,
    activo      BIT          NOT NULL DEFAULT 1
);

SELECT id_ejemplo, nombre
FROM ejemplo
WHERE activo = 1
ORDER BY nombre;`;

const codigoLargo = (() => {
    const l = [];
    l.push('-- Listado ficticio para probar que una caja de código se parte entre páginas.');
    l.push('-- Cada línea es un párrafo propio; las líneas largas se ajustan sin sangría francesa.');
    l.push('');
    for (let i = 1; i <= 7; i++) {
        l.push(`CREATE TABLE tabla_demo_${i} (`);
        l.push('    id          INT          NOT NULL PRIMARY KEY,');
        l.push(`    etiqueta    VARCHAR(40)  NOT NULL,  -- etiqueta corta de la fila ${i}`);
        l.push('    descripcion VARCHAR(400) NULL,');
        l.push('    creado_en   DATETIME2(0) NOT NULL DEFAULT SYSDATETIME()');
        l.push(');');
        l.push('');
        l.push(`INSERT INTO tabla_demo_${i} (id, etiqueta, descripcion) VALUES (1, 'uno', 'Primera fila de la tabla de demostración número ${i}, con texto largo para comprobar el ajuste de línea');`);
        l.push(`INSERT INTO tabla_demo_${i} (id, etiqueta) VALUES (2, 'dos');`);
        l.push('');
    }
    l.push('SELECT t1.id, t1.etiqueta, t2.etiqueta AS etiqueta_dos');
    l.push('FROM tabla_demo_1 t1');
    l.push('JOIN tabla_demo_2 t2 ON t2.id = t1.id');
    l.push('WHERE t1.id > 0;');
    return l.join('\n');
})();

// ---- contenido ---------------------------------------------------------------------------
export function contenido() {
    return [
        portada({
            facultad: ['Escuela de Tecnologías Digitales Aplicadas, Campus I', '(Ingeniería en Desarrollo y Tecnologías de Software)'],
            materias: ['Materia de ejemplo uno', 'Materia de ejemplo dos'],
            actividad: ['Demostración del generador de reportes', 'Documento de prueba con contenido ficticio'],
            integrantes: [
                'Casanova Pérez Gabriela', 'Escobar Domínguez Josué Gabriel', 'Gómez Delgado Ades Yasir',
                'González Guerrero Diego Enrique', 'Peña Morales José Manuel', 'Pérez Hernández Alan Eduardo',
            ],
            catedraticos: ['Nombre del catedrático uno', 'Nombre del catedrático dos'],
            semestre: '3°',
            grado: '“N”',
            fecha: 'Día de mes de año. Tuxtla Gutiérrez, Chiapas, México',
        }),
        indice(),

        saltoDePagina(),
        tituloPagina('DEMOSTRACIÓN | FORMATO DEL REPORTE.', 'Documento de prueba del generador (contenido ficticio).'),

        titulo1('Párrafos y texto enriquecido'),
        parrafo('Este documento de demostración usa **todos los elementos** del formato: portada, índice, títulos, párrafos justificados, listas, tablas, código, figuras, notas y referencias. El texto es de relleno y no describe ningún proyecto real.'),
        parrafo('El mini-marcado admite **negrita**, *cursiva*, ***negrita con cursiva*** y `identificador_en_codigo` en monoespaciada. También permite escapar los símbolos: un asterisco literal se escribe \\* y una comilla invertida \\`. La justificación reparte el espacio entre palabras para que ambos márgenes queden alineados, como en el documento de referencia.'),
        parrafo('**Pregunta de ejemplo:** ¿cómo se ve un párrafo largo cuando mezcla texto normal, `código_en_línea()` y términos en *cursiva* dentro de una misma oración que ocupa varias líneas del renglón justificado?'),

        titulo2('Listas'),
        parrafo('Una lista con viñetas, con un elemento anidado:'),
        lista([
            'Primer elemento de la lista, con **negrita** en una parte del texto.',
            { texto: 'Segundo elemento, que tiene subelementos:', sub: ['Subelemento uno.', 'Subelemento dos, con `codigo_en_linea`.'] },
            'Tercer elemento, suficientemente largo para ocupar más de una línea y mostrar la sangría francesa de la viñeta cuando el texto continúa en el renglón siguiente.',
        ]),
        parrafo('Una lista numerada que reinicia en cada llamada:'),
        listaNumerada([
            '**Primer paso.** Descripción del primer paso, con una explicación que se extiende por más de una línea para mostrar el alineado del texto.',
            '**Segundo paso.** Descripción del segundo paso.',
            '**Tercer paso.** Descripción del tercer paso.',
        ]),
        parrafo('Otra lista numerada, que vuelve a empezar en 1:'),
        listaNumerada(['Elemento uno.', 'Elemento dos.', 'Elemento tres.']),

        titulo2('Subtítulos sin numerar'),
        subtitulo('Supuestos'),
        lista(['El contenido de esta sección es ficticio.', 'Los subtítulos sin numerar no aparecen en el índice.']),

        titulo1('Tablas'),
        titulo2('Tabla corta con alineación por columna'),
        parrafo('La tabla usa encabezado marino, filas alternadas, bordes finos y código en línea en monoespaciada:'),
        tabla({
            columnas: ['Módulo', 'Descripción', 'Entradas', 'Cantidad'],
            anchos: [22, 40, 22, 16],
            alinear: ['izq', 'izq', 'izq', 'der'],
            filas: [
                ['`modulo_uno`', 'Primer módulo de ejemplo con una descripción que ocupa dos líneas dentro de la celda.', '`entrada[3:0]`', '4'],
                ['`modulo_dos`', 'Segundo módulo de ejemplo.', '`reloj`, `reinicio`', '12'],
                ['`modulo_tres`', 'Tercer módulo de ejemplo.', '`dato[7:0]`', '256'],
                ['`modulo_cuatro`', 'Cuarto módulo; la celda admite **negrita** y *cursiva*.', 'ninguna', '0'],
            ],
        }),
        nota('Elaboración propia. La nota de una tabla usa 10 pt y se coloca debajo de ella.'),

        titulo2('Tabla larga que cruza páginas'),
        parrafo('Esta tabla tiene más filas de las que caben en una página: el encabezado se repite arriba de cada página y ninguna fila se parte.'),
        tabla({
            columnas: ['Identificador', 'Descripción', 'Estado', 'Avance (%)'],
            anchos: [20, 52, 16, 12],
            alinear: ['izq', 'izq', 'centro', 'der'],
            filas: filasLargas,
        }),
        nota('Datos ficticios generados por el programa de demostración.'),

        titulo1('Código'),
        titulo2('Fragmento corto'),
        codigo({ etiqueta: 'Código SQL.', texto: sqlCorto }),
        parrafo('Después de un bloque de código el texto continúa con el espaciado del formato de referencia. `SELECT` y `WHERE` aparecen como código en línea.'),
        titulo2('Fragmento largo que cruza páginas'),
        parrafo('El siguiente listado es largo a propósito: la caja gris con barra marina se parte entre páginas sin cortar el estilo ni dejar líneas sueltas.'),
        codigo({ etiqueta: 'Código Verilog.', texto: codigoLargo }),
        parrafo('Aquí termina el listado largo.'),

        titulo1('Figuras'),
        titulo2('Figura con nota'),
        parrafo('Las figuras siguen el estilo APA 7: número en negrita, título en cursiva en la línea siguiente, imagen centrada con marco gris y nota debajo.'),
        figura({
            archivo: asset('figura-demo-1.png'),
            titulo: 'Diagrama de bloques de demostración.',
            nota: 'Elaboración propia. Diagrama ficticio para probar el formato.',
            alt: 'Tres bloques conectados por flechas: entrada, proceso y salida.',
        }),
        titulo2('Figura más pequeña y sin nota'),
        figura({
            archivo: asset('figura-demo-2.png'),
            titulo: 'Pantalla de demostración con *cursiva* en el título.',
            anchoCm: 11,
            alt: 'Pantalla ficticia con una tabla de tres columnas y un botón Guardar.',
        }),
        parrafo('Texto que sigue a la última figura, para comprobar el espaciado posterior.'),

        titulo1('Referencias bibliográficas'),
        referencia('Apellido, N. (2024). *Título de una obra de ejemplo* (2.ª ed.). Editorial de Ejemplo.'),
        referencia('Organización de Ejemplo. (s. f.). *Documento técnico de ejemplo* [Archivo PDF]. https://ejemplo.org/documentos/documento-tecnico-de-ejemplo.pdf'),
        referencia('Apellido, N., & Otro, M. (2023). Artículo de ejemplo con un título largo que ocupa más de una línea. *Revista de Ejemplo, 12*(3), 45-67. https://doi.org/10.0000/ejemplo'),
    ];
}

/** Contrato de paginar-indice.mjs: construir({paginas}) devuelve el Document. */
export function construir({ paginas = {} } = {}) {
    return crearDocumento(contenido(), {
        paginas,
        titulo: 'Demostración del generador de reportes',
        autor: 'Generador de reportes UNACH',
        descripcion: 'Documento de prueba con contenido ficticio',
    });
}

// ---- ejecución directa -------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const salida = path.join(AQUI, 'salida', 'demo.docx');
    const jsonPaginas = path.join(AQUI, 'salida', 'demo.paginas.json');
    let paginas = {};
    if (fs.existsSync(jsonPaginas)) paginas = JSON.parse(fs.readFileSync(jsonPaginas, 'utf8'));
    await guardarDocx(construir({ paginas }), salida);
    console.log(salida);
    if (!Object.keys(paginas).length) {
        console.log('El índice lleva números provisionales: ejecute  node paginar-indice.mjs build-demo.mjs');
    }
}
