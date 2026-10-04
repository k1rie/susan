'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENTO_RELOJ_CAMBIO } from '@/hooks/data/eventos.js';
import { cambiarRelojDemo, leerRelojDemo } from '@/lib/local/relojCliente.js';
import {
    ALTO_FOTOGRAMA,
    ANCHO_FOTOGRAMA,
    CALIDAD_JPEG,
    CICLOS_POR_OMISION,
    debeAjustarReloj,
    descripcionDelFotograma,
    dibujarFotograma,
    ESCENARIO_POR_OMISION,
    horaDeClase,
    intervaloDemoSeg,
    MINUTO_DE_INICIO_DEMO,
    minutoDeClase,
    participantesDelAula,
    planDeCiclo,
    SALTO_RELOJ_MIN,
} from './simuladorCamara.utils.js';

// El reloj cambió por obra del simulador: se avisa igual que lo hace la tarjeta del reloj, para que toda consulta montada (monitor,
// panel) vuelva a pedir sus datos con la hora nueva.
const avisarCambioDeReloj = (detalle) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_RELOJ_CAMBIO, { detail: detalle }));
};

/**
 * Deja el reloj de demostración listo para muestrear con la cámara simulada:
 *  1. EN MARCHA. Con el reloj detenido todas las capturas llevarían la misma hora y el servidor, que es idempotente por (cámara, hora),
 *     contaría solo la primera.
 *  2. Si se pide y hace falta, en el minuto 2 de la clase (ver debeAjustarReloj): con el reloj en el 07:12 de la semilla, la primera
 *     lectura de todos caería después del límite de Presente y saldrían Retardos.
 * Se hace ANTES de la primera captura (la simulación solo se activa cuando esto termina), para no mandar lecturas con la hora equivocada.
 * @returns {Promise<{ avisos: string[] }>} lo que se cambió, en lenguaje llano
 * @throws {ApiError} si la ruta del reloj no existe (fuera del modo local) o falla
 */
export async function prepararReloj({ sesion, escenario, ajustar }) {
    const avisos = [];
    let estado = await leerRelojDemo();
    let cambio = false;
    if (!estado.corre) {
        estado = await cambiarRelojDemo({ correr: true });
        cambio = true;
        avisos.push('El reloj de demostración estaba detenido: lo pusimos en marcha para que cada captura lleve su propia hora (Pausar en la tarjeta del reloj lo detiene).');
    }
    if (ajustar) {
        const minuto = minutoDeClase(estado.ahora, sesion);
        const hora = horaDeClase(sesion, MINUTO_DE_INICIO_DEMO);
        if (hora && debeAjustarReloj({ escenario, minuto, limitePresenteMin: sesion?.limite_presente_min })) {
            estado = await cambiarRelojDemo({ fijar: hora });
            cambio = true;
            avisos.push(`Reloj puesto en el minuto ${MINUTO_DE_INICIO_DEMO} de la clase (${hora.slice(11)}) para que las primeras lecturas cuenten como Presente.`);
        }
    }
    if (cambio) avisarCambioDeReloj(estado);
    return { avisos };
}

// Lo que «ve» el simulador cuando está inerte (producción): nada. Evita calcular quién estaría en el aula en cada render.
const PLAN_INERTE = { ciclo: 0, rostros: [], alumnos: 0, visitantes: 0 };

function pintar(canvas, plan) {
    if (canvas.width !== ANCHO_FOTOGRAMA) canvas.width = ANCHO_FOTOGRAMA;
    if (canvas.height !== ALTO_FOTOGRAMA) canvas.height = ALTO_FOTOGRAMA;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('el navegador no permite dibujar en un lienzo');
    dibujarFotograma(ctx, plan);
}

const aBlobJpeg = (canvas) =>
    new Promise((resolver, rechazar) => {
        canvas.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('no se pudo codificar el fotograma'))), 'image/jpeg', CALIDAD_JPEG);
    });

