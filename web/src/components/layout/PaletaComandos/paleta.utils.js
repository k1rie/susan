// Quita acentos y pasa a minúsculas: "Analítica" coincide con "analitica".
export function normalizar(texto) {
    return String(texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

// Comandos de la paleta a partir de la navegación del rol, los módulos activos (aportan la descripción por href)
// y los módulos próximos:  { id, titulo, descripcion?, grupo, href?, accion?, icono, pronto? }
export function construirComandos({ nav = [], activos = [], proximos = [] }) {
    const descripcionDe = new Map(activos.map((m) => [m.href, m.descripcion]));
    return [
        ...nav.map((i) => ({ id: `ir:${i.href}`, titulo: i.label, descripcion: descripcionDe.get(i.href), grupo: 'Ir a', href: i.href, icono: i.icon })),
        { id: 'ir:/modulos', titulo: 'Todos los módulos', descripcion: 'Catálogo completo, incluidos los próximos', grupo: 'Ir a', href: '/modulos' },
        ...proximos.map((m) => ({ id: `pronto:${m.id}`, titulo: m.titulo, descripcion: m.descripcion, grupo: 'Próximamente', href: `/modulos/${m.id}`, icono: m.icono, pronto: true })),
        { id: 'cta:contrasena', titulo: 'Cambiar contraseña', grupo: 'Cuenta', href: '/cambiar-contrasena' },
        { id: 'cta:salir', titulo: 'Salir', grupo: 'Cuenta', accion: 'salir' },
    ];
}

// Todas las palabras de la consulta deben aparecer en título/descripción. Orden: título que empieza con la
// consulta, título que la contiene, resto; estable dentro de cada grupo. Consulta vacía = todos.
export function filtrarComandos(comandos, consulta) {
    const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return comandos;
    const q = normalizar(consulta);
    const puntuados = [];
    comandos.forEach((c, indice) => {
        const titulo = normalizar(c.titulo);
        const completo = `${titulo} ${normalizar(c.descripcion)} ${normalizar(c.grupo)}`;
        if (!palabras.every((p) => completo.includes(p))) return;
        const puntos = titulo.startsWith(q) ? 0 : titulo.includes(q) ? 1 : 2;
        puntuados.push({ c, puntos, indice });
    });
    return puntuados.sort((a, b) => a.puntos - b.puntos || a.indice - b.indice).map((x) => x.c);
}

// Agrupa conservando el orden de aparición: [{ grupo, comandos }].
export function agruparComandos(comandos) {
    const mapa = new Map();
    for (const c of comandos) {
        if (!mapa.has(c.grupo)) mapa.set(c.grupo, []);
        mapa.get(c.grupo).push(c);
    }
    return Array.from(mapa, ([grupo, lista]) => ({ grupo, comandos: lista }));
}
