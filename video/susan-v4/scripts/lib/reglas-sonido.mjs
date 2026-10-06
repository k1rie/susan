// reglas-sonido.mjs - reglas de densidad y nivel del diseno sonoro de la v4 (SINTESIS regla 22, REFERENCIA 3.2/3.4, REFERENCIA-2 3.10).
// Funciones puras sobre la lista de cues montados ({ id, cuadro, nombre, categoria, t (absoluto, s), ... }): las usan mount-sfx (informe)
// y verify-sfx (criterio de aceptacion), asi los dos dicen lo mismo.
import { CATEGORIAS_FUERTES } from './sfx-lib.mjs';

export const REGLAS = {
    sfxPorSegMax: 2.0,          // ~1-2 SFX/s en total (la v3 tenia 4.0/s)
    eventosPorSeg: [0.8, 1.0],  // ~0.8-1 evento/s de 2-3 capas (objetivo, informativo)
    eventosPorSegMax: 1.4,      // por encima: aviso de sobrecarga
    ventanaCapa: 0.12,          // cues cuyas anclas caen a <= 120 ms forman UN evento (capas apiladas, REFERENCIA 3.2)
    capasMax: 3,                // 2-3 capas por evento...
    capasMaxCostura: 4,         // ...y 3-4 solo en las costuras entre cuadros
    costuraMargen: 0.35,        // un evento a <= 0.35 s de un corte cuenta como costura
    ticksVentana: 1.0,
    ticksMax: 4,                // mas de 4 tick-* en 1 s = "ticks por entero" (prohibido; un tic por columna al asentarse)
    saltoMaxDb: 12,             // saltos de nivel <= 12 dB entre segundos contiguos que suenan
    pisoActivoDbFS: -45,
};

export function agruparEventos(cues, ventana = REGLAS.ventanaCapa) {
    const ord = [...cues].sort((a, b) => a.t - b.t);
    const eventos = [];
    for (const c of ord) {
        const ult = eventos.at(-1);
        if (ult && c.t - ult.t0 <= ventana + 1e-9) { ult.cues.push(c); ult.t1 = c.t; } else eventos.push({ t0: c.t, t1: c.t, cues: [c] });
    }
    return eventos;
}

// Densidad: SFX/s, eventos/s y capas por evento. `cortes` = instantes absolutos de inicio de cada cuadro (salvo el primero).
export function densidad(cues, duracion, cortes = []) {
    const eventos = agruparEventos(cues);
    const enCostura = (e) => cortes.some((c) => e.t0 >= c - REGLAS.costuraMargen && e.t0 <= c + REGLAS.costuraMargen);
    const densos = [];
    for (const e of eventos) {
        const tope = enCostura(e) ? REGLAS.capasMaxCostura : REGLAS.capasMax;
        if (e.cues.length > tope) densos.push({ t: e.t0, capas: e.cues.length, tope, costura: enCostura(e), nombres: e.cues.map((c) => c.nombre) });
    }
    const dur = Math.max(duracion, 1e-6);
    return {
        cues: cues.length, sfxPorSeg: cues.length / dur, eventos: eventos.length, eventosPorSeg: eventos.length / dur,
        capasMax: Math.max(0, ...eventos.map((e) => e.cues.length)), densos,
    };
}

// "Ticks por entero": mas de REGLAS.ticksMax cues tick-* dentro de cualquier ventana de 1 s.
export function ticksPorEntero(cues) {
    const ts = cues.filter((c) => /^tick(-\d)?$/.test(c.nombre)).map((c) => c.t).sort((a, b) => a - b);
    const malos = [];
    for (let i = 0; i < ts.length; i++) {
        const n = ts.filter((t) => t >= ts[i] && t < ts[i] + REGLAS.ticksVentana).length;
        if (n > REGLAS.ticksMax && !malos.some((m) => ts[i] < m.desde + REGLAS.ticksVentana)) malos.push({ desde: ts[i], n });
    }
    return malos;
}

// Sin `whoosh-rev` antes de la voz del cierre (preferencia registrada en la v3): prohibido en el cuadro final y, si hay voz,
// en los 1.5 s previos a la ultima linea.
export function whooshRevAlCierre(cues, cuadroFinal, inicioVozFinal = null) {
    return cues.filter((c) => /^whoosh-rev/.test(c.nombre) && (c.cuadro === cuadroFinal || (inicioVozFinal != null && c.t >= inicioVozFinal - 1.5 && c.t <= inicioVozFinal + 0.2)));
}

// Transitorios fuertes (impact, snap, alert, chime, check) cuyo ancla cae DENTRO de una frase. `ventanas`: [{ id, ini, fin }] absolutas.
export function transitoriosEnVoz(cues, ventanas) {
    const out = [];
    for (const c of cues) {
        if (!CATEGORIAS_FUERTES.has(c.categoria)) continue;
        const v = ventanas.find((w) => c.t > w.ini + 1e-9 && c.t < w.fin - 1e-9);
        if (v) out.push({ cue: c, linea: v.id, ventana: [v.ini, v.fin] });
    }
    return out;
}
