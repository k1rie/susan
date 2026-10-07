import { describe, expect, it } from 'vitest';
import {
    GRUPOS_PARAMETROS,
    META_PARAMETROS,
    agruparParametros,
    aNumero,
    esCritico,
    llevaDeslizador,
    mismoValor,
    nombreParametro,
    resumenLista,
    textoDeDeslizador,
    textoModificacion,
    textoRango,
    textoSinGuardar,
    unidadLegible,
    validarCoherencia,
    validarValor,
    valorDeFabrica,
    valorParaEnviar,
} from './parametros.utils.js';

const p = { clave: 'tolerancia_min', tipo: 'entero', unidad: 'min', minimo: '0', maximo: '60' };
const umbral = { clave: 'umbral_similitud', tipo: 'decimal', unidad: 'score', minimo: '0.500', maximo: '0.999', valor: '0.850' };

describe('parametros.utils', () => {
    it('validarValor exige número entero dentro de rango', () => {
        expect(validarValor(p, '25')).toBeNull();
        expect(validarValor(p, '2.5')).toBe('Debe ser un número entero.');
        expect(validarValor(p, '61')).toMatch(/Fuera de rango/);
        expect(validarValor(p, '  ')).toBe('El valor no puede estar en blanco.');
    });
    it('validarValor acepta coma decimal, limita a 3 decimales y rechaza lo que no es número', () => {
        expect(validarValor(umbral, '0.9')).toBeNull();
        expect(validarValor(umbral, '0,9')).toBeNull();
        expect(validarValor(umbral, '0.9005')).toBe('Usa hasta 3 decimales.');
        expect(validarValor(umbral, 'abc')).toBe('Debe ser un número.');
        expect(validarValor(umbral, '1')).toBe('Fuera de rango: de 0.500 a 0.999.');
        expect(validarValor(umbral, '0.499')).toMatch(/Fuera de rango/);
    });
    it('textoRango cubre mínimo, máximo, ambos y ninguno, con la unidad legible', () => {
        expect(textoRango(p)).toBe('de 0 a 60 min');
        expect(textoRango({ minimo: '1' })).toBe('mínimo 1');
        expect(textoRango({ maximo: '9', unidad: 's' })).toBe('máximo 9 s');
        expect(textoRango({})).toBe('sin rango');
        expect(textoRango({ minimo: '5', maximo: '120', unidad: 'segundos' })).toBe('de 5 a 120 s');
        expect(textoRango({ minimo: '1', maximo: '100', unidad: 'porcentaje' })).toBe('de 1 a 100 %');
        // «score» no es una unidad que la persona deba leer: el rango ya dice que es un puntaje.
        expect(textoRango(umbral)).toBe('de 0.500 a 0.999');
    });
    it('unidadLegible abrevia las conocidas y deja pasar las demás', () => {
        expect(unidadLegible('minutos')).toBe('min');
        expect(unidadLegible('dias')).toBe('días');
        expect(unidadLegible('score')).toBe('');
        expect(unidadLegible('furlongs')).toBe('furlongs');
        expect(unidadLegible(null)).toBe('');
    });
    it('resumenLista cuenta parámetros y críticos', () => {
        expect(esCritico('umbral_similitud')).toBe(true);
        expect(resumenLista([{ clave: 'umbral_similitud' }, { clave: 'tolerancia_min' }, { clave: 'dimension_vector' }])).toBe('3 parámetros, 2 críticos');
        expect(resumenLista([{ clave: 'x' }])).toBe('1 parámetro');
        expect(resumenLista([])).toBe('0 parámetros');
    });
});

describe('nombres y valores de fábrica', () => {
    it('cada parámetro conocido tiene nombre legible y valor de fábrica; el desconocido muestra su clave', () => {
        expect(nombreParametro('umbral_similitud')).toBe('Umbral de similitud');
        expect(nombreParametro('algo_nuevo')).toBe('algo_nuevo');
        expect(valorDeFabrica({ clave: 'umbral_similitud' })).toBe('0.850');
        expect(valorDeFabrica({ clave: 'algo_nuevo' })).toBeNull();
        // Si la API algún día manda el valor por defecto, manda ese.
        expect(valorDeFabrica({ clave: 'umbral_similitud', valor_defecto: '0.900' })).toBe('0.900');
    });
    it('los 12 parámetros de la base están en el catálogo y en algún grupo (nada queda sin sección)', () => {
        const claves = ['umbral_similitud', 'min_detecciones_validas', 'limite_presente_min', 'tolerancia_min', 'intervalo_muestreo_seg', 'horas_limite_correccion', 'retardos_por_ausencia', 'porcentaje_max_ausencias', 'dias_retencion_recortes', 'vigencia_url_firmada_seg', 'dimension_vector', 'minutos_pase_lista_base'];
        for (const c of claves) {
            expect(META_PARAMETROS[c], c).toBeTruthy();
            expect(GRUPOS_PARAMETROS.filter((g) => g.claves.includes(c)), c).toHaveLength(1);
        }
        expect(Object.keys(META_PARAMETROS).sort()).toEqual([...claves].sort());
    });
    it('agruparParametros respeta el orden de la API dentro de cada grupo, omite los vacíos y no pierde los desconocidos', () => {
        const items = [{ clave: 'tolerancia_min' }, { clave: 'umbral_similitud' }, { clave: 'raro' }, { clave: 'limite_presente_min' }];
        const grupos = agruparParametros(items);
        expect(grupos.map((g) => g.id)).toEqual(['reconocimiento', 'ventanas', 'otros']);
        expect(grupos[1].items.map((x) => x.clave)).toEqual(['tolerancia_min', 'limite_presente_min']);
        expect(grupos.flatMap((g) => g.items)).toHaveLength(4);
        expect(agruparParametros([])).toEqual([]);
        expect(agruparParametros(undefined)).toEqual([]);
    });
});

