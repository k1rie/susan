// png.mjs - decodificador minimo de PNG (8 bits, RGB/RGBA/gris, sin entrelazado) a gris de 8 bits.
// Basta para las capturas de Chrome; evita depender de sharp/pngjs. API: pngAGris(buffer) -> { ancho, alto, gris: Uint8Array }
import { inflateSync } from 'node:zlib';

export function pngAGris(buf) {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('No es un PNG');
    let pos = 8;
    let ancho = 0, alto = 0, profundidad = 0, tipoColor = 0, entrelazado = 0;
    const trozos = [];
    while (pos < buf.length) {
        const largo = buf.readUInt32BE(pos);
        const tipo = buf.toString('ascii', pos + 4, pos + 8);
        const datos = buf.subarray(pos + 8, pos + 8 + largo);
        if (tipo === 'IHDR') {
            ancho = datos.readUInt32BE(0);
            alto = datos.readUInt32BE(4);
            profundidad = datos[8];
            tipoColor = datos[9];
            entrelazado = datos[12];
        } else if (tipo === 'IDAT') trozos.push(datos);
        else if (tipo === 'IEND') break;
        pos += 12 + largo;
    }
    if (profundidad !== 8 || entrelazado !== 0) throw new Error(`PNG no soportado (profundidad ${profundidad}, entrelazado ${entrelazado})`);
    const canales = { 0: 1, 2: 3, 4: 2, 6: 4 }[tipoColor];
    if (!canales) throw new Error(`Tipo de color PNG no soportado: ${tipoColor}`);
    const raw = inflateSync(Buffer.concat(trozos));
    const fila = ancho * canales;
    const px = Buffer.alloc(alto * fila);
    for (let y = 0; y < alto; y++) {
        const filtro = raw[y * (fila + 1)];
        const src = y * (fila + 1) + 1;
        const dst = y * fila;
        for (let x = 0; x < fila; x++) {
            const a = x >= canales ? px[dst + x - canales] : 0;
            const b = y > 0 ? px[dst - fila + x] : 0;
            const c = x >= canales && y > 0 ? px[dst - fila + x - canales] : 0;
            let v = raw[src + x];
            if (filtro === 1) v += a;
            else if (filtro === 2) v += b;
            else if (filtro === 3) v += (a + b) >> 1;
            else if (filtro === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            }
            px[dst + x] = v & 255;
        }
    }
    const gris = new Uint8Array(ancho * alto);
    for (let i = 0; i < ancho * alto; i++) {
        const o = i * canales;
        gris[i] = canales >= 3 ? Math.round(0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2]) : px[o];
    }
    return { ancho, alto, gris };
}
