import { describe, expect, it } from 'vitest';
import { colorDeSemilla, esSemillaDeAlumno, semillaDeAlumno, semillaDeExtrano, semillaDeColor } from '@/lib/demo/semillas.js';
import { COLOR_MARCO, GROSOR_MARCO, LADO_MINIMO } from '@/lib/demo/rostro.js';
import {
    ALTO_FOTOGRAMA,
    ALTO_ROTULO,
    ANCHO_FOTOGRAMA,
    CICLOS_POR_OMISION,
    conteosEsperados,
    debeAjustarReloj,
    descripcionDelFotograma,
    dibujarFotograma,
    disposicionDeRostros,
    escenarioValido,
    ESCENARIOS,
    hayVisitanteEnCiclo,
    horaDeClase,
    iniciales,
    intervaloDemoSeg,
    minutoDeClase,
    OPCIONES_CICLOS,
    participantesDelAula,
    planDeCiclo,
    rellenarRuido,
    rolDeAlumno,
    SALTO_RELOJ_MIN,
    textoEsperado,
} from './simuladorCamara.utils.js';

const nombres = ['Ana Pérez', 'Beto Luna', 'Carla Díaz', 'Diego Ruiz', 'Elena Mora', 'Fabio Gil'];
const grupo = (n) => Array.from({ length: n }, (_, i) => ({ id_alumno: i + 1, nombre: nombres[i % nombres.length], inscripcion: 'activa' }));

describe('ritmo de muestreo con la cámara simulada', () => {
    it('es el mínimo seguro: intervalo/2 más 1 s (5 s no pasaría el limitador del servidor)', () => {
        expect(intervaloDemoSeg(15)).toBe(9);
        expect(intervaloDemoSeg(10)).toBe(6);
        // El servidor acepta 1 captura por cámara cada >= intervalo/2: 7,5 s con 15 s. 5 s se quedaría corto, 9 s no.
        expect(5).toBeLessThan((15 * 500) / 1000);
        expect(intervaloDemoSeg(15)).toBeGreaterThan((15 * 500) / 1000);
    });
    it('sin intervalo válido usa el de 15 s y nunca baja de 2 s', () => {
        expect(intervaloDemoSeg(undefined)).toBe(9);
        expect(intervaloDemoSeg(0)).toBe(9);
        expect(intervaloDemoSeg('x')).toBe(9);
        expect(intervaloDemoSeg(1)).toBe(2);
    });
});

describe('participantesDelAula', () => {
    it('solo inscritos activos con id que tenga semilla, ordenados por id', () => {
        const lista = participantesDelAula([
            { id_alumno: 9, nombre: 'Nueve', inscripcion: 'activa' },
            { id_alumno: 3, nombre: 'Tres' },
            { id_alumno: 5, nombre: 'Baja', inscripcion: 'baja' },
            { id_alumno: 0, nombre: 'Cero', inscripcion: 'activa' },
            { id_alumno: 99999, nombre: 'Fuera de rango', inscripcion: 'activa' },
            { id_alumno: '4', nombre: 'Texto', inscripcion: 'activa' },
        ]);
        expect(lista.map((a) => a.id_alumno)).toEqual([3, 9]);
    });
    it('tolera entradas que no son listas', () => {
        expect(participantesDelAula(undefined)).toEqual([]);
        expect(participantesDelAula(null)).toEqual([]);
    });
});

describe('iniciales', () => {
    it('toma las dos primeras palabras en mayúscula', () => {
        expect(iniciales('Ana Pérez López')).toBe('AP');
        expect(iniciales('  beto  luna ')).toBe('BL');
        expect(iniciales('Carla')).toBe('C');
    });
    it('sin nombre usa un signo de interrogación', () => {
        expect(iniciales('')).toBe('?');
        expect(iniciales(undefined)).toBe('?');
    });
});

