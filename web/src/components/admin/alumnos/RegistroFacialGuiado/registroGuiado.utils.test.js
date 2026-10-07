import { describe, expect, it } from 'vitest';
import { PASOS_TOMA } from '../CapturaGuiadaPlantilla/capturaGuiada.utils.js';
import {
    claseMarca, CLASE_MARCA, distanciaAngular, elementosRevision, enFoco, estadosDePasos, marcaLlena, MARCAS_ANILLO, motivoDeCalidad, motivoDeToma,
    NUM_MARCAS, RITMO_AUTOMATICO, siguientePaso, textosDeVista, tieneDireccion, vistaDePaso,
} from './registroGuiado.utils.js';

const toma = (id, paso, estado = 'aceptada', extra = {}) => ({ id, origen: paso == null ? 'archivo' : 'camara', paso, estado, blob: null, nombre: null, motivoCodigo: null, motivo: null, ...extra });
const ninguno = new Set();

describe('siguientePaso', () => {
    it('devuelve el primer paso sin toma después del indicado y null cuando no queda ninguno', () => {
        expect(siguientePaso(-1, [], ninguno)).toBe(0);
        expect(siguientePaso(0, [toma(1, 0)], ninguno)).toBe(1);
        expect(siguientePaso(1, [toma(1, 0), toma(2, 1), toma(3, 2)], ninguno)).toBe(3);
        expect(siguientePaso(4, [], ninguno)).toBeNull();
    });

    it('salta los pasos que ya tienen toma y los omitidos', () => {
        expect(siguientePaso(0, [toma(1, 0), toma(2, 1)], new Set([2]))).toBe(3);
        expect(siguientePaso(2, [toma(1, 0), toma(2, 1), toma(3, 2)], new Set([3, 4]))).toBeNull();
        // Una toma subida como archivo (sin paso) no ocupa ningún paso.
        expect(siguientePaso(-1, [toma(9, null)], ninguno)).toBe(0);
    });
});

describe('estadosDePasos', () => {
    it('marca hecho, verificando, error, actual, omitido y pendiente', () => {
        const tomas = [toma(1, 0), toma(2, 1, 'verificando'), toma(3, 2, 'calidad')];
        expect(estadosDePasos({ tomas, omitidos: new Set([3]), actual: 4 })).toEqual(['hecho', 'verificando', 'error', 'omitido', 'actual']);
        expect(estadosDePasos({ tomas: [], omitidos: ninguno, actual: -1 })).toEqual(['pendiente', 'pendiente', 'pendiente', 'pendiente', 'pendiente']);
    });

    it('un paso con toma no es el «actual» aunque coincida el índice', () => {
        expect(estadosDePasos({ tomas: [toma(1, 0, 'duplicada')], omitidos: ninguno, actual: 0 })[0]).toBe('error');
    });
});

