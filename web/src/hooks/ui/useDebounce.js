'use client';

import { useEffect, useState } from 'react';

// Devuelve `valor` solo después de que deja de cambiar durante `ms` milisegundos. Sirve para no consultar al servidor en cada
// tecla (búsquedas) ni validar campos remotos mientras la persona sigue escribiendo.
export function useDebounce(valor, ms = 300) {
    const [retrasado, setRetrasado] = useState(valor);
    useEffect(() => {
        const id = setTimeout(() => setRetrasado(valor), ms);
        return () => clearTimeout(id);
    }, [valor, ms]);
    return retrasado;
}

export default useDebounce;
