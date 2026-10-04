import { describe, expect, it } from 'vitest';
import {
    anuncioCambios, aplicarRechazoRegistro, aplicarResultadoConjunto, codigoDeMotivo, esFotoAceptable, esServicioNoDisponible,
    estadoIndiceTrasRegistro, mensajeErrorPlantilla, resultadoDeToma, textoContador, textoEstadoToma, textoFotos, textoMotivo,
} from './plantillaFacial.utils.js';

const toma = (id, extra = {}) => ({ id, origen: 'archivo', paso: null, estado: 'verificando', motivoCodigo: null, motivo: null, cosenoResto: null, calidad: null, rostros: null, duplicadaDeId: null, ...extra });
const foto = (indice, extra = {}) => ({ indice, estado: 'aceptada', rostros: 1, calidad: { brillo: 100 }, motivo_rechazo: null, motivo_codigo: null, coseno_resto: 0.8, duplicada_de: null, ...extra });

describe('textoMotivo', () => {
    it('busca por código', () => {
        expect(textoMotivo('SIN_ROSTRO')).toBe('No se detectó ningún rostro.');
        expect(textoMotivo('MULTIPLES_ROSTROS')).toBe('Hay más de un rostro en la imagen.');
        expect(textoMotivo('ROSTRO_PEQUENO')).toBe('El rostro es muy pequeño; acérquese a la cámara.');
        expect(textoMotivo('NO_FRONTAL')).toBe('Mire de frente a la cámara.');
        expect(textoMotivo('POCA_LUZ')).toBe('Falta iluminación.');
        expect(textoMotivo('EXCESO_LUZ')).toBe('Exceso de luz o contraluz.');
        expect(textoMotivo('BORROSA')).toBe('La imagen está borrosa; mantenga quieta la cámara.');
        expect(textoMotivo('IMAGEN_INVALIDA')).toBe('No se pudo leer la imagen.');
    });
    it('en la captura guiada el giro excesivo se dice en «tú»', () => {
        expect(textoMotivo('NO_FRONTAL', { guiada: true })).toBe('Giraste demasiado; vuelve a mirar hacia la cámara.');
        expect(textoMotivo('POCA_LUZ', { guiada: true })).toBe('Falta iluminación.');
    });
    it('sin código conocido muestra la frase del servicio tal cual (sin «Calidad insuficiente»)', () => {
        expect(textoMotivo('La foto esta desenfocada.')).toBe('La foto esta desenfocada.');
        expect(textoMotivo('OTRO_CODIGO', { frase: 'Frase del servicio.' })).toBe('Frase del servicio.');
        expect(textoMotivo(null)).toBe('');
    });
});

describe('codigoDeMotivo', () => {
    it('prefiere motivo_codigo y acepta el código heredado en motivo_rechazo, no las frases', () => {
        expect(codigoDeMotivo({ motivo_codigo: 'BORROSA', motivo_rechazo: 'La foto esta desenfocada.' })).toBe('BORROSA');
        expect(codigoDeMotivo({ motivo_rechazo: 'POCA_LUZ' })).toBe('POCA_LUZ');
        expect(codigoDeMotivo({ motivo_rechazo: 'La foto esta muy oscura.' })).toBeNull();
        expect(codigoDeMotivo(null)).toBeNull();
    });
});

describe('esFotoAceptable (compatibilidad del camino de una foto)', () => {
    const BUENA = { rostros: 1, un_solo_rostro: true, motivo_rechazo: null };
    it('exige un rostro y sin motivo', () => {
        expect(esFotoAceptable(BUENA)).toBe(true);
        expect(esFotoAceptable({ ...BUENA, motivo_rechazo: 'BORROSA' })).toBe(false);
        expect(esFotoAceptable({ ...BUENA, un_solo_rostro: false })).toBe(false);
        expect(esFotoAceptable(null)).toBe(false);
    });
});