describe('aro de marcas', () => {
    const marcasEnFoco = (clave) => MARCAS_ANILLO.filter((m) => enFoco(m, clave));

    it('tiene 60 marcas uniformes, índices únicos y todas dentro del círculo', () => {
        expect(MARCAS_ANILLO).toHaveLength(NUM_MARCAS);
        expect(new Set(MARCAS_ANILLO.map((m) => m.indice)).size).toBe(NUM_MARCAS);
        MARCAS_ANILLO.forEach((m) => {
            [m.x1, m.y1, m.x2, m.y2, m.x1f, m.y1f].forEach((v) => {
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(200);
            });
            // Cada marca va del radio interior (90) al exterior (98); las del foco, más largas, desde 85.
            expect(Math.hypot(m.x1 - 100, m.y1 - 100)).toBeCloseTo(90, 0);
            expect(Math.hypot(m.x2 - 100, m.y2 - 100)).toBeCloseTo(98, 0);
            expect(Math.hypot(m.x1f - 100, m.y1f - 100)).toBeCloseTo(85, 0);
        });
    });

    it('los grados van desde arriba en sentido horario: la marca 0 está arriba, la 15 a la derecha, la 30 abajo y la 45 a la izquierda', () => {
        const [arriba, derecha, abajo, izquierda] = [0, 15, 30, 45].map((i) => MARCAS_ANILLO[i]);
        expect(arriba.y2).toBeLessThan(100);
        expect(Math.abs(arriba.x2 - 100)).toBeLessThan(0.1);
        expect(derecha.x2).toBeGreaterThan(100);
        expect(abajo.y2).toBeGreaterThan(100);
        expect(izquierda.x2).toBeLessThan(100);
    });

    it('el foco de «izquierda» queda en el lado IZQUIERDO de la pantalla, el de «derecha» en el derecho y el de «arriba» arriba', () => {
        const izq = marcasEnFoco('izquierda');
        const der = marcasEnFoco('derecha');
        const arr = marcasEnFoco('arriba');
        [izq, der, arr].forEach((foco) => expect(foco).toHaveLength(15));
        expect(izq.every((m) => m.x2 < 100)).toBe(true);
        expect(der.every((m) => m.x2 > 100)).toBe(true);
        expect(arr.every((m) => m.y2 < 100)).toBe(true);
        // El centro del arco es la marca exactamente a las 9, a las 3 y a las 12 en punto.
        expect(izq.some((m) => m.grados === 270)).toBe(true);
        expect(der.some((m) => m.grados === 90)).toBe(true);
        expect(arr.some((m) => m.grados === 0)).toBe(true);
    });

    it('los tres arcos con dirección no se traslapan y dejan libre el de abajo', () => {
        const usados = ['izquierda', 'derecha', 'arriba'].flatMap((c) => marcasEnFoco(c).map((m) => m.indice));
        expect(new Set(usados).size).toBe(45);
        const abajo = MARCAS_ANILLO.filter((m) => !usados.includes(m.indice));
        expect(abajo.every((m) => m.y2 > 100)).toBe(true);
    });

    it('sin dirección (de frente, otra expresión, portada) se resalta el aro completo', () => {
        ['frente', 'variacion', null, undefined].forEach((c) => {
            expect(tieneDireccion(c)).toBe(false);
            expect(marcasEnFoco(c)).toHaveLength(NUM_MARCAS);
        });
    });

    it('las marcas fuera del foco quedan neutras sea cual sea el estado, y las del foco llevan el estado', () => {
        const fuera = MARCAS_ANILLO.find((m) => !enFoco(m, 'izquierda'));
        const dentro = MARCAS_ANILLO.find((m) => m.grados === 270);
        ['actual', 'verificando', 'hecho', 'error'].forEach((estado) => {
            expect(claseMarca(fuera, { clave: 'izquierda', estado })).toBe(CLASE_MARCA.fuera);
        });
        expect(claseMarca(dentro, { clave: 'izquierda', estado: 'actual' })).toBe(CLASE_MARCA.actual);
        expect(claseMarca(dentro, { clave: 'izquierda', estado: 'hecho' })).toBe(CLASE_MARCA.hecho);
        expect(claseMarca(dentro, { clave: 'izquierda', estado: 'error' })).toBe(CLASE_MARCA.error);
        expect(claseMarca(dentro, { clave: 'izquierda', estado: 'verificando' })).toBe(CLASE_MARCA.verificando);
        // Sin clave (portada, guardado) todo el aro lleva el estado.
        expect(claseMarca(fuera, { clave: null, estado: 'hecho' })).toBe(CLASE_MARCA.hecho);
    });

    it('el progreso llena el arco del centro hacia afuera y, sin dirección, el aro en sentido horario', () => {
        const llenas = (clave, progreso) => marcasEnFoco(clave).filter((m) => marcaLlena(m, clave, progreso));
        expect(llenas('izquierda', 0)).toHaveLength(0);
        expect(llenas('izquierda', 1)).toHaveLength(15);
        const mitad = llenas('izquierda', 0.5);
        expect(mitad.length).toBeGreaterThan(0);
        expect(mitad.length).toBeLessThan(15);
        // Simétrica respecto al centro (270°): por cada marca llena a un lado, su espejo también.
        expect(mitad.length % 2).toBe(1);
        expect(mitad.some((m) => m.grados === 270)).toBe(true);
        // Sin dirección: avanza por índice (horario desde arriba) y con progreso > 0 siempre hay al menos una.
        expect(llenas('frente', 0)).toHaveLength(0);
        expect(llenas('frente', 0.01)).toHaveLength(1);
        expect(llenas('frente', 0.5)).toHaveLength(30);
        expect(llenas('frente', 1)).toHaveLength(NUM_MARCAS);
        expect(marcaLlena(MARCAS_ANILLO[0], 'frente', 0.01)).toBe(true);
    });

    it('un paso en curso con progreso muestra lo llenado en azul y el resto del foco en tinta', () => {
        const centro = MARCAS_ANILLO.find((m) => m.grados === 270);
        const borde = MARCAS_ANILLO.find((m) => m.grados === 270 - 42);
        expect(claseMarca(centro, { clave: 'izquierda', estado: 'actual', progreso: 0.2 })).toBe(CLASE_MARCA.llena);
        expect(claseMarca(borde, { clave: 'izquierda', estado: 'actual', progreso: 0.2 })).toBe(CLASE_MARCA.actual);
        expect(claseMarca(borde, { clave: 'izquierda', estado: 'actual', progreso: 1 })).toBe(CLASE_MARCA.llena);
    });

    it('distanciaAngular da siempre la ruta corta', () => {
        expect(distanciaAngular(350, 10)).toBe(20);
        expect(distanciaAngular(0, 180)).toBe(180);
        expect(distanciaAngular(270, 270)).toBe(0);
        expect(distanciaAngular(10, 350)).toBe(20);
    });
});

