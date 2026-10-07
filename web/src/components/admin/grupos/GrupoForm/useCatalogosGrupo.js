'use client';

import { useCallback, useMemo } from 'react';
import { useApiQuery } from '@/hooks/data';
import { aulasListar, docentesListar, materiasListar } from '@/lib/api/admin.js';
import { opcionAula, opcionDocente, opcionMateria } from './grupoForm.utils.js';

const LIMITE = 200;
const LIMITE_BUSQUEDA = 20;

// Un catálogo para un Combobox. Hasta 200 registros se cargan completos y se filtran en memoria (abrir la lista ya muestra todo); si hay más
// (el servidor devuelve `total`), pasa solo a búsqueda remota por texto para no ofrecer una lista truncada sin avisar.
function useCatalogo(cargar, args, aOpcion) {
    const consulta = useApiQuery(cargar, { ...args, limit: LIMITE });
    const items = useMemo(() => consulta.data?.items ?? [], [consulta.data]);
    const total = consulta.data?.total ?? items.length;
    const options = useMemo(() => items.map(aOpcion), [items, aOpcion]);
    const clave = JSON.stringify(args ?? {});
    const loadOptions = useCallback(
        async (q) => {
            const r = await cargar({ ...JSON.parse(clave), q, limit: LIMITE_BUSQUEDA });
            return (r?.items ?? []).map(aOpcion);
        },
        [cargar, clave, aOpcion],
    );
    const truncado = total > items.length;
    return {
        cargando: consulta.loading,
        error: consulta.error,
        reintentar: consulta.refetch,
        total,
        vacio: consulta.data != null && total === 0,
        options,
        // Props para el Combobox según el modo.
        comboProps: truncado ? { loadOptions, hintText: 'Escribe al menos 2 caracteres para buscar.' } : { options },
    };
}

// Los tres catálogos del grupo: materias, docentes activos y aulas.
export function useCatalogosGrupo() {
    const materias = useCatalogo(materiasListar, undefined, opcionMateria);
    const docentes = useCatalogo(docentesListar, { estatus: 'activo' }, opcionDocente);
    const aulas = useCatalogo(aulasListar, undefined, opcionAula);
    return { materias, docentes, aulas, cargando: materias.cargando || docentes.cargando || aulas.cargando, error: materias.error || docentes.error || aulas.error };
}

export default useCatalogosGrupo;
