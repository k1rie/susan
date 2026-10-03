import { derivadaSerie } from '../differentiation/diferencias.js';
import { richardson } from '../differentiation/richardson.js';
import { buscarCruce } from '../forecast/cruce.js';
import { proyectarSerie } from '../forecast/proyeccion.js';
import { romberg } from '../integration/romberg.js';
import { simpson13, trapecioDatos } from '../integration/cuadratura.js';
import { rellenarHuecos } from '../interpolation/rellenar.js';
import { ajusteLineal } from '../regression/minimosCuadrados.js';
import { PESOS_RIESGO, diaSemanaISO, evaluarRiesgoGrupo } from '../risk/riesgo.js';
import { cusum, ewmaControl } from '../stats/cambios.js';
import { tablaSuavizado } from '../smoothing/medias.js';
import { agruparSemanas, normalizarSesiones, patronPorDia } from './serieSemanal.js';

const esNum = (v) => typeof v === 'number' && Number.isFinite(v);
const acotar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const MIN_SEMANAS = 4;
const MSJ_INSUFICIENTE = 'Datos insuficientes: se requieren al menos 4 semanas con sesiones cerradas.';

/**
 * @typedef {object} AnalisisGrupo
 * Forma ESTABLE del resultado de {@link analizarGrupo}. Las tasas de `tendencia`, `suavizado` y `proyeccion`
 * son fracciones (0.12 = 12 %); `resumen`, `cruceLimite.acumulado` y `pendientePuntosPorSemana` están en % / puntos.
 * @property {object} resumen         { suficiente, semanasObservadas, semanasConDatos, sesionesCerradas, sesionesProgramadas,
 *   inscritos, tasaActual, tasaPrevia, variacionPP, tasaPromedio, acumuladoActualPct, limitePct, retardosPorAusencia,
 *   sesionesPorSemana, semanasTotales, alumnosEvaluados, alumnosEnRiesgo, alumnosSuperanLimite, areaAusentismo }
 * @property {object} tendencia       { disponible, semanas[], tasas[](null en semanas sin clase), ajuste:{intercepto,pendiente,r2,errorEstandar,n}|null,
 *   pendientePuntosPorSemana|null, direccion:'alza'|'baja'|'estable'|null, puntosAjustados[{semana,valor}], tasaCambio[{semana,puntosPorSemana}] }
 * @property {object} suavizado       { ventana, alfa, semanas[], tasasRellenas[], rellenadas[](semanas), sma[], ema[], wma[] }
 * @property {object} proyeccion      { disponible, horizonte, grado|null, razon|null, modelo|null, candidatos[], ajuste[{semana,valor}],
 *   puntos[{semana,valor,inferior,superior}], mensaje }
 * @property {object} cruceLimite     { estado:'cruza'|'no_cruza'|'superado'|'insuficiente', semana|null, t|null, mensaje, limitePct,
 *   semanasTotales, acumulado:{semanas[],valores[]}, ajuste[{semana,valor}], proyeccion[{semana,valor,inferior,superior}],
 *   grado|null, biseccion|null, newton|null }
 * @property {object} patronSemanal   { dias[{dia,nombre,sesiones,ausentes,tasa,critico}], diaCritico|null, nombreDiaCritico|null }
 * @property {object} cambios         { disponible, semanaCambio|null, semanaDeteccion|null, direccion|null, mensaje, cusum|null, ewma|null }
 * @property {object[]} alumnosEnRiesgo  resultados de evaluarRiesgoAlumno con nivel 'medio' o 'alto', de mayor a menor puntaje
 * @property {{codigo: string, nivel: 'alta'|'media'|'info', mensaje: string}[]} alertas
 * @property {{id: string, titulo: string, pasos?: object[], traza?: object[]}[]} procedimientos  secciones para el panel didáctico
 */