describe('motivoDeToma', () => {
    it('traduce cada código del servicio a una frase con la acción a seguir', () => {
        expect(motivoDeToma(toma(1, 1, 'calidad', { motivoCodigo: 'POCA_LUZ' }))).toBe('Hay poca luz. Busca un lugar más iluminado.');
        expect(motivoDeToma(toma(1, 1, 'calidad', { motivoCodigo: 'ROSTRO_PEQUENO' }))).toBe('Acércate un poco más a la cámara.');
        expect(motivoDeToma(toma(1, 1, 'calidad', { motivoCodigo: 'BORROSA' }))).toBe('La foto salió borrosa. Mantén quieto el dispositivo.');
        expect(motivoDeToma(toma(1, 1, 'calidad', { motivoCodigo: 'MULTIPLES_ROSTROS' }))).toBe('Se ve más de una persona. Solo debe salir tu rostro.');
    });

    it('«no frontal» se explica distinto en el paso de frente y en los giros', () => {
        expect(motivoDeToma(toma(1, 0, 'calidad', { motivoCodigo: 'NO_FRONTAL' }))).toBe('Mira de frente a la cámara, sin girar la cabeza.');
        expect(motivoDeToma(toma(1, 1, 'calidad', { motivoCodigo: 'NO_FRONTAL' }))).toBe('Giraste demasiado. Gira solo un poco, sin dejar de ver la cámara.');
    });

    it('usa la frase del servicio si el código no se conoce y cubre los demás estados', () => {
        expect(motivoDeToma(toma(1, 1, 'calidad', { motivoCodigo: 'NUEVO', motivo: 'Otro motivo.' }))).toBe('Otro motivo.');
        expect(motivoDeToma(toma(1, 1, 'calidad'))).toBe('La foto no cumple la calidad mínima.');
        expect(motivoDeToma(toma(1, 1, 'inconsistente'))).toMatch(/No parece la misma persona/);
        expect(motivoDeToma(toma(1, 1, 'ilegible'))).toBe('No se pudo leer la imagen. Inténtalo de nuevo.');
        expect(motivoDeToma(toma(1, 1, 'duplicada'))).toMatch(/casi igual a otra toma/);
        expect(motivoDeToma(toma(1, 1, 'aceptada'))).toBe('');
        expect(motivoDeToma(null)).toBe('');
    });
});

describe('vistaDePaso y textosDeVista', () => {
    it('la toma del paso manda; sin toma se está buscando la foto', () => {
        expect(vistaDePaso({ toma: null })).toBe('espera');
        expect(vistaDePaso({ toma: toma(1, 0, 'verificando') })).toBe('verificando');
        expect(vistaDePaso({ toma: toma(1, 0, 'verificando'), fallo: true })).toBe('fallo');
        expect(vistaDePaso({ toma: toma(1, 0, 'aceptada'), fallo: true })).toBe('aceptada');
        expect(vistaDePaso({ toma: toma(1, 0, 'inconsistente') })).toBe('rechazada');
    });

    it('cada vista tiene su título y detalle', () => {
        const paso = PASOS_TOMA[1];
        expect(textosDeVista({ vista: 'espera', paso })).toEqual({ titulo: 'Gira a la izquierda', detalle: paso.indicacion });
        expect(textosDeVista({ vista: 'verificando', paso }).titulo).toBe('Verificando…');
        expect(textosDeVista({ vista: 'aceptada', paso, ultimo: false }).detalle).toBe('Pasamos a la siguiente.');
        expect(textosDeVista({ vista: 'aceptada', paso, ultimo: true }).detalle).toBe('Listo, vamos a revisar tus tomas.');
        expect(textosDeVista({ vista: 'rechazada', paso, toma: toma(1, 1, 'calidad', { motivoCodigo: 'BORROSA' }) }).titulo).toBe('Esta toma no sirve');
        expect(textosDeVista({ vista: 'fallo', paso, detalleFallo: 'El servicio no responde.' })).toEqual({ titulo: 'No pudimos verificar la toma', detalle: 'El servicio no responde.' });
    });

    it('en espera la guía en vivo sustituye a la indicación y «reteniendo» a la guía', () => {
        const paso = PASOS_TOMA[0];
        expect(textosDeVista({ vista: 'espera', paso, guia: 'Hay poca luz.' })).toEqual({ titulo: 'De frente', detalle: 'Hay poca luz.' });
        expect(textosDeVista({ vista: 'espera', paso, guia: 'Hay poca luz.', reteniendo: true })).toEqual({ titulo: 'De frente', detalle: 'Muy bien, mantén la posición…' });
    });
});