describe('escenarios', () => {
    it('hay tres, con etiqueta, y el control de ciclos admite «sin límite»', () => {
        expect(ESCENARIOS.map((e) => e.etiqueta)).toEqual(['Todos llegan a tiempo', 'Llegan escalonados', 'Casos dudosos']);
        expect(escenarioValido('dudosos')).toBe(true);
        expect(escenarioValido('otro')).toBe(false);
        expect(OPCIONES_CICLOS).toContain(CICLOS_POR_OMISION);
        expect(OPCIONES_CICLOS).toContain(0);
    });

    it('a_tiempo: todos aparecen desde el primer ciclo y en todos', () => {
        for (let c = 0; c < 6; c += 1) expect(planDeCiclo({ escenario: 'a_tiempo', ciclo: c, alumnos: grupo(18), visitante: false }).alumnos).toBe(18);
    });

    it('escalonados: un tercio por ciclo (6, 12, 18) y se quedan', () => {
        const cuantos = (c) => planDeCiclo({ escenario: 'escalonados', ciclo: c, alumnos: grupo(18), visitante: false }).alumnos;
        expect([0, 1, 2, 3, 4].map(cuantos)).toEqual([6, 12, 18, 18, 18]);
    });

    it('dudosos: algunos salen tras 1 o 2 ciclos y el resto sigue', () => {
        const cuantos = (c) => planDeCiclo({ escenario: 'dudosos', ciclo: c, alumnos: grupo(18), visitante: false }).alumnos;
        expect([0, 1, 2, 3, 6].map(cuantos)).toEqual([18, 15, 12, 12, 12]);
        // Exactamente los que no llegan a 3 lecturas son los pendientes esperados.
        const lecturas = (i) => [0, 1, 2, 3, 4, 5].filter((c) => {
            const { llega, sale } = rolDeAlumno('dudosos', i, 18);
            return c >= llega && (sale == null || c < sale);
        }).length;
        const pocas = Array.from({ length: 18 }, (_, i) => lecturas(i)).filter((n) => n < 3);
        expect(pocas.sort()).toEqual([1, 1, 1, 2, 2, 2]);
        expect(conteosEsperados('dudosos', 18)).toEqual({ presentes: 12, retardos: 0, pendientes: 6 });
    });

    it('dudosos con grupos chicos siempre deja al menos un caso de 1 lectura (y de 2 si hay 3 o más)', () => {
        const pendientes = (n) => conteosEsperados('dudosos', n).pendientes;
        expect(pendientes(1)).toBe(0);
        expect(pendientes(2)).toBe(1);
        expect(pendientes(3)).toBe(2);
        expect(pendientes(4)).toBe(2);
        expect(pendientes(5)).toBe(2);
        // Coincide con lo que realmente dibuja el plan.
        const vistos = (n, c) => planDeCiclo({ escenario: 'dudosos', ciclo: c, alumnos: grupo(n), visitante: false }).alumnos;
        expect([vistos(5, 0), vistos(5, 1), vistos(5, 2)]).toEqual([5, 4, 3]);
    });

    it('el reparto no depende del orden en que llegan los alumnos', () => {
        const a = grupo(12);
        const ids = (alumnos) => planDeCiclo({ escenario: 'escalonados', ciclo: 0, alumnos, visitante: false }).rostros.map((r) => r.id_alumno);
        expect(ids([...a].reverse())).toEqual(ids(a));
    });

    it('conteos esperados: a_tiempo todos presentes; escalonados, la última tanda como retardo', () => {
        expect(conteosEsperados('a_tiempo', 18)).toEqual({ presentes: 18, retardos: 0, pendientes: 0 });
        expect(conteosEsperados('escalonados', 18)).toEqual({ presentes: 12, retardos: 6, pendientes: 0 });
        expect(conteosEsperados('escalonados', 0)).toEqual({ presentes: 0, retardos: 0, pendientes: 0 });
        expect(SALTO_RELOJ_MIN.escalonados).toBeGreaterThan(0);
        expect(SALTO_RELOJ_MIN.a_tiempo).toBe(0);
    });
});

