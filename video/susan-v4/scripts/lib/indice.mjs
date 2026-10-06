// indice.mjs - lectura del index.html ensamblado (assemble-index.mjs + transitions.mjs de la skill) y escritura de los bloques
// generados por los scripts de sonido y voz.
//
// Que se asume del indice (verificado contra assemble-index.mjs y transitions.mjs de product-launch-video):
//   - cada cuadro es <div id="el-<frame_id>" class="scene" data-composition-id="<frame_id>" data-composition-src="..."
//     data-start="..." data-duration="..." data-track-index="..."></div> dentro de #root (atributos en varias lineas);
//   - data-start de cada cuadro = suma de las duraciones anteriores; `transitions inject` solo ALARGA el data-duration del cuadro
//     saliente y no mueve ningun data-start: el instante local 0 de un cuadro es siempre su data-start;
//   - #root lleva data-duration = duracion total y se cierra con </div> antes del <script> del timeline `main`.
// Los bloques generados van dentro de #root, marcados (<!-- sfx:start --> ... <!-- sfx:end -->, <!-- voz:start --> ... <!-- voz:end -->)
// para reemplazarse en cada corrida (idempotente). assemble-index.mjs reescribe el indice COMPLETO: hay que volver a montarlos.

const num = (attrs, nombre) => {
    const m = new RegExp(`\\b${nombre}="([^"]*)"`).exec(attrs);
    return m ? Number(m[1]) : null;
};
const txt = (attrs, nombre) => new RegExp(`\\b${nombre}="([^"]*)"`).exec(attrs)?.[1] ?? null;

export function leerIndice(html) {
    const rootTag = /<div\b[^>]*\bid="root"[^>]*>/.exec(html)?.[0] ?? '';
    const duracion = num(rootTag, 'data-duration');
    const cuadros = [];
    for (const m of html.matchAll(/<div\b([^>]*)>\s*<\/div>/g)) {
        const a = m[1];
        const id = /\bid="el-([A-Za-z0-9_-]+)"/.exec(a)?.[1];
        if (!id || !/data-composition-src=/.test(a)) continue;
        cuadros.push({ id, start: num(a, 'data-start'), duration: num(a, 'data-duration'), track: num(a, 'data-track-index'), src: txt(a, 'data-composition-src') });
    }
    cuadros.sort((a, b) => a.start - b.start);
    const bloque = (n) => new RegExp(`<!-- ${n}:start[^>]*-->([\\s\\S]*?)<!-- ${n}:end -->`).exec(html)?.[1] ?? null;
    const audiosDe = (fragmento, origen) => [...(fragmento ?? '').matchAll(/<audio\b([^>]*)>/g)].map((x) => ({
        id: txt(x[1], 'id'), src: txt(x[1], 'src'), start: num(x[1], 'data-start'), duration: num(x[1], 'data-duration'),
        mediaStart: num(x[1], 'data-media-start') ?? 0, volume: num(x[1], 'data-volume'), volOrig: num(x[1], 'data-vol-orig'),
        track: num(x[1], 'data-track-index'), origen,
    }));
    const bSfx = bloque('sfx'), bVoz = bloque('voz');
    // <audio> fuera de los bloques generados (p. ej. los que monta assemble-index desde audio_meta.json): no deben convivir
    let resto = html;
    for (const n of ['sfx', 'voz']) resto = resto.replace(new RegExp(`<!-- ${n}:start[^>]*-->[\\s\\S]*?<!-- ${n}:end -->`), '');
    return { duracion, cuadros, rootTag, sfx: audiosDe(bSfx, 'sfx'), voz: audiosDe(bVoz, 'voz'), ajenos: audiosDe(resto, 'ajeno'), tieneSfx: bSfx !== null, tieneVoz: bVoz !== null };
}

// Reemplaza el bloque <!-- nombre:start --> ... <!-- nombre:end --> o, si no existe, lo inserta justo antes del cierre de #root
// (despues del bloque `despuesDe` si se pide y existe). `contenido` son las lineas ya sangradas, sin las marcas.
export function escribirBloque(html, nombre, comentario, contenido, { despuesDe = null } = {}) {
    const bloque = `      <!-- ${nombre}:start (${comentario}; NO editar a mano) -->\n${contenido}${contenido ? '\n' : ''}      <!-- ${nombre}:end -->`;
    const re = new RegExp(`[ \\t]*<!-- ${nombre}:start[^>]*-->[\\s\\S]*?<!-- ${nombre}:end -->`);
    if (re.test(html)) return html.replace(re, () => bloque);
    if (despuesDe) {
        const fin = html.indexOf(`<!-- ${despuesDe}:end -->`);
        if (fin >= 0) {
            const corte = fin + `<!-- ${despuesDe}:end -->`.length;
            return `${html.slice(0, corte)}\n${bloque}${html.slice(corte)}`;
        }
    }
    const iRoot = html.search(/<div\b[^>]*\bid="root"/);
    if (iRoot < 0) throw new Error('index.html sin <div id="root">');
    const iScript = html.indexOf('<script', iRoot);
    const iCierre = html.lastIndexOf('</div>', iScript < 0 ? html.length : iScript);
    if (iCierre < iRoot) throw new Error('no se encontro el cierre de #root antes del <script> del timeline main');
    // el cierre de #root suele ir sangrado: el bloque se inserta al inicio de esa linea
    const inicioLinea = html.lastIndexOf('\n', iCierre) + 1;
    return `${html.slice(0, inicioLinea)}${bloque}\n${html.slice(inicioLinea)}`;
}

// Quita un bloque generado (para comparar indices "sin sonido").
export const quitarBloque = (html, nombre) => html.replace(new RegExp(`\\n?[ \\t]*<!-- ${nombre}:start[^>]*-->[\\s\\S]*?<!-- ${nombre}:end -->`), '');