/**
 * Orquesta el análisis numérico de un grupo. Nunca lanza por datos pobres (series cortas, huecos, sin ausencias):
 * degrada con `resumen.suficiente = false` y alertas. Solo lanza TypeError/RangeError por argumentos inválidos
 * (entrada no objeto, límite o retardos no positivos).
 *
 * @param {object} entrada
 * @param {object[]|{sesiones: object[]}} entrada.serie   sesiones de api_serie_grupo (cerradas, por fecha)
 * @param {{fechas: string[], alumnos: {id_alumno?: number, idAlumno?: number, matricula?: string, nombre?: string, estados: (string|null)[]}[]}} [entrada.matriz]
 * @param {number} [entrada.limitePct=20]
 * @param {number} [entrada.sesionesProgramadas]
 * @param {number} [entrada.retardosPorAusencia=3]
 * @param {{retardosPorAusencia?: number, limitePct?: number, sesionesProgramadas?: number}} [entrada.opciones]  alternativa a los campos anteriores
 * @returns {AnalisisGrupo}
 */
export function analizarGrupo(entrada) {
    if (entrada === null || typeof entrada !== 'object' || Array.isArray(entrada)) {
        throw new TypeError('analizarGrupo recibe un objeto { serie, matriz, limitePct, sesionesProgramadas, retardosPorAusencia }.');
    }
    const opc = entrada.opciones ?? {};
    const limitePct = entrada.limitePct ?? opc.limitePct ?? 20;
    const rpa = entrada.retardosPorAusencia ?? opc.retardosPorAusencia ?? 3;
    if (!esNum(limitePct) || limitePct <= 0 || limitePct > 100) {
        throw new RangeError('limitePct debe ser un número en (0, 100].');
    }
    if (!esNum(rpa) || rpa < 1) {
        throw new RangeError('retardosPorAusencia debe ser un número >= 1.');
    }
    const progEntrada = entrada.sesionesProgramadas ?? opc.sesionesProgramadas;
    const progDefinida = esNum(progEntrada) && progEntrada > 0;

    const { sesiones, descartadas } = normalizarSesiones(entrada.serie);
    const prog = progDefinida ? progEntrada : Math.max(sesiones.length, 1);
    const semanas = agruparSemanas(sesiones, { rpa, sesionesProgramadas: prog });
    const W = semanas.length;
    const conDatos = semanas.filter((s) => s.tasa !== null);
    const xs = conDatos.map((s) => s.semana);
    const ys = conDatos.map((s) => s.tasa);
    const suficiente = conDatos.length >= MIN_SEMANAS;
    const spw = W > 0 ? sesiones.length / W : null;
    const semanasTotales = progDefinida && spw ? Math.max(W, Math.ceil(prog / spw - 1e-9)) : W + 4;
    const horizonte = acotar(semanasTotales - W, 1, 16);
    const alertas = [];
    const procedimientos = [];

    // ---- Resumen ----
    const totalIns = sesiones.reduce((s, x) => s + x.inscritos, 0);
    const totalAus = sesiones.reduce((s, x) => s + x.ausentes, 0);
    const totalRet = sesiones.reduce((s, x) => s + x.retardos, 0);
    const tasaActual = ys.length ? ys[ys.length - 1] * 100 : null;
    const tasaPrevia = ys.length > 1 ? ys[ys.length - 2] * 100 : null;

    // ---- Tendencia (regresión lineal de la tasa semanal) ----
    const tendencia = {
        disponible: false, semanas: semanas.map((s) => s.semana), tasas: semanas.map((s) => s.tasa), ajuste: null,
        pendientePuntosPorSemana: null, direccion: null, puntosAjustados: [], tasaCambio: [],
    };
    let ajusteTend = null;
    if (suficiente) {
        ajusteTend = ajusteLineal(xs, ys);
        const pend = ajusteTend.pendiente * 100;
        tendencia.disponible = true;
        tendencia.ajuste = {
            intercepto: ajusteTend.intercepto, pendiente: ajusteTend.pendiente, r2: ajusteTend.r2,
            errorEstandar: ajusteTend.errorEstandar, n: ajusteTend.n,
        };
        tendencia.pendientePuntosPorSemana = pend;
        tendencia.direccion = pend > 0.25 ? 'alza' : (pend < -0.25 ? 'baja' : 'estable');
        tendencia.puntosAjustados = xs.map((x, i) => ({ semana: x, valor: ajusteTend.ajustados[i] }));
        procedimientos.push({ id: 'regresion', titulo: 'Regresión', pasos: ajusteTend.pasos });
    }
    if (conDatos.length >= 2) {
        const d = derivadaSerie(xs, ys);
        tendencia.tasaCambio = xs.map((x, i) => ({ semana: x, puntosPorSemana: d[i] * 100 }));
    }

    // ---- Suavizado (con huecos interiores rellenados por interpolación) ----
    const semanasIdx = semanas.map((s) => s.semana);
    const rell = rellenarHuecos(semanasIdx, tendencia.tasas);
    const tabSuav = tablaSuavizado(rell.valores, semanasIdx, { ventana: 3 });
    const suavizado = {
        ventana: tabSuav.ventana, alfa: tabSuav.alfa, semanas: semanasIdx, tasasRellenas: rell.valores,
        rellenadas: rell.rellenados.map((i) => semanasIdx[i]), sma: tabSuav.sma, ema: tabSuav.ema, wma: tabSuav.wma,
    };
    if (W > 0) {
        const pasosSuav = [{ titulo: 'Medias móviles de la tasa semanal', texto: 'SMA y WMA con ventana 3; EMA con α = 2/(n+1).', tabla: tabSuav.tabla }];
        if (rell.rellenados.length > 0) {
            pasosSuav.unshift({
                titulo: 'Semanas sin clase rellenadas por interpolación',
                texto: `Método: ${rell.metodo === 'spline' ? 'spline cúbico natural' : 'lineal'}. Estos valores no son observaciones.`,
                tabla: { columnas: ['semana', 'tasa interpolada'], filas: rell.rellenados.map((i) => [semanasIdx[i], rell.valores[i]]) },
            });
        }
        procedimientos.push({ id: 'suavizado', titulo: 'Suavizado', pasos: pasosSuav });
    }

    // ---- Proyección de la tasa semanal ----
    const proyeccion = {
        disponible: false, horizonte, grado: null, razon: null, modelo: null, candidatos: [], ajuste: [], puntos: [], mensaje: MSJ_INSUFICIENTE,
    };
    if (suficiente) {
        const pr = proyectarSerie({ x: xs, y: ys, horizonte });
        const lim01 = (v) => acotar(v, 0, 1);
        Object.assign(proyeccion, {
            disponible: true,
            grado: pr.elegido.grado,
            razon: pr.razon,
            modelo: { grado: pr.modelo.grado, coeficientes: pr.modelo.coeficientes, centro: pr.modelo.centro, escala: pr.modelo.escala, r2: pr.modelo.r2, errorEstandar: pr.modelo.errorEstandar },
            candidatos: pr.candidatos.map((c) => ({ grado: c.grado, r2: c.r2, r2Ajustado: c.r2Ajustado, aic: c.aic, errorEstandar: c.errorEstandar, errorLOO: c.errorLOO })),
            ajuste: pr.ajustados.map((p) => ({ semana: p.x, valor: p.valor })),
            puntos: pr.puntos.map((p) => ({ semana: p.x, valor: lim01(p.valor), inferior: lim01(p.inferior), superior: lim01(p.superior) })),
            mensaje: `Proyección a ${horizonte} semana(s) con modelo de grado ${pr.elegido.grado}. Es una estimación.`,
        });
        procedimientos.push({
            id: 'proyeccion',
            titulo: 'Proyección',
            pasos: [{
                titulo: 'Modelos candidatos (validación cruzada leave-one-out)',
                texto: pr.razon,
                tabla: {
                    columnas: ['grado', 'R²', 'R² ajustado', 'AIC', 'error estándar', 'RMSE LOO'],
                    filas: pr.candidatos.map((c) => [c.grado, c.r2, c.r2Ajustado, c.aic, c.errorEstandar, c.errorLOO]),
                },
            }],
        });
    }

    // ---- Cruce del límite sobre las faltas equivalentes acumuladas (promedio por alumno, % de programadas) ----
    const xsAc = semanas.map((s) => s.semana);
    const ysAc = semanas.map((s) => s.acumuladoPct);
    const cruceLimite = {
        estado: 'insuficiente', semana: null, t: null, mensaje: 'Datos insuficientes', limitePct, semanasTotales,
        acumulado: { semanas: xsAc, valores: ysAc }, ajuste: [], proyeccion: [], grado: null, biseccion: null, newton: null,
    };
    if (suficiente) {
        const pr = proyectarSerie({ x: xsAc, y: ysAc, horizonte });
        cruceLimite.grado = pr.elegido.grado;
        cruceLimite.ajuste = pr.ajustados.map((p) => ({ semana: p.x, valor: p.valor }));
        cruceLimite.proyeccion = pr.puntos.map((p) => ({ semana: p.x, valor: p.valor, inferior: p.inferior, superior: p.superior }));
        // Exactamente el límite conserva el derecho (RN-11): se supera solo si es estrictamente mayor.
        const primeraSuperada = semanas.find((s) => s.acumuladoPct > limitePct + 1e-9);
        if (primeraSuperada) {
            Object.assign(cruceLimite, { estado: 'superado', semana: primeraSuperada.semana, t: primeraSuperada.semana, mensaje: 'Ya superado' });
        } else {
            const r = buscarCruce(pr.modelo, limitePct, { desde: W, hasta: Math.max(semanasTotales, W + 1) });
            cruceLimite.biseccion = r.biseccion;
            cruceLimite.newton = r.newton;
            if (r.estado === 'cruza') {
                Object.assign(cruceLimite, { estado: 'cruza', t: r.t, semana: r.semana, mensaje: `Semana ${r.semana} (estimada)` });
            } else if (r.estado === 'superado') {
                // El ajuste ya está sobre el límite aunque lo observado todavía no: se anticipa a la próxima semana.
                Object.assign(cruceLimite, { estado: 'cruza', t: W, semana: W + 1, mensaje: `Semana ${W + 1} (estimada)` });
            } else {
                Object.assign(cruceLimite, { estado: 'no_cruza', mensaje: 'No cruza dentro del periodo' });
            }
        }
        if (cruceLimite.biseccion) {
            procedimientos.push({ id: 'cruce-biseccion', titulo: 'Cruce: bisección', pasos: [{ titulo: `Bisección sobre f(t) - ${limitePct} = 0`, texto: 'Se busca la semana t en que el ajuste del acumulado alcanza el límite.' }], traza: cruceLimite.biseccion.traza });
        }
        if (cruceLimite.newton && cruceLimite.newton.traza.length > 0) {
            procedimientos.push({ id: 'cruce-newton', titulo: 'Cruce: Newton-Raphson', pasos: [{ titulo: 'Newton-Raphson con derivada analítica del ajuste', texto: 'Parte del centro del corchete hallado por barrido.' }], traza: cruceLimite.newton.traza });
        }
    }

    // ---- Patrón por día de la semana ----
    const patronSemanal = patronPorDia(sesiones);

    // ---- Cambios de nivel (CUSUM y EWMA) sobre la tasa semanal ----
    const cambios = { disponible: false, semanaCambio: null, semanaDeteccion: null, direccion: null, mensaje: 'Se requieren al menos 6 semanas para detectar cambios de nivel.', cusum: null, ewma: null };
    if (suficiente && W >= 6) {
        const serieCtl = rell.valores.map((v) => v ?? 0);
        const cu = cusum(serieCtl);
        const ew = ewmaControl(serieCtl);
        cambios.disponible = true;
        cambios.cusum = { objetivo: cu.objetivo, sigma: cu.sigma, k: cu.k, h: cu.h, cambios: cu.cambios.map((c) => ({ ...c, semanaInicio: c.inicio + 1, semanaDeteccion: c.indice + 1 })) };
        cambios.ewma = { objetivo: ew.objetivo, sigma: ew.sigma, lambda: ew.lambda, L: ew.L, alarmas: ew.alarmas.map((i) => i + 1) };
        if (cu.cambios.length > 0) {
            const c = cu.cambios[0];
            Object.assign(cambios, { semanaCambio: c.inicio + 1, semanaDeteccion: c.indice + 1, direccion: c.direccion });
        } else if (ew.alarmas.length > 0) {
            const i = ew.alarmas[0];
            Object.assign(cambios, { semanaCambio: i + 1, semanaDeteccion: i + 1, direccion: ew.traza[i].fx > ew.objetivo ? 'alza' : 'baja' });
        }
        cambios.mensaje = cambios.semanaCambio === null
            ? 'No se detectaron cambios de nivel en la tasa semanal.'
            : `Cambio de nivel a la ${cambios.direccion} desde la semana ${cambios.semanaCambio} (detectado en la ${cambios.semanaDeteccion}).`;
        procedimientos.push({
            id: 'cambio-nivel',
            titulo: 'Cambio de nivel',
            pasos: [
                {
                    titulo: `CUSUM (objetivo ${cu.objetivo.toFixed(4)}, k = ${cu.k.toFixed(4)}, h = ${cu.h.toFixed(4)})`,
                    texto: 'S+ y S- acumulan desviaciones; hay alarma cuando superan h.',
                    tabla: { columnas: ['semana', 'tasa', 'S+', 'S-'], filas: cu.traza.map((r) => [r.iter + 1, r.x, r.sPos, r.sNeg]) },
                },
                {
                    titulo: `EWMA (λ = ${ew.lambda}, L = ${ew.L})`,
                    tabla: { columnas: ['semana', 'tasa', 'z', 'límite inf.', 'límite sup.'], filas: ew.traza.map((r) => [r.iter + 1, r.x, r.fx, r.limiteInferior, r.limiteSuperior]) },
                },
            ],
        });
    }

    // ---- Riesgo por alumno ----
    let evaluados = [];
    const m = entrada.matriz;
    if (m && Array.isArray(m.alumnos) && m.alumnos.length > 0) {
        const fechas = Array.isArray(m.fechas) ? m.fechas : [];
        evaluados = evaluarRiesgoGrupo(
            m.alumnos.map((a) => ({ idAlumno: a.idAlumno ?? a.id_alumno ?? null, matricula: a.matricula, nombre: a.nombre, estados: Array.isArray(a.estados) ? a.estados : [] })),
            { sesionesProgramadas: prog, limitePct, retardosPorAusencia: rpa, diasSemana: fechas.map(diaSemanaISO), sesionesPorSemana: spw ?? undefined, semanaActual: W || undefined },
        );
    }
    const alumnosEnRiesgo = evaluados.filter((a) => a.nivel !== 'bajo');
    const alumnosSuperanLimite = evaluados.filter((a) => a.superaLimite).length;
    procedimientos.push({
        id: 'riesgo',
        titulo: 'Riesgo del alumno',
        pasos: [{
            titulo: 'Factores del puntaje de riesgo (0-100)',
            texto: 'Cada alumno suma el aporte de siete factores explicables; el detalle de un alumno está en su fila de la tabla.',
            tabla: { columnas: ['factor', 'puntos máximos'], filas: Object.entries(PESOS_RIESGO) },
        }],
    });

    // ---- Derivación e integración de la tasa semanal ----
    let areaAusentismo = null;
    if (conDatos.length >= 2) {
        const tr = trapecioDatos(xs, ys);
        areaAusentismo = tr.valor;
        const pasosCalculo = [];
        if (ajusteTend) {
            const a = xs[0];
            const b = xs[xs.length - 1];
            const f = ajusteTend.predecir;
            const nSub = 2 * Math.max(1, Math.ceil(b - a));
            const sim = simpson13(f, a, b, nSub);
            const rom = romberg(f, a, b);
            pasosCalculo.push({
                titulo: 'Área bajo la curva (ausentismo acumulado en tasa·semanas)',
                texto: 'El trapecio usa los datos observados; Simpson y Romberg integran el ajuste lineal.',
                tabla: { columnas: ['método', 'valor'], filas: [['Trapecio (datos)', tr.valor], [`Simpson 1/3 (n = ${nSub})`, sim.valor], ['Romberg', rom.valor]] },
            });
            pasosCalculo.push(...rom.pasos);
            const ri = richardson(f, b, { h: 1, niveles: 4 });
            pasosCalculo.push({ titulo: 'Tasa de cambio en la última semana', texto: 'Derivada del ajuste: extrapolación de Richardson frente a la derivada analítica.', valores: [{ etiqueta: 'Richardson', valor: ri.valor }, { etiqueta: 'analítica', valor: ajusteTend.pendiente }] });
            pasosCalculo.push(...ri.pasos);
        }
        pasosCalculo.push({
            titulo: 'Tasa de cambio por semana (diferencias finitas)',
            tabla: { columnas: ['semana', 'puntos porcentuales por semana'], filas: tendencia.tasaCambio.map((r) => [r.semana, r.puntosPorSemana]) },
        });
        procedimientos.push({ id: 'derivacion-integracion', titulo: 'Derivación e integración', pasos: pasosCalculo });
    }

    const resumen = {
        suficiente,
        semanasObservadas: W,
        semanasConDatos: conDatos.length,
        sesionesCerradas: sesiones.length,
        sesionesProgramadas: progDefinida ? prog : null,
        inscritos: sesiones.length ? sesiones[sesiones.length - 1].inscritos : 0,
        tasaActual,
        tasaPrevia,
        variacionPP: tasaActual !== null && tasaPrevia !== null ? tasaActual - tasaPrevia : null,
        tasaPromedio: totalIns > 0 ? (100 * totalAus) / totalIns : null,
        acumuladoActualPct: W > 0 ? ysAc[W - 1] : null,
        limitePct,
        retardosPorAusencia: rpa,
        sesionesPorSemana: spw,
        semanasTotales: W > 0 ? semanasTotales : null,
        alumnosEvaluados: evaluados.length,
        alumnosEnRiesgo: alumnosEnRiesgo.length,
        alumnosSuperanLimite,
        areaAusentismo,
    };

    // ---- Alertas ----
    const alerta = (codigo, nivel, mensaje) => alertas.push({ codigo, nivel, mensaje });
    if (!suficiente) {
        alerta('DATOS_INSUFICIENTES', 'media', MSJ_INSUFICIENTE);
    }
    if (cruceLimite.estado === 'superado') {
        alerta('LIMITE_SUPERADO_GRUPO', 'alta', `El promedio de faltas equivalentes del grupo ya superó el límite de ${limitePct} %.`);
    } else if (cruceLimite.estado === 'cruza') {
        alerta('CRUCE_PROYECTADO', cruceLimite.semana - W <= 4 ? 'alta' : 'media', `La proyección indica que el promedio de faltas del grupo cruzará el límite de ${limitePct} % en la semana ${cruceLimite.semana}.`);
    }
    if (alumnosSuperanLimite > 0) {
        alerta('ALUMNOS_SUPERAN_LIMITE', 'alta', `${alumnosSuperanLimite} alumno(s) ya superaron el límite de ${limitePct} % de faltas.`);
    }
    const restantes = alumnosEnRiesgo.filter((a) => !a.superaLimite).length;
    if (restantes > 0) {
        alerta('ALUMNOS_EN_RIESGO', 'media', `${restantes} alumno(s) en riesgo de superar el límite; revise la tabla de riesgo.`);
    }
    if (tendencia.direccion === 'alza') {
        alerta('TENDENCIA_AL_ALZA', 'media', `El ausentismo semanal sube ${tendencia.pendientePuntosPorSemana.toFixed(1)} puntos porcentuales por semana.`);
    }
    if (cambios.semanaCambio !== null) {
        alerta('CAMBIO_DE_NIVEL', 'media', cambios.mensaje);
    }
    if (patronSemanal.diaCritico) {
        const d = patronSemanal.dias.find((x) => x.critico);
        alerta('DIA_CRITICO', 'info', `${d.nombre} concentra la mayor tasa de ausencia (${(d.tasa * 100).toFixed(1)} %).`);
    }
    if (sesiones.length > 0 && totalAus === 0 && totalRet === 0) {
        alerta('SIN_AUSENCIAS', 'info', 'El grupo no registra ausencias ni retardos en las sesiones cerradas.');
    }
    if (descartadas > 0 || rell.rellenados.length > 0) {
        alerta('DATOS_FALTANTES', 'info', `${descartadas} sesión(es) descartada(s) por datos inválidos y ${rell.rellenados.length} semana(s) sin clase rellenada(s) por interpolación.`);
    }
    if (!progDefinida && sesiones.length > 0) {
        alerta('PROGRAMADAS_NO_DEFINIDAS', 'info', 'No se indicaron las sesiones programadas: los porcentajes usan las sesiones cerradas como base.');
    }
    const orden = { alta: 0, media: 1, info: 2 };
    alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel]);

    return {
        resumen, tendencia, suavizado, proyeccion, cruceLimite, patronSemanal, cambios, alumnosEnRiesgo, alertas, procedimientos,
    };
}