describe('planDeCiclo', () => {
    it('cada alumno lleva la semilla con la que se registró y sus iniciales', () => {
        const plan = planDeCiclo({ escenario: 'a_tiempo', ciclo: 0, alumnos: grupo(6), visitante: false });
        expect(plan.rostros).toHaveLength(6);
        plan.rostros.forEach((r, i) => {
            expect(r.tipo).toBe('alumno');
            expect(r.semilla).toBe(semillaDeAlumno(i + 1));
            expect(esSemillaDeAlumno(r.semilla)).toBe(true);
            expect(r.etiqueta).toBe(iniciales(nombres[i]));
        });
    });

    it('el visitante pasa en los ciclos 1, 4, 7… con una semilla ajena a los alumnos y el rótulo «Visita»', () => {
        const con = (c) => planDeCiclo({ escenario: 'a_tiempo', ciclo: c, alumnos: grupo(4), visitante: true });
        expect([0, 1, 2, 3, 4].map((c) => hayVisitanteEnCiclo(c))).toEqual([false, true, false, false, true]);
        expect(con(0).visitantes).toBe(0);
        const plan = con(1);
        expect(plan.visitantes).toBe(1);
        const visita = plan.rostros.at(-1);
        expect(visita).toMatchObject({ tipo: 'visitante', etiqueta: 'Visita', semilla: semillaDeExtrano(1) });
        expect(esSemillaDeAlumno(visita.semilla)).toBe(false);
        expect(plan.alumnos).toBe(4);
    });

    it('sin la opción de visitante nunca aparece', () => {
        for (let c = 0; c < 8; c += 1) expect(planDeCiclo({ escenario: 'a_tiempo', ciclo: c, alumnos: grupo(3), visitante: false }).visitantes).toBe(0);
    });

    it('es determinista: mismos datos, mismo plan', () => {
        const p = { escenario: 'dudosos', ciclo: 1, alumnos: grupo(14), visitante: true };
        expect(planDeCiclo(p)).toEqual(planDeCiclo({ ...p }));
    });

    it('sin alumnos solo puede aparecer el visitante', () => {
        expect(planDeCiclo({ escenario: 'a_tiempo', ciclo: 0, alumnos: [], visitante: true }).rostros).toEqual([]);
        expect(planDeCiclo({ escenario: 'a_tiempo', ciclo: 1, alumnos: [], visitante: true }).rostros).toHaveLength(1);
    });
});

describe('disposicionDeRostros', () => {
    // Caja que ocupa cada rostro: el cuadrado más el rótulo de abajo.
    const cajas = (d) => d.rostros.map((p) => ({ x1: p.x, y1: p.y, x2: p.x + d.lado, y2: p.y + d.lado + ALTO_ROTULO }));
    const separacion = (a, b) => Math.max(b.x1 - a.x2, a.x1 - b.x2, b.y1 - a.y2, a.y1 - b.y2);

    it.each([1, 7, 18, 30, 45])('con %i rostros: caben todos, dentro del fotograma y sin tocarse', (n) => {
        const d = disposicionDeRostros(n);
        expect(d.rostros).toHaveLength(n);
        expect(d.omitidos).toBe(0);
        expect(d.lado).toBeGreaterThanOrEqual(LADO_MINIMO);
        const lista = cajas(d);
        lista.forEach((c) => {
            expect(c.x1).toBeGreaterThanOrEqual(0);
            expect(c.y1).toBeGreaterThanOrEqual(0);
            expect(c.x2).toBeLessThanOrEqual(ANCHO_FOTOGRAMA);
            expect(c.y2).toBeLessThanOrEqual(ALTO_FOTOGRAMA);
        });
        for (let i = 0; i < lista.length; i += 1) {
            for (let j = i + 1; j < lista.length; j += 1) expect(separacion(lista[i], lista[j])).toBeGreaterThanOrEqual(16);
        }
    });

    it('usa el lado más grande posible: pocos rostros, grandes; muchos, más chicos', () => {
        expect(disposicionDeRostros(3).lado).toBeGreaterThan(disposicionDeRostros(45).lado);
    });

    it('sin rostros no hay nada que repartir', () => {
        expect(disposicionDeRostros(0)).toMatchObject({ rostros: [], omitidos: 0 });
    });

    it('si no caben ni con el lado menor, dibuja los que quepan y dice cuántos omitió', () => {
        const d = disposicionDeRostros(400);
        expect(d.omitidos).toBeGreaterThan(0);
        expect(d.rostros.length + d.omitidos).toBe(400);
        expect(d.lado).toBe(40);
    });
});

describe('rellenarRuido', () => {
    it('gris suave (128 ± 6), opaco y reproducible por semilla', () => {
        const a = rellenarRuido(new Uint8ClampedArray(4 * 4000), 3);
        const b = rellenarRuido(new Uint8ClampedArray(4 * 4000), 3);
        const c = rellenarRuido(new Uint8ClampedArray(4 * 4000), 4);
        expect([...a]).toEqual([...b]);
        expect([...a]).not.toEqual([...c]);
        for (let i = 0; i < a.length; i += 4) {
            expect(a[i]).toBe(a[i + 1]);
            expect(a[i]).toBe(a[i + 2]);
            expect(a[i]).toBeGreaterThanOrEqual(122);
            expect(a[i]).toBeLessThanOrEqual(134);
            expect(a[i + 3]).toBe(255);
        }
    });
});