describe('motivoDeCalidad', () => {
    it('traduce el código del control de calidad de una foto', () => {
        expect(motivoDeCalidad({ codigo: 'SIN_ROSTRO' })).toBe('No vemos tu rostro. Colócalo dentro del círculo.');
        expect(motivoDeCalidad({ codigo: 'EXCESO_LUZ' })).toBe('Hay demasiada luz. Evita ventanas o focos detrás de ti.');
        expect(motivoDeCalidad({ codigo: 'NO_FRONTAL', clavePaso: 'frente' })).toBe('Mira de frente a la cámara, sin girar la cabeza.');
        expect(motivoDeCalidad({ codigo: 'NO_FRONTAL', clavePaso: 'izquierda' })).toBe('Giraste demasiado. Gira solo un poco, sin dejar de ver la cámara.');
    });

    it('sin código conocido usa la frase del servicio y, si tampoco hay, un texto genérico', () => {
        expect(motivoDeCalidad({ codigo: 'NUEVO', frase: 'Otra cosa.' })).toBe('Otra cosa.');
        expect(motivoDeCalidad({ codigo: null })).toBe('La foto no cumple la calidad mínima.');
    });
});

describe('RITMO_AUTOMATICO', () => {
    it('pide más de una muestra buena (la persona se queda quieta) y da tiempo de moverse entre pasos', () => {
        expect(RITMO_AUTOMATICO.aciertos).toBeGreaterThanOrEqual(2);
        expect(RITMO_AUTOMATICO.esperaPaso).toBeGreaterThan(RITMO_AUTOMATICO.intervalo);
        expect(RITMO_AUTOMATICO.demoraRechazo).toBeGreaterThan(RITMO_AUTOMATICO.demoraAceptada);
        expect(RITMO_AUTOMATICO.manualTrasFallos).toBeGreaterThan(0);
    });
});

describe('elementosRevision', () => {
    const numeros = (tomas) => new Map(tomas.map((t) => [t.id, t.paso == null ? 6 : t.paso + 1]));

    it('en cámara hay un elemento por paso (con su toma u omitido) y las subidas al final', () => {
        const tomas = [toma(1, 0), toma(2, 2), toma(3, null, 'aceptada', { nombre: 'a.jpg' })];
        const e = elementosRevision({ tomas, omitidos: new Set([3]), numeros: numeros(tomas), modo: 'camara' });
        expect(e.map((x) => x.clave)).toEqual(['paso-0', 'paso-1', 'paso-2', 'paso-3', 'paso-4', 'toma-3']);
        expect(e[0].toma.id).toBe(1);
        expect(e[1]).toMatchObject({ toma: null, omitido: false, paso: 1 });
        expect(e[3]).toMatchObject({ toma: null, omitido: true });
        expect(e[5]).toMatchObject({ titulo: 'a.jpg', paso: null, numero: 6 });
    });

    it('en archivo solo hay un elemento por toma, numerado por posición', () => {
        const tomas = [toma(1, null), toma(2, null)];
        const n = new Map([[1, 1], [2, 2]]);
        const e = elementosRevision({ tomas, omitidos: ninguno, numeros: n, modo: 'archivo' });
        expect(e.map((x) => [x.numero, x.titulo])).toEqual([[1, 'Foto 1'], [2, 'Foto 2']]);
    });
});
