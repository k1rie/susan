// Pose por paso: ¿la persona está haciendo lo que pide la indicación?
//
// El servicio (POST /v1/photo/check, modelo de landmarks 3D de InsightFace) manda `pose` { cabeceo, giro, alabeo } en grados, CON
// SIGNO, medidos sobre la imagen SIN espejar (la que sale de la cámara; solo la vista previa va en espejo). Aquí se pasan al marco
// de la persona —giro > 0: hacia SU izquierda; cabeceo > 0: levanta la barbilla— y se comparan con el rango de cada paso.
//
// SIGNOS Y RANGOS PENDIENTES DE CALIBRAR con un rostro real (panel de pose del asistente, solo modo local): el signo depende de
// la convención del modelo y los rangos de lo que una persona hace cómodamente. Ver docs/api/biometria.md.

/** Multiplicador que lleva el ángulo del servicio al marco de la persona (ver arriba). */
export const SIGNO = { giro: 1, cabeceo: 1 };

// Rangos en grados, ya en el marco de la persona. `giro`/`cabeceo`: [mínimo, máximo]. El tope lateral queda por debajo del que
// rechaza el control del conjunto (razón de giro 0,40 ≈ 36°): una toma a 30° todavía pasa como «de frente» en la verificación final.
export const RANGOS_POSE = {
    frente: { giro: [-10, 10], cabeceo: [-12, 12] },
    izquierda: { giro: [14, 32], cabeceo: [-18, 18] },
    derecha: { giro: [-32, -14], cabeceo: [-18, 18] },
    arriba: { giro: [-15, 15], cabeceo: [14, 30] },
    variacion: { giro: [-20, 20], cabeceo: [-20, 20] },
};
// La cabeza ladeada (alabeo) se pide recta en todos los pasos: inclina la comparación y la foto.
export const ALABEO_MAX = 22;

/** Ángulos de la pose del servicio en el marco de la persona; null si no hay pose. */
export function angulosDePersona(pose) {
    if (!pose) return null;
    return { giro: pose.giro * SIGNO.giro, cabeceo: pose.cabeceo * SIGNO.cabeceo, alabeo: pose.alabeo };
}

const falta = (valor, [min, max]) => (valor < min ? min - valor : valor > max ? valor - max : 0);

// Qué decir según el eje que se sale del rango y hacia dónde. En los giros laterales se mide el avance en la dirección pedida
// (izquierda: valor; derecha: -valor) para que «poco» y «demasiado» signifiquen lo mismo en ambos lados.
function guiaDeGiro(clave, valor, [min, max]) {
    if (clave !== 'izquierda' && clave !== 'derecha') {
        return valor > max ? 'Mira de frente: gira un poco hacia tu derecha.' : 'Mira de frente: gira un poco hacia tu izquierda.';
    }
    const izquierda = clave === 'izquierda';
    const avance = izquierda ? valor : -valor;
    const [pide, tope] = izquierda ? [min, max] : [-max, -min];
    if (avance < pide) return `Gira un poco más hacia tu ${izquierda ? 'izquierda' : 'derecha'}.`;
    if (avance > tope) return 'Giraste demasiado; vuelve un poco hacia el centro.';
    return 'Mira un poco más de frente.';
}
function guiaDeCabeceo(clave, valor, [min, max]) {
    if (clave === 'arriba') return valor < min ? 'Levanta un poco más la barbilla.' : 'Levantaste demasiado; baja un poco la barbilla.';
    return valor > max ? 'Baja un poco la barbilla.' : 'Levanta un poco la barbilla.';
}

/**
 * Evalúa la pose de una muestra contra el paso. Sin pose (embedder fake, servicio anterior) no se exige nada: `ok` es true.
 * Devuelve { ok, guia, angulos } con `guia` = la corrección más importante (el eje que más se sale) o null.
 */
export function evaluarPose(clave, pose) {
    const angulos = angulosDePersona(pose);
    const rangos = RANGOS_POSE[clave];
    if (!angulos || !rangos) return { ok: true, guia: null, angulos };
    const faltas = [
        { eje: 'giro', f: falta(angulos.giro, rangos.giro) },
        { eje: 'cabeceo', f: falta(angulos.cabeceo, rangos.cabeceo) },
        { eje: 'alabeo', f: Math.max(0, Math.abs(angulos.alabeo) - ALABEO_MAX) },
    ];
    const peor = faltas.reduce((a, b) => (b.f > a.f ? b : a));
    if (peor.f <= 0) return { ok: true, guia: null, angulos };
    const guia = peor.eje === 'giro'
        ? guiaDeGiro(clave, angulos.giro, rangos.giro)
        : peor.eje === 'cabeceo'
            ? guiaDeCabeceo(clave, angulos.cabeceo, rangos.cabeceo)
            : 'Endereza la cabeza.';
    return { ok: false, guia, angulos };
}