/**
 * Estado y acciones de la cámara simulada (SOLO desarrollo local: `habilitado` = api_ahora().reloj_simulado). Cuando está activa,
 * `capturar()` devuelve un JPEG dibujado con los rostros sintéticos que el servicio de reconocimiento (EMBEDDER=fake) sí reconoce, y
 * el mismo lienzo (`ponerLienzo`, ref de callback para el <canvas>) sirve de vista previa. Determinista: el fotograma sale del número de ciclo, el escenario y los ids.
 *
 * Ciclo = un fotograma enviado. El escenario decide quién aparece en cada uno (ver rolDeAlumno); «Escalonados» además adelanta el reloj
 * antes de cada ciclo. Al llegar al límite de ciclos `capturar()` devuelve null (el muestreo omite el ciclo) hasta que se reinicie.
 *
 * @param {{ habilitado: boolean, camaraDisponible?: boolean, sesion: object, alumnos?: object[] }} p
 *   `camaraDisponible`: el aula tiene una cámara de navegador activa (el servidor no admite imagen subida para una cámara IP)
 */
export default function useSimuladorCamara({ habilitado, camaraDisponible = true, sesion, alumnos = [] }) {
    const [escenario, setEscenario] = useState(ESCENARIO_POR_OMISION);
    const [maxCiclos, setMaxCiclos] = useState(CICLOS_POR_OMISION);
    const [visitante, setVisitante] = useState(true);
    const [ajustarReloj, setAjustarReloj] = useState(true);
    const [encendido, setEncendido] = useState(false);
    const [preparando, setPreparando] = useState(false);
    const [ciclo, setCiclo] = useState(0);
    const [aviso, setAviso] = useState(null); // { tono: 'info' | 'warning', texto }
    const canvasRef = useRef(null);
    // Ref de callback: el <canvas> se monta en otro componente (LienzoSimulado) y avisa aqui; el objeto ref no sale del hook.
    const ponerLienzo = useCallback((elemento) => {
        canvasRef.current = elemento;
    }, []);
    const cicloRef = useRef(0);
    // «Época» de la simulación: sube al reiniciar los ciclos y al apagarla. Una captura que ya estaba en camino (esperando al reloj o a
    // codificar el JPEG) cuando eso pasó pertenece a la época anterior y no debe mover el contador de la nueva ni salir como fotograma.
    const epoca = useRef(0);
    // Numero de la ultima orden de encender/apagar: si se apaga mientras el reloj se prepara, el resultado tardio ya no se aplica.
    const orden = useRef(0);
    const vivo = useRef({});

    // En produccion (`habilitado` falso) el simulador es inerte: ni siquiera se calcula quien estaria en el aula.
    const participantes = habilitado ? participantesDelAula(alumnos) : [];
    const total = participantes.length;
    const claveAlumnos = participantes.map((a) => `${a.id_alumno}:${a.nombre}`).join('|');
    const limite = maxCiclos > 0 ? maxCiclos : null;
    const terminado = limite != null && ciclo >= limite;
    // Tras el último ciclo la vista se queda en el último fotograma enviado, no en uno que ya no se mandará.
    const cicloVisible = terminado ? ciclo - 1 : ciclo;
    const plan = habilitado ? planDeCiclo({ escenario, ciclo: cicloVisible, alumnos, visitante }) : PLAN_INERTE;
    const activo = habilitado && camaraDisponible && encendido && !preparando;

    useEffect(() => {
        vivo.current = { habilitado, sesion, alumnos, escenario, maxCiclos: limite, visitante, ajustarReloj };
    });

    // Vista previa: el fotograma del ciclo que se enviará a continuación. El lienzo existe solo mientras la simulación está encendida.
    useEffect(() => {
        if (!habilitado || !encendido) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { escenario: esc, visitante: vis, alumnos: lista } = vivo.current;
        try {
            pintar(canvas, planDeCiclo({ escenario: esc, ciclo: cicloVisible, alumnos: lista, visitante: vis }));
        } catch {
            // Sin lienzo utilizable no hay vista previa; capturar() lo avisa con un mensaje al intentar enviar.
        }
    }, [habilitado, encendido, cicloVisible, escenario, visitante, claveAlumnos]);

    const reiniciar = useCallback(() => {
        epoca.current += 1;
        cicloRef.current = 0;
        setCiclo(0);
    }, []);

    const encender = useCallback(async () => {
        // Defensa extra: fuera del desarrollo local (reloj real) no hay nada que encender ni ruta del reloj a la que llamar.
        if (!vivo.current.habilitado) return;
        const mia = ++orden.current;
        reiniciar();
        setAviso(null);
        setEncendido(true);
        setPreparando(true);
        let resultado;
        try {
            const { avisos } = await prepararReloj({ sesion: vivo.current.sesion, escenario: vivo.current.escenario, ajustar: vivo.current.ajustarReloj });
            resultado = avisos.length > 0 ? { tono: 'info', texto: avisos.join(' ') } : null;
        } catch (e) {
            resultado = { tono: 'warning', texto: `No se pudo preparar el reloj de demostración (${e?.message || 'error desconocido'}). Si las capturas se repiten, pulsa «Correr» en la tarjeta del reloj.` };
        }
        if (mia !== orden.current) return;
        setAviso(resultado);
        setPreparando(false);
    }, [reiniciar]);

    const apagar = useCallback(() => {
        orden.current += 1;
        epoca.current += 1;
        setEncendido(false);
        setPreparando(false);
        setAviso(null);
    }, []);

    const alternar = useCallback((valor) => (valor ? encender() : apagar()), [encender, apagar]);

    // Cambiar de escenario con la simulación en marcha la reinicia desde el ciclo 0 (las lecturas ya guardadas en el servidor no se borran).
    const cambiarEscenario = useCallback((id) => {
        setEscenario(id);
        reiniciar();
    }, [reiniciar]);

    const ponerRelojEnMarcha = useCallback(async () => {
        try {
            const estado = await cambiarRelojDemo({ correr: true });
            avisarCambioDeReloj(estado);
            setAviso({ tono: 'info', texto: 'Reloj de demostración en marcha: las siguientes capturas llevan cada una su hora.' });
        } catch (e) {
            setAviso({ tono: 'warning', texto: `No se pudo poner en marcha el reloj (${e?.message || 'error desconocido'}).` });
        }
    }, []);

    // Fotograma del ciclo en curso, para enviar. Devuelve null cuando ya se enviaron todos los ciclos pedidos.
    const capturar = useCallback(async () => {
        const { escenario: esc, maxCiclos: tope, visitante: vis, alumnos: lista } = vivo.current;
        const n = cicloRef.current;
        const mia = epoca.current;
        if (tope != null && n >= tope) return null;
        try {
            const salto = SALTO_RELOJ_MIN[esc] ?? 0;
            if (salto > 0 && n > 0) {
                // Un fallo del reloj no impide la captura: se avisa y el fotograma sale con la hora que haya.
                try {
                    avisarCambioDeReloj(await cambiarRelojDemo({ avanzarMin: salto }));
                } catch (e) {
                    setAviso({ tono: 'warning', texto: `No se pudo adelantar el reloj de demostración (${e?.message || 'error desconocido'}).` });
                }
            }
            if (mia !== epoca.current) return null; // se reinició o se apagó mientras el reloj se adelantaba
            // El lienzo de la vista previa si existe; si no (aún no montado), uno fuera de pantalla: el fotograma enviado es el mismo.
            const canvas = canvasRef.current ?? document.createElement('canvas');
            pintar(canvas, planDeCiclo({ escenario: esc, ciclo: n, alumnos: lista, visitante: vis }));
            const blob = await aBlobJpeg(canvas);
            if (mia !== epoca.current) return null;
            cicloRef.current = n + 1;
            setCiclo(n + 1);
            return blob;
        } catch (e) {
            setAviso({ tono: 'warning', texto: `No se pudo generar el fotograma simulado (${e?.message || 'error desconocido'}).` });
            return null;
        }
    }, []);

    return {
        habilitado,
        camaraDisponible,
        encendido,
        preparando,
        activo,
        escenario,
        cambiarEscenario,
        maxCiclos,
        setMaxCiclos,
        visitante,
        setVisitante,
        ajustarReloj,
        setAjustarReloj,
        ciclo,
        terminado,
        // La sesión ya pasó su tolerancia: aunque esté encendida, no se envía nada hasta que el reloj vuelva a un minuto dentro de la ventana.
        fueraDeVentana: sesion?.en_ventana === false,
        total,
        plan,
        descripcion: descripcionDelFotograma(plan),
        intervaloSeg: intervaloDemoSeg(sesion?.intervalo_muestreo_seg),
        aviso,
        encender,
        apagar,
        alternar,
        reiniciar,
        ponerRelojEnMarcha,
        capturar,
        ponerLienzo,
    };
}
