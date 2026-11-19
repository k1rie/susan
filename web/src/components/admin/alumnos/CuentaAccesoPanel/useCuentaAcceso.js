'use client';

import { useApiQuery } from '@/hooks/data';
import { usuariosListar } from '@/lib/api/admin.js';

// Estado de la cuenta de acceso de un alumno. La ficha del alumno (api_alumno_obtener) no dice si tiene cuenta, así que se pregunta al
// listado de cuentas (administrador) buscando por su matrícula y quedándose con la que está vinculada a ESTE alumno: la búsqueda de
// texto puede traer otras matrículas parecidas.
//   alumno -> { id_alumno, matricula } o null mientras la ficha carga.
//   -> { estado: 'cargando' | 'error' | 'sin' | 'activa' | 'inactiva', cuenta, error, refetch }
export default function useCuentaAcceso(alumno) {
    const consulta = useApiQuery(
        usuariosListar,
        { q: alumno?.matricula, rol: 'alumno', limit: 50 },
        { enabled: Boolean(alumno?.matricula) },
    );
    const cuenta = consulta.data?.items?.find((u) => u.id_alumno === alumno?.id_alumno) ?? null;
    let estado;
    if (!alumno?.matricula || (consulta.loading && !consulta.data)) estado = 'cargando';
    else if (consulta.error && !consulta.data) estado = 'error';
    else if (!cuenta) estado = 'sin';
    else estado = cuenta.activo ? 'activa' : 'inactiva';
    return { estado, cuenta, error: consulta.error, refetch: consulta.refetch };
}