describe('mensajeErrorPlantilla', () => {
    it('FOTO_RECHAZADA usa motivo_codigo antes que la frase', () => {
        expect(mensajeErrorPlantilla({ code: 'FOTO_RECHAZADA', details: { motivo_codigo: 'NO_FRONTAL', motivo_rechazo: 'El rostro no esta de frente.' }, message: 'x' })).toBe('Mire de frente a la cámara.');
        expect(mensajeErrorPlantilla({ code: 'FOTO_RECHAZADA', details: { motivo_rechazo: 'NO_FRONTAL' }, message: 'x' })).toBe('Mire de frente a la cámara.');
        expect(mensajeErrorPlantilla({ code: 'FOTO_RECHAZADA', details: { motivo_rechazo: 'Frase nueva.' }, message: 'x' })).toBe('Frase nueva.');
        expect(mensajeErrorPlantilla({ code: 'FOTO_RECHAZADA', message: 'sin detalle' })).toBe('sin detalle');
    });
    it('códigos de las fotos múltiples', () => {
        expect(mensajeErrorPlantilla({ code: 'FOTOS_RECHAZADAS' })).toBe('Algunas fotos no sirven: repite las tomas marcadas.');
        expect(mensajeErrorPlantilla({ code: 'FOTOS_INSUFICIENTES', details: { minimo: 4 } })).toBe('Se necesitan al menos 4 fotos.');
        expect(mensajeErrorPlantilla({ code: 'FOTOS_INSUFICIENTES' })).toBe('Se necesitan al menos 3 fotos.');
        expect(mensajeErrorPlantilla({ code: 'FOTOS_DUPLICADAS' })).toBe('Hay fotos repetidas: usa tomas distintas.');
        expect(mensajeErrorPlantilla({ code: 'DEMASIADOS_ARCHIVOS' })).toBe('Máximo 8 fotos.');
        expect(mensajeErrorPlantilla({ code: 'ARCHIVO_DEMASIADO_GRANDE' })).toBe('Una foto pesa demasiado.');
    });
    it('servicio no disponible por código nuevo, antiguo o por estado 503', () => {
        const dicho = 'El servicio de reconocimiento no responde; reintente.';
        expect(mensajeErrorPlantilla({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'x' })).toBe(dicho);
        expect(mensajeErrorPlantilla({ status: 503, message: 'x' })).toBe(dicho);
        expect(esServicioNoDisponible({ code: 'RECONOCIMIENTO_NO_DISPONIBLE' })).toBe(true);
        expect(esServicioNoDisponible({ code: 'VALIDACION', status: 422 })).toBe(false);
    });
    it('sin error devuelve vacío y otros errores conservan su mensaje', () => {
        expect(mensajeErrorPlantilla(null)).toBe('');
        expect(mensajeErrorPlantilla({ code: 'RN_13_CONSENTIMIENTO_NO_VIGENTE', message: 'Consentimiento no vigente.' })).toBe('Consentimiento no vigente.');
    });
});

describe('estadoIndiceTrasRegistro', () => {
    it('lista, pendiente e indexando', () => {
        expect(estadoIndiceTrasRegistro({ estado: 'activada' })).toBe('lista');
        expect(estadoIndiceTrasRegistro({ estado: 'sin_cambios' })).toBe('lista');
        expect(estadoIndiceTrasRegistro({ estado: 'pendiente' })).toBe('pendiente');
        expect(estadoIndiceTrasRegistro({ estado: 'en_curso' })).toBe('indexando');
        expect(estadoIndiceTrasRegistro(undefined)).toBe('indexando');
    });
});

describe('textoEstadoToma', () => {
    const numeroDe = (id) => ({ 2: 4 })[id] ?? null;
    it('un texto por estado', () => {
        expect(textoEstadoToma(toma(1), numeroDe)).toBe('Verificando…');
        expect(textoEstadoToma(toma(1, { estado: 'aceptada' }))).toBe('Aceptada');
        expect(textoEstadoToma(toma(1, { estado: 'calidad', motivoCodigo: 'BORROSA' }))).toBe('La imagen está borrosa; mantenga quieta la cámara.');
        expect(textoEstadoToma(toma(1, { estado: 'calidad', motivo: 'Frase.' }))).toBe('Frase.');
        expect(textoEstadoToma(toma(1, { estado: 'calidad' }))).toBe('La foto no cumple la calidad mínima.');
        expect(textoEstadoToma(toma(1, { estado: 'inconsistente', motivoCodigo: 'NO_COINCIDE' }))).toBe('No parece la misma persona');
        expect(textoEstadoToma(toma(1, { estado: 'inconsistente', motivoCodigo: 'CONJUNTO_AMBIGUO' }))).toBe('Las tomas no coinciden entre sí');
        expect(textoEstadoToma(toma(1, { estado: 'ilegible' }))).toBe('No se pudo leer la imagen');
        expect(textoEstadoToma(toma(1, { estado: 'duplicada', duplicadaDeId: 2 }), numeroDe)).toBe('Igual a la toma 4');
        expect(textoEstadoToma(toma(1, { estado: 'duplicada', duplicadaDeId: 9 }), numeroDe)).toBe('Igual a otra toma');
    });
});