// Contexto 2D falso que anota lo que se pinta (jsdom no trae canvas).
function contextoFalso() {
    const llamadas = [];
    const ctx = {
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        createImageData: (ancho, alto) => ({ width: ancho, height: alto, data: new Uint8ClampedArray(ancho * alto * 4) }),
        putImageData: (imagen) => llamadas.push({ op: 'fondo', imagen }),
        fillRect: (x, y, ancho, alto) => llamadas.push({ op: 'rect', x, y, ancho, alto, color: ctx.fillStyle }),
        fillText: (texto, x, y) => llamadas.push({ op: 'texto', texto, x, y, color: ctx.fillStyle }),
    };
    return { ctx, llamadas };
}

describe('dibujarFotograma', () => {
    const plan = planDeCiclo({ escenario: 'a_tiempo', ciclo: 1, alumnos: grupo(6), visitante: true });
    const { ctx, llamadas } = contextoFalso();
    const resultado = dibujarFotograma(ctx, plan);
    const rects = llamadas.filter((l) => l.op === 'rect');
    const textos = llamadas.filter((l) => l.op === 'texto');

    it('pinta primero el fondo con ruido y luego, por rostro, marco + interior + rótulo', () => {
        expect(llamadas[0].op).toBe('fondo');
        expect(llamadas[0].imagen.width).toBe(ANCHO_FOTOGRAMA);
        expect(llamadas[0].imagen.height).toBe(ALTO_FOTOGRAMA);
        expect(resultado).toMatchObject({ dibujados: 7, omitidos: 0 });
        expect(rects).toHaveLength(14);
        expect(textos).toHaveLength(7);
    });

    it('el marco es el magenta de 4 px y el interior lleva el color de la semilla (lo que lee el detector)', () => {
        plan.rostros.forEach((rostro, i) => {
            const marco = rects[2 * i];
            const interior = rects[2 * i + 1];
            expect(marco.color).toBe(`rgb(${COLOR_MARCO.join(', ')})`);
            expect(marco.ancho).toBe(resultado.lado);
            expect(marco.alto).toBe(resultado.lado);
            expect(interior.x).toBe(marco.x + GROSOR_MARCO);
            expect(interior.y).toBe(marco.y + GROSOR_MARCO);
            expect(interior.ancho).toBe(resultado.lado - 2 * GROSOR_MARCO);
            expect(interior.color).toBe(`rgb(${colorDeSemilla(rostro.semilla).join(', ')})`);
            // El detector (color_to_seed) recupera la misma semilla desde el color pintado.
            expect(semillaDeColor(colorDeSemilla(rostro.semilla))).toBe(rostro.semilla);
        });
    });

    it('cada rótulo va DEBAJO de su cuadrado y nunca sobre un marco o un interior', () => {
        plan.rostros.forEach((rostro, i) => {
            const marco = rects[2 * i];
            expect(textos[i].texto).toBe(rostro.etiqueta);
            expect(textos[i].y).toBeGreaterThan(marco.y + marco.alto);
            expect(textos[i].x).toBe(marco.x + marco.ancho / 2);
        });
        // Ni la línea de base ni los ~15 px de la letra (arriba de ella) tocan ningún cuadrado.
        for (const t of textos) {
            for (let i = 0; i < rects.length; i += 2) {
                const m = rects[i];
                const sobre = t.y - 15 < m.y + m.alto && t.y > m.y && t.x > m.x && t.x < m.x + m.ancho;
                expect(sobre).toBe(false);
            }
        }
    });

    it('el rótulo no es magenta ni se parece al marco', () => {
        for (const t of textos) expect(t.color).not.toBe('rgb(255, 0, 255)');
    });

    it('un visitante se pinta con su propia semilla, distinta de la de cualquier alumno', () => {
        const colores = rects.filter((_, i) => i % 2 === 1).map((r) => r.color);
        expect(new Set(colores).size).toBe(colores.length);
    });

    it('sin rostros solo pinta el fondo', () => {
        const { ctx: otro, llamadas: l2 } = contextoFalso();
        expect(dibujarFotograma(otro, { ciclo: 0, rostros: [], alumnos: 0, visitantes: 0 })).toMatchObject({ dibujados: 0 });
        expect(l2.map((l) => l.op)).toEqual(['fondo']);
    });
});

