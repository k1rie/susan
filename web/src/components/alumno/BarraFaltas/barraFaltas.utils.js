// Geometría de la barra: la escala llega hasta 1.5 veces el límite (o el valor si lo supera) para que la
// marca del límite siempre sea visible. Solo presentación; el estado oficial lo dicta la base (superaLimite).
export function calcularBarra(porcentaje, limitePct = 20) {
    const pct = Math.max(0, Number(porcentaje) || 0);
    const limite = Math.max(1, Number(limitePct) || 20);
    const escala = Math.max(limite * 1.5, pct);
    return {
        pct,
        limite,
        relleno: Math.min(100, (pct / escala) * 100),
        marca: (limite / escala) * 100,
    };
}

export function nivelBarra(porcentaje, limitePct, { superaLimite, enLimite } = {}) {
    if (superaLimite) return 'excedido';
    if (enLimite) return 'limite';
    if (superaLimite === undefined && Number(porcentaje) > Number(limitePct)) return 'excedido';
    return 'ok';
}
