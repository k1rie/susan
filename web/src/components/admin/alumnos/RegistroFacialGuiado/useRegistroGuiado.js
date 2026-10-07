import { useState } from 'react';
import { siguientePaso } from './registroGuiado.utils.js';

/**
 * Máquina de pantallas del asistente de registro facial. Va encima de usePlantillaFacial (que guarda las tomas, las
 * verifica y registra): aquí solo se decide qué pantalla y qué paso se ven.
 *
 * Pantallas: intro -> captura (5 pasos) -> revision -> registrando -> listo; `archivo` es el camino alterno para subir fotos.
 * `registrando` y `listo` no se guardan: se derivan del estado del registro para que un error devuelva a la revisión
 * sin efectos ni banderas duplicadas.
 */
export default function useRegistroGuiado(p) {
    const [pantalla, setPantalla] = useState('intro');
    const [paso, setPaso] = useState(0);
    const [omitidos, setOmitidos] = useState(() => new Set());
    // Al repetir una toma desde la revisión, al terminar el paso se vuelve a la revisión en vez de seguir con los demás.
    const [retoma, setRetoma] = useState(false);

    const { envio, registro } = p;
    let visible = pantalla;
    if (pantalla === 'registrando') {
        if (envio.cargando) visible = 'registrando';
        else if (envio.error) visible = 'revision';
        else visible = registro ? 'listo' : 'revision';
    }

    const avanzar = (desde, omitidosAhora) => {
        const siguiente = retoma ? null : siguientePaso(desde, p.tomas, omitidosAhora);
        setRetoma(false);
        if (siguiente === null) setPantalla('revision');
        else setPaso(siguiente);
    };

    const comenzar = () => {
        p.setModo('camara');
        setRetoma(false);
        setPaso(siguientePaso(-1, p.tomas, omitidos) ?? 0);
        setPantalla('captura');
    };

    const irAArchivo = () => {
        p.setModo('archivo');
        setPantalla('archivo');
    };

    const pasoListo = () => avanzar(paso, omitidos);

    const omitirPaso = () => {
        // Omitir una toma que salió rechazada la descarta: no debe quedar marcada en la revisión.
        const rechazada = p.tomas.find((t) => t.paso === paso);
        if (rechazada) p.quitarToma(rechazada.id);
        const nuevos = new Set(omitidos).add(paso);
        setOmitidos(nuevos);
        avanzar(paso, nuevos);
    };

    // Repetir una toma o agregar una omitida: se vuelve a su paso en la cámara y, al aceptarse, a la revisión.
    const retomarPaso = (idToma, pasoARetomar) => {
        if (idToma != null) p.repetirToma(idToma);
        setOmitidos((previos) => {
            const nuevos = new Set(previos);
            nuevos.delete(pasoARetomar);
            return nuevos;
        });
        p.setModo('camara');
        setPaso(pasoARetomar);
        setRetoma(true);
        setPantalla('captura');
    };

    const empezarDeNuevo = () => {
        p.limpiar();
        setOmitidos(new Set());
        setRetoma(false);
        setPaso(0);
        setPantalla('captura');
        p.setModo('camara');
    };

    const irARevision = () => setPantalla('revision');
    const volverAIntro = () => setPantalla('intro');

    const registrar = (una = false) => {
        if (!(una ? p.puedeRegistrarUna : p.puedeRegistrar)) return;
        setPantalla('registrando');
        if (una) p.registrarUna();
        else p.registrar();
    };

    return {
        pantalla: visible, paso, omitidos,
        comenzar, irAArchivo, pasoListo, omitirPaso, retomarPaso, empezarDeNuevo, irARevision, volverAIntro, registrar,
    };
}
