// Solo rutas internas: empiezan con '/', no con '//' y sin '\' ni caracteres de control (evita redirección abierta).
export function rutaSegura(ruta, alternativa = null) {
    if (typeof ruta !== 'string') return alternativa;
    const r = ruta.trim();
    if (!r.startsWith('/') || r.startsWith('//') || r.includes('\\') || /[\u0000-\u001f]/.test(r)) return alternativa;
    return r;
}
