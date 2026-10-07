'use client';

import { useDebounce } from '@/hooks/ui/useDebounce.js';
import { useApiQuery } from '@/hooks/data';
import { alumnosListar } from '@/lib/api/admin.js';
import { PATRONES } from '@/lib/formularios/limites.js';
import { mayusculas, recortar } from '@/lib/formularios/texto.js';

// Comprueba en el servidor si la matrícula escrita ya existe, para avisar antes de la revisión y no después de «Crear alumno».
// Solo consulta cuando la matrícula tiene el formato correcto y la persona hizo una pausa (400 ms); lee con api_alumnos_listar
// (no escribe nada). Es una ayuda: la regla real es el DUPLICADO de api_alumno_guardar, que sigue mapeándose al campo.
//   -> { estado: 'idle' | 'comprobando' | 'libre' | 'duplicada', alumno }
export default function useMatriculaExistente(matricula) {
    const candidata = mayusculas(recortar(matricula));
    const valida = PATRONES.matricula.test(candidata) ? candidata : '';
    const pausada = useDebounce(valida, 400);
    const consulta = useApiQuery(alumnosListar, { q: pausada || undefined, limit: 5 }, { enabled: Boolean(pausada) });

    if (!valida) return { estado: 'idle', alumno: null };
    if (pausada !== valida || consulta.loading) return { estado: 'comprobando', alumno: null };
    // Un fallo de red no bloquea el alta: se calla y el servidor responde al enviar.
    if (consulta.error || !consulta.data) return { estado: 'idle', alumno: null };
    const alumno = (consulta.data.items ?? []).find((a) => a.matricula === valida) ?? null;
    return alumno ? { estado: 'duplicada', alumno } : { estado: 'libre', alumno: null };
}