describe('aplicarResultadoConjunto', () => {
    it('aplica por snapshot de ids aunque haya huecos en el arreglo actual', () => {
        // Se enviaron las tomas 7 y 9; entre tanto llegó la 12, que no estaba en el envío y no se toca.
        const tomas = [toma(12), toma(7), toma(9)];
        const r = aplicarResultadoConjunto(tomas, [7, 9], { fotos: [foto(0), foto(1, { estado: 'calidad', motivo_codigo: 'POCA_LUZ', coseno_resto: null })] });
        expect(r.map((t) => [t.id, t.estado])).toEqual([[12, 'verificando'], [7, 'aceptada'], [9, 'calidad']]);
        expect(r[2].motivoCodigo).toBe('POCA_LUZ');
        expect(r[1].cosenoResto).toBe(0.8);
    });
    it('convierte duplicada_de (índice) en el id de la toma', () => {
        const r = aplicarResultadoConjunto([toma(7), toma(9)], [7, 9], { fotos: [foto(0), foto(1, { estado: 'duplicada', motivo_codigo: 'DUPLICADA', duplicada_de: 0, calidad: null, rostros: null })] });
        expect(r[1]).toMatchObject({ estado: 'duplicada', duplicadaDeId: 7 });
    });
    it('no muta la entrada ni toca tomas sin foto en la respuesta', () => {
        const tomas = [toma(1), toma(2)];
        const r = aplicarResultadoConjunto(tomas, [1, 2], { fotos: [foto(0)] });
        expect(tomas[0].estado).toBe('verificando');
        expect(r[0].estado).toBe('aceptada');
        expect(r[1]).toBe(tomas[1]);
    });
});

describe('aplicarRechazoRegistro', () => {
    it('FOTOS_RECHAZADAS: traduce details.fotos con el snapshot de ids del envío', () => {
        const tomas = [toma(3, { estado: 'aceptada' }), toma(5, { estado: 'aceptada' })];
        const r = aplicarRechazoRegistro(tomas, [5, 3], { fotos: [foto(0, { estado: 'inconsistente', motivo_codigo: 'NO_COINCIDE' }), foto(1)] });
        expect(r.find((t) => t.id === 5).estado).toBe('inconsistente');
        expect(r.find((t) => t.id === 3).estado).toBe('aceptada');
    });
    it('FOTOS_DUPLICADAS: marca la copia con la toma original', () => {
        const r = aplicarRechazoRegistro([toma(3), toma(5)], [3, 5], { duplicadas: [{ indice: 1, de: 0 }] });
        expect(r[1]).toMatchObject({ estado: 'duplicada', duplicadaDeId: 3 });
        expect(r[0].estado).toBe('verificando');
    });
    it('sin details devuelve lo mismo', () => {
        const tomas = [toma(1)];
        expect(aplicarRechazoRegistro(tomas, [1], undefined)).toBe(tomas);
        expect(aplicarRechazoRegistro(tomas, [1], {})).toBe(tomas);
    });
});

describe('anuncioCambios', () => {
    it('anuncia solo lo que cambió y no los estados «verificando»', () => {
        const antes = [toma(1, { estado: 'aceptada' }), toma(2), toma(3)];
        const despues = [toma(1, { estado: 'aceptada' }), toma(2, { estado: 'aceptada' }), toma(3, { estado: 'calidad', motivoCodigo: 'POCA_LUZ' })];
        const numero = (id) => id;
        expect(anuncioCambios(antes, despues, numero)).toBe('Toma 2 aceptada. Toma 3 no aceptada: falta iluminación.');
        expect(anuncioCambios(despues, despues, numero)).toBe('');
        expect(anuncioCambios(antes, antes, numero)).toBe('');
    });
});

describe('textoContador y textoFotos', () => {
    it('sin tomas pide el mínimo', () => {
        expect(textoContador({ total: 0, aceptadas: 0, marcadas: 0, minimo: 3 })).toBe('Captura al menos 3 tomas.');
    });
    it('con marcadas pide repetir o quitar; si solo falta cantidad dice cuántas', () => {
        expect(textoContador({ total: 4, aceptadas: 3, marcadas: 1, minimo: 3 })).toBe('Tomas aceptadas: 3 de 4 (mínimo 3). Repite o quita las tomas marcadas.');
        expect(textoContador({ total: 1, aceptadas: 1, marcadas: 0, minimo: 3 })).toBe('Tomas aceptadas: 1 de 1 (mínimo 3). Faltan 2 tomas aceptadas para registrar.');
        expect(textoContador({ total: 2, aceptadas: 2, marcadas: 0, minimo: 3 })).toBe('Tomas aceptadas: 2 de 2 (mínimo 3). Falta 1 toma aceptada para registrar.');
        expect(textoContador({ total: 5, aceptadas: 5, marcadas: 0, minimo: 3 })).toBe('Tomas aceptadas: 5 de 5 (mínimo 3).');
    });
    it('textoFotos concuerda en número', () => {
        expect(textoFotos(1)).toBe('1 foto');
        expect(textoFotos(5)).toBe('5 fotos');
    });
});

describe('resultadoDeToma', () => {
    it('adapta una toma a la forma que lee CalidadFotoResumen', () => {
        const r = resultadoDeToma(toma(1, { estado: 'calidad', rostros: 2, motivoCodigo: 'MULTIPLES_ROSTROS', motivo: 'Hay mas de un rostro en la foto.', cosenoResto: null }));
        expect(r).toMatchObject({ estado: 'calidad', rostros: 2, un_solo_rostro: false, motivo_codigo: 'MULTIPLES_ROSTROS', coseno_resto: null });
    });
});