describe('reloj de la clase', () => {
    const sesion = { fecha: '2026-09-14', hora_inicio: '07:00:00', limite_presente_min: 10 };
    it('minuto de la clase a partir del ISO del reloj (negativo antes de empezar)', () => {
        expect(minutoDeClase('2026-09-14T07:12:00-06:00', sesion)).toBe(12);
        expect(minutoDeClase('2026-09-14T06:45:00-06:00', sesion)).toBe(-15);
        expect(minutoDeClase('2026-09-14T13:03:30Z', sesion)).toBe(3.5);
    });
    it('null si no se puede calcular', () => {
        expect(minutoDeClase('no es fecha', sesion)).toBeNull();
        expect(minutoDeClase('2026-09-14T07:12:00-06:00', {})).toBeNull();
    });
    it('hora fijable del minuto N de la clase (hora de la sede)', () => {
        expect(horaDeClase(sesion, 2)).toBe('2026-09-14 07:02');
        expect(horaDeClase({ ...sesion, hora_inicio: '08:55:00' }, 10)).toBe('2026-09-14 09:05');
        expect(horaDeClase({ fecha: '2026-09-14', hora_inicio: '23:50:00' }, 30)).toBe('2026-09-14 23:59');
        expect(horaDeClase({ hora_inicio: '07:00' }, 2)).toBeNull();
        expect(horaDeClase({ fecha: '2026-09-14' }, 2)).toBeNull();
    });
    it('ajusta el reloj: siempre en escalonados; en los demás solo si ya no queda margen o la clase no empieza', () => {
        expect(debeAjustarReloj({ escenario: 'escalonados', minuto: 3, limitePresenteMin: 10 })).toBe(true);
        expect(debeAjustarReloj({ escenario: 'a_tiempo', minuto: 3, limitePresenteMin: 10 })).toBe(false);
        expect(debeAjustarReloj({ escenario: 'a_tiempo', minuto: 7, limitePresenteMin: 10 })).toBe(false);
        expect(debeAjustarReloj({ escenario: 'a_tiempo', minuto: 7.5, limitePresenteMin: 10 })).toBe(true);
        expect(debeAjustarReloj({ escenario: 'dudosos', minuto: 12, limitePresenteMin: 10 })).toBe(true);
        expect(debeAjustarReloj({ escenario: 'dudosos', minuto: -4, limitePresenteMin: 10 })).toBe(true);
        expect(debeAjustarReloj({ escenario: 'a_tiempo', minuto: null, limitePresenteMin: 10 })).toBe(false);
        expect(debeAjustarReloj({ escenario: 'a_tiempo', minuto: 12 })).toBe(true);
    });
});

describe('textos', () => {
    it('a_tiempo: dice en cuánto tiempo pasan a Presente y el resultado esperado', () => {
        const t = textoEsperado({ escenario: 'a_tiempo', intervaloSeg: 9, total: 18 });
        expect(t).toContain('En unos 20 s todos los alumnos pasan a Presente');
        expect(t).toContain('18 Presentes');
        expect(t).toContain('visitante');
    });
    it('escalonados: tandas, retardo de la última y salto de reloj', () => {
        const t = textoEsperado({ escenario: 'escalonados', intervaloSeg: 9, total: 18 });
        expect(t).toContain('tres tandas');
        expect(t).toContain('tercera en Retardo');
        expect(t).toContain('4 min');
        expect(t).toContain('12 Presentes · 6 Retardos');
    });
    it('dudosos: pendientes al cerrar', () => {
        const t = textoEsperado({ escenario: 'dudosos', intervaloSeg: 9, total: 18, visitante: false });
        expect(t).toContain('Pendientes de revisión');
        expect(t).toContain('6 Pendientes de revisión al cerrar');
        expect(t).not.toContain('visitante');
    });
    it('sin ajustar el reloj no promete un resultado exacto', () => {
        const t = textoEsperado({ escenario: 'a_tiempo', intervaloSeg: 9, total: 18, reloj: false });
        expect(t).toContain('según la hora del reloj');
        expect(t).not.toContain('Resultado esperado');
    });
    it('descripción del fotograma: cuántos alumnos y visitantes', () => {
        expect(descripcionDelFotograma({ ciclo: 0, alumnos: 12, visitantes: 0 })).toContain('ciclo 1: 12 alumnos.');
        expect(descripcionDelFotograma({ ciclo: 1, alumnos: 1, visitantes: 1 })).toContain('1 alumno y un visitante');
    });
});
