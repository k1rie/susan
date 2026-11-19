'use client';

import { useCallback, useState } from 'react';
import { completarRestantes, contarCambios, marcasIniciales, textoMarcado } from './paseListaManual.utils.js';

// Estado local del pase manual: las marcas viven aquí hasta guardarlas (por eso hay «cambios sin guardar»).
//   marcas     = { [id_alumno]: estado } lo que se ve en pantalla.
//   guardadas  = lo que ya tiene el servidor (de partida, lo que trae el monitor; después, lo último que se guardó).
//   aviso      = resultado de la última acción en bloque, con lo necesario para deshacerla.
// El servidor no sabe «desmarcar»: por eso «Limpiar» vuelve a lo guardado en lugar de vaciar todo.
export default function usePaseListaManual({ activos, sugerido }) {
    const [marcas, setMarcas] = useState(() => marcasIniciales(activos));
    const [guardadas, setGuardadas] = useState(marcas);
    const [aviso, setAviso] = useState(null); // { texto, previa }

    const cambios = contarCambios(marcas, guardadas);

    const marcar = useCallback((idAlumno, estado) => {
        setAviso(null);
        setMarcas((previas) => ({ ...previas, [idAlumno]: estado }));
    }, []);

    // Una acción en bloque es de un toque y puede equivocarse de alcance: se anuncia y se puede deshacer.
    const completar = (estado) => {
        const r = completarRestantes(activos, marcas, estado);
        if (!r.afectados) return;
        setAviso({ texto: textoMarcado(r.afectados, estado), previa: marcas });
        setMarcas(r.marcas);
    };

    const marcarRestantesSegunHora = () => completar(sugerido);
    const todosPresentes = () => completar('presente');

    const limpiar = () => {
        if (!cambios) return;
        setAviso({ texto: 'Se quitaron las marcas sin guardar.', previa: marcas });
        setMarcas(guardadas);
    };

    const deshacer = () => {
        if (!aviso) return;
        setMarcas(aviso.previa);
        setAviso(null);
    };

    // Lo que se acaba de enviar al servidor pasa a ser «lo guardado» (no se pregunta al salir después de guardar).
    const confirmarGuardado = useCallback((instantanea) => {
        setGuardadas(instantanea);
        setAviso(null);
    }, []);

    return { marcas, guardadas, cambios, sucio: cambios > 0, aviso, marcar, todosPresentes, marcarRestantesSegunHora, limpiar, deshacer, confirmarGuardado };
}