describe('texto y números', () => {
    it('aNumero admite coma decimal y rechaza lo demás', () => {
        expect(aNumero('0,85')).toBe(0.85);
        expect(aNumero(' 15 ')).toBe(15);
        expect(aNumero('1e3')).toBeNull();
        expect(aNumero('')).toBeNull();
        expect(aNumero('abc')).toBeNull();
    });
    it('valorParaEnviar recorta y cambia la coma por punto (el servidor solo admite punto)', () => {
        expect(valorParaEnviar(' 0,9 ')).toBe('0.9');
        expect(valorParaEnviar('15')).toBe('15');
    });
    it('mismoValor compara números, no texto: 0.85 es 0.850; un texto raro cuenta como cambio', () => {
        expect(mismoValor(umbral, '0.85')).toBe(true);
        expect(mismoValor(umbral, '0,850')).toBe(true);
        expect(mismoValor(umbral, '0.9')).toBe(false);
        expect(mismoValor(umbral, '')).toBe(false);
        expect(mismoValor(umbral, 'abc')).toBe(false);
        expect(mismoValor(umbral, '0.85', '0.9')).toBe(false);
    });
    it('deslizador solo en decimales con rango y escribe 3 decimales', () => {
        expect(llevaDeslizador(umbral)).toBe(true);
        expect(llevaDeslizador(p)).toBe(false);
        expect(llevaDeslizador({ tipo: 'decimal' })).toBe(false);
        expect(textoDeDeslizador('0.9')).toBe('0.900');
        expect(textoDeDeslizador(0.855)).toBe('0.855');
    });
});

describe('validarCoherencia (el límite de «presente» debe ser menor que la tolerancia)', () => {
    const todos = [
        { clave: 'limite_presente_min', valor: '10' },
        { clave: 'tolerancia_min', valor: '20' },
    ];
    it('avisa con el valor guardado del otro parámetro', () => {
        const limite = { clave: 'limite_presente_min' };
        const tolerancia = { clave: 'tolerancia_min' };
        expect(validarCoherencia(limite, '15', todos)).toBeNull();
        expect(validarCoherencia(limite, '20', todos)).toBe('Debe ser menor que la tolerancia de retardo (20 min).');
        expect(validarCoherencia(limite, '25', todos)).toMatch(/menor que la tolerancia/);
        expect(validarCoherencia(tolerancia, '30', todos)).toBeNull();
        expect(validarCoherencia(tolerancia, '10', todos)).toBe('Debe ser mayor que el límite para marcar presente (10 min).');
    });
    it('no inventa conflictos: otros parámetros, texto que no es número o falta el otro', () => {
        expect(validarCoherencia({ clave: 'umbral_similitud' }, '5', todos)).toBeNull();
        expect(validarCoherencia({ clave: 'limite_presente_min' }, 'abc', todos)).toBeNull();
        expect(validarCoherencia({ clave: 'limite_presente_min' }, '50', [])).toBeNull();
        expect(validarCoherencia({ clave: 'limite_presente_min' }, '50')).toBeNull();
    });
});

describe('textos de estado', () => {
    it('textoModificacion distingue el valor inicial de uno cambiado', () => {
        expect(textoModificacion({ actualizado_por: null, fecha_actualizacion: '2026-08-01T00:00:00Z' })).toBe('Valor inicial del sistema');
        expect(textoModificacion({ actualizado_por: { correo: 'ana@x.mx' }, fecha_actualizacion: '2026-03-12T10:00:00Z' })).toMatch(/^Cambiado el .+ por ana@x\.mx$/);
        expect(textoModificacion({ actualizado_por: { correo: 'ana@x.mx' }, fecha_actualizacion: 'no-es-fecha' })).toBe('Cambiado por ana@x.mx');
        expect(textoModificacion({ actualizado_por: {}, fecha_actualizacion: null })).toBe('Cambiado');
    });
    it('textoSinGuardar concuerda en número', () => {
        expect(textoSinGuardar(0)).toBeNull();
        expect(textoSinGuardar(1)).toBe('1 parámetro con cambios sin guardar');
        expect(textoSinGuardar(3)).toBe('3 parámetros con cambios sin guardar');
    });
});
