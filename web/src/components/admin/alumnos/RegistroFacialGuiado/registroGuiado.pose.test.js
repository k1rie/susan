import { describe, expect, it } from 'vitest';
import { PASOS_TOMA } from '../CapturaGuiadaPlantilla/capturaGuiada.utils.js';
import { ALABEO_MAX, angulosDePersona, evaluarPose, RANGOS_POSE, SIGNO } from './registroGuiado.pose.js';

// El servicio manda los ángulos con SU signo; las pruebas hablan en el marco de la persona (giro > 0: a su izquierda; cabeceo > 0:
// arriba) y convierten con SIGNO, así siguen valiendo cuando la calibración cambie el signo.
const pose = (giro = 0, cabeceo = 0, alabeo = 0) => ({ giro: giro / SIGNO.giro, cabeceo: cabeceo / SIGNO.cabeceo, alabeo });

describe('rangos por paso', () => {
    it('hay un rango para cada paso de la captura', () => {
        PASOS_TOMA.forEach((p) => expect(RANGOS_POSE[p.clave], p.clave).toBeDefined());
    });

    it('izquierda y derecha son simétricas y quedan por debajo del giro que rechaza el control del conjunto (~36°)', () => {
        expect(RANGOS_POSE.izquierda.giro).toEqual(RANGOS_POSE.derecha.giro.map((v) => -v).reverse());
        expect(RANGOS_POSE.izquierda.giro[0]).toBeGreaterThan(RANGOS_POSE.frente.giro[1]); // hay que girar más que la tolerancia de «de frente»
        expect(Math.max(...RANGOS_POSE.izquierda.giro)).toBeLessThan(36);
        expect(RANGOS_POSE.arriba.cabeceo[0]).toBeGreaterThan(RANGOS_POSE.frente.cabeceo[1]);
    });
});

describe('angulosDePersona', () => {
    it('pasa los ángulos del servicio al marco de la persona y deja el alabeo igual', () => {
        expect(angulosDePersona({ giro: 10, cabeceo: -5, alabeo: 3 })).toEqual({ giro: 10 * SIGNO.giro, cabeceo: -5 * SIGNO.cabeceo, alabeo: 3 });
        expect(angulosDePersona(null)).toBeNull();
    });
});

describe('evaluarPose', () => {
    it('sin pose (embedder fake o servicio anterior) no exige nada', () => {
        expect(evaluarPose('izquierda', null)).toEqual({ ok: true, guia: null, angulos: null });
        expect(evaluarPose('izquierda', undefined).ok).toBe(true);
    });

    it('un paso desconocido no se exige', () => {
        expect(evaluarPose('otro', pose(80)).ok).toBe(true);
    });

    it('de frente: acepta casi centrada y corrige hacia el lado contrario del giro', () => {
        expect(evaluarPose('frente', pose(0, 0)).ok).toBe(true);
        expect(evaluarPose('frente', pose(8, -6)).ok).toBe(true);
        expect(evaluarPose('frente', pose(25)).guia).toBe('Mira de frente: gira un poco hacia tu derecha.');
        expect(evaluarPose('frente', pose(-25)).guia).toBe('Mira de frente: gira un poco hacia tu izquierda.');
    });

    it('izquierda: pide girar hacia la izquierda, ni poco ni demasiado', () => {
        expect(evaluarPose('izquierda', pose(20)).ok).toBe(true);
        expect(evaluarPose('izquierda', pose(0)).guia).toBe('Gira un poco más hacia tu izquierda.');
        expect(evaluarPose('izquierda', pose(5)).guia).toBe('Gira un poco más hacia tu izquierda.');
        expect(evaluarPose('izquierda', pose(-20)).guia).toBe('Gira un poco más hacia tu izquierda.'); // giró al lado contrario
        expect(evaluarPose('izquierda', pose(45)).guia).toBe('Giraste demasiado; vuelve un poco hacia el centro.');
    });

    it('derecha: el espejo de izquierda', () => {
        expect(evaluarPose('derecha', pose(-20)).ok).toBe(true);
        expect(evaluarPose('derecha', pose(0)).guia).toBe('Gira un poco más hacia tu derecha.');
        expect(evaluarPose('derecha', pose(20)).guia).toBe('Gira un poco más hacia tu derecha.');
        expect(evaluarPose('derecha', pose(-45)).guia).toBe('Giraste demasiado; vuelve un poco hacia el centro.');
    });

    it('arriba: pide levantar la barbilla sin girar la cabeza', () => {
        expect(evaluarPose('arriba', pose(0, 18)).ok).toBe(true);
        expect(evaluarPose('arriba', pose(0, 0)).guia).toBe('Levanta un poco más la barbilla.');
        expect(evaluarPose('arriba', pose(0, 45)).guia).toBe('Levantaste demasiado; baja un poco la barbilla.');
        expect(evaluarPose('arriba', pose(30, 18)).guia).toBe('Mira de frente: gira un poco hacia tu derecha.');
    });

    it('en los pasos de frente la barbilla muy arriba o muy abajo se corrige', () => {
        expect(evaluarPose('frente', pose(0, 30)).guia).toBe('Baja un poco la barbilla.');
        expect(evaluarPose('frente', pose(0, -30)).guia).toBe('Levanta un poco la barbilla.');
    });

    it('la cabeza ladeada (alabeo) se corrige en cualquier paso', () => {
        expect(evaluarPose('frente', pose(0, 0, ALABEO_MAX + 10)).guia).toBe('Endereza la cabeza.');
        expect(evaluarPose('izquierda', pose(20, 0, -(ALABEO_MAX + 10))).guia).toBe('Endereza la cabeza.');
        expect(evaluarPose('izquierda', pose(20, 0, ALABEO_MAX - 2)).ok).toBe(true);
    });

    it('con varias correcciones dice la del eje que más se sale', () => {
        // Giró lo suficiente pero la barbilla está muy abajo: la corrección importante es la barbilla.
        expect(evaluarPose('izquierda', pose(20, -40)).guia).toBe('Levanta un poco la barbilla.');
        // Casi no giró y la barbilla un poco fuera: importa más el giro.
        expect(evaluarPose('izquierda', pose(0, 22)).guia).toBe('Gira un poco más hacia tu izquierda.');
    });

    it('devuelve los ángulos en el marco de la persona', () => {
        expect(evaluarPose('izquierda', pose(20, 4)).angulos).toEqual({ giro: 20, cabeceo: 4, alabeo: 0 });
    });
});
